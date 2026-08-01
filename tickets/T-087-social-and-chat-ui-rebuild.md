---
id: T-087
title: "Rebuild the social feed and chat UI/UX on one design language, keeping CodeBlock untouched"
status: done
severity: medium
area: social
epic: E-008
created: 2026-08-01
---

## Summary

`/social/feed` and the chat panel are currently rendered in **two different
visual languages that were never reconciled**, because E-008 restyled the
composer, comment thread and chat input onto Material 3 tonal surfaces
(T-065, T-073) while leaving the post card, the feed skeleton, the poll and
the typing indicator on the older accent-glow treatment. The result reads as
two products stacked on top of each other: a Material surface composer sits
directly above post cards that glow on every edge and every word.

Owner request (2026-08-01) is a full rebuild of the social and chat UI/UX,
not a residue sweep: comments, posts, post authoring, chat, all of it.
Core functionality is unchanged. `CodeBlock` is explicitly out of scope and
must not be touched.

**This ticket supersedes E-008's "Not a visual redesign" non-goal.** That
non-goal was written on 2026-07-27 to keep the performance work shippable;
it is now the thing being deliberately reversed. E-008's other non-goals
(no schema change, no pagination/virtualisation, no moderation or identity
work) still hold.

## Evidence

### 1. Two competing idioms in the same viewport

Older accent-glow idiom, applied per-element:

- `src/components/social/PostCard/PostCard.module.css:4-25` — accent-tinted
  border at 0.25 alpha, `inset 0 0 60px` accent wash, `translateY(-2px)`
  hover lift, and a second accent halo on hover.
- `PostCard.module.css:54,111,153,326,332` — `text-shadow` glow on the
  author name, every menu item, the read-more link and both buttons.
- `src/pages/HomeFeedPage.module.css:64-143` — the loading skeleton draws
  the *old* card geometry (accent border, inset accent wash, accent-tinted
  shimmer), so it will visibly mismatch the moment the card changes.

Newer M3 idiom, in components sitting immediately above and below:

- `src/components/social/PostComposer/PostComposer.module.css:1-46` —
  `--md-surface-container-low` fill, `--md-outline-variant` hairline,
  `--md-shape-xl` radius, and one animated neon gradient hairline as the
  deliberate "cyberpunk signature", with an explicit comment saying the
  glow was reduced to exactly that one element.
- `src/components/social/PostActions/PostActions.module.css:8-138`,
  `src/components/social/CommentItem/CommentItem.module.css:135-160` —
  neutral `rgba(var(--color-fg-rgb), …)` pills, state-layer hovers, no
  glow at all.

Both idioms are internally coherent. Neither is wrong. They just do not
belong on the same screen, and no component currently arbitrates.

### 2. Theme-system drift in the un-migrated components

`derivePalette()` generates 9 themes x light/dark, but `PostCard` hardcodes
one theme's bright accent seven times and a code-theme cyan once:

- `PostCard.module.css:54,111,153,236,245,326,332` —
  `rgba(255, 208, 138, …)`, which is Hub Orange's `--color-accent-bright`
  baked in as a literal. On Nebula, Crimson or Slate the glow stays orange.
- `PostCard.module.css:267` — `.barLabel` is `#7FE7FF`, one of the
  `CodeBlock` syntax literals, used as a poll-option label colour.
- `HomeFeedPage.module.css:139` — the skeleton shimmer carries the same
  `rgba(255, 208, 138, 0.2)` literal.

### 3. Post authoring is gated behind a modal on every single post

`PostComposer.jsx:168-177` routes **every** post through
`setShowTitleModal(true)`, and `TitleModal.jsx:31-33` allows an empty
title. So the mandatory interaction cost of posting a one-line thought is:
type, click Post, wait for a modal, dismiss or skip the modal. The title is
optional data behind a required dialog.

### 4. Chat has no panel chrome

