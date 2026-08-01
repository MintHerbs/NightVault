---
id: T-093
title: Turn the circuit sandbox into a FigJam-shaped workbench — floating chrome, smart connectors, Logisim .circ files
status: done
severity: high
area: circuits
epic: none
created: 2026-08-01
---

## Summary

T-092 made the sandbox full-screen and got wiring working. It is still laid out
like a form: a fixed navbar across the top, a parts toolbar under it, a
transport row under that, and a notices panel pinned along the bottom. Four
horizontal bands before the canvas starts, and the canvas is what the tool is.

The owner's reference is FigJam: a bare dotted canvas with **floating** chrome
that sits over it — transport top-left, file actions top-right, parts docked
bottom-centre — and connectors you draw by dragging off a shape, which snap to
their target and route around corners instead of cutting across the diagram.

This ticket rebuilds the sandbox chrome to that shape, replaces the wire
renderer with a real router, adds Logisim `.circ` import/export, and fixes four
specific defects the owner reported while using it.

## Evidence

### 1. Four bands of chrome before the canvas

`src/pages/arch/digital-logic/DigitalLogicPage.jsx:194-230` renders `LabNavbar`
above `CircuitSandbox`; `CircuitSandbox.jsx:582-612` then renders `GatePalette`
and `.controlRow` above `.surfaceShell`. On a 900px viewport that is 60 + 76 +
52 = 188px of chrome, all of it in the flow, all of it stealing canvas height in
the one mode whose whole point is canvas height.

`src/App.jsx:212-222` also renders the global 56px `Sidebar` rail here, and
`DigitalLogicPage.module.css:45-50` pads the shell to clear it — a second column
of chrome in a mode the owner wants bare.

### 2. The notices panel is pinned along the bottom

`CircuitSandbox.jsx:725-736` renders `.notices` over the bottom of the canvas
whenever there is a message *or* a warning, and `documentWarnings()` returns a
warning for **every component with an unconnected input** — which is every
component, continuously, while a circuit is being built. The owner's screenshot
shows the normal state of the tool: a red bar reading "That input already has a
wire. Two outputs on one input is a short." stacked on "AND has 1 unconnected
input", covering the bottom fifth of the playground.

The red bar is `connect()` refusing (`sandboxModel.js:297-299`). That refusal is
correct as a *model* rule and wrong as an *interaction*: in FigJam, dropping a
connector on an occupied point re-points it. Refusing means the student's only
route to changing a connection is to find and delete the old wire first.

### 3. Wires cut across the diagram

`CircuitSandbox.jsx:1169-1173` routes every wire as: out, halfway across,
vertical, in. Three hard corners, no rounding, and no idea what it is crossing.
For a feedback wire (target left of source) it runs the vertical *through* the
gates between them.

The draft wire while dragging is a straight dashed line to the pointer
(`CircuitSandbox.jsx:690-698`), so what you see mid-gesture is not the shape you
get on release.

### 4. Export is our own JSON, not `.circ`

`CircuitSandbox.jsx:514-522` writes `circuit.json` in the schema
`sandboxModel.serialize()` defines. Nothing else in the world reads it. The
course tool is Logisim, whose files are `.circ`.

### 5. Four defects the owner hit

- **Gates read as three-input.** `PALETTE` places 2-input gates
  (`sandboxModel.js:54`), and that is what a fresh AND has — verified. But the
  synthesised circuits behind "Circuit" stage and the FSM handoff build gates
  with as many inputs as the product term has literals, so a 3-literal term
  gives a 3-input AND. The course teaches 2-input gates.
- **Connecting to a gate is a coin flip.** A 2-input gate is 60px tall, so its
  pins sit 20px apart; `DROP_RADIUS` is 16 (`CircuitSandbox.jsx:75`). Aim ±10px
  and you land on the other pin — and if that pin is already wired you get the
  red bar, which is exactly the screenshot. There is no snap, no highlight, and
  no indication of which pin a drop will land on.
