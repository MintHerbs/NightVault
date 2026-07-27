---
id: T-064
title: Social feed fires ~152 requests on load and blocks vote feedback on two round trips
status: in-progress
severity: high
area: social
epic: E-008
created: 2026-07-27
---

## Summary

The feed issued roughly 152 network requests to render 50 posts, updated
vote icons only after two sequential Supabase round trips, and re-rendered
plus re-syntax-highlighted every card on any vote by any user. Separately,
code blocks collapsed into one continuous line on mobile. Together these
made the feed feel, in the owner's words, "laggy and buggy".

## Evidence

**Request storm on load.** `usePosts` fetched 50 posts, then ran
`getPostCounts(post.id)` per post inside a `Promise.all`, which was two
queries each (all vote rows + a comment count). On top of that, every
`PostCard` independently queried the `polls` table on mount, whether or not
the post had a poll:

- `src/hooks/usePosts.js:105-110` (old) — per-post count fan-out
- `src/components/social/PostCard/PostCard.jsx:94-130` (old) — per-card
  poll query, plus two more for posts that did have a poll

1 + (50 x 2) + 50 = ~151, plus the user-interaction query.

**Counts computed by downloading every row.** `usePosts.js:36-37` (old)
pulled all `post_votes` rows for a post and counted them in JS, so a post
with 400 votes shipped 400 rows to display "400".

**Vote latency.** `usePosts.js:320-353` (old) `votePost` did a `SELECT` to
find the existing vote, awaited it, then an `UPSERT`, awaited that, and only
then called `setUserVotes`. No optimistic update existed. The realtime
`post_votes` handler at `usePosts.js:177-197` (old) then ran a *third*
query, re-fetching every vote row for the affected post, on every vote event
from every user.

**Feed-wide re-render per vote.** `HomeFeedPage.jsx:107-114` (old) rebuilt
every post object in a `useMemo` keyed on `getUserVote`, which changed
identity whenever `userVotes` did. `PostCard` was `forwardRef` with no
`memo`, and `CodeBlock` (`CodeBlock.jsx:4-8`, old) ran `detectCodeLanguage`
(a dozen regexes over the whole file) and `tokenizeCodeLine` per line
directly in its render body, with no memoisation. `PostCard` also carried
Framer's `layout` prop and the list used `AnimatePresence mode="popLayout"`,
adding 50 FLIP measurements per commit.

**Unbounded canvas loops.** `AgentAvatar` runs a `requestAnimationFrame`
loop that shadow-blurs `GRID_SIZE² = 36` rects per frame
(`agent-avatar/index.jsx:196-224`). It is rendered with `animated={true}` on
every post card and every comment, and never paused when off-screen or when
the tab was hidden.

**Mobile code block.** `CodeBlock.module.css:139-173` (old) laid lines out
as `display: table-row` / `table-cell` inside a plain inline `<code>` with
no `display: table` ancestor, relying on the browser's anonymous-table
fixup. `CodeBlock.jsx` emits the line spans with no whitespace between them,
so wherever that fixup did not hold, every line rendered inline and ran
together. `.card` carried `will-change: transform` and Framer's `layout`,
which put a live `transform: scale()` on an ancestor of the table during the
read-more expand.

## Impact

On a remote Supabase instance, clicking upvote left the arrow grey for the
duration of two sequential round trips before it turned green, and the count
changed only after a third. Meanwhile ~50 rAF loops saturated the main
thread, so the click handler itself was competing for time. Any vote by any
user re-tokenised every visible code block. On mobile, expanding a long code
post with "read more" could render the whole snippet as one unreadable line.

## Fix applied

Deliberately client-side only. An RPC (`get_feed_posts`) would collapse the
remaining 6 queries to 1, but it needs a migration, and
`db/sql/0006`-`0015` are 0-byte stubs so the social schema has no written
record to extend. 152 to 6 captures nearly all the win at no deploy risk.
Filed as a possible follow-up, not done here.

- `src/hooks/usePosts.js:36-95` — `loadFeedExtras()` batches votes,
  comments, polls, poll votes, and flags into fixed `.in(...)` queries and
  buckets them in one pass. The caller's own vote is derived from the same
  vote response instead of a separate query.
- `src/hooks/usePosts.js:410-441` — `votePost` applies the vote and the
  tallies locally before writing, and drops the pre-`SELECT` because state
  already knows the current vote. Rolls back on error.
- `src/hooks/usePosts.js` realtime handlers — apply `+1/-1` deltas from the
  payload instead of re-querying, and skip echoes of our own writes by
  comparing `session_id`.
- `src/hooks/useComments.js` — same optimistic treatment; a comment vote no
  longer triggers a 3-query `fetchComments()`.