`src/features/chat/components/ChatPanel/ChatPanel.jsx:51-93` renders
starfield, message list and input. There is no header: no room name, no
online count, no close control (`onClose` is accepted as a prop and never
used). Closing is only possible from the sidebar or the Dynamic Island.

`ChatBubble.jsx:11-34` renders an avatar and a permanent timestamp for
**every** message with a fixed 16px bottom margin
(`ChatBubble.module.css:1-6`), so five consecutive messages from the same
person produce five avatars and five timestamps. There is no message
grouping and no day divider.

`TypingIndicator.module.css:28-43` and `SeenIndicator.module.css` implement
the same overlapping-avatar-stack treatment twice, independently.

### 5. Dead component library carrying its own palette

`src/pages/social/ComponentShowcase.jsx` is **not routed anywhere** (no
reference to it outside its own file). It is the only consumer of
`social/Alert`, `social/Badge` and `social/Toast`, which between them carry
31 raw hex literals (`Toast.module.css` 12, `Badge.module.css` 11,
`Alert.module.css` 8) and zero `@media` rules. `social/Callout` is the one
that is genuinely live, via `src/pages/social/guidelines.jsx:121`.

A rebuild that restyles all four spends most of its effort on three
components nothing renders. **Owner decision 2026-08-01: leave all four
alone.** They are neither restyled nor deleted by this ticket, so the
"no raw hex" criterion below is scoped to the components actually
rebuilt.

### 6. Residue already filed and still open

T-070 tracks un-tokenised danger colours in `CommentSection`/`CommentItem`,
sub-40px mobile controls, and six breakpoint comments naming the wrong
token. Those files are all inside this ticket's blast radius, so T-070
should be absorbed rather than fixed twice.

## Impact

A visitor opening `/social/feed` on any theme other than Hub Orange sees
orange glow on post-card author names and read-more links while the
composer directly above them is correctly themed, and sees a cyan poll
label that belongs to the code syntax palette. A visitor posting a
one-sentence thought is interrupted by a modal asking for an optional
title. A visitor sending five chat messages in a row sees their own avatar
and timestamp repeated five times down the column, and cannot close the
chat panel from inside it. A visitor on a phone gets 36px vote targets in
comment threads (T-070).

None of this is broken in the functional sense, which is exactly why it has
survived four tickets: every individual symptom reads as cosmetic while the
aggregate reads as an unfinished product.

## Suggested fix

### Design direction: "neon on tonal", three layers with fixed jobs

Not a new palette. The existing tokens stay, the existing themes stay, the
cyberpunk code theme stays. What changes is that each layer gets exactly
one job, so the two idioms stop competing:

**Layer 1 — surface carries structure.** Every container (post card,
composer, comment panel, chat bubble, drawer, modal) is an M3 tonal
surface: `--md-surface-container-*` fill, `--md-outline-variant` hairline,
`--md-shape-*` radius. No accent-tinted container borders, no `inset`
accent washes, no hover lift. Elevation is tone, not shadow, per
`docs/design/colors.md`.

**Layer 2 — accent carries meaning.** Accent appears only where it encodes
state or identity: focus, the primary action, your own chat bubble, an
active toggle chip, a poll result bar, the "you" avatar ring. Accent never
appears as decoration on static text, which retires every `text-shadow`
glow in the feed.

**Layer 3 — one signature per surface.** The animated neon gradient
hairline `PostComposer.module.css:21-36` already establishes becomes the
single recurring cyberpunk element, extended to the post card, the comment
panel and the chat header. One neon line per surface, brightening on
focus-within. That is the thread tying the redesign to `CodeBlock`'s neon
syntax without competing with it, and it keeps the code block the loudest

**Correction (2026-08-01, owner review):** `PostCard` does not carry the
hairline after all. A feed is many cards at once, and a line at the top of
every one of them read as clutter rather than a signature the way one line
on the composer or the chat header does. The signature stays on
`PostComposer` and `ChatHeader` only; `docs/design.md`'s decisions log and
`src/components/social/README.md` reflect this.
thing on the page, which is correct because it is the content.

