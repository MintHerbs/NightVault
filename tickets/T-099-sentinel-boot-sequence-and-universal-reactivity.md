---
id: T-099
title: "Sentinel: first-visit boot sequence, session identity, and a response to every action"
status: done
severity: medium
area: layout
epic: none
created: 2026-08-02
---

## Implementation notes (2026-08-02, later): pacing and the handoff

Owner watched the sequence and called it too fast to read. It was: at 7.5s
across seven stages, a line spent ~420ms resolving out of its scramble and then
had well under a second left before the stage ended. Retimed to ~16s, and the
numbers now budget for both halves of a stage explicitly, with
`quips.test.js` asserting every worded stage outlasts `BOOT_SCRAMBLE_MS` by a
readable margin. Measured after the change: each line holds its finished text
for 1.4s to 4.0s.

Motion was retimed with it. One shared curve, `BOOT_EASE`, replaces the pill's
normal springs for the duration of the boot: the ordinary 0.25s bounce-0.5
layout and the content swap's bounce-0.5 both read as twitchy on a sequence
nobody is driving. Travel is 1.4s, the panel resize 1.1s, the scramble 900ms at
a 70ms tick, the sidebar's colour 1.4s. Hover and tap squash are suppressed
while booting.

**The handoff was broken and the retiming is what exposed it.** The forge and
the sidebar avatar both carried `layoutId="sentinel-avatar"` while both were
mounted, which is one claimant too many: the effect that actually played was the
forge flying *up out of the sidebar corner* when it appeared, and the intended
flight *down* never happened at all. Fixed by handing the id over rather than
sharing it. The forge now unmounts as `integrate` begins, and the sidebar's
wrapper claims the id on that same render, keyed so it genuinely remounts.
Granting the id to an already-mounted element is not enough: motion starts a
shared-layout transition on *mount*, so without the key it registered silently
and animated nothing. Verified: the forge holds still while forging (1px drift),
and the avatar then travels 731px into the corner. No motion warnings.

The glyph slot also collapses during `integrate`, so the panel closes up behind
the departing avatar instead of holding 72px of empty space open.

## Implementation notes (2026-08-02)

All three parts shipped. Five things below turned out differently from the spec
once the code was actually read, and the spec was wrong in each case:

1. **`useApiCalls` was never a mint site.** It read the key and *bailed out* if
   it was missing, so a visitor whose first action was an API call saw the quota
   silently fail to load. Four hooks minted, not five. It now calls
   `getSessionId()` and the bail branch is gone.
2. **`useAnimationPlayer` reaches two tools, not four.** Recurrence and the FSM
   view have their own step machinery; only `TreePage` and `TableauxPage` import
   it (`StepControls` and `LogicStepControls` both take a `player` of its shape).
   The leverage argument still holds, it is just half the size claimed.
