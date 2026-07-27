---
id: T-069
title: Social RLS ownership checks can never match, and three tables have missing or disabled policies
status: in-progress
severity: high
area: social
epic: E-008
created: 2026-07-27
---

## Approach chosen, and a correction (2026-07-27)

Option A as originally written below is **wrong** and should not be applied. It
would have made `DELETE` on `post_votes` `USING (true)`, which lets anyone
holding the anon key delete every vote in the database. The justification given
for it ("the ownership checks provide no real protection anyway") conflated
vote stuffing, which is already possible, with mass deletion, which is not. It
also left post editing broken, since it only touched the vote and flag
policies.

Implemented instead: extend the SECURITY DEFINER RPC pattern the codebase
already uses. `soft_delete_post` and `soft_delete_comment` take the caller's
claimed session id and filter on it internally, which is exactly why deleting
is the one ownership-scoped action that works today. `db/sql/0041` adds
`vote_post`, `vote_comment`, `flag_post` and `update_own_post` on the same
model. Same trust assumptions as the rest of the app, nothing opened up, and
the inert RLS policies can be cleaned up separately.

`db/sql/0040` separately fixes `handle_post_flag`, which had the same
not-SECURITY-DEFINER defect as the vote triggers, and rewrites it to recount
rather than increment so unflagging brings `flag_count` back down.

**Neither is applied.** Both were refused by the local permission classifier.
The client has deliberately NOT been rewired to call these RPCs yet: doing so
before the functions exist would turn a broken vote *switch* into a completely
broken vote *button*. Apply 0040 and 0041 first, then the client change is a
small follow-up in `votePost`, `flagPost`, `updatePost` and `voteComment`.

## Summary

Every "own row" RLS policy on the social tables tests
`session_id::text = current_setting('app.session_id', true)`, and that setting
is always empty in practice, so all of those policies are permanently false.
Separately, two vote tables have no UPDATE policy (which the client's vote
switching requires), `post_flags` has no DELETE policy, and
`flagged_posts_review` has RLS turned off entirely.

## Evidence

Introspected against the deployed project on 2026-07-27. Recorded verbatim in
`db/sql/0036_social_rls.sql` and `db/sql/0037_social_rpcs.sql`.

**The GUC cannot survive the request.** `set_session_id()` is:

```sql
PERFORM set_config('app.session_id', p_session_id::text, true); -- true = local to transaction
```

`true` means transaction-local. `withSession()`
(`src/lib/supabaseClient.js:62-66`) calls it as its own `POST /rpc/
set_session_id`, and PostgREST runs every HTTP request in a separate
transaction, so the value is discarded before the next request arrives. Every
policy reading `app.session_id` therefore evaluates against an empty string.

Affected policies: `update_own_posts`, `delete_own_posts`,
`update_own_comments`, `delete_own_comments`, `delete_own_votes`,
`delete_comment_votes`, `rate_limits_select_own`.

**Missing policies.** Confirmed by `pg_policies`:

| table | policies that exist | missing |
|---|---|---|
| `post_votes` | SELECT, INSERT, DELETE | **UPDATE** |
| `comment_votes` | SELECT, INSERT, DELETE | **UPDATE** |
| `post_flags` | SELECT, INSERT | **DELETE** |
| `flagged_posts_review` | none, RLS disabled | all |

`flagged_posts_review` having RLS off is also flagged by the Supabase security
advisor as `rls_disabled_in_public` (ERROR level), alongside `api_calls`,
`messages` and `sessions`.

## Impact

**Vote switching cannot succeed.** `votePost` in `src/hooks/usePosts.js` uses
`.upsert(..., { onConflict: 'post_id,session_id' })`, which is
`INSERT ... ON CONFLICT DO UPDATE`. Postgres checks the UPDATE policy for the
conflicting row; with no UPDATE policy the row is not visible for update. Same
for `voteComment`. T-064 added optimistic updates with rollback, so the
user-visible symptom is an arrow that changes colour and then reverts.

**Un-voting and un-flagging fail silently.** `delete_own_votes` never matches,
and `post_flags` has no DELETE policy at all. A DELETE filtered out by RLS
affects zero rows and returns no error, so the optimistic update stays on
screen and the row survives in the database. The vote or flag reappears on
reload.

**Editing a post fails.** `updatePost` selects the row back after updating, so
the zero-row result surfaces as a PostgREST error and the UI reports "Failed
to update post".

**Deleting works**, because `soft_delete_post` and `soft_delete_comment` are
`SECURITY DEFINER` and bypass RLS entirely. That is why deletion is the one
ownership-scoped action that behaves.

Note the ownership checks are not providing real protection today regardless:
`session_id` is a client-generated localStorage value and the INSERT policies
are all `WITH CHECK (true)`, so anyone can already write a row claiming any
session id.

## Suggested fix

Two coherent directions, and the choice is a product decision:

**A. Make the model honest about being anonymous.** Drop the `app.session_id`
predicates and let the vote and flag tables be openly writable, matching the
INSERT policies that are already `true`. Add the missing UPDATE and DELETE
policies as `USING (true)`. Smallest change, no client work, and gives up a
protection that does not currently exist anyway.

**B. Make ownership actually enforceable.** Send the session id as a request
header from the Supabase client (`global.headers`) and have the policies read
`current_setting('request.headers', true)::json->>'x-session-id'`, which
PostgREST populates per request. Then delete `set_session_id()` and
`withSession()` entirely. More work, and still only as trustworthy as a
client-supplied header, but it makes the policies mean what they say.

Either way, enable RLS on `flagged_posts_review` and decide whether it should
be readable by anon at all, and add a DELETE trigger so `flag_count` decrements
on unflag (`handle_post_flag()` currently only ever increments it).

Recommend **A** plus the `flagged_posts_review` lockdown, on the grounds that
B's header is no more trustworthy than the localStorage value it replaces, and
E-008 scopes the feed as deliberately anonymous. B is worth revisiting only if
posts ever gain real identity.

## Acceptance criteria

- [ ] Switching a vote from up to down succeeds against the live database
- [ ] Removing a vote persists across a reload
- [ ] Unflagging a post persists and decrements `flag_count`
- [ ] Editing an own post succeeds
- [ ] `flagged_posts_review` has RLS enabled and a deliberate policy
- [ ] No social policy depends on a setting that cannot be populated
- [ ] `set_session_id()` / `withSession()` are either fixed or removed, not
      left as dead code that implies a protection that is not there

## References

- Discovered while implementing T-067; the deployed policies are recorded in
  `db/sql/0036_social_rls.sql`
- T-064 is what makes the failures user-visible as revert-on-rollback
- T-068 fixed a related but distinct RLS interaction: the vote-sync triggers
  were not `SECURITY DEFINER`, so they too were silently writing zero rows
- Supabase advisor lints `0013_rls_disabled_in_public`,
  `0024_permissive_rls_policy`