- **Input and probe look like gates.** All three use `.body` —
  `--md-surface-container-high` on `--md-outline-variant`
  (`CircuitSandbox.module.css:97-103`). The two things carrying the bits the
  student is reading are the same colour as the things transforming them.
- **The clock is inert.** `onSurfacePointerUp` handles a click on `input` and on
  `const` (`CircuitSandbox.jsx:430-436`); `clock` falls through and does
  nothing, even though `simulation.inputs` holds a level for it and
  `toggleInput` would work.

### 6. Speed is a control nobody needs

`SandboxControls.jsx:46-54` spends a four-option segmented button on 1/2/4/8 Hz.
Owner: drop it.

## Impact

The mode the owner most wants to use is the one carrying the most chrome, the
most modal error text, and the least reliable core gesture. Wiring — the only
thing a schematic editor has to be good at — currently fails silently into a red
bar about shorts.

## Suggested fix

### 1. FigJam chrome

Sandbox mode renders **only** the canvas plus three floating docks:

```
┌──────────────────────────────────────────────────────────┐
│ ╭─────────────────────────────────╮   ╭───────────────╮  │
│ │ ←  │ ▶Run  ⏭  ↺  │ ↶ ↷ ⌫ │ ⌁   │   │ Import Export │  │
│ ╰─────────────────────────────────╯   ╰───────────────╯  │
│                                                          │
│                    · · · · · · · ·                       │
│                    dotted canvas                         │
│                                                          │
│              ╭────────────────────────────╮              │
│              │ ▣ ◯ ⎍ ⬡ │ gates… │ D T JK SR│              │
│              ╰────────────────────────────╯              │
└──────────────────────────────────────────────────────────┘
```

- No `LabNavbar`, no global `Sidebar`, no Starfield, nothing in the flow.
- The back arrow is the first item of the transport dock, and returns to the
  lab's default mode rather than `/home`, so every other mode stays reachable
  with the navbar gone.
- The parts dock is icon-only with tooltips, grouped by divider, and can be both
  clicked (place at the next free spot) and dragged onto the canvas (place
  where dropped).

### 2. Smart connectors

A new pure module, `lib/circuits/wireRouting.js`:

- `elbowPoints(from, to, opts)` — the polyline. Forward routes stub out, run to
  a mid-x, cross, and stub in. Backward routes (a feedback wire, target behind
  source) stub out, drop to a clear lane below both endpoints, run back, and
  stub in. Aligned ports get one straight segment.
- `roundedPath(points, radius)` — the polyline as `d`, with each interior corner
  rounded by an arc no larger than half the shorter adjacent segment.

The same router draws the committed wire *and* the connector in flight, so the
gesture previews the result.

Interaction, all four FigJam affordances:

- **Hover-based handles.** Hovering a component grows its pins into handles;
  hovering a pin grows it further and shows its name.
- **Drag from a handle** in either direction. Out→in and in→out both make the
  same wire, because a student aiming at a gate's input pin and dragging back to
  a source is describing the same connection.
- **Snap.** While dragging, the nearest compatible port within `SNAP_RADIUS`
  captures the endpoint, and that port lights up. The line goes where the
  highlight is; there is nothing to aim at any more.
- **Re-point on drop.** Dropping on an occupied input replaces its driver
  (`reconnect()` in the model) instead of refusing.

### 3. `.circ` files

A new pure module, `lib/circuits/circFormat.js`, with its own minimal XML reader
so it runs identically in the browser and under plain node (T-039: no test
framework, no jsdom).

- `toCirc(doc)` writes genuine Logisim project XML: `<lib>` declarations,
  `<comp lib= name= loc=>` per component with the attributes Logisim needs, and
  `<wire from= to=>` segments along the routed path.
- `fromCirc(text)` reads it back. Our own export carries the exact document in
  an XML comment, so a b-tree → b-tree round trip is lossless; a file from
  Logisim proper is reconstructed structurally, matching wire endpoints to
  component pin coordinates.
