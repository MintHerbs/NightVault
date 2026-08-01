---
id: T-095
title: Rebuild the Digital Logic input layer on the shared pill, and turn the sandbox into a Logisim-shaped playground
status: done
severity: high
area: circuits
epic: none
created: 2026-08-01
---

## Summary

The Digital Logic Lab (T-089) shipped with its own bespoke input surface, an
island that never reacts to it, and a sandbox that draws every component as an
identical rounded rectangle on a flat background, crops under the fixed sidebar
rail, has no way to delete a component with the mouse, and gives up a third of
its vertical space to a timing diagram nobody asked to have open.

This ticket does five things: put the tool back on the shared input language,
make the island respond to it (and write both down as rules so the next tool
cannot drift), give the sandbox real gate silhouettes, animated current and a
Logisim-style toolbar, fix the sidebar gutter, and put the canvas on a dotted
grid.

## Evidence

### 1. The tool built its own input UI

- `src/features/circuits/components/ExpressionField/ExpressionField.jsx` is a
  from-scratch M3 filled text field. Every other question-asking tool in the app
  uses the same shared pill: `src/features/erd/components/ERDStep1/ERDStep1.jsx:45`,
  `src/pages/tree/TreePage.jsx`, `src/features/logic/components/LogicInputPage.jsx`,
  `src/pages/algo/complexity/ComplexityPage.jsx`,
  `src/pages/logic/proof/LogicalEquivalencePage.jsx` — all
  `src/components/ui/PillInput/PillInput.jsx`.
- `src/features/circuits/components/ExpressionInput/ExpressionInput.jsx:95-103`
  renders `ExpressionField` where `ERDStep1.jsx:45-53` renders `PillInput`. The
  two surfaces sit one click apart in the same sidebar and look nothing alike.
- Nothing in `docs/rules.md` says which input component to use. §5 covers CSS
  Modules and §4 covers extraction, so there was no rule to break — the drift is
  the rules' gap, not just this tool's mistake.

### 2. The island never reacts to the input

- `src/components/ui/PillInput/PillInput.jsx:38-44` fires `onAIStateChange('observing')`
  on **focus**, before a single keystroke. That is the behaviour the user is
  describing, and it already exists — the digital-logic tool just does not use
  the component that has it.
- `src/features/circuits/components/ExpressionInput/ExpressionInput.jsx:53-59`
  re-implements a weaker version: it only fires on a non-empty value, so clicking
  into the field does nothing.
- `src/pages/arch/digital-logic/DigitalLogicPage.jsx:242` passes the **raw**
  `onAIStateChange` prop to `ExpressionInput`, bypassing the `setAIState` ref
  wrapper built at lines 74-78 precisely so the island effects do not re-fire on
  unrelated re-renders. The page's own comment explains why the wrapper exists
  and then the one call site that most needs it skips it.
- `DigitalLogicPage.jsx:93-117` sets `thinking` and then `idle` inside the same
  synchronous `try/finally`. `analyse()` is synchronous, so the island is told to
  think and stop thinking within one frame and never paints a thing.
- The animations are already built and unused here:
  `src/components/layout/DynamicIsland/ObservingAnimation.jsx`,
  `ThinkingAnimation.jsx`, `WaitingAnimation.jsx`, `GeneratingAnimation.jsx`, all
  driving `src/components/effects/smoothui/grid-loader/index.tsx`, which exposes
  ~50 preset patterns of which the island currently uses two (`plus-full`,
  `frame`).

### 3. The sandbox draws boxes, not gates

- `src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx:462-476`
  renders every component — AND, OR, XOR, flip-flop, probe — as the same
  `<rect rx="10">` with its name written inside.
- The correct shapes already exist twelve files away:
  `src/features/circuits/components/CircuitCanvas/CircuitCanvas.jsx:184-243`
  has `andBody()`, `orBody()`, `orTail()`, the inverter triangle and the
  inversion bubble, with a file header (lines 8-11) explaining exactly why
  silhouettes beat labelled boxes. They are private to that file, so the
  editable canvas cannot use them.
- No current animation exists. `CircuitSandbox.jsx:141-155` ticks the simulation
  and re-renders; every wire changes colour in the same frame.
  `src/lib/circuits/simulator.js:154-189` settles to a fixed point with no
  notion of propagation order, but
  `src/lib/circuits/circuitSynthesis.js:224-261` (`componentLevels`) already
  computes a per-component depth and already guards against feedback loops
  (lines 243-246), so the ordering needed to animate a wavefront is available.