### Scope, by phase

**Phase 0 — shared primitives.** Extract the two things currently
duplicated or about to be: an `AvatarStack` primitive (from the
`TypingIndicator` / `SeenIndicator` duplication) and a `VoteControl`
segmented primitive (post and comment votes currently implement the same
semantics twice, in two shapes). Both land in `src/components/ui/` per the
modularity rules in `docs/design.md`.

**Phase 1 — feed shell and post card.** Rebuild `PostCard` on the tonal
surface, restructure the header (avatar / Anon / relative time / overflow),
title as a real heading, action bar separated by a hairline instead of
floating pills, gradient-fade "read more" instead of a text link that
reflows the card. Rebuild the poll as result rows rather than 40px tracks
with absolutely-positioned labels, which removes the `#7FE7FF` literal.
Move flag into the overflow menu; it currently sits at equal weight to
voting. Redraw the `HomeFeedPage` skeleton to the new geometry.

**Phase 2 — post authoring.** Replace the mandatory `TitleModal` with an
inline progressive composer: collapsed single-line prompt, expanding on
focus into optional title field + body + attachment rail. Unify the three
attachment panels (poll / code / GIF) into one tray with one remove
affordance. `TitleModal` is deleted, not restyled.

**Phase 3 — comments.** Keep the thread-connector geometry in
`CommentItem.module.css:1-85`; it is good and hard-won, and the CSS
variables at the top are already the documented way to retune it.
Restructure the panel into header (count + sort) / composer / thread, adopt
the Phase 0 `VoteControl`, and add thread collapse for long threads.

**Phase 4 — chat.** Add real panel chrome: room name, online count, close
control wired to the already-accepted `onClose` prop. Group consecutive
messages from one session (one avatar, one timestamp per run), add day
dividers, move per-message timestamps to hover/focus reveal. Restyle
bubbles, input, drawer, typing and seen indicators onto the three-layer
system via the Phase 0 `AvatarStack`.

**Phase 5 — sweep.** Absorb T-070. 44px minimum touch targets across the
rebuilt surface. `prefers-reduced-motion` blocks in every rebuilt file that
animates. Update `docs/design.md`'s decisions log and
`src/components/social/README.md`, which currently documents a Framer
Motion dependency the project does not use. `ComponentShowcase` and the
three components only it renders are left untouched per the owner decision
above.

### Invariants (must still work, unchanged, after every phase)

Feed: create post with optional title / code / poll / binary vote / GIF;
edit and delete own post; upvote, downvote and vote switching; flag;
threaded comments with one reply level; comment votes; delete own comment;
poll voting with one vote per session; read-more truncation at 4 content
lines and 15 code lines; onboarding carousel on first visit; rate limiting.

Chat: one global anonymous room; send text; send GIF, sticker and emoji;
typing presence; seen receipts; realtime insert subscription; unread count
feeding the sidebar and the Dynamic Island; 3-messages-per-5s rate limit;
500-word cap.

### Explicitly untouched

- `src/components/social/CodeBlock/CodeBlock.jsx`,
  `CodeBlock.module.css`, and `src/lib/social/codeHighlighter.js`. Owner
  instruction 2026-08-01, and it matches E-008's existing non-goal. The
  binding reason is that `CodeBlock` is **not** social-only: notes render
  through the same component and the same stylesheet
  (`src/components/markdown/MarkdownRenderer.jsx`, and `CodeBlock.jsx`'s
  own `title` docstring about fence meta), so restyling it to match the
  feed would silently restyle every published note. `CodeAttachment` (the
  composer's code *authoring* panel, a different component with no notes
  consumer) **is** in scope.
- The theme token system and `derivePalette()`. This ticket consumes
  tokens, it does not add or retune any.
- The Dynamic Island, which stays `#000` in all modes per `docs/design.md`.
- Schema, RPCs, hooks, and the `usePosts` memoisation contract from T-064.
  This is a presentation-layer rebuild; `PostCard` must stay `memo`-safe
  and keep receiving scalar props.

