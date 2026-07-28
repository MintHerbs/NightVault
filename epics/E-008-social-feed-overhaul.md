---
id: E-008
title: Social feed and chat overhaul — performance, composer UX, media, presence
status: in-progress
created: 2026-07-27
---

## Goal

A 2026-07-27 review of `/social/feed` and `/social/chat` found that most of
the reported symptoms (a feed that felt "laggy and buggy", like/dislike
icons taking seconds to respond, code blocks collapsing to a single line on
mobile) traced back to one shared cluster of causes rather than to seven
separate bugs: an N+1 request pattern on feed load, no optimistic updates
anywhere, no memoisation across a 50-card list that re-tokenises syntax on
every render, and dozens of unbounded `requestAnimationFrame` canvas loops.

Alongside that, the composer, comment thread, and chat input carried
hardcoded colours that predate the theme system added in T-062, so several
controls are invisible or off-brand in the light themes. The GIF/sticker
feature was never wired up at all (a `TenorSearch` component existed but was
never imported), and the chat had no typing presence.

This epic tracks fixing the performance cluster first, then the interaction
design, then the two new features. Ordering is deliberate: the UI work is
much easier to judge on a feed that already feels fast.

**Design direction:** Material 3 structure (layout, sizing, state layers,
button hierarchy, 40px+ touch targets) applied over the existing accent
token system and the cyberpunk code theme, which the owner explicitly wants
kept. This is not a visual redesign; it should still read as the same
product. See [docs/design.md](../docs/design.md) and
[docs/design/components.md](../docs/design/components.md).

Every finding below was verified by reading the actual code before being
filed.

## Tickets

- [ ] T-064 — Social feed fires ~152 requests on load and blocks vote
      feedback on two round trips; no memoisation across the card list
      (high). Reopened 2026-07-27: two acceptance criteria had been ticked
      unmet and the vote-delta optimisation drifted counts on a foreign vote
      switch. Both fixed; stays open until verified against a live database
- [x] T-065 — Composer, code attachment, comment thread, and chat input
      have broken affordances and pre-T-062 hardcoded colours (medium).
      Stays closed: its core claims hold. Two criteria were ticked unmet and
      were corrected in place on 2026-07-28, with the residue split to T-070
- [x] T-066 — Add KLIPY GIF/sticker picker behind an Edge Function proxy,
      and a chat typing indicator (medium). Closed 2026-07-28: the secret
      was found misplaced (`KLIPY_API` in the root `.env` instead of
      `KLIPY_API_KEY` in `supabase/functions/.env`), fixed, the function
      deployed, and both features verified in a real browser against the
      live project
- [ ] T-067 — Reconstruct `db/sql/0006`-`0015` from the deployed social
      schema; the ten social migrations are 0-byte files, so the repo cannot
      rebuild or reason about the schema it runs on (high). Unblocked via the
      Supabase MCP connector and transcribed into `0028`-`0038`; not yet run
      against any database
- [ ] T-068 — Vote-count columns on `posts`/`comments` are permanently wrong:
      the sync triggers never fired on UPDATE *and* were not `SECURITY
      DEFINER`, so they wrote zero rows under RLS (medium). Fixed in `0039`,
      awaiting apply. Supersedes the original `get_feed_posts` RPC framing,
      which is probably now unnecessary
- [ ] T-069 — Social RLS ownership checks can never match, so vote switching,
      un-voting, un-flagging and post editing all fail, most of them silently
      (high). Needs a product decision between dropping the checks and making
      them enforceable
- [ ] T-070 — Social CSS still carries un-tokenised danger colours, sub-40px
      mobile controls in `CommentItem`/`PollBuilder`, and six breakpoint
      comments naming the wrong token (low). The residue of T-065; filed
      rather than reopening it, since T-065's core claims hold

## Non-goals

- Not a visual redesign. The translucent card treatment, the accent
  palette, and the cyberpunk syntax highlighting stay as they are; only
  layout, state, sizing, and theme-token correctness change.
- Not a schema change, for T-064 through T-066. The performance work is
  deliberately client-side so it needs no migration; see the note in T-064
  about why an RPC was considered and deferred. T-067 and T-068 are the
  explicit exceptions, added 2026-07-27 once it became clear the missing
  migrations were blocking verification of T-064 rather than merely being
  tech debt. They are separate tickets precisely so the client-side work
  could ship without waiting on them.
- Not feed pagination or virtualisation. The feed is capped at 50 posts and
  that cap is unchanged; if the cap ever rises, virtualisation becomes its
  own ticket.
- Not moderation, auth, or identity work. Posts stay anonymous and
  session-scoped.

## References

- [docs/rules.md §5.2](../docs/rules.md) — UI component sourcing rule
- T-062 — Appearance dialog and the theme token system these components
  need to respect
- T-024 (done) — the earlier touch-target pass on `PostActions`, which is
  why that one file already had a `@media (max-width: 480px)` block
- E-002 — mobile optimization epic; T-064's code-block fix and the
  breakpoints added in T-065 overlap its goals for the social area
