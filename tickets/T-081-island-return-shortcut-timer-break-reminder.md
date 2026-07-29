---
id: T-081
title: Dynamic Island — return-to-page shortcut, study timer, hourly break reminder
status: in-progress
severity: low
area: ui
epic: none
created: 2026-07-29
---

## Implementation status (2026-07-30)

Code-complete, verified in a real browser (Playwright + chromium) against the
dev server. Build and stylelint both exit 0.

- `src/hooks/useStudyTimer.js` — deadline-based timer, duration in ms so an
  arbitrary hours + minutes value sits alongside the presets.
- `src/hooks/useBreakReminder.js` — visible-time accumulator, deferred rather
  than dropped when the island is busy.
- `src/components/layout/DynamicIsland/TimerPanel.jsx` — transport. The
  readout is the button into the custom picker.
- `.../TimerSetPanel.jsx` — the expanded hours/minutes panel.
- `.../BreakReminderContent.jsx` — violet `wave-tb` loader + message.
- `.../DynamicIsland.jsx`, `.module.css`, `index.js`, `src/App.jsx` — new
  states, precedence, segmented hover, chat-source tracking.

**Decisions taken after this ticket was first written** (all owner-directed):

1. **Custom time was added**, which the original Suggested fix below did not
   cover. Hours + minutes, steppers (±1h, ±5m) plus typing, clamped to 12h and
   59m, and the island expands into a real panel for it rather than trying to
   fit a picker into a pill.
2. **The entry point is the readout itself**, not a separate icon. A sliders
   icon was built first and removed: the time is the largest, most obvious
   target in the panel, and tapping a time to edit it is the expected gesture.
   A side benefit is that no preset now falsely reads as selected for a custom
   duration.
3. **No completion sound**, for now. Recorded as a deliberate omission rather
   than an oversight. If revisited, the note worth keeping is that a chime
   should fire regardless of tab visibility, unlike the break reminder which
   is suppressed while hidden — a timer finishing in a background tab is
   exactly when a chime matters most.

**Fixed during self review** (2026-07-30), both with browser evidence:

- `useStudyTimer.js` `toggle()` treated `remainingMs === 0` as "nothing to
  run", so after a timer finished the play button silently did nothing and the
  only way back was re-picking a preset. A finished timer now restarts from its
  full duration. Verified with a 1-minute custom timer: reached `timer-done`,
  cleared, then play resumed it (`0:59`).
- Escape from the set-time view dismissed the whole island while its own
  Cancel button returned to the transport. Escape now steps back one level;
  clicking away still dismisses outright. Verified: `timer-set` → Escape →
  `timer` → Escape → `idle`, and outside-click → `idle`.
- `index.js` was missing the `TimerSetPanel` export its siblings all have.

## Summary

Three owner-requested additions to the Dynamic Island, building on T-079's
state machine. A return shortcut so opening chat from the island can be undone
from the island; a study timer; and an hourly "take a break" reminder. All
three are new capability rather than defect repair, which is why this is
`low` severity despite being the larger body of work.

## Evidence

Not a bug report. The three requests, and the constraints each runs into:

- Opening chat from the island (`DynamicIsland.jsx`'s `handleActivate`, added
  in T-079) is currently one-way: the island hands off to the chat panel and
  the only way back is the panel's own close control. The island is still
  clickable while chat is open (`.wrapper` is `z-index: 9999`, `ChatPanel` is
  `50`, `ChatDimOverlay` is `4`), so a return affordance is feasible.
- There is no route-to-title map anywhere in `src/` and nothing sets
  `document.title` per route, so a "back to {page name}" label would mean
  inventing one. The label is therefore a plain "Back".
- `Sidebar` toggles chat with a functional updater
  (`CollapsedView.jsx:71` — `setIsChatOpen?.((p) => !p)`), so any wrapper
  that tracks *how* chat was opened has to keep supporting updater form.
- `GridLoader` (`src/components/effects/smoothui/grid-loader/index.tsx:112`)
  accepts any CSS colour string, not only its five named presets, so the
  break reminder is not restricted to the existing palette.
- Existing GridLoader usage to stay distinguishable from: blue pulse
  `plus-full` (observing), white stagger `frame` (waiting, generating), amber
  stagger `frame` (thinking). Red is spoken for by the error state and green
  by the presence dot and the T-079 progress ring.

## Impact

Without the return shortcut, the island's chat notification is a one-way
door: it interrupts you, you click it, and getting back to what you were
doing needs a different control in a different corner of the screen. The
timer and the break reminder are additive.

## Suggested fix

### Return-to-page shortcut