- `CircuitSandbox.jsx:416` renders `WaveformPanel` unconditionally under the
  canvas, while the canvas itself is capped at `min(46vh, 420px)`
  (`CircuitSandbox.module.css:18-26`).
- There is no `onContextMenu` handler anywhere in the file. Deleting means
  selecting and then finding the toolbar bin, or pressing Delete
  (`CircuitSandbox.jsx:123-131`).

### 4. The sandbox ignores the sidebar

- `src/components/layout/Sidebar/Sidebar.module.css:1-14` — the rail is
  `position: fixed; left: 0; width: 56px`, and goes off-canvas at 968px
  (lines 21-29).
- `src/pages/arch/digital-logic/DigitalLogicPage.module.css:10-19` — `.main` is
  `padding: 96px 16px 48px` with **no** left gutter, and `.sandbox` (lines
  126-133) is `max-width: 1160px; margin: 0 auto`. Centring inside the full
  viewport puts the left edge of a 1160px sandbox under the rail on any screen
  narrower than about 1272px.
- The convention this page missed is documented in
  `src/components/common/BackButton/BackButton.module.css:1-8`, which offsets to
  `left: 80px` for exactly this reason.
- The palette is a 168px fixed left column (`GatePalette.module.css:1-10`),
  stacked immediately right of the rail, so the two eat 224px of width before
  the canvas starts.

### 5. Flat background, and input/output do not read as Logisim

- `CircuitSandbox.module.css:18-26` — `.surface` is a flat
  `--md-surface-container-low` with no grid.
- `CircuitSandbox.jsx:543-555` (`bodyText`) renders an input as the string
  `"A 0"` inside a rounded rect. In Logisim an input is a square you click that
  shows its bit, and an output is a distinct shape showing the bit it receives;
  here they are the same rectangle as every gate, distinguished only by the text.
- Components are placed on a 132×116 lattice (`sandboxModel.js:169-171`) but
  dragged to arbitrary pixels (`CircuitSandbox.jsx:187-197`), so a hand-arranged
  circuit never lines up and its wires never run straight.

## Impact

A junior opening `/arch/digital-logic` after using the ER tool meets a different
input control for the same job, gets no feedback that the app registered the
click, and then lands in a "playground" where an AND and an OR are the same grey
box. Concretely:

- On a 1280px laptop the sandbox's leftmost column of components sits under the
  sidebar rail: the palette's first button and any component placed at x≈32 are
  unclickable, and the student cannot tell the canvas is scrolled rather than
  broken.
- Pressing Run makes every wire in the circuit change colour simultaneously.
  For the four-bit shift register the tool ships as an example, that is exactly
  the observation the exercise exists to teach — that the value moves one stage
  per edge — and the UI shows it as an instantaneous global repaint.
- A misplaced gate can only be removed by clicking it and then hunting the bin
  icon below the fold, or by knowing about the Delete key. Right-click, which is
  what Logisim trains them to do, does nothing.

## Suggested fix

Five workstreams. 1 and 2 also produce rules; 3, 4 and 5 are all inside the
sandbox and should land together.

### 1. Put the input back on the shared pill

- Delete `ExpressionField/` and render `PillInput` in `ExpressionInput.jsx`,
  with the same `ScrambleText` title / subtitle / pill stack `ERDStep1` uses.
- The symbol bar and example chips **stay**. They are tool affordances around
  the input, not a replacement for it — the same way ERD keeps its "Use my own
  LLM instead" link. What must not survive is a second text field.
- The symbol bar needs to insert at the caret, which needs `PillInput` to accept
  a controlled `value`. Add it as an **optional** prop
  (`const isControlled = value !== undefined`) so the five existing uncontrolled
  call sites are untouched. This is the one shared-component change in this
  ticket and it is additive by construction.
- Write the rule: a new `docs/rules.md` section fixing the shared input surfaces
  and forbidding a bespoke one without a recorded reason.

### 2. Make the island respond

- Focus → `observing` comes free with `PillInput`. Route it through the page's
  `setAIState` ref wrapper, not the raw prop
  (`DigitalLogicPage.jsx:242` is the bug).
- Submit → `thinking`, then `idle`. Because `analyse()` is synchronous the state
  needs a **minimum dwell** (~700ms) or it never paints. Implement the dwell in
  the page, not the island: the island's job is to show a state, not to
  second-guess how long it lasted.