- `PostCard`, `CodeBlock`, `AgentAvatar` wrapped in `memo`; `HomeFeedPage`
  passes scalar `userVote`/`hasFlagged` and stable handler identities so the
  memo actually holds. `layout` and `mode="popLayout"` removed.
- `CodeBlock` memoises detection and tokenising.
- `agent-avatar/index.jsx:230-270` — IntersectionObserver plus
  `visibilitychange` gating, so only on-screen avatars in a visible tab
  animate.
- `CodeBlock.module.css` — flex rows inside a `width: max-content` block
  replace the table layout, with a `position: sticky` line-number gutter.
  `will-change: transform` removed from `.card`.
- Mobile breakpoints added to `PostCard`, `CodeBlock` (none existed).

## Reopened 2026-07-27

A verification pass over the implementation found that two of the acceptance
criteria had been ticked without being met, and that one of the optimisations
introduced a count drift the original write-up did not flag. Reopened rather
than filed as a follow-up, because a closed ticket whose headline criterion is
false is worse than an open one: the next reader trusts the checklist.

**1. About 50 requests still fired per feed load, and they scaled with page
size.** `PostCard` renders `CommentSection` unconditionally
(`PostCard.jsx:396`), `CommentSection` calls `useComments()` at the top level
(`CommentSection.jsx:25`), and `useComments` calls `useRateLimit()`
unconditionally (`useComments.js:61`), which fires a `bot_blacklist` select on
mount. Hooks cannot be conditional, so passing `postId = null` while a thread
is closed suppressed the comment fetch but not this one. A 50-post load
therefore issued 52 identical `bot_blacklist` selects (one from
`HomeFeedPage`, one from `usePosts`, fifty from the comment sections) on top of
the 5 batched feed queries: roughly 57 requests, 50 of them growing linearly
with post count.

This was pre-existing rather than a regression (`useRateLimit` was already
imported in `useComments` before this ticket), which is why the original
count of ~152 was itself an undercount; the true figure before this ticket was
closer to 200.

Fixed in `useRateLimit.js` with a module-scoped promise cache keyed on session
id, so all callers await one lookup. Cached there rather than gated in
`useComments` because the blacklist answer is identical across instances by
definition, so every present and future caller inherits it. Failed lookups are
evicted rather than cached as "not blacklisted", and the burst-blacklist path
overwrites the cached answer so instances mounted afterwards do not read a
stale `false`.

**2. The `post_votes` realtime handler drifted counts upward on a foreign vote
switch.** Switching up to down produces an UPDATE, because `votePost` uses
`upsert` with `onConflict`. Under the default replica identity `payload.old`
carries only the key columns, so `old.vote_type` is absent, so the handler
computed `from = null` and added the new vote without removing the old one.
Unlike the DELETE case, this is not a safe no-op: it is a wrong number that
accumulates until reload. The pre-ticket re-query approach was authoritative
and could not drift this way, so this was a regression introduced by the delta
optimisation.

Fixed by branching on whether `old.vote_type` is actually present rather than
always re-querying: when it is present the delta is correct and is used, and
when it is absent the handler falls back to `fetchVoteCounts()`, two head-only
counts that transfer no rows. Written this way so that if the table's replica
identity is ever widened for unrelated reasons the repair query retires itself
instead of lingering as dead cost nobody remembers to remove. The handler now
also skips posts that are not in the current list, so an off-screen vote costs
nothing.

**3. `useComments.fetchComments` still contained the pattern this ticket
fixed elsewhere.** It queried `comment_votes` for the tallies and then queried
the same table again filtered to the caller's own `session_id`, so opening a
thread cost 3 queries where 2 suffice. Folded into one pass by selecting
`session_id` up front, exactly as `loadFeedExtras()` does for post votes.

Also corrected a comment in `useComments.js` that claimed the stable
`voteComment` identity keeps "memoised CommentItems" from re-rendering.
`CommentItem` is a plain function export and `CommentSection` hands it inline
handlers, so no memo exists there to hold. Threads are small enough that this
has not been worth changing, but the comment should not imply otherwise.

## Acceptance criteria

- [x] Feed load issues a fixed number of queries independent of page size
      (7, or 6 when no post carries a poll: the `posts` page, four batched
      extras, one conditional `poll_votes`, and one shared `bot_blacklist`
      lookup). The original "6, or 5" was ticked while 52 `bot_blacklist`
      selects were still firing; see Reopened, item 1
- [x] No component issues a per-post query on mount
- [x] Vote state is applied to the UI before any network call, and rolled
      back if the write fails
- [x] A vote does not re-render or re-tokenise unrelated cards
- [x] Avatar animation loops stop when off-screen or the tab is hidden
- [x] Code block line layout does not depend on anonymous-table generation
- [x] A foreign vote switch does not drift the visible tallies, whatever the
      replica identity of `post_votes` (Reopened, item 2)
