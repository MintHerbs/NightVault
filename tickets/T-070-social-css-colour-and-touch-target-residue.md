---
id: T-070
title: Social CSS still carries un-tokenised danger colours, sub-40px mobile controls, and mislabelled breakpoint comments
status: backlog
severity: low
area: social
epic: E-008
created: 2026-07-28
---

## Summary

T-065 reworked the composer, comment thread and chat input but did not
finish three of its own sweeps. Two of its acceptance criteria were ticked
while still unmet; both have been corrected in that ticket and the residue
is tracked here. None of this is user-blocking, which is why it is `low`
rather than a T-065 reopen.

## Evidence

**Danger colours that the `--color-danger` token now covers.** The token
was added on 2026-07-28 (`src/styles/global.css`, `:root` plus the
`[data-mode='light']` block) and the `#FF5FA2` family was retargeted to it
across `PostCard`, `PostComposer` and `CodeAttachment`. These were a
different literal and were left alone:

- `CommentSection.module.css:194` — `.error` is `color: #f87171`
- `CommentItem.module.css:296-311` — `.btnDanger` is `#dc2626` /`#ef4444`
  with `color: #fff`, and `.deleteConfirm` uses `rgba(220, 38, 38, …)`.
  This is the same delete-confirm affordance as `PostCard`'s `.confirm`,
  which now uses the token, so the two render in different reds

Both predate the token existing. `#dc2626` on `#fff` is 5.9:1 and passes,
so this is consistency rather than a contrast defect.

**Deliberately exempt, listed so a future sweep does not "fix" them:**
`CommentItem.module.css:164-179` (`#22c55e`/`#ef4444` vote states, which
match `PostActions.module.css:47,51` on purpose — vote semantics are
hue-fixed across themes), and all 13 `#FF5FA2` uses in
`CodeBlock.module.css`, which are the cyberpunk syntax palette that E-008
explicitly keeps.

**Undecided, not obviously wrong:** `PostComposer.module.css:12,23,221,228`
uses `rgba(0, 0, 0, …)` for drop shadows and a scrim, and `:222` puts
`#fff` on that scrim. Shadows and scrims carry no text-contrast
requirement, so these may be correct as literals.

**Controls below 40px on mobile.**

- `CommentItem.module.css:355-358` — `.actionBtn` is raised to 36px, not
  40px, in the `max-width: 640px` block. This is the upvote / downvote /
  reply / delete row, the most-tapped control in a thread
- `PollBuilder.module.css` — has **zero** `@media` rules, despite T-065
  claiming "breakpoints added to all five files that had none" and naming
  `PollBuilder` as one of the five. `.input` computes to roughly 32px,
  `.removeBtn` to 28px and `.addBtn` to 22px at every viewport width

**Breakpoint comments name the wrong token.** `docs/design.md:99-101`
defines `--breakpoint-sm: 480px`, `--breakpoint-md: 640px`,
`--breakpoint-lg: 768px`, and requires a comment naming the token above
each rule because CSS custom properties cannot be read inside a `@media`
condition. Six files get this wrong:

- `PostCard.module.css:397`, `PostComposer.module.css:310`,
  `CommentSection.module.css:199`, `CommentItem.module.css:331`,
  `CodeAttachment.module.css:221` — all label `max-width: 640px` as
  `/* --breakpoint-sm */`; that value is `--breakpoint-md`
- `ChatInput.module.css:115` — labels `max-width: 768px` as
  `/* --breakpoint-md */`; that value is `--breakpoint-lg`

The pixel values are all real tokens, so the "no new one-off pixel
breakpoints" rule holds; only the comments are wrong.

## Impact

A user on a phone tapping upvote on a comment gets a 36px target and, in
`PollBuilder`, a 22px "+ Add option" link, both under the 40px minimum
E-008 set as its design direction; mis-taps on the vote row are the likely
observable symptom. A user who opens the delete-confirm on a post and then
on a comment sees two different shades of red for the same action. A
developer reading any of the six CSS files and trusting the breakpoint
comment picks `--breakpoint-sm` for a new rule and lands on 480px, which is
a different layout tier from the 640px the surrounding rules use.

## Suggested fix

1. Point `CommentSection`'s `.error` and `CommentItem`'s `.btnDanger` /
   `.deleteConfirm` at `var(--color-danger)`, `var(--color-danger-rgb)` and
   `var(--color-on-danger)`, matching what `PostCard.module.css` now does.
2. Raise `.actionBtn` to 40px in `CommentItem`'s mobile block. `.actions`
   already sets `flex-wrap: wrap` and `.meta` gains it at that breakpoint,
   so wrapping to two lines is already handled.
3. Give `PollBuilder.module.css` a `max-width: 640px` block sizing
   `.input`, `.removeBtn` and `.addBtn` to 40px.
4. Correct the six breakpoint comments. Separately decide whether
   `ChatInput` should move from 768px to 640px so the chat input and the
   composer change tier at the same width; today, between 641px and 768px
   the chat input is in mobile sizing and the composer is not.

## Acceptance criteria

- [ ] No danger-signal colour literals remain in the social CSS outside
      `CodeBlock.module.css` (syntax palette) and the vote states in
      `CommentItem`/`PostActions`
- [ ] Post and comment delete-confirm affordances render in the same colour
- [ ] `.actionBtn` and all `PollBuilder` controls reach 40px at
      `max-width: 640px`
- [ ] Every `@media` rule in the social CSS is preceded by a comment naming
      the token that actually matches its pixel value
- [ ] `npm run build` and `npm run lint:css` pass (Node 20+; the default
      Node 18 cannot run stylelint here)

## References

- T-065 — the ticket this completes; its criteria 1 and 5 were corrected on
  2026-07-28 to point here
- E-008 — social feed and chat overhaul, which set the 40px touch-target
  direction
- T-062 — the theme token system
- `docs/design.md` §Breakpoints — the token table and the comment rule
- LT-001 — the stylelint contrast rule, which inspects `color` only and so
  catches none of the above
