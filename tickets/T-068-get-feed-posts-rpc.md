---
id: T-068
title: Collapse the feed's remaining queries into a get_feed_posts RPC
status: in-progress
severity: medium
area: social
epic: E-008
created: 2026-07-27
---

## Root cause found; scope changed (2026-07-27)

Severity raised from low. This is no longer a performance ticket about an RPC:
the denormalised count columns are simply wrong in production, and were always
wrong, for two independent reasons that each alone would have been sufficient.

1. **The triggers never fired on UPDATE.** `trigger_sync_post_votes` and
   `trigger_sync_comment_votes` were `AFTER INSERT OR DELETE`. The client
   switches a vote with `.upsert(..., { onConflict: ... })`, which is
   `INSERT ... ON CONFLICT DO UPDATE`, so switching a vote never re-synced.

2. **The trigger functions were not `SECURITY DEFINER`.** Trigger functions run
   as the invoking role, which for the feed is `anon`. `posts` has RLS enabled
   and its only UPDATE policy is the always-false `app.session_id` check (see
   T-069), so `update posts` inside the trigger matched zero rows and failed
   silently. An UPDATE filtered out by RLS is not an error.

Cause 2 is why the counts were wrong even for plain first-time votes: verified
2026-07-27, **all 2 of 2 vote rows in the project had a stored count of 0
against a real count of 1.** Fixing only cause 1 would have looked like a fix
and changed nothing.

Fixed in `db/sql/0039_fix_vote_sync_triggers.sql`: both triggers gain
`OR UPDATE`, both functions become `SECURITY DEFINER` with a pinned
`search_path` (which also clears advisor lint 0011), and every drifted row is
backfilled. **Not yet applied to production** (see Status below).

The original RPC idea is deferred again and probably unnecessary. Once the
columns are trustworthy, `loadFeedExtras()` can read totals straight off the
post rows it already fetches and drop the `post_votes` batch query, taking feed
load from 6 requests to 5 and removing the vote row-volume problem without any
RPC. Only the caller's own vote and the comment counts would still need
aggregating. Do that as a follow-up **after** `0039` is applied and verified,
not before.

## Status: applied to production 2026-07-27

Applied via the Supabase MCP connector. Verified immediately afterwards:

| check | result |
|---|---|
| posts still drifted | 0 |
| comments still drifted | 0 |
| `sync_post_votes` / `sync_comment_votes` are SECURITY DEFINER | both true |
| both have a pinned `search_path` | `public, pg_temp` |
| trigger events on both vote tables | INSERT, DELETE, UPDATE |

Not yet exercised through the app itself. Note that a real end-to-end vote
switch will still fail until T-069 is resolved, because `post_votes` has no
UPDATE policy: the trigger is now correct, but the write that would fire it is
blocked by RLS. The two are independent bugs that happened to share a symptom.

## Summary

T-064 cut feed load from roughly 150 requests to 5, but it did so by batching
queries client-side, which means the counts shown on each post are still
computed by downloading every underlying row. A `get_feed_posts` RPC would
return the page and its aggregates in one request and transfer a fixed amount
of data regardless of how popular the posts are.

## Evidence

`src/hooks/usePosts.js:39-46` issues four batched queries plus a conditional
fifth, on top of the `posts` select at `usePosts.js:158-164`. Two of those
still download one row per underlying record:

- `.from('post_votes').select('post_id, session_id, vote_type').in('post_id', postIds)`
  returns one row per vote across all 50 posts.
- `.from('comments').select('post_id').in('post_id', postIds).eq('is_deleted', false)`
  returns one row per comment across all 50 posts, purely to count them in JS
  at `usePosts.js:60-63`.

`src/hooks/useComments.js:82-99` has the same shape for a single thread's
`comment_votes`.

T-064's Evidence section named this pattern as a defect ("a post with 400
votes shipped 400 rows to display 400"), and its Fix section reduced the
number of requests carrying those rows without reducing the rows. Its own
"Fix applied" notes an RPC was considered and deferred because
`db/sql/0006`-`0015` are empty stubs, which is now tracked as T-067.

