---
id: T-094
title: "Sentinel: expand Dynamic Island personality across the site"
status: in-progress
severity: low
area: layout
epic: none
created: 2026-08-01
---

## Implementation notes (2026-08-02): contextual quips

Shipped the quip system: Sentinel now reacts to what you open, with 45
curated moments and a unique grid animation per moment.

- `src/lib/sentinel/quips.js` — the catalog plus the four-rung resolution
  ladder (exact id, empty folder, keyword, structural). Pure, no imports.
- `src/lib/sentinel/routeMatch.js` + `routeQuips.js` — route arrivals to
  quip contexts, with the tool half derived from the TOOLS registry so a
  renamed route cannot leave a stale copy. Split in two because the node
  test runner cannot resolve the registry's own import chain.
- `src/hooks/useSentinelQuip.js` — module-level emitter with its gates
  (island busy, 20s global floor, 14-day per-quip cooldown plus a 35%
  repeat roll), and `deferQuip` for actions that end in a hard navigation.
  A preference gate and the per-entry pacing knobs were added in the
  second pass below.
- `src/components/layout/DynamicIsland/QuipContent.jsx` plus a new `quip`
  state in `displayStateFor()`, ranked under everything informational.
- `GridLoader` gained an optional `label` prop: its hardcoded
  `aria-label="Loading"` was wrong for a glyph that is not a loader, and
  `output` is an implicit live region.
- Fire points: notes browser (Subject, folder, file, search, back-spam),
  route arrivals (10 tools, admin, settings, feed), chat open, theme
  switch, music skip-spam, admin sign-out.
- `src/lib/sentinel/quips.test.js` and `src/hooks/useSentinelQuip.test.js`,
  wired together as `npm run test:sentinel`. The first asserts the ladder,
  the unique-animation constraint, that every pattern named is one
  GridLoader really has, and that every registry tool has a line; the
  second covers the emitter's gates (drop vs. hold vs. spend) and its
  behaviour against hostile or corrupt storage.

## Implementation notes (2026-08-02, later): ambient moments

The ambient/session half, taking the catalog to 76 moments.

- Six more 3x3 faces on `GridLoader` (drowsy, sleep, surprised, flat,
  squint, wince), and `SentinelFace` gained a variant table.
- `src/hooks/useSentinelIdle.js` — the pill's resting face. Drowsy after
  two minutes untouched, asleep after ten, both halved after midnight,
  with a wordless startle on waking. This is where the "mood" idea from
  the original spec actually landed: rather than a mood variable nothing
  reads, Sentinel simply gets tired sooner at night, which is the only
  place a mood would have been visible.
- `src/hooks/useSentinelSignals.js` — browser-level moments wired once in
  App: connectivity both ways, copy, print, a file dragged onto the
  window, returning after five minutes away, the Konami code, and the
  arrival remark (hour of day, visit streak, one-year anniversary).
- `src/lib/sentinel/session.js` — visit record and streak arithmetic,
  local-day based so a late-night session does not break a run.
- `src/lib/sentinel/aiMoments.js` — "there we go", "take your time" and
  "too easy" derived from the aiState stream in App, so all ten tools get
  them without any tool page changing.
- `src/hooks/useSentinelReading.js` — finished a long note, skimming, or
  opening the same note a third time this session.
- Wordless quips: an empty line renders the glyph alone for 0.9s instead
  of 2.6s, used for confirmations (copy, save, message sent, startle).
- Pacing gained two per-entry knobs, `frequent` and `cooldownMs`, because
  a confirmation and a joke want opposite treatment.
- Fire points also added for: the study timer (started, abandoned),
  poking the pill, chat (sent, burst, empty room), the feed (first post
  ever, posting after midnight), the editor (saved, published, unsaved
  for ten minutes), and empty/repeated searches.
- **Appearance gained a "Sentinel reactions" switch**
  (`src/hooks/useSentinelPersonality.js`), separate from the existing
  pop-up alerts toggle: wanting to be told about a message and not
  wanting a remark about a folder is a reasonable pair of preferences.
