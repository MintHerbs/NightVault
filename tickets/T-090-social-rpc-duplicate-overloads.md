---
id: T-090
title: "Four social RPCs carry stale duplicate overloads, so PostgREST refuses to call them (PGRST203)"
status: backlog
severity: high
area: social
epic: E-008
created: 2026-08-01
---

## Summary

Four `public.*` functions the social feed calls exist in the **local** database
under two signatures each: the current one from `db/sql/0037_social_rpcs.sql`,
and a stale legacy one that predates it and was never dropped. PostgREST
cannot resolve the overload, so it answers `HTTP 300 PGRST203` and the call
never reaches Postgres. Deleting a post, deleting a comment, the feed rate
limit, and the bot blacklist are all affected.

Found while verifying T-087 in a browser: the delete-post flow was reported as
a UI failure, and turned out to be this.

## Evidence

Against the local stack (`http://127.0.0.1:54321`, anon key from `.env.local`):

```
POST /rest/v1/rpc/soft_delete_post
  {"p_post_id": "<uuid>", "p_session_id": "<uuid>"}
→ HTTP 300
  {"code":"PGRST203",
   "message":"Could not choose the best candidate function between:
     public.soft_delete_post(p_post_id => uuid, p_session_id => text),
     public.soft_delete_post(p_post_id => uuid, p_session_id => uuid)"}
```

All four duplicated pairs, from `pg_proc`:

| Function | Stale signature (returns) | Current signature (returns) |
|---|---|---|
| `soft_delete_post` | `(uuid, text)` → `void` | `(uuid, uuid)` → `jsonb` |
| `soft_delete_comment` | `(uuid, text)` → `void` | `(uuid, uuid)` → `jsonb` |
| `check_and_increment_rate_limit` | `(text, text, int, int)` → `jsonb` | `(uuid, text, int, int)` → `jsonb` |
| `check_bot_blacklist` | `(text)` → `jsonb` | `(uuid)` → `jsonb` |

The repo defines only the current signature of each:
`db/sql/0037_social_rpcs.sql:32` (`check_and_increment_rate_limit`), `:101`
(`check_bot_blacklist`), `:156` (`soft_delete_post`), `:180`
(`soft_delete_comment`). Nothing in `db/sql/` creates the `text` variants, so
they are residue from the pre-0037 deployment rather than something a
migration re-creates.

The client always sends the UUID form —
`src/hooks/usePosts.js:447-457` (`soft_delete_post`),
`src/hooks/useComments.js:223` (`soft_delete_comment`) — so the current
signature is the intended target in every case.

`usePosts.deletePost` treats the 300 as a generic failure
(`if (error || !data?.success) return { error: 'Failed to delete post' }`), so
the user sees nothing but a delete that quietly does not happen.

## Impact

On any database carrying the stale duplicates: a visitor deletes their own
post, the confirm panel closes, and the post is still there on reload —
`is_deleted` is still `false`. Same for deleting a comment. The feed's
rate-limit and bot-blacklist checks fail the same way; both are called on
mount by `useRateLimit`, so the feed currently runs with no working rate
limit at all on those databases.

Verified in the local stack. **Whether production is affected is not yet
known and must be checked before this is closed** — prod has no
`schema_migrations` table, so the applied set cannot be inferred from the
repo (see the 2026-08-01 social/chat PGRST202 outage).

## Suggested fix

Drop the four stale overloads, in a numbered migration rather than by hand,
so any environment that still has them converges:

```sql
DROP FUNCTION IF EXISTS public.soft_delete_post(uuid, text);
DROP FUNCTION IF EXISTS public.soft_delete_comment(uuid, text);
DROP FUNCTION IF EXISTS public.check_and_increment_rate_limit(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.check_bot_blacklist(text);
```

Then `NOTIFY pgrst, 'reload schema'` — PostgREST caches the catalogue and
keeps returning PGRST203 until it does.

Note `db:migrate` is still blocked by the 0024 drift, so this will need
`docker exec psql` locally and a verified path on prod.

The four drops were applied by hand to the **local** database on 2026-08-01
so that T-087's delete flows could be verified. That change is not captured
anywhere yet; this ticket is what captures it.

## Acceptance criteria

- [ ] A numbered migration in `db/sql/` drops all four stale overloads
- [ ] `pg_proc` shows exactly one `public` function per name for all four
- [ ] `soft_delete_post` and `soft_delete_comment` return
      `{"success": true}` over PostgREST for a matching session id
- [ ] Deleting a post and deleting a comment both persist across a reload
- [ ] The production database is checked for the same duplicates via the
      Supabase MCP connector, and either confirmed clean or fixed
- [ ] `useRateLimit`'s two calls succeed rather than 300

## References

- [T-087](T-087-social-and-chat-ui-rebuild.md) — found during its verification
- `db/sql/0037_social_rpcs.sql` — the canonical signatures
- T-067 — the reconstruction of the social migrations these functions came from
- `docs/runbooks/` — prod has no migration tracking; verify via MCP, not
  `applied_envs`