## Impact

Not currently user-visible: with `FEED_LIMIT = 50` and modest vote counts the
payload is small and the feed is fast after T-064. It becomes a problem in
three scenarios:

- A post gets popular. A thread with a few thousand votes and comments ships
  every one of those rows on every feed load, for a number that renders in
  four characters.
- The feed cap rises. `FEED_LIMIT` is 50 today. The `.in(...)` filters also
  pass 50 UUIDs in a GET query string (roughly 1.9KB per request); a
  materially higher cap risks URL and header limits and would need POST-based
  requests or an RPC anyway.
- Any consumer needs a second page. There is no pagination today (explicitly a
  non-goal in E-008), but a cursor is far easier to add inside one RPC than
  across five coordinated batch queries.

## Scope may be much smaller than this ticket assumes (2026-07-27)

Read-only introspection of the deployed schema for T-067 found that
`posts.upvotes`, `posts.downvotes` and `posts.flag_count` already exist as
`integer NOT NULL DEFAULT 0`, as do `comments.upvotes` and
`comments.downvotes`. `db/README.md:39` and `:42` claim a "vote-count sync
trigger" maintains them.

If that trigger exists and the columns are accurate, this ticket largely
evaporates: `loadFeedExtras()` can drop the `post_votes` batch query entirely
and read the totals straight off the rows `.select('*')` already returns,
taking feed load from 6 requests to 5 and removing the vote row-volume problem
with no RPC and no migration. Only the caller's own vote would still need
`post_votes`, and that can be a single `.eq('session_id', ...)` query returning
at most one row per post. The `comments` count query could go the same way if a
comparable trigger maintains a count on `posts`, though no such column exists,
so comment counts would still need aggregating.

Note this cuts the other way too. `usePosts.js:181` currently spreads
client-computed counts *over* these columns, so if the trigger does exist, the
client is doing redundant work and shipping every vote row to recompute a
number the database already has. If it does not exist, the columns are dead
weight that `.select('*')` ships on every post and that any future reader would
reasonably mistake for authoritative.

**Settle this before designing the RPC.** Compare the stored columns against
`count(post_votes)` for a sample of posts; if they agree, do the cheap fix
above and reduce this ticket to the comment-count aggregation. Blocked on the
same access as T-067.

## Suggested fix

A single `get_feed_posts(p_session_id uuid, p_limit int)` returning, per post:
the post row, `upvotes`, `downvotes`, `comment_count`, the caller's own
`vote_type`, whether the caller has flagged it, and the poll with its option
tallies and the caller's chosen option. Aggregate server-side so vote and
comment rows never leave the database.

`loadFeedExtras()` in `usePosts.js` then collapses to one call, and
`hydratePost()` reduces to the same RPC for a single id. The realtime handlers
should be left alone: they are correct after T-064 and are not the source of
the row volume.

Two things to settle while writing it:

- Whether `posts` already carries `upvotes`/`downvotes` columns. If it does,
  `usePosts.js:179-183` currently spreads client-computed values over them, so
  the client silently wins and the columns may be stale. Decide which side is
  authoritative before the RPC hard-codes one.
- Whether to close the realtime DELETE gap noted in T-064 at the same time, by
  setting `REPLICA IDENTITY FULL` on `post_votes`. It is a separate concern but
  the same migration.

## Acceptance criteria

- [ ] Feed load issues exactly one request for the page and all its derived
      values
- [ ] Response size for a given page size does not grow with the number of
      votes or comments on those posts
- [ ] Vote, comment and poll totals match what the previous client-side
      counting produced for the same data
- [ ] The caller's own vote, flag and poll choice are still reflected on first
      paint
- [ ] Optimistic voting and the realtime delta handlers still work unchanged
- [ ] `npm run build` and `npm run lint:css` pass

## References

- Blocked in practice by T-067: this needs a migration, and the social schema
  has no written record to extend until that is done
- T-064 is where the client-side batching this supersedes was implemented, and
  where the deferral was first recorded
- E-008 lists "not a schema change" as a non-goal, which is why this is a
  separate ticket rather than part of T-064