- Tests: `src/lib/sentinel/session.test.js` covers the streak and
  aiState machines; the catalog suite now checks uniqueness over the
  resolved matrix rather than the pattern name, because the loader
  carries aliases that render identically.

Deliberately not built:

- **404 and error-boundary cameos.** This app has no catch-all route and
  no global error boundary (only `EditorErrorBoundary`, scoped to the
  note editor). Adding either is an architecture decision, not a
  personality one, and should be its own ticket.
- **A devtools easter egg.** Every reliable detection is a hack (timing a
  `debugger`, watching window-size deltas) and reads as user-hostile.
- **Typing-indicator replacement, circuit heartbeat ramp, ERD quota
  tiredness, post-like reactions.** Each needs surgery inside a
  subsystem rather than a fire point, and the risk outweighs the beat.

Still backlog: the whole retrofit list (`Loading.jsx` and friends).

Split off into
[T-099](T-099-sentinel-boot-sequence-and-universal-reactivity.md) rather
than growing this ticket further: the first-visit boot sequence (which
also settles the "two competing intro moments" overlap flagged under the
greeting spec below), the session-identity defect it depends on, and an
acknowledgement for every tool control. What stays here is the retrofit
list.

## Implementation notes (2026-08-01)

Shipped: the flagship greeting (`src/hooks/useSentinelGreeting.js`,
`src/components/layout/DynamicIsland/SentinelFace.jsx`, wired into the
existing `greeting` phase in `DynamicIsland.jsx`), a face on the `error`
state, three new `face-*` presets on `GridLoader`, and a squash
hover/tap on the pill itself. `docs/design.md`'s Dynamic Island state
list is updated to match.

Not shipped, still backlog: every retrofit-list item (`Loading.jsx` and
friends), every ambient/random moment (typing, quota-tired, copy flash,
theme-flip, idle, 404, session-ending, drop-catch, easter egg, route
blip, music pulse), and the 5x5-resolution question — left at 3x3 to
avoid the two-density problem called out in the architecture notes
below; revisit only if a specific face needs detail 3x3 can't express.

## Summary

The Dynamic Island's AI-persona system is being named **Sentinel** and
extended beyond its current handful of states (observing/waiting/thinking/
generating/error) into a first-visit greeting, a set of retrofits on
existing generic loading/empty UI, and a long tail of ambient "just for
life" moments elsewhere on the site. This section is the original spec; see
the implementation notes above for what has actually shipped since.

Hard constraint carried through the whole ticket: **every new personality
moment below needs its own unique grid animation** (distinct
color/pattern/mode/speed on the existing `GridLoader`), not a reuse of the
current observing/waiting/thinking/generating/error patterns.

## Naming

"Dynamic Island" stays the technical/component name
(`DynamicIsland.jsx`, `useAIState`, etc. are unaffected). **Sentinel** is
the persona name and should be used in user-facing copy (greeting text,
any docs describing the feature to end users). Code identifiers do not
need to be renamed as part of this ticket.

## Flagship feature: greeting on visit

- **New visitor** (no prior-visit record found): Sentinel opens with
  `"Hi, I'm Sentinel"` — a one-time introduction, shown once per browser
  ever (or until the persistence flag is cleared).
- **Returning visitor**: Sentinel shows one line picked at random from a
  small pool of welcome-back variants (e.g. "Welcome back",
  "Glad to see you!") so repeat visits don't feel identical every time.
- **Persistence**: needs a mechanism to distinguish new vs. returning
  (e.g. a `localStorage` flag such as `sentinel:hasVisited`). No such flag
  exists today — this is new state, not a rename of anything.
- **Overlap to resolve at design time**: "first note created / first
  login" (listed below) may be the same moment as "new visitor" or a
  distinct second one-time beat — decide during implementation rather
  than shipping two competing intro moments.