- Anything outside the supported component set is refused by name rather than
  dropped silently.

### 4. Two-input gates

A new pure module, `lib/circuits/binarize.js`: rewrite any gate with more than
two inputs into a cascade of 2-input gates, preserving the gate style (a
NAND-only circuit stays NAND-only). Applied to every synthesised netlist, so the
Circuit stage and the FSM handoff both show the gates the course teaches.

### 5. Input and probe get their own colour

`--accent-blue` for inputs, `--accent-green` for probes — the fixed data-viz
roles, which `docs/design/colors.md` already reserves for "encodes meaning on a
canvas, not brand". Gates stay neutral.

### 6. Clock clicks, speed goes

Clicking a clock toggles its level and shows the digit. The speed control is
deleted and the free run fixed at 2 Hz.

## Acceptance criteria

### Chrome

- [x] Sandbox mode renders no `LabNavbar`, no global `Sidebar`, and no Starfield
- [x] Every control floats over the canvas; zero chrome elements in the flow
- [x] The canvas fills the viewport edge to edge below the docks
- [x] Transport dock, top-left: back, Run/Pause, Step, Reset, undo, redo,
      delete, Timing. No speed control anywhere
- [x] File dock, top-right: Import and Export, both `.circ`
- [x] Parts dock, bottom-centre, icon-only, grouped, click **or** drag to place
- [x] The bottom notices panel is gone. A refusal is a transient toast at the
      top of the canvas that clears itself; unconnected pins say so by being
      drawn hollow, not by a list

### Connectors

- [x] Wires route orthogonally with rounded corners, and the connector in flight
      uses the same router as the committed wire
- [x] A feedback wire (target left of source) routes around, not through
- [x] Hovering a component enlarges its pins; hovering a pin enlarges it further
- [x] Dragging from an input pin to an output pin makes the same wire as the
      other direction
- [x] While dragging, the nearest compatible port within the snap radius
      captures the endpoint and highlights
- [x] Dropping on an occupied input re-points that input; no "already has a
      wire" refusal is reachable by dragging
- [x] Dropping on empty canvas cancels
- [x] Click-then-click still works

### Files

- [x] Export writes `.circ` that Logisim's own parser shape accepts: a
      `<project>` with `<lib>` declarations, one `<circuit>`, `<comp>` and
      `<wire>` elements
- [x] Import accepts what export wrote, exactly, for every component kind the
      palette offers — asserted by a round-trip test over generated documents
- [x] Import of a `.circ` written by Logisim proper reconstructs components and
      wires from coordinates
- [x] An unsupported component is refused by name
- [x] Malformed XML is refused with a readable reason, never a stack trace

### Gates and components

- [x] A gate placed from the parts dock has exactly two inputs
- [x] Every synthesised circuit (Circuit stage, FSM handoff) uses 2-input gates,
      verified against the pre-binarisation netlist over the full truth table
- [x] A NAND-only circuit is still NAND-only after binarisation; likewise NOR
- [x] Input nodes are blue, probes are green, gates are neutral, in all nine
      themes and both modes
- [x] Clicking a clock toggles it, and its level is drawn on it

### Cross-cutting

- [x] `npm run test:circuits` passes, including new suites for the router, the
      `.circ` codec and binarisation
- [x] `npm run lint` and `npm run lint:css` clean
- [x] `npm run build` clean
- [x] Browser pass over the whole flow, driving real pointer events

## Outcome

Shipped the same day. 57/57 on the new browser pass (`round4`), and both earlier
passes brought back to green (51/51, 37/37) after updating the assertions the
redesign deliberately invalidated: the navbar is gone in this mode, export is
`.circ`, a second wire on a pin re-points instead of being refused, and the
connector in flight is a routed `<path>` rather than a straight `<line>`.

Export was also driven end to end through the real UI — download the `.circ`,
clear the canvas, import the file back — and the document came back byte for
byte identical.

### Four defects this round exposed