- [x] `npm run build` and `npm run lint:css` pass
- [ ] The feed has been loaded once against a live database with the network
      tab open, confirming the request count and that no tally drifts

## Remaining verification

Still not exercised against a live database. Docker is not running and the
Supabase CLI is not installed, and `.env.local` points the dev app at
`http://127.0.0.1:54321`, so `npm run dev` currently talks to nothing.

Note that bringing the local stack up would not be sufficient on its own:
`db/sql/0006`-`0015` are empty, so `npm run db:migrate` against a fresh local
database creates no social tables at all. Verifying this ticket means either
pointing at the remote project for one session or waiting on T-067. That is
the practical reason this cannot be closed yet.

The paths worth watching on the first real run are the optimistic-vote
rollback, the request count on load, and the realtime delta handling.

**Trap when verifying locally.** `db/seeds/dev_social_schema.sql` adds only
`posts` to the `supabase_realtime` publication and sets `REPLICA IDENTITY FULL`
on only `posts` (see its Realtime section, lines 193-207). It does not publish
`post_votes` or `comments`. On a local database built from that file the
`post_votes` and `comments` subscriptions in `usePosts` therefore receive
nothing at all, so every delta handler and the new UPDATE repair branch are
dead code. Anyone verifying this ticket locally would observe no drift, no
double-counting and no repair query, and conclude the handlers work when in
fact they never ran. Publish both tables first:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE post_votes, comments;
```

Leave `post_votes` at its default replica identity for the first pass, since
that is the case the repair branch exists for and the one production is most
likely in. Then set `REPLICA IDENTITY FULL` and confirm the repair query stops
firing and the delta path takes over, which is the self-retiring behaviour the
branch was written for.

## Open question raised after the fact

Schema introspection done for T-067 on 2026-07-27 found that `posts` already
carries `upvotes`, `downvotes` and `flag_count` as `integer NOT NULL DEFAULT
0`, and `comments` carries `upvotes` and `downvotes`. `loadFeedExtras()`
computes all of these client-side and `usePosts.js:181` spreads the computed
values over the stored ones, so the client silently wins.

If something maintains those columns (`db/README.md:39` claims a vote-count
sync trigger does), then the `post_votes` batch query in `loadFeedExtras()` is
redundant for the totals and the feed could read them off the post rows it
already fetches. That would be a smaller and better fix than what this ticket
implemented. It does not make anything here wrong: the client-side counts are
self-consistent and the optimistic path works either way. But it may make part
of it unnecessary. Tracked in T-068, which cannot be settled without the
database access T-067 needs.

## Known gap: foreign vote removal — closed by T-068's fix

**Superseded 2026-07-27.** Now that `0039` makes `sync_post_votes` actually
work, every vote write also updates `posts.upvotes`/`downvotes`, and `posts` is
in the realtime publication. So a foreign vote removal now arrives as a `posts`
UPDATE carrying the authoritative counts, which the existing handler merges via
`{ ...p, ...next }`. The gap described below is closed without
`REPLICA IDENTITY FULL`.

Ordering is safe rather than lucky: the trigger fires in the same transaction
as the vote write and is replicated in WAL order, so the `post_votes` event
always precedes the `posts` event. The delta is applied first and then
overwritten by the authoritative value, which converges even though both paths
now fire for the same vote. The delta handling is consequently redundant, not
wrong; simplifying it belongs with the T-068 follow-up that drops the
`post_votes` batch query entirely.

The original text follows for the record.

## Known gap: foreign vote removal (original, now superseded)

When another user removes a vote entirely, the DELETE payload's `old` record
carries only the key columns under the default replica identity, so `post_id`
is absent and the handler cannot even tell which post to correct. The count
stays stale-high for other viewers until their next load.

This is not a regression: the previous re-query implementation returned early
on the same missing `post_id`, so the behaviour is unchanged. It is a real gap
though, and only `REPLICA IDENTITY FULL` on `post_votes` or a periodic
reconcile closes it. Both need a migration, so it belongs with the schema
reconstruction in T-067, not here. Deliberately out of scope for this ticket,
which E-008 scopes as client-side only.

## References

- E-008: social feed and chat overhaul
- T-067: reconstruct `db/sql/0006`-`0015`, which is what unblocks local
  verification of this ticket and closes the DELETE gap above
- T-068: the `get_feed_posts` RPC this ticket deferred, which is also what
  finally stops counts being computed from downloaded rows
- T-024: earlier touch-target pass on `PostActions`
- `db/README.md:39-48` documents triggers for the social tables that do not
  exist in the repo; treat that table as intent, not reality