- Both branches are new `aiState`-adjacent moments and should route
  through the existing `useAIState.js` controller
  (`setAIState`/`hold`/`release`, `MINIMUM_DWELL_MS` dwell) so they get
  the same anti-flicker guarantees as `observing`/`thinking`/etc., with
  `AIStateContent.jsx` gaining the new state(s) and their own `GridLoader`
  props.

## Retrofit candidates (existing generic loading/empty UI → Sentinel)

- [src/components/ui/Loading/Loading.jsx](../src/components/ui/Loading/Loading.jsx) — shared generic `ldrs` Quantum spinner; swapping this for a GridLoader variant cascades personality to every importer for free.
- [src/pages/HomeFeedPage.jsx](../src/pages/HomeFeedPage.jsx) `FeedSkeleton` — generic shimmer skeleton while feed posts load.
- [src/features/chat/components/ChatPanel/ChatPanel.jsx](../src/features/chat/components/ChatPanel/ChatPanel.jsx) (~L76-83) — generic `<Loading />` spinner, plus plain-text empty state "No messages yet. Say hi!"
- [src/components/social/CommentSection/CommentSection.jsx](../src/components/social/CommentSection/CommentSection.jsx) (~L163-166) — plain-text "Loading comments…" and "No comments yet. Start the discussion."
- [src/pages/notes-browser/NotesBrowserPage.jsx](../src/pages/notes-browser/NotesBrowserPage.jsx) (~L324, 344, 373) — generic `<Loading />` spinner, plus plain-text empty states ("No files here yet.", "No subjects yet.", "Nothing here yet.", "No matches.")
- [src/pages/course/CourseLandingPage.jsx](../src/pages/course/CourseLandingPage.jsx) (~L44) — generic `<Loading />` spinner while a course loads.
- [src/pages/admin/AdminUsers.jsx](../src/pages/admin/AdminUsers.jsx) (~L364) — plain-text empty state "No one here yet." / "No one else here yet."
- [src/pages/admin/AdminBrowser.jsx](../src/pages/admin/AdminBrowser.jsx) (~L770-816) — same plain-text `emptyState` pattern for file/folder browsing.
- [src/components/admin/EditorNavbar.jsx](../src/components/admin/EditorNavbar.jsx) (~L155) — generic spinner in the save-button icon slot.
- [src/pages/admin/AdminSettingsPage.jsx](../src/pages/admin/AdminSettingsPage.jsx) (~L245, 312), [AdminUsers.jsx](../src/pages/admin/AdminUsers.jsx) (~L505), [src/components/admin/CoverPicker/CoverPicker.jsx](../src/components/admin/CoverPicker/CoverPicker.jsx) (~L174) — Save/Submit buttons show only "Saving…" text, no animated feedback.
- [src/components/ui/MediaPicker/MediaPicker.jsx](../src/components/ui/MediaPicker/MediaPicker.jsx) (~L189-191) — "Load more" button, text only.

## Ambient/random personality moments (new, not tied to any existing loading state)

- Favicon/tab title shifts when the browser tab is unfocused (Sentinel "waiting" for the user to come back).
- 404 / error boundary page gets a Sentinel cameo instead of static copy.
- Idle detection — after a period of inactivity, Sentinel does something small and playful.
- Empty search results get a Sentinel moment instead of plain text.
- Konami-code style easter egg tied to Sentinel.
- Hover/drag micro-pulses on interaction (file-upload dropzones, `CoverPicker`).
- "Someone is typing…" chat indicator — replace the dot-typing animation with a Sentinel grid pulse.
- AI-generation quota running low ([api/_lib/erdQuota.js](../api/_lib/erdQuota.js), [api/_lib/generationQuota.js](../api/_lib/generationQuota.js)) — Sentinel goes "tired" near the limit instead of silently blocking.
- Copy-to-clipboard actions (code blocks, share links) — quick grid flash confirmation instead of a toast.
- Theme toggle (light/dark switch) — Sentinel blinks/reacts on switch.
- First note created / first login — one-time "hello" moment for new users (see overlap note under the greeting feature above).
- Global file drop onto the browser window — Sentinel "catches" a dragged-in file before it lands in a picker.
- Session-about-to-expire warning — Sentinel gets restless instead of a plain modal.
- Route/page transitions — subtle blip during slower navigation.
- Music player ([src/components/layout/MusicPlayer/MusicPlayer.jsx](../src/components/layout/MusicPlayer/MusicPlayer.jsx)) playback — pulse synced to play/pause state, not just to loading.