## Acceptance criteria

- [x] No `text-shadow` glow remains on static text in
      `src/components/social/` or `src/features/chat/` (excluding
      `CodeBlock`). Asserted in the browser across four theme/mode combos by
      walking every `article *` and reading computed `text-shadow`
- [x] Zero raw hex or raw `rgba()` colour literals in the rebuilt
      components, excluding `CodeBlock`, the hue-fixed vote green/red, and
      black-only shadows and scrims. `ComponentShowcase`, `social/Alert`,
      `social/Badge` and `social/Toast` are out of scope and unmodified
- [x] `rgba(255, 208, 138, …)` and `#7FE7FF` no longer appear in
      `PostCard.module.css` or `HomeFeedPage.module.css`
- [x] Every container in the rebuilt surface uses an `--md-surface-*` fill
      with an `--md-outline-variant` hairline, and none uses both a tonal
      fill and an accent-tinted border
- [x] A post can be published without any modal appearing; `TitleModal` is
      deleted and the title is an inline optional field
- [x] The chat panel has a header with a working close control, and five
      consecutive messages from one session render one avatar and one
      timestamp
- [x] `TypingIndicator` and `SeenIndicator` both render through one shared
      avatar-stack primitive
- [x] Post votes and comment votes render through one shared vote control
- [x] Every interactive control in the rebuilt surface is at least 44px on
      a 480px viewport. Measured at 390px over `main` and the chat dialog;
      caught two misses on the first pass (`VoteControl`'s 38px buttons
      inside a 44px track, and the chat input's 40px round buttons)
- [x] Every rebuilt `.module.css` that animates has a
      `prefers-reduced-motion: reduce` block
- [x] Every `@media` rule in the rebuilt files carries a comment naming the
      correct `--breakpoint-*` token (absorbs T-070)
- [x] `CodeBlock.jsx`, `CodeBlock.module.css` and `codeHighlighter.js` are
      byte-identical to their pre-ticket state (`git diff` over
      `src/components/social/CodeBlock` and `src/lib/social/codeHighlighter.js`
      is empty)
- [x] All invariants above verified in a real browser against local
      Supabase, feed and chat, in at least two themes and both modes.
      **One exception, carried to T-091:** the seen receipt only reflects the
      first message of a run. Reproduced identically on the pre-rebuild build,
      so it is not a regression from this ticket
- [x] `docs/design.md` decisions log records the three-layer direction, and
      `src/components/social/README.md` no longer claims Framer Motion

## Found while verifying

Two pre-existing defects surfaced, both ruled out as regressions from this
ticket and filed separately rather than fixed here:

- [T-090](T-090-social-rpc-duplicate-overloads.md) — four social RPCs carry
  stale duplicate overloads, so PostgREST returns `PGRST203` and post delete,
  comment delete, the feed rate limit and the bot blacklist never run. The
  four stale overloads were dropped **by hand on the local database only** so
  this ticket's delete flows could be verified; that change is unmigrated and
  T-090 owns it.
- [T-091](T-091-read-receipt-stalls-on-message-run.md) — the chat read receipt
  latches on the first message a peer reads, so "Seen by" disappears as soon
  as anyone sends twice. A/B'd against the pre-rebuild build, which fails the
  same way.

## References

- [E-008](../epics/E-008-social-feed-overhaul.md) — parent epic; this
  ticket reverses its "Not a visual redesign" non-goal
- T-065, T-073 — the two tickets that moved half this surface to M3, which
  is what created the split this ticket closes
- T-070 — absorbed by Phase 5
- T-064 — the memoisation contract Phase 1 must not break
- [docs/design.md](../docs/design.md) — token table, breakpoints,
  modularity rules, decisions log
- [docs/design/colors.md](../docs/design/colors.md) — `--md-*` role table
  and the filled-or-outlined rule
