---
id: T-079
title: Dynamic Island overhaul — state machine repair, music player correctness, chat notifications
status: in-progress
severity: medium
area: ui
epic: none
created: 2026-07-29
---

## Implementation status (2026-07-29)

Code-complete across all three phases, verified in a real browser against the
local Supabase stack (Playwright + chromium, messages injected through psql to
simulate inbound traffic).

- `src/components/layout/DynamicIsland/DynamicIsland.jsx` — rewritten. Two
  independent axes (`phase` for the entrance lifecycle, `intent` for what the
  visitor is doing) with everything else derived by precedence in
  `displayStateFor()`. `'ai-active'`, `previousAIStateRef`,
  `handleMusicIconClick` and the empty error `useEffect` are gone.
- `ChatNotificationContent.jsx` — new; the notification pill's content.
- `src/hooks/useChatNotification.js` — new; coalescing, cooldown, budget and
  priority gating.
- `src/hooks/useChat.js` — own-`session_id` filter, plus a `lastIncoming`
  return for the island. Note this file also picked up T-078's `send_message`
  RPC mid-session; that change is unrelated and was left alone.
- `src/hooks/usePresence.js` — added `presenceSynced` so the greeting can wait
  for a real count.
- `src/components/layout/MusicPlayer/MusicPlayer.jsx` — `onStateChange` drives
  `isPlaying`, ENDED auto-advances, `cueVideoById` preserves paused-ness across
  a skip, `getProgress()` feeds the ring.
- `src/App.jsx` — single source of truth for the track, `isPlaying` starts
  false and is corrected by the player, `handleAIStateChange` actually wired,
  `OnlineCountContext` deleted, `MusicPlayer` no longer unmounted on `/admin`.
- `DynamicIsland.module.css` — `greeting`/`chat` states, progress ring,
  focus-visible ring, sr-only live region, reduced-motion block last in the
  file so it outranks what it mutes. Also collapsed 40 lines of
  one-declaration `cursor: pointer` state rules into one.