- **The browser's own drag-and-drop was cancelling every other wire.** A
  `dragstart` on the SVG hands the pointer to native DnD, which fires
  `pointercancel` and ends the gesture one frame in. It only fires past a
  movement threshold, which is why wiring "worked sometimes" rather than never —
  the hardest kind of bug to report. Fixed with `onDragStart` preventDefault and
  `user-select: none` on the surface.
- **Re-rendering a pressed pin cancelled the drag too.** Chromium answers the
  removal of a captured target with `pointercancel`, and pressing a pin
  re-renders it as an armed pin. The gesture now captures the **surface**, which
  is never re-created. This is not the capture T-092 removed: that one was on
  the source pin and broke the drop, because the release over the target was
  delivered to the source. The surface is where the release is handled anyway.
- **The capture then routed around T-092's other fix.** With the pointer
  captured, the `click` after a press on a pin is delivered to the surface,
  whose handler cleared the armed wire and the selection — the exact bug the
  port's `stopPropagation` existed to prevent, reappearing through a different
  door. The surface now ignores a click that belongs to a gesture that started
  on something.
- **Unmounting the sidebar crashed React.** `new YT.Player('yt-player')`
  *replaces* the div MusicPlayer renders, so React's tracked child stops being in
  the document. `<Sidebar>` is its immediate sibling, and mounting it asked the
  DOM to `insertBefore` a node that was no longer there. Nothing had ever made a
  sibling conditional before, so the landmine had never been stepped on.
  MusicPlayer now renders a wrapper React keeps and the API swaps only the
  inner div.

### And one of my own, in the CSS

`rgb(var(--accent-blue-rgb) / 14%)` mixes the comma-separated token with the
slash alpha syntax and does not parse, so both new fills fell back to opaque
black. Invisible in dark mode against a near-black canvas; obvious the moment
the light theme was checked. The house form is `rgba(var(--x-rgb), 0.14)`, which
global.css says in a comment.

### What was not built

- Wires do not route *around* components, only around the endpoints of a
  backward connection. Two components on the same row still get a wire straight
  through whatever sits between them. Obstacle-avoiding routing is a much larger
  algorithm and FigJam does not do it either.
- `.circ` geometry for flip-flops is our documented model, not Logisim's exact
  offsets. Combinational circuits should open correctly in Logisim; a flip-flop
  may need nudging. The embedded lossless copy means our own files never depend
  on this.

## Notes

- **Fidelity of `.circ` is bounded and the ticket says so.** Logisim derives a
  component's pin coordinates from its `loc`, `facing`, `size` and input count.
  We reproduce that for the subset we place (facing east, default sizes, 1-bit
  wires) and document the offset table in the module. A file using buses,
  splitters, subcircuits, tunnels or rotated components is refused by name
  rather than half-read. The embedded-comment round trip exists precisely so our
  own files never depend on that reconstruction being perfect.
- **Binarisation changes a picture the owner did not complain about.** A
  4-literal product term becomes three chained ANDs rather than one wide one, so
  the Circuit stage gets wider. That is the trade the "two inputs" requirement
  asks for, and the right-click "Add an input" control still widens a gate by
  hand.
- **Re-pointing on drop weakens a model invariant deliberately.** `connect()`
  keeps refusing a second driver — the rule is real and the tests stay. The
  editor now calls `reconnect()`, which removes the old wire first, so the
  refusal is unreachable by dragging and remains reachable by a malformed file.

## References

- [tickets/T-092-…](T-092-digital-logic-playground-and-input-language.md) — the
  round this continues; §"Wiring actually works" is what this replaces
- [tickets/T-089-digital-logic-lab.md](T-089-digital-logic-lab.md) — the build
- [docs/specs/digital-logic.md](../docs/specs/digital-logic.md)
- [docs/design/colors.md](../docs/design/colors.md) — why `--accent-blue` /
  `--accent-green` are the right roles for canvas meaning
- [docs/rules.md](../docs/rules.md) §14, §15 — the input and island rules this
  must not break