## Architecture notes (grounded in current code)

- **State model**: `AIStateContent.jsx` maps a single `aiState` enum
  (`observing | waiting | processing | thinking | generating | error`,
  default `idle`) to sub-components. Every one of them wraps the same
  `GridLoader` component
  (`src/components/effects/smoothui/grid-loader/index.tsx`) with a
  different `color`/`pattern`/`mode`/`speed` — there is no separate
  animation engine per state today, just prop variation on one shared
  component. New Sentinel moments should follow this pattern: a new
  `GridLoader` prop combination per moment, not a new animation system.
- **Controller hook**: `src/hooks/useAIState.js` is the reusable persona
  controller (`setAIState`, `hold`, `release`, `MINIMUM_DWELL_MS` = 700ms
  anti-flicker dwell). `App.jsx` owns `aiState` centrally and passes it
  into a single global `DynamicIsland` singleton — there is only one
  Sentinel instance on the page, never a per-component one.
- **Local mood side-channel**: `src/hooks/useAIActivity.jsx` is a React
  context (`AIActivityProvider`/`useAIActivity`/`useSetAIActivity`) that
  lets one page report finer-grained mood without widening the shared
  `aiState` enum — currently only `CircuitSandbox` uses it
  (`sweeping | settled | unstable | invalid`). **Guardrail**: new ambient
  moments (idle detection, quota-tired, typing-indicator, etc.) should
  plug in via this same local-context pattern rather than adding new
  branches to the global `aiState` enum, to keep the one global signal
  legible. Only the flagship greeting (a true one-time global moment) is
  a candidate for living directly in `aiState`.
- **Docking is unrelated**: `src/hooks/useIslandDock.js` controls where
  Sentinel physically sits (`top` vs `bottom-right`), not persona/state —
  don't confuse this with the animation/state system above.
- **Related but out of scope**: `src/lib/asciiArt/fields/` (e.g.
  `circuitPulse.js`) is a separate generative ascii-art system used for
  tool-card cover art on home/course pages, consumed via `field:` props in
  `src/constants/tools.js`. It shares a visual vocabulary with Sentinel
  (pulse-travels-a-wire) but is architecturally distinct. Not in scope for
  this ticket unless a future ticket explicitly unifies the two systems.

## Suggested approach

1. Land the greeting feature first (highest-value, already scoped above)
   as the initial `aiState` extension + `localStorage` persistence.
2. Retrofit `Loading.jsx` next — single change point, widest reach.
3. Work through the remaining retrofit list page by page.
4. Treat each ambient/random moment as its own small slice behind the
   `useAIActivity` pattern; ship independently, no need to batch them.

## Acceptance criteria

- [x] New visitors see "Hi, I'm Sentinel" exactly once.
- [x] Returning visitors see a randomly-picked welcome-back line, varied across sessions.
- [ ] Every new personality moment (greeting states + each retrofit + each ambient moment) renders a visually distinct `GridLoader` color/pattern/mode/speed combination — no two moments share an identical animation.
- [ ] `Loading.jsx` retrofit does not regress any existing importer (visual smoke check across feed, chat, notes-browser, course, admin pages).
- [ ] New ambient moments are implemented via `useAIActivity`-style local context, not by widening the shared `aiState` enum (flagship greeting excepted).

## References

- Prior art in this session: `src/components/layout/DynamicIsland/`, `src/hooks/useAIState.js`, `src/hooks/useAIActivity.jsx`, `src/hooks/useIslandDock.js`, `src/lib/asciiArt/fields/`.
