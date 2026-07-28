---
id: T-065
title: Composer, code attachment, comment thread, and chat input have broken affordances and pre-T-062 hardcoded colours
status: done
severity: medium
area: social
epic: E-008
created: 2026-07-27
---

## Summary

The three text-entry surfaces in the social area (post composer, comment
thread, chat input) each shipped controls that misreport their state, sit
below touch-target size, or use colours hardcoded before the theme system
landed in T-062. The code attachment editor was the worst of them: its line
numbers did not scroll with the code and never lined up with it in the first
place. The chat send button is invisible in light themes.

## Evidence

**Code attachment gutter never matched the code.**
`CodeAttachment.module.css:129-166` (old) put the line numbers in a separate
`overflow: hidden` div with no scroll link to the textarea, so they stayed
put while the code scrolled. Independently, the metrics did not agree:
`.lineNumber` was `font-size: 0.75rem; height: 1.28em` (0.96rem) against
`.textarea` at `font-size: 0.82rem; line-height: 1.6` (1.31rem), so numbers
drifted further from their lines with every row. The textarea also had
`resize: vertical` inside a `max-height: 400px` flex row, letting it grow out
of its own container.

**Pre-T-062 hardcoded colours.** T-062 introduced 9 themes plus light mode
built on `--color-accent`, `--color-accent-rgb`, and friends
(`src/styles/global.css:15-215`). These ignore it:

- `CodeAttachment.module.css` — `#7aa2f7` and `#ff79c6` throughout
- `CommentSection.module.css:89` — `.btnPrimary:hover` was `#f97316`
- `CommentItem.module.css` — `.btnPrimary` on `--color-accent-alt` with the
  same `#f97316` hover; `.activeUp`/`.activeDown` used two accent tokens
  that read as the same colour in most themes
- `ChatInput.module.css:59-73` — send button `background: #ffffff`, hover
  `#e0e0e0`, i.e. a white circle on a white surface in any light theme

**Missing or misleading affordances.**

- `CodeAttachment.jsx:70-80` (old) — `<select>` with `appearance: none` and
  no replacement chevron, so it did not read as a dropdown
- `CodeAttachment.jsx:122-126` (old) — footer was a 💡 emoji plus
  "Syntax highlighting will be applied when posted"
- `CommentSection.jsx:79-108` (old) — the composer rendered *below* the
  whole comment list, so replying to a busy post meant scrolling past every
  comment to reach the box. No avatar, no counter, no cancel, no empty state
- `CommentItem.module.css:67-82` (old) — action buttons were zero-padding
  text with a 14px gap, roughly a 16px tap target, and lifted on hover
- `CommentItem.jsx:130-137` (old) — reply box was a fixed `rows={3}` while
  the two sibling composers auto-grew
- `ChatInput.module.css:48-53` (old) — `.bottomRow` reserved
  `min-height: 32px` permanently, but the send button only mounted once
  `value.length > 0`, leaving a dead strip under the field
- `ChatInput.jsx:50-53` (old) — rate-limited sends returned on an explicit
  `// Silently ignore - no error message`; the word cap likewise refused
  keystrokes with no explanation
- `ChatInput.jsx:16-21, 78-89` (old) — resize logic duplicated between an
  effect and the change handler, fighting a CSS `transition: height 0.1s`

**No mobile breakpoints.** `PostComposer`, `CodeAttachment`,
`CommentSection`, `CommentItem`, and `PollBuilder` had zero `@media` rules.

## Impact

A user on any light theme sees no send button in chat, just a blank circle.
A user attaching code sees line numbers that disagree with their code and
then slide out of register entirely on scroll. A user replying to a post
with 30 comments scrolls past all of them to find the input. A user who
trips the 3-messages-per-5-seconds chat limit sees their message vanish with
no feedback and reasonably concludes chat is broken.

## Fix applied

Material 3 structure (sizing, state layers, button hierarchy, 40px+ touch
targets) over the existing accent tokens; the cyberpunk syntax theme in
`CodeBlock.module.css` is deliberately untouched.

- `CodeAttachment` — gutter and textarea share `--code-font-size`,
  `--code-line-height`, `--code-pad-y` declared once on `.wrapper`, and the
  gutter is driven from the textarea's `onScroll`. Added a chevron to the
  select, an auto-detect assist chip, Tab-to-indent, a remove action, and a
  notice when a paste is trimmed at 1000 lines. Emoji footer removed.
- `PostComposer` — feature buttons became M3 toggle chips (outlined off,
  tonal-filled on, `aria-pressed`); the Post button is a 40px filled button
  with an icon and a spinner. Counter hides below 800 chars. Cmd/Ctrl+Enter
  submits. The button stays clickable while empty so the existing shake
  still explains itself rather than presenting a dead control.
- `CommentSection` — composer moved above the thread with an avatar, action
  row revealed on focus, counter, cancel, empty state, Cmd/Ctrl+Enter.