**Correction to this ticket's own Evidence.** The claim under Impact that "any
API failure shows a red dot with no message that never clears" was wrong: a
sweep of every `onAIStateChange` call site shows only `idle`, `observing`,
`waiting` and `thinking` are ever fired anywhere in the app. `error`,
`generating` and `processing` were already unreachable, so the broken
`handleAIStateChange` wiring had no observable symptom. The wiring is fixed
regardless (it's cheap, and the states are documented), but no caller
exercises it. Wiring pages' existing failure paths to fire `error` is a
separate piece of work, not folded in here.

**Not verified at runtime:** that closing the music panel returns the pill to a
*still-live* AI state. Focusing the pill moves focus out of the page's input,
which makes the page itself fire `idle`, so the scenario can't be produced from
the UI. The precedence chain handles it by construction — `displayStateFor()`
re-reads the `aiState` prop every render and stores nothing.

## Summary

The Dynamic Island was ported from
[smoothui.dev/docs/components/dynamic-island](https://smoothui.dev/docs/components/dynamic-island)
and hand-modified until it worked, leaving three problems that compound: a
state machine with a sentinel value that permanently disables the hover
state, a music player whose UI lies about what is actually playing, and a
pile of dead code from features that were wired up and then abandoned. This
ticket repairs all of that, adds the requested expanded-then-collapse
entrance animation, and gives the island its first genuinely new capability:
coalesced chat notifications.

Filed as one ticket at the owner's request. The three parts are separable
(see the phases under "Suggested fix") and can land as separate commits.

## Evidence

### Part A — state machine and dead code

- `src/components/layout/DynamicIsland/DynamicIsland.jsx:90` —
  `previousAIStateRef` is assigned the current `aiState` but **never reset
  back to `'idle'`**. Combined with `:49` and `:56`, which set
  `state = 'ai-active'` when the music panel closes, this means: once any
  page has fired a non-idle `aiState`, closing the music player leaves
  `state === 'ai-active'` permanently. `handleMouseEnter` at `:73` requires
  `state === 'idle'`, so the online-count hover never fires again for the
  rest of the session. **Highest-severity item in this ticket.**
- `'ai-active'` has no rule in `DynamicIsland.module.css`. The stylesheet
  defines `idle`, `hover`, `music`, `thinking`, `generating`, `observing`,
  `waiting`, `processing`, `error` (`:52-94`). `'ai-active'` is a sentinel
  that leaked into the same variable the CSS reads via `data-state`
  (`DynamicIsland.jsx:135`), which is the root cause of the bug above.
- `DynamicIsland.jsx:96-101` — `handleMusicIconClick` is defined and
  attached to nothing. Dead.
- `DynamicIsland.jsx:34-42` — a `useEffect` that sets a 3-second timer whose
  callback body is an empty block with a comment. Does nothing.
- `src/App.jsx:69-80` — `handleAIStateChange`, which owns the only
  `setErrorMessage` call and the only error auto-reset, is **never passed to
  anything**. `App.jsx:118` passes `onAIStateChange={setAIState}` instead.
  Consequence: `errorMessage` is permanently `''`, so the `error` state
  renders a red dot with no text, and it never auto-collapses. Both
  `docs/design.md:249` and `docs/documentation.md:289` document behaviour
  ("auto-collapses after 3s", "error string") that cannot currently happen.
- `src/App.jsx:14` + `:116` — `OnlineCountContext` is created and provided
  with **zero consumers** anywhere in `src/`.
- `DynamicIsland.jsx:146` — content swaps use a `key` change on a
  `motion.div` with no `AnimatePresence`, so outgoing content disappears
  instantly instead of animating out. Upstream uses
  `AnimatePresence mode="popLayout"`.
- No `prefers-reduced-motion` handling anywhere in the component. Upstream
  smoothui handles this via Motion's `useReducedMotion`; the port dropped
  it. The repo honours reduced-motion in 12+ other places
  (`src/components/ui/Card/Card.jsx:41`,
  `src/components/ui/ScrambleText/ScrambleText.jsx:47`,
  `src/components/ui/AsciiCard/AsciiCanvas.jsx:19`, and others), making the
  island the outlier.
- The pill is a bare `<div onClick>` (`DynamicIsland.jsx:132-144`): no
  `role`, no `tabIndex`, no `aria-live` on state changes, no focus ring.
  `Escape` closes the music panel (`:53-58`) but no keyboard path opens it.

### Part B — music player correctness

- `DynamicIsland.jsx:111-127` — `handleSkipBack` / `handleSkipForward`
  change the track but never touch `isPlaying`. YouTube's `loadVideoById`
  (`src/components/layout/MusicPlayer/MusicPlayer.jsx:66`) **autoplays**,
  so skipping while paused starts audio while the button still shows ▶.
- `MusicPlayer.jsx:33-34` — `loop: 1` with `playlist: videoId` only applies
  to the video the player was constructed with. After the first
  `loadVideoById`, looping is lost and there is no `onStateChange` handler
  to advance or restart, so playback silently stops when the track ends.
- `src/App.jsx:107` — `MusicPlayer` is gated on `!isAdminRoute` while the
  island at `:86-93` renders unconditionally. Navigating to `/admin`
  therefore destroys the player (music stops mid-song) and leaves the
  island's play/skip buttons no-oping against a null ref.
- `src/App.jsx:20` — `isPlaying` initialises to `true` on faith. The player
  starts muted (`MusicPlayer.jsx:38`) because browsers block unmuted
  autoplay; if autoplay is blocked outright the UI is wrong from first
  paint, and with no `onStateChange` subscription it can never self-correct.
- Track state is duplicated: `currentSongIndex` lives in the island
  (`DynamicIsland.jsx:18`), `currentSongId` lives in `App.jsx:25`, synced
  one-way through `onSongChange`.
- `DynamicIsland.jsx:182` — `currentSong.artist || 'mooner.dev'` means the
  three entries in `src/config/songs.js` with `artist: ''` (Signalis, Umbra
  IX, Dead Stars) are all miscredited to mooner.dev.

### Part C — chat notifications

- `src/hooks/useChat.js:59-68` — the realtime INSERT handler does **not
  filter by `session_id`**. The only reason your own messages don't inflate
  `unreadCount` today is the accident that the panel must be open to send,
  which `:63` already excludes. Close the panel quickly after sending and
  your own message counts against you.
- `src/App.jsx:27` and
  `src/features/chat/components/ChatPanel/ChatPanel.jsx:15` both call
  `useChat`, each opening its own realtime channel (unique names via
  `useChat.js:15`). Driving notifications from App's instance is safe today,
  but any notification logic placed inside the hook would fire twice.
- `db/sql/0001_init_messages.sql:9` — `messages` carries `session_id TEXT`
  and no display name. The room is one global anonymous channel, so there is
  no sender name available for a notification label.
- `db/sql/0044_chat_message_attachments.sql` — an attachment-only message
  stores `content: ''` (the column stays `NOT NULL`), so a snippet-based
  label needs a fallback.
- `src/hooks/useChat.js:65` — `unreadCount` already caps at 10, so "10+"
  semantics exist to reuse.
- `src/hooks/useChat.js:12` — `lastReadAtRef` initialises to mount time, so
  messages that predate page load correctly never count as unread.

## Impact

**Part A.** Every visitor who uses any AI-backed page (tree insert/delete,
ERD, any logic tool) and then opens the music player loses the online-count
hover for the remainder of their session, with no recovery short of a
reload. The green dot stays but becomes inert, which reads as a broken
feature rather than a deliberate one. Separately, the `error` state cannot
display its message or auto-clear, though see the correction at the top of
this file: no caller fires `error`, so that defect has no live symptom.

**Part B.** A visitor who skips a track while paused hears audio start while
the UI shows ▶, then finds the pause button appears to do nothing on first
press (it flips `isPlaying` to `true`, matching reality, but the audio keeps
playing). A visitor who reaches the end of any skipped-to track gets silence
with a UI still showing ▶. Any admin navigating to `/admin` loses playback
entirely and gets dead controls.

**Part C.** Not a defect, a missing capability. The Sidebar badge is
currently the only signal that anything happened in chat, and it is easy to
miss. Adding notifications naively (one pill per message) would be worse
than nothing in a single global room where every visitor's message is a
candidate notification.

## Suggested fix

### Phase A — one state machine, no sentinels

Collapse to a single derived state rather than crossing local `state` with
the `aiState` prop. Delete `'ai-active'` entirely: if the island needs to
know whether AI activity is live, it should read the `aiState` prop
directly, which is already the source of truth. Remove
`previousAIStateRef`, `handleMusicIconClick`, the empty error `useEffect`,
and `OnlineCountContext`. Fix the `handleAIStateChange` wiring at
`App.jsx:118` so `errorMessage` and the error auto-reset actually work, or
delete `handleAIStateChange` and move the auto-reset into the island. Add
`AnimatePresence mode="popLayout"` for content swaps, `useReducedMotion`
gating, and basic a11y (`role="button"`, `tabIndex`, keyboard open,
`aria-live="polite"` for state changes).

**Entrance animation (the owner's request):** add a `greeting` state that
the mount effect enters, rendering the green dot plus "{n} online" expanded,
then collapsing to `idle` after a hold. Two constraints:

- `onlineCount` starts at `1` (`usePresence.js:5`) and the Supabase presence
  sync lands async. Gate the reveal on first presence sync **or** the
  existing 3s timeout, whichever comes first, so it cannot flash "1 online"
  and then jump to "4 online" mid-hold.
- The island lives outside `<AppRoutes>` and so does not remount on
  navigation. The greeting is therefore once per page load already; only
  reach for `sessionStorage` if once per *session* is wanted instead.

### Phase B — music player tells the truth

Subscribe to YouTube's `onStateChange` and derive `isPlaying` from the
player rather than from optimistic local state. That single change fixes the
skip-while-paused desync, the wrong-from-first-paint case when autoplay is
blocked, and gives the hook needed to auto-advance when a track ends
(replacing the `loop`/`playlist` approach that breaks after the first
skip). Make the track a single source of truth (lift `currentSongIndex` into
`App.jsx` alongside `currentSongId`, or keep it wholly in the island and
pass only the id down). Stop unmounting `MusicPlayer` on `/admin`, or hide
the island's music affordance there so the controls are never dead. Fix the
`artist` fallback so an empty string renders as empty rather than
mooner.dev. Optional polish once `onStateChange` exists: progress ring
around the album art, marquee for long titles.

### Phase C — coalesced chat notifications

A **queue is the wrong model** here. Upstream smoothui ships a notification
queue, which suits per-app alerts; in one global room it guarantees spam,
turning ten messages into ten sequential pops. Use **coalescing** instead:
the first message pops the pill, and subsequent messages within the burst
window mutate the same pill in place (the existing `layout` animation makes
the growth look intentional), relabelling to "3 new messages".

Anti-spam gates, in priority order:

| Gate | Mechanism | Status |
|---|---|---|
| Panel open | `useChat.js:63` already guards on `isChatOpenRef`, and App's instance receives `isChatOpen` | exists |
| Own messages | Filter `payload.new.session_id === localStorage.getItem('session_id')` | missing today |
| Burst coalescing | One pending-notification object with a count; reset after ~4s of silence | new |
| Cooldown | After dismissal, ~30s refractory window where messages only bump the Sidebar badge | new |
| Session budget | After ~5 pops in a session, stop popping until the user opens chat | new |

Priority rules matter as much as the rate limits. Chat is the island's
**lowest-priority occupant**: it must never preempt the `music` state (the
user is actively interacting) and never preempt an active `thinking` or
`generating` state (that is task feedback the user is waiting on). When a
notification is blocked, **drop it rather than defer it**: a chat
notification that surfaces 40 seconds late is pure noise, and the Sidebar
badge already carries the durable signal. That division of labour is the
actual anti-spam story, and it is what lets the island be stingy: the island
is the transient, interruptive, strictly-budgeted channel; the badge is the
lossless one that never drops a message.

Hover should pause auto-dismissal so a ~4s window stays readable without
lingering. Consolidating the two `useChat` subscriptions into one is the
safer foundation but is not strictly required if notifications are driven
only from App's instance.

## Open decisions

1. **Notification label.** ~~`messages` has no display name column~~ —
   **resolved: built as (a)**, an anonymous "New message" / "{n} new messages"
   plus a content snippet, per the recommendation below. A pseudonym scheme
   derived from `session_id` remains available later; it would only change
   `ChatNotificationContent.jsx`. Original framing: `messages` has no display
   name column, so the options were (a) anonymous plus snippet, or (b) a
   stable pseudonym derived from `session_id`. Recommendation was (a) for v1,
   since the room is deliberately anonymous and (b) invites a naming scheme
   the rest of the chat UI does not currently have.
2. **Busy / hidden-tab suppression.** Skipping notifications while focus is
   in an input (note editor, post composer, Monaco playgrounds) or while
   `document.hidden` is true was considered and deliberately deferred. The
   five gates above are judged sufficient for v1 without adding a config
   surface. Revisit if it still feels noisy in use.

## Acceptance criteria

Verified in a real browser unless noted. Method: Playwright + chromium against
the dev server and the local Supabase stack, with inbound chat messages
injected via `docker exec … psql` so they arrive over realtime like anyone
else's.

- [x] Hovering the pill shows the online count reliably, including after AI
      activity has fired and the music player has been opened and closed.
      *Exercised on `/logic/tableaux`: focusing the formula input produced a
      real `observing` state, then music was opened and closed, then hover
      returned `hover`. This is the path the old code died on.*
- [x] `'ai-active'` no longer exists; every value written to `data-state`
      is accounted for. *Note: `greeting`, `idle` and `hover` deliberately
      carry no dedicated CSS rule — they use the default `.content` box and
      the layout animation supplies the width change. Only `music`, `chat`
      and the AI states need their own sizing.*
- [x] `handleMusicIconClick`, the empty error `useEffect`, and
      `OnlineCountContext` are deleted. *Confirmed by grep: no references
      remain anywhere in `src/`.*
- [x] The `error` state displays its message and auto-clears after 3s.
      *Wiring fixed and reachable, but not exercised at runtime: no caller
      fires `error` (see the correction at the top of this file).*
- [x] On first load the pill drops in expanded showing the green dot and
      "{n} online", holds, then collapses to the small state. The count
      shown never changes mid-hold. *Reveal waits for `presenceSynced` (5s
      cap) and the count is frozen when the greeting starts.*
- [x] With `prefers-reduced-motion: reduce`, the island changes state
      without spring/slide animation. *Phase sequence observed under emulated
      reduced motion was `hidden` → `collapsed`, never entering `greeting`.*
- [x] The pill is reachable and operable by keyboard. *Focus then Enter
      opened the music panel; Escape closed it; a `:focus-visible` ring was
      captured.* State changes are announced through a stable `role="status"`
      live region — *correct by construction, not machine-verifiable without
      a screen reader.*
- [x] Skipping tracks while paused does not start playback; the play/pause
      icon always matches actual player state. *Paused, skipped, transport
      stayed "Play music" while the title advanced; resuming then played the
      cued track.*
- [x] A track reaching its end advances rather than falling silent, including
      after a skip. *Seeked the 3600s mix to 3597s via the iframe's
      postMessage API; the pill advanced to the next track and kept playing.*
- [x] Music continues playing across navigation to `/admin`. No control is
      ever a silent no-op. *After navigating to `/admin` the transport still
      read "Pause music", and pressing pause there registered.*
- [x] Tracks with `artist: ''` do not display "mooner.dev". *The artist line
      is omitted entirely for those entries.*
- [x] A new chat message from another session pops the island once; several
      in quick succession produce one pill labelled with a count.
      *Three messages inside the burst window produced exactly one pill
      reading "3 new messages".*
- [x] Your own sent messages never produce a notification.
- [x] Notifications do not appear while the chat panel is open, during the
      cooldown window, after the session budget is spent, or while the island
      is showing the music panel or an active AI state. *All four gates
      observed: cooldown dropped the next message, the 6th pop of a session
      was refused after five, and messages arriving during `music` and during
      `observing` left both states untouched.*
- [x] Attachment-only messages (`content: ''`) render a sensible label.
      *A `gif` attachment rendered "Sent a GIF".*
- [x] Hover holds a shown notification open past its dismiss window.
      *Still `chat` after 7s hovered; dismissed once the pointer left.*
- [x] `docs/design.md` (§Dynamic Island) and `docs/documentation.md`
      (§Dynamic Island States) are updated to match the final state list.

## Out of scope

- Mobile touch-target and responsive work on the island: that is
  **T-017** under [E-002](../epics/E-002-mobile-optimization.md). Note that
  E-002 line 47 still shows T-017 unchecked even though commit `b403883`
  ("fix: make DynamicIsland responsive at phone widths (T-017)") added the
  `@media (max-width: 480px)` block; that checkbox appears stale and should
  be reconciled separately rather than in this ticket.
- Unifying `src/components/admin/ToastNotification.jsx` and
  `src/components/social/Toast/Toast.jsx` into the island as a general
  notification host. Considered and deferred: worth doing, but it is a
  cross-cutting change to two existing surfaces and should not ride along
  with this one.
- Editor save status ("Saving…" / "Saved") in the island, sourced from
  `EditorNavbar`'s existing `saving`/`unsaved` state. Blocked on Phase B's
  `/admin` fix anyway.
- Presence detail ("4 online · 2 reading Notes"), which would need
  `usePresence`'s `channel.track()` payload extended with the current path.
- Theme quick-toggle in the expanded state: overlaps the Appearance dialog
  from T-062.

## References

- [docs/specs/presence-and-music.md](../docs/specs/presence-and-music.md) —
  the original spec. Note it predates the current implementation and is
  now inaccurate in several places (it specifies polling-based presence
  rather than the Supabase presence channel actually used, and forbids
  Framer Motion, which the component now depends on). Worth marking as
  historical.
- [docs/design.md](../docs/design.md) §Dynamic Island (line 240) — state
  list and the "pill is always `#000`" rule, which this ticket does not
  change.
- [docs/documentation.md](../docs/documentation.md) §Dynamic Island States
  (line 289) — the state/trigger/label table.
- [smoothui.dev/docs/components/dynamic-island](https://smoothui.dev/docs/components/dynamic-island)
  — upstream component this was ported from.
- T-017 / [E-002](../epics/E-002-mobile-optimization.md) — mobile island
  work, kept separate.
- T-062 — Appearance dialog, source of the "never theme the pill" rule.