- Personality, using the ~50 patterns `grid-loader` already exposes and the
  variations it supports (`mode`, `pattern`, `color`, `blur`, `gap`): give the
  local-computation case its own look rather than borrowing the model-call one.
  A circuit being minimised is not the same event as a model being waited on and
  should not animate identically.
- Write the rule: every tool input drives the island, with the state vocabulary
  named.

### 3. Real gates, animated current, drawer, right-click

- Extract the silhouettes out of `CircuitCanvas.jsx` into
  `src/lib/circuits/gateShapes.js` and consume them from **both** canvases. This
  is the "used in 2+ places" trigger in `docs/rules.md` §4.1, and it is why the
  extraction is the right call rather than copying the paths across.
- Current animation: the simulator stays instantaneous — its values are correct
  and must not be made to lie. The animation is a **display overlay** driven by
  `componentLevels()`: a wavefront advances one level at a time, wires whose
  source the front has reached carry a travelling pulse, and probes reveal their
  new value as the front passes them. That is honest (it is gate-delay order,
  which is real) and it is the thing the shift-register exercise needs to show.
  Cap the whole sweep so a deep circuit cannot animate for seconds, and skip it
  entirely under `prefers-reduced-motion` (`docs/rules.md` §10.3).
- Timing diagram into a collapsible drawer, closed by default, toggled from the
  transport bar. The reclaimed vertical space goes to the canvas.
- Right-click a component or a wire → context menu with Delete (and the actions
  that are currently buried in the footer for that kind: pin count for a gate,
  0/1 for a constant). `preventDefault()` so the browser menu stays away.

### 4. Clear the rail, and move the palette into a toolbar

- Give `.main` a left gutter of the rail's width, inside a `min-width: 969px`
  query so the mobile off-canvas case keeps its full width.
- Move `GatePalette` from a 168px left column to a horizontal toolbar above the
  canvas, with the gate silhouettes from workstream 3 as its icons. That is the
  Logisim arrangement the user asked for and it returns 168px to the canvas.
- Inputs and outputs get their own shapes: a clickable square carrying its bit,
  and a distinct output shape carrying the bit it receives, both with the label
  outside the body rather than concatenated into it.

### 5. Dotted grid

- `.surface` gets a dot grid via `radial-gradient` at 20px, in
  `--md-outline-variant` so it follows all nine themes.
- Snap placement and drag to the same 20px grid. A visible grid that components
  do not land on is worse than no grid, and snapping is what makes hand-drawn
  wires run straight.

## Acceptance criteria

### Input language

- [x] `ExpressionField/` is unreferenced and no digital-logic surface renders a
      text input that is not `PillInput`. **Not deleted from disk:** the `rm` was
      refused by the sandbox, so the folder is orphaned and needs removing by
      hand. Nothing imports it and Vite does not bundle it
- [x] `PillInput` accepts an optional controlled `value`
      (`const isControlled = value !== undefined`); all five pre-existing call
      sites are unchanged and still work uncontrolled
- [x] The symbol bar inserts at the caret, and the caret does not jump to the
      end afterwards. Verified in the browser: `AB` + the complement button gives
      `AB'`
- [x] `docs/rules.md` §14 is the shared-input-surfaces rule, naming `PillInput` /
      `CodePillInput` and requiring a recorded reason for anything else
- [x] `FsmView` was on the same bespoke field and moved too — it was not in the
      original evidence and would have left half the tool on the old language

### Island

- [x] Clicking into the expression field shows "Observing" in the island, before
      any typing
- [x] Submitting shows a visible thinking state. Measured in the browser: 280ms
      after Enter the island reads `Thinking...`, where `analyse()` returns in
      under 5ms