3. **The precedence rule in this ticket was wrong, and the browser proved it.**
   The spec said an ack must never preempt an `aiState`. But the two tools with
   a transport hold *one steady* `aiState` for a whole run
   ([TreePage.jsx:67-70](../src/pages/tree/TreePage.jsx#L67-L70),
   [TableauxPage.jsx:68](../src/pages/logic/tableaux/TableauxPage.jsx#L68) both
   set `thinking` until `isAtEnd`), so the island is busy *exactly* when the
   transport is usable. Under the spec's rule every transport ack was emitted
   and instantly buried: verified in Chrome, 0 of 8 presses produced a visible
   response. `ack` now sits directly above `aiState`, with its own narrower
   `setAckBusy` gate, and the 500ms flash is followed by the unchanged aiState
   resuming. Nothing is lost, because everything it briefly covers is either
   steady or self-holding.
4. **The `frequent` flag keeps its users.** Four entries used it, not two.
   `copied` and `saved` migrated to acks (both answer a control press);
   `message-sent` and `startle` stayed quips (a content action and an ambient
   reaction), so the flag was not removed.
5. **`agent-avatar/index.tsx` was a dead, already-drifted duplicate.** It
   imported a `@repo/shadcn-ui` package this repo does not have, so nothing
   could load it, and it had already lost the circle-clip fix and the
   IntersectionObserver gating that `index.jsx` carries. Deleted. This is the
   exact failure the shared `generator.js` exists to prevent, found sitting in
   the folder.

Also: the dock override is local to the island (`effectiveDock`) rather than a
write to the `useIslandDock` store. The spec had the boot holding the store and
restoring an undo seven seconds later, which could stomp a dock a page set in
the meantime. Overriding on the way out cannot stomp anything, and yielding is
then just a matter of not overriding.

Verified in Chrome against a genuinely cleared browser: 25/25 boot checks
(centre stage, all seven stages in order, greyscale to colour, handoff, skip,
reduced motion, reactions off, the sidebar-less `/admin` fallback, page stays
interactive) and 8/8 ack checks (both transports, the 400ms floor under a
six-press burst, no live-region change, reactions off). `npm test` passes whole.

**Two pre-existing defects surfaced while verifying this, both since fixed:**

- [T-103](T-103-tree-transport-hidden-under-sidebar.md): the B+ tree transport's
  leftmost button sat at x=24 under the 56px fixed sidebar rail and was mostly
  unclickable. Found because the ack verification could not click it.
- `MusicPlayer`'s imperative handle called `playerRef.current?.unMute()`, which
  guards the ref but not the method. The YouTube API attaches its methods
  asynchronously, so an interaction landing before the iframe was ready threw a
  TypeError out of App's first-interaction handler. All three methods now check
  the method itself the way `getProgress` already did, `unmute()` reports
  whether it took, and App keeps listening until it does (previously the throw
  was the only reason the listeners survived to retry). Found because it fired
  on every click in the headless verification runs.

## Summary

Three related pieces of Sentinel work, in dependency order:

1. **Session identity has no single owner.** Four hooks mint `session_id`
   independently and three components read it at render time with an
   `'anonymous'` fallback, so on a first visit the bottom-left avatar is seeded
   from the literal string `"anonymous"` and every first-time visitor is shown
   the same stranger's avatar until presence syncs.
2. **Sentinel has no origin.** On a first-ever visit the island leaves its dock,
   flies to the centre of the screen, expands into a panel, and performs its own
   initialisation in front of the visitor: introduces itself, generates the
   session id, forges the avatar out of that id, hands it to the bottom-left
   corner (grey until it arrives), then collapses and returns to its dock.
3. **Nothing reacts to what you press.** Sentinel reacts to where you go and to
   what the `aiState` stream reports, but every transport button, mode switch,
   clear, add, delete and export in all ten tools is silent. A second, cheap
   acknowledgement tier fixes that, wired at the two places every tool already
   shares.

Part 1 is a defect and is a prerequisite for part 2. Part 3 depends on neither
and can land in any order.

## Evidence

### Part 1: session id

Four independent mint sites, each carrying its own copy of the same
read-or-create-and-write block (this said five before the code was read; see
implementation note 1):

| Site | Lines |
|---|---|
| [usePresence.js](../src/hooks/usePresence.js#L15-L19) | 15-19 |
| [useRateLimit.js](../src/hooks/useRateLimit.js#L14-L17) | 14-17 |
| [useComments.js](../src/hooks/useComments.js#L5-L8) | 5-8 |
| [usePosts.js](../src/hooks/usePosts.js#L7-L10) | 7-10 |

Plus [useApiCalls.js:21](../src/hooks/useApiCalls.js#L21), which read the key
and gave up when it was missing rather than minting.

Three render-time readers with an `'anonymous'` fallback and no subscription:
[App.jsx:54](../src/App.jsx#L54),
[Sidebar.jsx:16](../src/components/layout/Sidebar/Sidebar.jsx#L16),
[HomeFeedPage.jsx:76](../src/pages/HomeFeedPage.jsx#L76). Plus bare reads in
[usePostAlerts.js:26](../src/hooks/usePostAlerts.js#L26),
[useChat.js:10](../src/hooks/useChat.js#L10),
[useChat.js:95](../src/hooks/useChat.js#L95),
[useComments.js:225](../src/hooks/useComments.js#L225) and
[usePosts.js:450](../src/hooks/usePosts.js#L450).

Two facts that make the ordering fragile:

- `usePresence` returns early when Supabase is unconfigured
  ([usePresence.js:13](../src/hooks/usePresence.js#L13)), so with no Supabase
  the id is minted by whichever of the other four hooks mounts first, which is
  not a stable choice.
- [useChat.js:6-10](../src/hooks/useChat.js#L6-L10) already carries a comment
  acknowledging there is no ordering guarantee that the id exists when it reads.

### Part 2: the boot sequence

Every piece this is assembled from already exists and is load-bearing:

- **The move.** `.wrapper` is `position: fixed; inset: 0` with its alignment
  driven by `data-dock`
  ([DynamicIsland.module.css:10-25](../src/components/layout/DynamicIsland/DynamicIsland.module.css#L10-L25)),
  and both `.innerCenter` and `.pill` carry `layout`
  ([DynamicIsland.jsx:488](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L488),
  [:507](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L507)), so a
  dock change FLIPs rather than teleports. T-095 proved this end to end with
  `bottom-right`. A centre dock needs one enum value and one CSS rule, not a new
  animation.
- **The expansion.** `timer-set` is the precedent for the pill growing into a
  real panel rather than a strip, and its comment records that as deliberate
  ([DynamicIsland.module.css:111-117](../src/components/layout/DynamicIsland/DynamicIsland.module.css#L111-L117)).
- **The lifecycle slot.** `phase` is already a separate axis from `intent`,
  documented as such
  ([DynamicIsland.jsx:52-63](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L52-L63)),
  running `hidden → greeting → collapsed`
  ([:125](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L125),
  [:252-274](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L252-L274)).
- **The first-visit test.** `useSentinelGreeting` already distinguishes a
  first-ever visit via the `sentinel-visited` key
  ([useSentinelGreeting.js:19](../src/hooks/useSentinelGreeting.js#L19),
  [:49-61](../src/hooks/useSentinelGreeting.js#L49-L61)).
- **The text animation.** The effect used on H1 headers is `ScrambleText`
  ([ScrambleText.jsx](../src/components/ui/ScrambleText/ScrambleText.jsx), used
  at [HeroText.jsx:97](../src/components/effects/HeroText/HeroText.jsx#L97) and
  mandated for tool landing screens by [docs/rules.md §14.1](../docs/rules.md)).
- **The avatar.** `AgentAvatar` draws a deterministic 6x6 grid from a seeded
  hash and a 3-colour palette
  ([agent-avatar/index.tsx:18](../src/components/effects/smoothui/agent-avatar/index.tsx#L18),
  [:48-115](../src/components/effects/smoothui/agent-avatar/index.tsx#L48-L115)),
  and the bottom-left slot renders it through `ChatAvatar` at 26px
  ([CollapsedView.jsx:111-126](../src/components/layout/Sidebar/CollapsedView/CollapsedView.jsx#L111-L126)).
- **Quips already stand down.** `setQuipBusy` is fed `phase !== 'collapsed'`
  ([DynamicIsland.jsx:215-224](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L215-L224)),
  so a new `boot` phase silences quips for its whole duration with no change,
  and anything deferred during it fires on the settle.

### Part 3: the acknowledgement tier

**The existing emitter is built to withhold, which is the opposite of what
"respond to every press" needs.** `fireQuip` gates on a 20s global floor
([quips.js:70](../src/lib/sentinel/quips.js#L70)), a 14-day per-id cooldown
([quips.js:67](../src/lib/sentinel/quips.js#L67)) and a 35% roll for anything
seen before ([quips.js:88](../src/lib/sentinel/quips.js#L88)), applied at
[useSentinelQuip.js:190-201](../src/hooks/useSentinelQuip.js#L190-L201). Routing
button presses through it unchanged would answer roughly one press in twenty.
Loosening those gates is not the answer: they are what keeps the *worded* quips
from becoming unbearable.

**The mechanism already exists in prototype.** The `frequent` flag
([quips.js:74-81](../src/lib/sentinel/quips.js#L74-L81)) skips the cooldown and
uses a 1500ms floor; six entries use it. Wordless quips already render the glyph
alone for 900ms
([QuipContent.jsx:31-35](../src/components/layout/DynamicIsland/QuipContent.jsx#L31-L35),
[quips.js:98](../src/lib/sentinel/quips.js#L98)).

**Two shared choke points cover most of the surface.**

- [useAnimationPlayer.js:145-169](../src/hooks/useAnimationPlayer.js#L145-L169)
  exposes `play`, `pause`, `togglePlayPause`, `next`, `prev`, `goToStep`,
  `skipToEnd`, `updateSpeed` and `reset`, and is the transport behind the B+
  tree ([StepControls.jsx](../src/features/tree/components/StepControls/StepControls.jsx)),
  the tableaux, recurrence and the FSM view. One edit reaches all four.
- [docs/rules.md §14.1](../docs/rules.md) makes `PillInput` / `CodePillInput`
  mandatory for every tool question, so the input side is two more edits.

Same leverage `aiMoments.js` already took from the `aiState` stream: wired once
in `App` ([App.jsx:128-138](../src/App.jsx#L128-L138)), inherited by all ten
tools.

**The uniqueness budget is not a constraint.** Measured: `GridLoader` carries 74
pattern names collapsing to **57 distinct 3x3 matrices**, and the signature the
test checks is matrix x 3 modes x 5 colours x 3 speeds, so **2565 signatures**
exist. 76 are claimed (`grep -c "grid: {" src/lib/sentinel/quips.js`). Roughly
18 more is comfortable.

## Impact

**Part 1 is a live defect.** `App` and `Sidebar` both evaluate
`localStorage.getItem('session_id') || 'anonymous'` during render, before any
effect has run, so both get `'anonymous'`.
[ChatAvatar.jsx:22](../src/features/chat/components/ChatAvatar/ChatAvatar.jsx#L22)
passes that straight to `AgentAvatar` as its `seed`, whose draw effect is keyed
on `[seed, size, animated]`
([agent-avatar/index.tsx:268](../src/components/effects/smoothui/agent-avatar/index.tsx#L268)).
The visitor is shown the deterministic avatar for the string `"anonymous"` (the
same one every other first-time visitor sees), which then swaps to their own
once `usePresence` reports a count and re-renders `App`. Observable as a visible
avatar change in the bottom-left corner a second or two after load. With
Supabase unconfigured, `usePresence` never mints, `onlineCount` never changes,
and the wrong avatar can persist for the whole page life. Separately, reading
mutable external state during render without `useSyncExternalStore` is the
tearing hazard React 18 documents.

**Part 2 runs at the worst possible moment.** A first-visit cinematic is the
first thing anyone ever sees of the site, before they have any reason to trust
it will end. Every design constraint below follows from that: skippable on any
input, never blocking the page behind it, never gated on a network call, and
short enough that a visitor who came to read a note does not resent it. The
total budget is the main risk: six beats at a readable pace is roughly 7
seconds, which is long. The mitigations are that it happens once ever, the page
underneath stays interactive throughout, and any click or key ends it. Stage
durations are named constants so the budget can be tuned without restructuring.

It also currently has nowhere to land on three surfaces: `Sidebar` is not
rendered on `/admin*` or the circuit sandbox
([App.jsx:281](../src/App.jsx#L281)), and below 968px it is an off-canvas drawer
that starts closed
([Sidebar.jsx:31-35](../src/components/layout/Sidebar/Sidebar.jsx#L31-L35)).

**Part 3 carries a real risk worth stating.** The island sits top-centre; tool
transports sit at the bottom of the viewport. A flash 800px from the click is
feedback the visitor may never look at, and a flash on *every* press is a light
flickering at the edge of their vision for a whole animation run. That is why
the design below is a wordless sub-second glyph rather than anything with text,
why the floor is 400ms, and why the "what must not get an ack" list is as long
as the "what does". The alternative (a second local feedback surface per button)
is exactly what [docs/rules.md §15](../docs/rules.md) exists to prevent, so the
island stays the one channel.

## Suggested fix

### Part 1: one owner for the session id

A single module-level store, `src/lib/sessionId.js`, in the same shape as the
two stores already used for cross-branch values
([useIslandDock.js](../src/hooks/useIslandDock.js),
[useSentinelPersonality.js](../src/hooks/useSentinelPersonality.js)):

```js
// Minted at module init, synchronously, before any component renders.
// crypto.randomUUID() is instant, so there is nothing to await and no window
// in which a reader can legitimately see 'anonymous'.
export function getSessionId()         // always a real id
export function wasMintedThisLoad()    // true if this load created it
export default function useSessionId() // useSyncExternalStore
```

- All five mint sites delete their block and call `getSessionId()`.
- All render-time readers call `useSessionId()`. The `'anonymous'` fallback goes
  away entirely rather than being kept as a safety net: a fallback that can
  never be correct is worse than a throw.
- Non-React callers (`useChat`'s send path, the RPC argument sites) call
  `getSessionId()`.
- `localStorage` failure (private mode) yields a per-load ephemeral id rather
  than `'anonymous'`, matching the stance every other Sentinel store takes
  ([useSentinelPersonality.js:22-28](../src/hooks/useSentinelPersonality.js#L22-L28)):
  an id that is wrong-but-unique beats one shared with every other visitor.

`wasMintedThisLoad()` is what part 2 narrates. Recording it at module init
rather than letting the boot mint it later is deliberate: any hook mounting
before the cinematic reaches its "generating" beat would otherwise mint the id
first and make the beat a lie. The boot narrates a real generation that happened
milliseconds earlier, and the value it shows is the real one.

### Part 2: the boot sequence

#### Stage table

One `bootStage` value per beat, all durations named constants in
`src/lib/sentinel/boot.js`, so the sequence is one readable table rather than
nested timeouts.

| # | `bootStage` | ms | Island | Copy | Glyph |
|---|---|---|---|---|---|
| 0 | `wake` | 600 | drops in at centre, collapsed size | none | thinking (existing `ThinkingAnimation`) |
| 1 | `hello` | 1600 | expands to the boot panel | `Welcome, I am Sentinel!` | `face-grin` |
| 2 | `session` | 1200 | held | line 1 rises and dims; `Session id generating...` | own signature |
| 3 | `session-done` | 600 | held | `done!` replaces in place | own signature, `fast` |
| 4 | `forge` | 2000 | held | `Generating avatar` | **AvatarForge** (below) |
| 5 | `integrate` | 1000 | held | `Integrating` | avatar flies to the sidebar slot; slot de-greys |
| 6 | `settle` | 500 | collapses, flies back to `top` | none | `greenDot` |

Total 7500ms. Treat 7.5s as a ceiling to tune down, not a target to grow.

#### Centre dock

Add `DOCK_CENTER = 'center'` to
[useIslandDock.js](../src/hooks/useIslandDock.js) and one CSS rule beside the
existing `bottom-right` block:

```css
.wrapper[data-dock="center"] {
  padding: 0;
  justify-content: center;
  align-items: center;
}
```

The boot holds the dock by capturing the undo `dockIsland()` returns
([useIslandDock.js:42-46](../src/hooks/useIslandDock.js#L42-L46)) and calling it
at `settle`.

**Hole to close:** a page that docks mid-boot (the circuit sandbox docks
`bottom-right`) emits its own value, and the boot's undo would then restore
`center` over it. The boot must subscribe to the store and, on seeing a value it
did not set, abandon its hold and jump straight to `settle`. A page's docking
decision outranks a flourish.

#### Phase and precedence

`phase` gains `'boot'`; `bootStage` is separate state on the same component.
`displayStateFor()`
([DynamicIsland.jsx:64-99](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L64-L99))
gains one line **above the panel check**, because unlike everything else in that
function the boot cannot be preempted by anything, including an open panel:

```js
if (phase === 'boot') return 'boot'
```

The reveal gate (`REVEAL_DELAY_MS = 3000` / `REVEAL_CAP_MS = 5000`, waiting on
`presenceSynced`,
[DynamicIsland.jsx:26-28](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L26-L28),
[:243-267](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L243-L267))
exists so the greeting cannot announce a placeholder online count. **The boot
shows no count**, so it does not inherit that gate and starts at ~600ms instead
of 3s. That is a real improvement to the first-visit feel, not a workaround.

#### The copy stack

A `BootLog` component holding at most two lines: the older translated up to
`opacity: 0.45, scale: 0.92`, the newer entering from below. Each new line is a
`ScrambleText` with its own `key` so it re-runs.

Naming note for whoever builds it: this is described as "the typewriter
animation we have been using for H1 headers". The component actually used on H1
headers is `ScrambleText`, which resolves characters out of noise rather than
typing left to right. Use `ScrambleText`; do not build a second text-animation
component, and do not rename it.

Stage 3 is the one exception to the rise-and-dim rule: `done!` replaces
`Session id generating...` **in the same slot**, because they are one statement.

#### AvatarForge

`AgentAvatar`'s generator helpers (`hashSeed`, `createRng`, `generatePalette`,
`generateGrid`, `GRID_SIZE`) are module-private
([agent-avatar/index.tsx:48-115](../src/components/effects/smoothui/agent-avatar/index.tsx#L48-L115)).
Extract them to `src/components/effects/smoothui/agent-avatar/generator.ts` and
have both `AgentAvatar` and a new `AvatarForge` import them.

That extraction is the point of this step: the forged avatar must be provably
the same grid and palette the sidebar goes on to render. A second independent
implementation is how the two silently drift, and the visitor would watch one
avatar get built and a different one appear in the corner.

The animation, at ~72px inside the boot panel: every cell starts at its real
seeded grid position but desaturated to grey, and cells resolve to their final
HSL in an order drawn from `createRng(hash)`, finishing on the outer glow ring.
It satisfies T-094's unique-animation constraint by construction: it is the only
6x6 animation in the app, and every other Sentinel moment is GridLoader's 3x3.

#### The handoff

`layoutId="sentinel-avatar"` on the forge's wrapper and on the sidebar's
`ChatAvatar` wrapper
([CollapsedView.jsx:111-126](../src/components/layout/Sidebar/CollapsedView/CollapsedView.jsx#L111-L126)).
`layoutId` is globally scoped in `motion/react` and both trees live under
`AppContent`, so the shared-layout transition crosses the two fixed containers
without a `LayoutGroup`.

**Fallback, required.** When no sidebar avatar is mounted (`/admin*`, the
circuit sandbox, or a viewport under 968px where the drawer is closed), the
`integrate` beat shrinks the forged avatar into the pill itself and the sequence
completes normally. Detect this by whether the shared `layoutId` has a second
claimant, not by re-deriving the route conditions in a second place.

#### Grey to colour

The sidebar avatar renders its **real seeded avatar** from first paint under
`filter: grayscale(1) brightness(0.75)`, transitioning to `none` over 600ms at
the `integrate` beat, driven by a `useSentinelBoot` store shaped like
`useIslandDock`.

Not a seed swap. Swapping seeds would change the *pattern*, which reads as a
different avatar replacing the first rather than the same avatar gaining colour.
The grey state is presentation over real data, which also means nothing
regresses if the boot is skipped or never runs.

#### Gating and escape hatches

- **Runs when:** `wasMintedThisLoad()` **and**
  `isSentinelPersonalityEnabled()`
  ([useSentinelPersonality.js:56-58](../src/hooks/useSentinelPersonality.js#L56-L58)).
- **Persistence:** reuse `sentinel-visited`
  ([useSentinelGreeting.js:19](../src/hooks/useSentinelGreeting.js#L19)). A
  second flag would let the two disagree about what a first visit is.
- **Skip:** any click, any keypress, or `Escape` jumps to `settle`. Nothing is
  lost, because the id was minted at module init.
- **Reduced motion:** skip entirely, arrive collapsed, un-grey the avatar
  immediately. Same stance the entrance already takes
  ([DynamicIsland.jsx:259-263](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L259-L263)).
- **Replay:** an entry in `AppearanceDialog` beside the existing Sentinel
  reactions switch, plus `?sentinel=boot` for development. A once-ever cinematic
  is otherwise impossible to review.
- **Accessibility:** the island's live region
  ([DynamicIsland.jsx:483-485](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L483-L485))
  announces each stage's line once. The forge canvas is decorative.

#### Retires the old first-visit branch

The `displayState === 'greeting' && sentinelGreeting.isFirstVisit` branch
([DynamicIsland.jsx:601-606](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L601-L606))
is removed, and `SENTINEL_INTRO_HOLD_MS`
([:32](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L32)) with it.
`useSentinelGreeting` keeps only the welcome-back pool. This settles the
"overlap to resolve at design time" T-094 flagged: there is now exactly one
introduction.

### Part 3: the acknowledgement tier

#### Two tiers, one emitter

| | **Ack** (new) | **Quip** (today) |
|---|---|---|
| Carries | a glyph, never words | a line |
| Fires | every qualifying action | rarely |
| Floor | 400ms (`ACK_MIN_GAP_MS`) | 20s (`QUIP_MIN_GAP_MS`) |
| Cooldown | none | 14 days |
| Hold | 500ms (`ACK_FLASH_MS`) | 2600ms (`QUIP_HOLD_MS`) |
| Recorded in storage | never | yes, pruned |
| Unique per | action **family** | individual moment |
| Announced | never | yes, via the live region |

`fireAck(family)` lives beside `fireQuip` in
[useSentinelQuip.js](../src/hooks/useSentinelQuip.js) and shares its preference
check ([:175](../src/hooks/useSentinelQuip.js#L175)) and its busy gate. The
catalog goes in a new `ACKS` table in
[quips.js](../src/lib/sentinel/quips.js), not into `QUIPS`, so the two pacing
models cannot be confused at a call site.

#### Unique per verb, not per button

An ack is a word in a language the visitor learns without being taught. "That
shape means Sentinel took my input" has to mean the same thing in the B+ tree as
in the tableaux, or it means nothing at all. Sixty distinct glyphs would be
sixty shapes nobody can tell apart. So acks are unique per **family** and shared
across every tool that fires them.

This changes the uniqueness rule the test enforces
([quips.test.js:188-198](../src/lib/sentinel/quips.test.js#L188-L198)), which
today asserts one flat namespace over `QUIPS`. It becomes: acks unique among
acks, quips unique among quips, and no ack colliding with any quip.

#### The families

| Family | Fires on |
|---|---|
| `step-forward` | next step |
| `step-back` | previous step |
| `play` | playback started or resumed |
| `pause` | playback paused |
| `skip-end` | jumped to the finished result |
| `rewind` | run reset to step 0 |
| `speed-up` / `speed-down` | transport speed changed |
| `mode-switch` | tool changed mode (Grade Toolkit, Digital Logic `?mode=`) |
| `clear` | canvas or input emptied |
| `add` | element placed (a gate, an entity, a key) |
| `remove` | element deleted |
| `toggle` | switch or checkbox flipped |
| `expand` / `collapse` | drawer or panel opened / closed |
| `export` | downloaded, or a prompt generated |
| `reject` | input refused: empty, unparseable, over a limit |
| `copy` | already exists as `moment:copied`, migrates to this tier |
| `save` | already exists as `moment:saved`, migrates to this tier |

#### What must NOT get an ack

This list is as much the feature as the one above.

- **Anything that already sets `aiState`.** §15.1 makes every tool *input* drive
  the island, and §15.4 guarantees even instant work holds a visible state. An
  ack on top would be the pill talking over itself. Concretely: a pill submit
  gets its `thinking`/`generating` state and **no** `submit` ack. The gap this
  ticket fills is the controls that set no state at all, which is why `submit`
  is absent from the family table and `reject` is present only for refusals that
  do not set `error`.
- **Anything while an island panel is open.** An open panel outranks everything
  ([DynamicIsland.jsx:77-79](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L77-L79)),
  so music-transport acks would be dropped anyway. Do not fire them rather than
  firing and dropping them.
- **Typing.** No per-keystroke acks, ever.
- **Anything faster than the floor.** Drops, never queues, matching the file's
  existing stance
  ([useSentinelQuip.js:25-29](../src/hooks/useSentinelQuip.js#L25-L29)). A held
  arrow key produces one ack every 400ms, and a scrub on `goToStep` fires once
  on release rather than once per frame.

#### Precedence

`ack` slots into `displayStateFor()` directly **below `quip`** and above
`return`/`greeting`/`hover`. It therefore preempts nothing informational: not an
aiState, not a chat notification, not a break reminder, not a finished timer,
and not a quip.

#### Accessibility

Acks contribute **nothing** to the live region
([DynamicIsland.jsx:445-465](../src/components/layout/DynamicIsland/DynamicIsland.jsx#L445-L465)).
A screen reader user pressing "next step" already hears the step description
from the tool; an ack announcement would double every transport press. The glyph
uses the same `label=""` decorative treatment `QuipContent` already applies
([QuipContent.jsx:23-29](../src/components/layout/DynamicIsland/QuipContent.jsx#L23-L29)).

#### Wiring order, cheapest first

1. **`useAnimationPlayer`**: fire from `play`, `pause`, `next`, `prev`,
   `skipToEnd`, `reset`, `updateSpeed`. Eight families across four tools, zero
   per-tool edits.
2. **`PillInput` / `CodePillInput`**: `reject` only, per the exclusion above.
3. **Per tool, second pass**: Grade Toolkit mode select, Digital Logic
   `ModeSelect` / `GatePalette` / `SandboxControls`, ERD step cards, the logic
   `InferenceRulesDrawer` and `SymbolBar`, tree `OperationsPanel` reset, every
   export and copy button.
4. **Migrate** `moment:copied` and `moment:saved` out of `QUIPS` into `ACKS` and
   drop the `frequent` flag, which has no remaining users afterwards.

#### Preference

The existing "Sentinel reactions" switch gates acks too, since `fireAck` shares
`fireQuip`'s preference check. Recommend **one switch to start**: three Sentinel
toggles in Appearance is already more than the setting deserves. If acks turn
out to annoy people who like quips, split then, with evidence.

## Acceptance criteria

**Part 1: session id**

- [x] `grep -rn "getItem('session_id')\|setItem('session_id'" src/` returns
      matches only inside `src/lib/sessionId.js`.
- [x] The string `'anonymous'` no longer appears as a session-id fallback in
      `src/`.
- [x] On a first-ever visit (cleared `localStorage`), the bottom-left avatar
      renders the visitor's own seeded avatar on first paint and never changes
      seed for the life of the page.
- [x] With Supabase unconfigured, the same holds.
- [x] `getSessionId()` returns the identical value to `useSessionId()` within
      one render pass, in every component.

**Part 2: boot sequence**

- [x] On a cleared browser, the island flies to screen centre, expands, runs all
      seven stages in order, hands the avatar off, and returns to `top` docked
      and collapsed.
- [x] The forged avatar is pixel-identical to the one the sidebar renders
      afterwards, because both read the same generator module.
- [x] The bottom-left avatar is greyscale from first paint and takes colour at
      the `integrate` beat, without its pattern changing.
- [x] The page behind the island is interactive for the whole sequence.
- [x] Any click, keypress or `Escape` ends the sequence immediately and leaves
      the island docked, collapsed and functional.
- [x] A second load runs no boot and shows a welcome-back line as today.
- [x] `prefers-reduced-motion: reduce` runs no boot; the avatar is in colour on
      first paint.
- [x] Sentinel reactions switched off in Appearance runs no boot.
- [x] A first visit landing on `/admin`, on the circuit sandbox, or at a
      viewport under 968px completes via the in-pill fallback with no orphaned
      or off-screen avatar.
- [x] A page docking the island mid-boot ends the sequence at `settle` and keeps
      its own dock.
- [x] No quip fires during the boot; one deferred during it fires after.

**Part 3: acknowledgement tier**

- [x] Pressing next / previous / play / pause / skip / reset / speed in the B+
      tree and the tableaux produces a wordless island flash, in both, from the
      one `useAnimationPlayer` edit. (Two tools, not four: see note 2 above.)
- [x] A burst of six presses in ~250ms produces at most two acks (400ms floor).
- [x] Scrubbing the step slider produces no acks at all. `goToStep` is left
      deliberately silent rather than acked on release: it fires on every value
      the drag passes through, and the step landed on is already drawn on the
      canvas.
- [x] A pill submit that sets `aiState` produces the aiState and no ack; only a
      refused submit acks.
- [x] An ack briefly covers a steady `aiState` and the aiState resumes. It never
      preempts a quip (the emitter refuses while one holds), and the transient
      states below it are self-holding rather than consumed.
- [x] No ack alters the live region, so a screen reader is told nothing extra.
- [x] No ack fires while an island panel is open, or before the pill has
      finished its entrance.
- [x] Acks write nothing to `localStorage`.
- [x] Sentinel reactions off in Appearance silences acks as well as quips.

**Across all three**

- [x] `npm run test:sentinel` passes, including the three-way uniqueness rule
      (ack vs ack, quip vs quip, ack vs quip) and the boot stages that use
      `GridLoader`.

## Non-goals

- Not a change to the `aiState` vocabulary
  ([docs/rules.md §15.1](../docs/rules.md)). Tools keep reporting
  `observing`/`thinking`/`generating`/`error` exactly as they do; part 3 covers
  the controls that set no state at all.
- Not a second feedback surface. Everything still goes through the one island,
  per §15. No per-button toasts, no inline flashes competing with the pill.
- Not the T-094 retrofit backlog (`Loading.jsx` and friends). Same persona,
  different job.
- Not a login, an account, or a server-side identity. `session_id` stays an
  anonymous browser-local UUID.

## References

- [T-094](T-094-sentinel-personality-expansion.md): the parent personality
  ticket, still `in-progress`. Owns the unique-animation constraint this
  inherits and the intro-overlap question part 2 closes. Its remaining scope is
  the loading-state retrofit, which stays there.
- [docs/rules.md §14](../docs/rules.md): the shared input surfaces part 3 wires
  once instead of ten times.
- [docs/rules.md §15](../docs/rules.md): the island as the single feedback
  channel, and why a second local surface is not the answer.
- [src/hooks/useIslandDock.js](../src/hooks/useIslandDock.js): the store shape
  part 1 copies, and the dock mechanism part 2 reuses (T-095).
- [src/lib/sentinel/quips.js](../src/lib/sentinel/quips.js): the catalog and
  pacing model part 3 extends with a second tier.