Track *how* chat was opened, in `App.jsx`, as state rather than a ref (the
island needs to re-render on it). The island opens a 60s return window when
chat was opened from the island; while that window is open, hovering shows
"← Back" and clicking closes chat. The window ends on a 60s timer or as soon
as chat closes by any other route, after which the island reverts to normal
behaviour (hover shows the online count, click opens music) and closing chat
is manual. Owner's framing: *"if i wait for more than 60 seconds then i cant,
it shows me music again so i need to manually return back."*

### Segmented hover + study timer

Navigation decided by the owner from three options: **hover reveals a
segmented pill** — online count on the left, then a divider, then a music
icon and a timer icon. Clicking the pill body still opens music, so existing
muscle memory is untouched; each icon opens its own panel. This is also what
this project's original spec described
(`docs/specs/presence-and-music.md` §States: online count, divider, music
icon on the right), so it is a return to the documented intent rather than a
new idiom. It also leaves room for a third entry later.

Rejected: a tab inside the music panel (hides the timer behind an unrelated
feature, and nests "timer" under "music player"), and sidebar-sets /
island-displays (most discoverable, but splits one feature across two
components).

Timer itself: presets, start/pause, reset, and a countdown. While running
and otherwise idle the island shows a compact ambient countdown, which is
what makes the feature worth having on this surface rather than in a panel
somewhere. On reaching zero it expands with a completion state.

### Hourly break reminder

Fires on **active** elapsed time, not wall clock: the counter pauses while
`document.hidden`. A tab left open overnight should not bank eight reminders
or fire them into a page nobody is looking at.

Unlike a chat notification, a due reminder is **deferred rather than
dropped** when the island is busy (music panel open, live AI state). It is
hourly and deliberate, so showing it a minute late is better than losing it —
the opposite trade-off from T-079's chat gating, and worth a comment at the
call site so the inconsistency reads as deliberate.

Animation, owner delegated the choice: `wave-tb` in `stagger` mode, rounded,
in soft violet `#a78bfa`. No existing state uses violet, a wave, or
top-to-bottom motion, so it is unmistakable against the AI states; a
downward wave reads as winding down rather than working; rounded cells plus
blur keep it gentle rather than alarming.

## Acceptance criteria

- [x] Opening chat from the island, then hovering the island within 60s,
      offers "← Back"; clicking it closes chat and returns to the page.
      *Observed `return` on hover, label "Back", click returned to the page.*
- [x] Opening chat from the **sidebar** never offers the return shortcut.
      *Hover gave `hover`, not `return`.*
- [x] Hovering the pill shows the online count plus a music icon and a timer
      icon; clicking the pill body still opens the music player.
- [x] The timer can be set from a preset, started, paused and reset, and it
      keeps running while the island is collapsed and across route changes.
      *Verified across a genuine client-side route change: `/home` →
      `/social/feed`, still running at 24:55, entrance not replayed.*
- [x] While a timer runs and nothing outranks it, the collapsed island shows
      the remaining time.
- [x] Reaching zero expands the island into a completion state that clears
      itself, **and play restarts it from the full duration.**
- [x] A custom time can be set in hours and minutes by clicking the readout;
      steppers and typing both work, clamped to 12h / 59m; Start is disabled
      at zero; Cancel leaves a running timer untouched; the countdown shows
      hours only once they exist.
- [x] After an hour of active (visible) time the island opens with the violet
      `wave-tb` loader and "It's been an hour, reminder to take a break".
      *Fake clock, with `visibilityState: visible` asserted so the
      visible-time gate could not pass vacuously.*
- [x] A reminder that comes due while the island is busy is shown once it
      frees up rather than lost, and a chat message arriving while the
      reminder is up does not displace it.
- [x] Escape steps back one level from the set-time view; clicking away
      dismisses the island outright.
- [x] `docs/design.md` and `docs/documentation.md` state tables updated.

**Not verified at runtime:**

- *"After 60s the offer is gone"* — the 60s window was not waited out in the
  browser; only its arming and its use were exercised. The expiry is a single
  `setTimeout` in the same effect that arms it.
- *"Closing chat by any other means ends the window immediately"* — covered by
  construction (the effect keys on `isChatOpen`), not by an observed run.
- *`prefers-reduced-motion` for the timer and reminder specifically* — the
  island's entrance was verified under emulated reduced motion (`hidden` →
  `collapsed`, no `greeting`); the timer and reminder inherit the same
  `useReducedMotion` gate and the muted CSS transitions, but were not
  separately re-checked under it.

## References

- T-079 — the state machine, precedence chain and notification gating this
  builds on. Read `displayStateFor()` before adding a state.
- [docs/specs/presence-and-music.md](../docs/specs/presence-and-music.md) —
  the original segmented-pill design, now partially reinstated. Note the file
  is otherwise historical and inaccurate (see T-079's References).
- Owner decisions, 2026-07-29: segmented hover for timer navigation; commit
  T-079 before starting this; break-reminder colour and pattern delegated.