- [x] Emptying the field returns the island to idle; leaving the page returns it
      to idle (the hook's own unmount effect)
- [x] Routed through the shared `useAIState` wrapper, so `DigitalLogicPage.jsx`'s
      raw-prop bypass is gone
- [x] `thinking` no longer borrows `waiting`'s animation: it is a green
      `ripple-out` pulse against `waiting`'s white `frame` stagger
- [x] `docs/rules.md` §15 is the island rule, with the state vocabulary as a
      table
- [x] Reduced motion is respected: `useReducedMotion` skips the sweep outright,
      and the pulse is `display: none` under the media query
- [x] `npm run test:hooks` covers the dwell arithmetic. Only the pure part —
      running the hook needs a renderer, and T-039 says no test framework, so
      `dwellRemaining()` is extracted and the wiring is checked in the browser

### Playground

- [x] `gateShapes.js` exists, both canvases use it, and no gate silhouette is
      defined twice. The extracted geometry is byte-identical to what
      `CircuitCanvas` drew, so the read-only canvas is visually unchanged
- [x] AND, OR, XOR, NAND, NOR, XNOR and NOT are each distinguishable by
      silhouette alone. `gateShapes.test.js` compares the drawn geometry with the
      kind name deliberately excluded from the signature, so a test that passed
      on labels alone would fail
- [x] Running or stepping sends a pulse from the inputs through the circuit to
      the outputs in propagation order
- [x] The animation is display-only. `propagation.test.js` case 5 settles the
      same netlist before and after building a plan and compares every value;
      the simulator is never consulted by the animation at all
- [x] The sweep is capped at 1.4s and skipped under reduced motion. Every depth
      from 1 to 1000 is checked against both the cap and the per-step floor
- [x] The timing diagram is in a drawer, closed by default. The canvas went from
      `min(46vh, 420px)` to `min(56vh, 540px)`, and shrinks again while the
      drawer is open so both fit on one screen
- [x] Right-clicking a component or a wire opens a menu that can delete it, and
      the browser's own menu does not appear. The menu also carries the actions
      that were previously only in the footer (constant 0/1, gate pin count)
- [x] Delete key and the toolbar bin still work

### Layout and grid

- [x] No part of the sandbox sits under the 56px rail from 969px up. Measured in
      the browser at 1280px: the surface's left edge is at x=72, which is the
      rail plus the page's own 16px
- [x] The palette is a horizontal toolbar above the canvas using the gate
      silhouettes; the 168px left column is gone
- [x] Inputs are clickable squares carrying their bit, probes are circles
      carrying theirs, constants are hexagons so they cannot be mistaken for a
      clickable input, and the name sits outside the body
- [x] The canvas has a dotted grid built from `--md-outline-variant`, so it
      follows all nine themes
- [x] Placement and drag snap to `GRID`. `sandboxModel.test.js` asserts both the
      snap and that a sub-cell nudge does not move an already-snapped component
- [x] No new raw hex, no shadows used as elevation, no transforms used as state
      layers

### Cross-cutting

- [x] `npm run test:circuits` runs 12 suites including the two new ones, all
      passing
- [x] `npm run lint:css` clean, `npm run build` clean
- [x] All four modes driven in a real browser at 1280px, no page errors

## Notes

Three defects found during the work that the original evidence did not predict:

- **`FsmView` used the same bespoke field.** Fixing only `ExpressionInput` would
  have left the state-machine mode on the old input language while the other
  three modes moved.
- **The FSM landing screen was not centred.** It is mounted inside the page's
  full-width sandbox column, which stretches its children; the result view has
  its own `margin: 0 auto` and the landing view did not, so the change was
  invisible until the input moved and the asymmetry became obvious.
- **The drawer opened below the fold.** Reclaiming the timing diagram's height
  for the canvas made the canvas tall enough that the drawer it fed opened off
  screen, which reads as a button that did nothing. The canvas now gives the
  height back while the drawer is open, and the drawer scrolls itself into view.

Two constraints that shaped the design:

- **The animation is not allowed to stage values.** An earlier plan had the
  wavefront gate what each probe displayed, so a probe showed its old value until
  the front arrived. That is defensible as gate delay, but it means the number on
  screen is briefly not the number the simulator computed, and a student
  debugging a circuit cannot afford to wonder which one they are looking at. The
  pulse is additive: correct values throughout, with an overlay showing the
  order.
- **There is no `--md-outline` token**, only `--md-outline-variant`. Gate bodies
  needed more edge against the dotted grid, so the stroke width went from 1.5 to
  2 rather than inventing a token across nine themes.

## Follow-up round (same day)

A second pass after review of the shipped screenshots. Seven changes, all owner
requests.

### Chrome

- [x] **The "Mode" dropdown is gone everywhere.** Four modes are four places, so
      they are navigation: `LabNavbar` is a proper top bar with back, brand, a
      mode tablist (arrow keys move between them) and a right-hand action slot.
      It replaces the floating dropdown, the global `Navbar` and the
      `BackButton` on this page
- [x] The sandbox is reachable as its own navbar entry, so "just open the
      sandbox and build something" is one click from any mode
- [x] `ModeSelect.jsx` is now only the `MODES` table plus its helpers; the
      component is unrendered. Kept because the table is what the navbar, the
      route guard and the not-built-yet panel all read

### Full-screen sandbox

- [x] The canvas fills the viewport instead of a 540px slab. Measured at
      1440x900: 620px tall, left edge at x=72 (clear of the rail), and the page
      does not scroll
- [x] The timing diagram is a modal opened from the navbar, not a drawer in the
      flow. Escape and the backdrop close it; focus moves into it on open
- [x] The dynamic island flies to the bottom-right while this mode is showing,
      and returns to the top on leaving. `useIslandDock` is a small external
      store rather than a second callback threaded through `AppRoutes` and every
      page that would never use it
- [x] Running the circuit puts the island in `thinking`; pausing returns it to
      idle. This reverses the spec's §9 line, which said not to hold a state for
      the whole run — owner decision, and defensible: the simulator really is
      computing every tick
- [x] Anything along the bottom edge stops 240px short of the right, so the
      message bar cannot run underneath the docked pill

### Behaviour

- [x] **Only a wire carrying a 1 pulses.** Every wire pulsing regardless of value
      contradicted the one distinction the animation exists to make
- [x] The circuit stage is editable in place: drag, wire, toggle and run the
      synthesised circuit without leaving the stage. Not persisted — it is
      scratch space for one question, and autosaving it would overwrite the
      student's own sandbox. "Open full screen" still hands off

### The defect the browser pass found

- [x] **Undo and redo did not autosave.** They moved the document without
      touching storage, so the last *edit* stayed saved and the undo did not:
      reloading the tab silently brought back work that had already been undone,
      and no amount of undoing could remove it. Only reachable by driving the
      real UI — no unit test touches localStorage, and the model layer is where
      all the other coverage sits

### Robustness

- [x] `sandboxRobustness.test.js`, three jobs in one suite:
      - 60 random edit sequences, 2,400 operations, every document invariant
        re-checked after each one and again walking the whole history backwards
        the way undo does. Covers the shapes that break editors: deleting a
        component a wire was attached to, resizing a gate that had pins wired,
        undoing past a deletion
      - 220 random gate DAGs x 12 input vectors = 26,664 port comparisons
        against a reference that evaluates in **topological order** with its own
        restatement of the gate tables, versus the simulator's
        iterate-to-fixed-point loop. Different algorithm, independently written
        truth tables
      - 120 random flip-flop networks x 24 clock cycles = 3,384 comparisons
        against a reference stepper that samples every flip-flop before
        committing any, with its own restatement of the next-state functions.
        893 state changes observed, asserted as a floor so the test cannot
        quietly stop exercising anything
      - Plus: refusals (self-drive, double driver, shorted file, junk JSON), and
        a forced ring oscillator reported unstable rather than hanging
- [x] A 50-check end-to-end browser pass that builds a circuit **only by
      clicking** — place four parts, wire three connections port by port, toggle
      inputs, verify the probe, run, drag, right-click delete, undo, redo — and
      checks the layout, the island dock, the timing modal and every mode. All
      50 pass

### Two fixture bugs in my own tests, worth recording

- A two-element ring (NAND + one NOT) is a **latch**, not an oscillator: two
  inversions compose to the identity. And even an odd ring settles at all-`x`
  unless something forces a definite value into it first, because `NOT(x)` is
  `x`. The fixture holds an enable low to fill the loop, then raises it.
- The first browser assertions read "the last `<text>` in the canvas" as the
  probe's value. The probe renders its digit first and its **name** second, so
  that was reading the label. Three green checks were meaningless until it
  compared the right node.

## Third round (same day)

Six owner requests after a second review.

### Boolean algebra: the rule leads

- [x] Each step now leads with its law, in title-size primary colour, with the
      identity beside it and the rewritten line underneath. It was already
      naming every law, but as a small chip *below* the expression — answer
      first, reasoning second, which is backwards for a subject where the marks
      are for naming the rule
- [x] Asserted structurally, not by eye: the test reads the step body's first
      child, checks it is one of the 13 law names, that it is ≥14px, that it
      outranks the identity beside it, and that it is drawn in the primary
      colour

### SOP / POS: verified, no change needed

- [x] `AB' + BC` over A,B,C has minterms {3,4,5,7} and maxterms {0,1,2,6}.
      SOP gives `F = BC + AB'` — `BC` covers 3,7 and `AB'` covers 4,5. POS gives
      `F = (A + B)(B' + C)` — `(A+B)` is 0 at 0,1 and `(B'+C)` is 0 at 2,6. Both
      unions are exact, both marked essential
- [x] The toggle also flips the universal-gate form: SOP offers NAND-only, POS
      offers NOR-only, which is the correct pairing

### State machine: the manual flow is a carousel

- [x] "Use my own LLM instead" is a link on step 1, not a `<details>` buried
      under the examples. It opens the same three-step flow ERD uses:
      question → copy the prompt → paste the JSON, with pagination dots and a
      Back at every stage
- [x] A generation failure drops straight into step 2 carrying its reason, so a
      dead end becomes a route. `vite dev` serves no functions, so this is the
      normal path in development
- [x] The island follows the whole flow: `observing` on the question,
      `generating` during the call, `waiting` on the copy and paste screens,
      `observing` once there is something in the paste box, `thinking` while the
      JSON is parsed, `idle` when the machine is built, back to `observing` if
      it will not parse
- [x] Not shared code with `ERDStep2`/`ERDStep3` — those are bound to ERD's own
      copy and numbering. What had to match is the layout, and that is what was
      reproduced

### Sandbox: actually full screen

- [x] No Starfield. **The page was rendering a second one on top of App's
      global one** — `<Starfield comets={false} />` in the page *and*
      `<Starfield />` in App, two animation loops for one background. The page's
      is gone entirely and App suppresses its own for this mode, the same way it
      already does for ERD
- [x] Nothing below the canvas at all. Undo, redo, delete, export and import
      moved up onto the transport row; messages and warnings float over the
      canvas. Asserted: zero in-flow elements below the canvas's bottom edge,
      and the canvas reaches 888px of a 900px viewport

### Wiring actually works

- [x] **Ports have a hit target.** The visible dot is 5px; there is now an
      11px transparent disc over it. A 10px target is below every pointer-size
      guideline, and that — not the mechanism — is why the sandbox felt
      unwireable
- [x] **Drag to wire.** Press an output, drag, release on an input. A dashed
      draft wire follows the pointer
- [x] **Drag to re-route.** Pressing an input pin that is already driven detaches
      that wire and picks it up from its original source, so changing a
      connection is a drag rather than delete-then-redraw. There was previously
      no way to change a connection at all
- [x] Dropping a wire on empty canvas removes it
- [x] Click-then-click still works

### The title glows

- [x] Both landing screens use the same `softGlow` pulse as every other tool's
      hero, and it is disabled under `prefers-reduced-motion`

### Two defects this round exposed

- **Pointer capture broke every drop.** Capturing the pointer on the source pin
  meant every subsequent event — including the release over the *target* pin —
  was delivered to the source, so a dragged wire could never land. The drop is
  now resolved by hit-testing the pointer against the port geometry on the
  surface's pointerup, which is also what the visitor is actually aiming with.
- **The surface's click handler un-armed the wire it had just armed.** Clicking a
  port set `pendingPort`, then the click bubbled to the surface, whose handler
  clears it. Click-then-click wiring had never worked; only the port `onClick`
  with `stopPropagation` was holding it together before the handlers moved to
  pointer events.

### And two more of my own test bugs

- The algebra assertion read the *step number* as the law, because it took the
  first `span` in the list item and the numbered marker comes first in DOM
  order. It passed on "1" and "2" looking like content.
- The FSM fixture used `name`/`resetState`; the real schema is `id`/`reset` with
  signals as objects. The app was right and the fixture was wrong — worth
  recording because "good JSON builds the machine" failing looked exactly like a
  parser bug for a minute.

## References

- [docs/specs/digital-logic.md](../docs/specs/digital-logic.md) — the spec this
  extends; §11's phases are all shipped, this is the follow-up
- [tickets/T-089-digital-logic-lab.md](T-089-digital-logic-lab.md) — the build
  this corrects
- [docs/rules.md](../docs/rules.md) — where the two new rules go
- [docs/design.md](../docs/design.md) — the `--md-*` token set (T-062) and the
  K-map palette added by T-089
- `src/components/effects/smoothui/grid-loader/index.tsx` — the pattern
  vocabulary the island animations draw from