- `CommentItem` — action buttons are pills with real hit area; reply box
  auto-grows and gains a counter and a disabled state; up/down now use the
  same green/red as `PostActions`.
- `ChatInput` — single row, send button always present with a disabled
  state, themed on `--color-accent`; rate-limit and word-cap now surface a
  transient hint; one resize path; `enterKeyHint="send"`; 16px font on
  mobile to stop iOS zoom-on-focus.
- Breakpoints added to all five files that had none.
- Two `rgba(var(--color-fg-rgb), 0.4)` disabled-text colours were caught by
  the LT-001 stylelint contrast rule and moved to
  `var(--md-on-surface-variant)`.

## Acceptance criteria

- [ ] No hardcoded hex colours remain on themed surfaces in the composer,
      comment, or chat-input CSS (the cyberpunk syntax palette in
      `CodeBlock.module.css` is intentionally exempt) — **unticked
      2026-07-28, see Correction below**
- [x] Code attachment line numbers track the textarea's scroll position and
      share its line metrics
- [x] Comment composer renders above the thread
- [x] Rate-limited and length-capped input produces visible feedback
- [ ] Interactive controls reach 40px on mobile breakpoints — **unticked
      2026-07-28, see Correction below**
- [x] `npm run build` and `npm run lint:css` pass

## Correction (2026-07-28)

A verification pass read all five components against the code on disk. The
ticket's core claims hold: the gutter genuinely syncs and shares its
metrics, the comment composer genuinely sits above the thread, refused chat
input genuinely surfaces a hint, and both gates genuinely pass (re-run on
Node 22; Node 18 cannot run stylelint here). This ticket stays `done` for
that reason. Two criteria were ticked while unmet, and are unticked above
rather than quietly amended, because a closed ticket whose checklist is
wrong is worse than an open one.

**Criterion 1 was false but nearly true.** The four colours named in
Evidence were all genuinely fixed. What the sweep missed was a wider
danger/error family. Fixed on 2026-07-28, in this ticket's spirit rather
than as new scope: a `--color-danger` / `--color-on-danger` token pair now
exists in `src/styles/global.css`, and all 32 `#FF5FA2` and
`rgba(255, 95, 162, …)` occurrences, spread over 30 lines in `PostCard`,
`PostComposer` and `CodeAttachment`, point at it. The token is deliberately theme-invariant,
defined once in `:root` and overridden once in a new `[data-mode='light']`
block, on the same reasoning that keeps the vote green/red flat: error is
one system semantic, not a brand accent. It needed a light override because
`#FF5FA2` measures 7.1:1 on the dark surfaces but only 2.7:1 on the light
ones, so it had been failing AA as text on every light theme everywhere it
was used. `CodeBlock.module.css` is untouched, as the criterion exempts it.

What still remains under this criterion — `#f87171`, the `#dc2626` family
in `CommentItem`'s delete-confirm, and some `rgba(0, 0, 0, …)` shadows — is
tracked in **T-070**.

**Criterion 5 was false in two places**, neither noted at the time:
`CommentItem`'s `.actionBtn` is 36px rather than 40px on mobile, and
`PollBuilder` has no `@media` rules at all, which also makes the "Fix
applied" line "breakpoints added to all five files that had none" wrong,
since `PollBuilder` is one of the five it names. Both tracked in **T-070**.

**A contrast bug this ticket's own fix introduced, now fixed.** Moving the
primary buttons onto `--color-accent-bright` for hover was correct in dark
themes, where that token is a lighter tint and raises contrast, but
inverted in light themes, where the same lighter tint collapses it against
a near-white background: hub/light went 4.5:1 at rest to 2.5:1 on hover,
supabase/light to 1.9:1, cyan/light to 2.2:1, and all nine light themes got
strictly worse on hover. `CommentSection`, `CommentItem` and `ChatInput`
now use an M3 state layer — the content colour at 8% over an unchanged base
— which is bounded and cannot invert the pass/fail state in either mode.
`PostComposer`'s `.postBtn` did not have this bug; its rest state is already
a two-stop gradient carrying both colours, so its hover only reverses the
gradient direction. Separately, `PostCard`'s `.btn.btnDanger:hover` was
blending the danger colour into `--color-accent-bright`, so a destructive
action's hover hue drifted toward whatever accent the viewer's theme used;
it now uses the same state layer over the danger fill.

The LT-001 stylelint rule caught none of this: it inspects `color` for
low-alpha white only, so a `background` swap is invisible to it.

## Remaining verification

Not yet checked in a real browser at phone width, or against each of the 9
themes plus light mode. The highest-value manual pass is the chat send
button and the comment primary button in a light theme, since those are the
two that were previously invisible or off-brand.

## References

- E-008 — social feed and chat overhaul
- T-062 — the theme token system these components need to respect
- LT-001 — the stylelint contrast rule that caught the disabled-text colours
