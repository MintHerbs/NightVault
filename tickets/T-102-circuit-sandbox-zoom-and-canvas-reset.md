---
id: T-102
title: Circuit Sandbox needs zoom and a confirmed canvas reset
status: backlog
severity: medium
area: circuits
epic: none
created: 2026-08-02
---

## Summary

The Circuit Sandbox camera can pan but cannot zoom, so a circuit larger than the
viewport can only ever be read a screenful at a time and a small one cannot be
brought closer. Separately, there is no way to start over: the canvas keeps
whatever is on it, autosaved to `localStorage`, and the only way to empty it is
to delete every component by hand.

This adds zoom in / zoom out to the camera, and a "clear the canvas" control in
the top-right file dock that asks for confirmation before it runs.

## Evidence

**The camera has no scale.** The only view state is a translation:

- [CircuitSandbox.jsx:158](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L158): `const [offset, setOffset] = useState({ x: 0, y: 0 })`, described in its own comment as "the camera".
- [CircuitSandbox.jsx:939](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L939): every shape is drawn inside `<g transform={`translate(${offset.x}, ${offset.y})`}>`. There is no `scale`.
- [CircuitSandbox.jsx:609-616](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L609-L616): `documentPoint()` converts client → document coordinates by subtracting `offset` only, so it is exact today and wrong the moment a scale exists.
- No `wheel` handler is registered anywhere on the surface, so the scroll wheel currently does nothing over the canvas.

**Nothing resets the document.** The three existing controls that sound like it
do not:

- [SandboxControls.jsx:87-89](../src/features/circuits/components/SandboxControls/SandboxControls.jsx#L87-L89): "Reset every flip-flop" calls `resetSimulation` ([CircuitSandbox.jsx:465-471](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L465-L471)), which touches simulation state only; the document is untouched.
- Undo ([CircuitSandbox.jsx:301](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L301)) steps back one gesture at a time and is capped at `HISTORY_LIMIT = 60`.
- Right-click → Delete removes one component or wire ([CircuitSandbox.jsx:1223-1227](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L1223-L1227)).

**Emptying it by hand does not stay empty by accident.** `commit()` autosaves to
`localStorage` under `STORAGE_KEY = 'digital-logic:sandbox'`
([sandboxModel.js:511](../src/lib/circuits/sandboxModel.js#L511)), and the
component seeds itself from that store on mount
([CircuitSandbox.jsx:115-117](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L115-L117)), so any reset that skips the save leaves the old
circuit to come back on reload. This is the same class of bug the undo/redo
autosave note at [CircuitSandbox.jsx:287-294](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L287-L294) already records.

**The top-right dock is the right home for it and has room.** It is the
`full`-variant file dock holding Export, Import, and a hidden file input
([CircuitSandbox.jsx:1064-1086](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L1064-L1086)), styled by `.fileDock`
([CircuitSandbox.module.css:124](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.module.css#L124)) as a horizontal row of `IconButton`s.

## Impact

- A circuit wider or taller than the viewport can be panned across but never
  seen whole, so nothing built past about a dozen components can be checked at a
  glance or screenshotted. There is no keyboard, wheel, or trackpad gesture that
  changes the scale.
- On a laptop screen the 20px snap grid makes a flip-flop chain physically wide;
  a student following a signal has to pan back and forth to keep both ends in
  mind.
- Starting a fresh circuit means deleting the previous one component by component
  (or hitting undo up to 60 times, which fails on anything older). A student who
  wants a blank canvas for the next exercise has no way to ask for one.

## Suggested fix

### 1. Give the camera a scale

Add `const [zoom, setZoom] = useState(1)` beside `offset`. Treat the pair as one
camera: `offset` stays in **screen** pixels, `zoom` scales **document** units, so
a document point `p` paints at `offset + p * zoom`.

Touch points, all of which currently assume `zoom === 1`:

| Location | Change |
|---|---|
| [CircuitSandbox.jsx:939](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L939) | `transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}`; translate first, so `offset` keeps meaning screen pixels |
| [CircuitSandbox.jsx:609-616](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L609-L616) `documentPoint` | divide by `zoom` after subtracting `offset` |
| [CircuitSandbox.jsx:582-589](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L582-L589) `onComponentPointerDown` | `dx`/`dy` computed in document units, so divide by `zoom` |
| [CircuitSandbox.jsx:674-676](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L674-L676) drag move | same conversion |
| [CircuitSandbox.jsx:532-538](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L532-L538) drop from the parts dock | same conversion, before subtracting half the component size |
| [CircuitSandbox.jsx:904](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L904) dot grid | also set `backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`` so the lattice keeps matching the snap grid it depicts (`GRID = 20`, [sandboxModel.js:65](../src/lib/circuits/sandboxModel.js#L65)) |
| [CircuitSandbox.jsx:91](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L91) `SNAP_RADIUS` | divide by `zoom` at the call site in `nearestPort`, so the pin-capture distance stays constant **on screen** rather than shrinking to 13px at 50% |

Panning must not be scaled: `onSurfacePointerMove` already adds raw client
deltas to `offset`, which is correct at any zoom and should stay as it is.

**Anchored zoom.** Zooming must hold one point still, or the circuit slides out
from under the pointer. For an anchor `a` in screen coordinates (relative to the
surface):

```
offset' = a - (a - offset) * (zoom' / zoom)
```

The anchor is the pointer for wheel/pinch zoom, and the centre of the surface
for the buttons and the keyboard.

**Extract the maths.** Put `zoomAt(camera, nextZoom, anchor)`, `toDocument`, and
`toScreen` in a new `src/lib/circuits/camera.js` and unit-test them in
`camera.test.js`, added to the `test:circuits` script in `package.json`. This is
the convention the sandbox already states for itself: "everything awkward lives
in sandboxModel.js as plain data, so it is tested without a DOM"
([CircuitSandbox.jsx:9-11](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L9-L11)). Round-tripping a point through both
conversions is exactly the kind of thing that silently breaks.

### 2. Zoom controls and gestures

- **Ladder, not free scale.** `ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3]`; the buttons move one rung. Wheel and pinch are continuous but clamped to `[0.25, 3]`.
- **Dock placement: bottom-left.** Top-left is the transport dock, and the pin-count control already sits under it ([CircuitSandbox.module.css](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.module.css) `.pinControl`). Bottom-centre is the parts dock. Bottom-**right** is not free, because the dynamic island parks there in this mode, which `.dockBottom`'s `max-width` already works around ([CircuitSandbox.module.css:112-113](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.module.css#L112-L113)). That leaves bottom-left. Style it with the same `.fileDock` treatment and give it `data-dock="zoom"` so the parts-drag drop test at [CircuitSandbox.jsx:529](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L529) keeps rejecting drops onto it.
- **Contents:** `ZoomOut` icon button, a percentage label (`100%`), `ZoomIn` icon button. Clicking the label returns to 100% and re-centres, which is the cheapest possible "I am lost" escape.
- **Wheel:** ctrl/cmd + wheel zooms anchored at the pointer (this is also what browsers report for a trackpad pinch); plain wheel pans. Both must `preventDefault()`, which means registering on `surfaceRef` with `addEventListener('wheel', handler, { passive: false })` in an effect; React's own `onWheel` cannot be made non-passive.
- **Keyboard**, in the existing handler at [CircuitSandbox.jsx:383-411](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L383-L411) (which already ignores keystrokes aimed at form fields): ctrl/cmd + `=`/`+` in, ctrl/cmd + `-` out, ctrl/cmd + `0` back to 100%.
- **No CSS transition on the transform.** It would lag behind the wheel and fight every frame of a continuous gesture.
- **Not persisted.** Zoom is view state, like `offset`. It is not part of `serialize()` and must not reach `localStorage`. A reload opens at 100%.
- Both variants get zoom. Unlike the file dock, this is a camera control, and panning already works in `embedded`.

### 3. Clear the canvas, with a confirmation

**Placement.** A third `IconButton` in the top-right `.fileDock`, after Import,
behind a separator; the file dock is where "what is on this canvas as a whole"
already lives. Note the separator has to be added: `.divider` exists only in
[SandboxControls.module.css:17](../src/features/circuits/components/SandboxControls/SandboxControls.module.css#L17), and CSS Modules are file-scoped, so
`CircuitSandbox.module.css` needs its own copy rather than an import.

**Icon and name.** `Eraser` from lucide-react (verified present, and unused
elsewhere in this feature). The accessible label must **not** be "Reset": the
transport dock already has "Reset every flip-flop" and two controls called reset
in one toolbar is the ambiguity this ticket should not add. Use **"Clear the
canvas"**.

**Disabled** when `doc.components.length === 0 && doc.wires.length === 0`, the
same way Export is already disabled on an empty document
([CircuitSandbox.jsx:1067-1073](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L1067-L1073)).

**The confirmation is an in-app modal, not `window.confirm`.** No `window.confirm`
or `alert` appears anywhere in `src/` today, and a native dialog cannot be
themed and blocks the main thread. Reuse the `TimingDialog` pattern already in
this file ([CircuitSandbox.jsx:1144-1186](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L1144-L1186)) and its `.dialogScrim` / `.dialog` styles:
backdrop click closes, focus moves into the dialog on open, and the Escape
listener is registered in the **capture** phase with `stopPropagation()` so one
press closes the dialog without also cancelling a half-drawn wire: the exact
problem `TimingDialog` already documents and solves.

Copy: title "Clear the canvas?", body "This removes every component and wire.
You can undo it." Buttons: "Cancel" (focused on open) and "Clear canvas"
(danger styling, `.menuItemDanger` is the existing precedent).

**What confirming does**, in order:

1. `setRunning(false)` and `stopSweep()`; `setFront(SETTLED)`.
2. `commit(emptyDocument())`, through `commit()` and not `setDocState`, so it pushes an undo entry **and** overwrites the autosave. Both matter: undo is the safety net behind the confirmation, and skipping the save is how the cleared circuit would come back on the next reload.
3. `setSelection(null)`, `setPendingPort(null)`, `setSnapPort(null)`, `setWireEnd(null)`, `setMenu(null)`; clear `wireRef`, `dragRef`, `panRef`.
4. `setTrace([])` and `clockPhaseRef.current = 0`. The simulation itself rebuilds on its own; it is a `useMemo` over `doc` ([CircuitSandbox.jsx:229](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L229)).
5. Camera home: `setOffset({ x: 0, y: 0 })` and `setZoom(1)`.
6. `flash('Canvas cleared. Ctrl+Z brings it back.')` using the existing toast ([CircuitSandbox.jsx:333](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L333)).

Step 2 keeping the clear undoable is deliberate, and worth confirming with the
owner: the ask was for a confirmation dialog, and undo on top of it costs
nothing and turns a mis-click that got through the dialog into a keystroke
rather than a lost circuit.

## Acceptance criteria

- [ ] Zoom in and zoom out controls sit in a bottom-left dock over the canvas, with a percentage readout between them; clicking the readout returns to 100%.
- [ ] Zoom is clamped to 25%–300%; the buttons step through a fixed ladder and disable at each end.
- [ ] Ctrl/cmd + wheel and a trackpad pinch zoom about the pointer: the document point under the cursor does not move while zooming.
- [ ] Plain wheel pans; neither gesture scrolls the page behind the canvas.
- [ ] Ctrl/cmd + `+` / `-` / `0` zoom in, out, and return to 100%, and do nothing while a form field has focus.
- [ ] At every zoom level: components drop under the cursor where released, dragging a component tracks the pointer exactly, and a wire dragged between two pins lands on the pin that highlighted.
- [ ] The dot grid stays aligned with the lattice components snap to at every zoom level.
- [ ] Panning speed is unchanged by zoom (the content keeps up with the hand 1:1).
- [ ] Zoom resets to 100% on reload and never appears in the `digital-logic:sandbox` `localStorage` value.
- [ ] A "Clear the canvas" button sits in the top-right dock beside Export and Import, disabled when the canvas is already empty.
- [ ] Pressing it opens a modal asking for confirmation; Escape, the backdrop, and Cancel all dismiss it with the circuit untouched, and Escape does not also cancel a wire in flight.
- [ ] Confirming empties the canvas, stops a free run in progress, clears the timing trace, and returns the camera to 100% at the origin.
- [ ] After confirming, reloading the page shows an empty canvas; the cleared circuit does not return from `localStorage`.
- [ ] Ctrl+Z immediately after confirming restores the circuit exactly as it was.
- [ ] `npm run test:circuits` covers the camera conversions and anchored zoom in `src/lib/circuits/camera.test.js`.

## Out of scope

- **Zoom to fit.** Genuinely useful on an infinite canvas with no bounds, and it needs a document bounding box plus a decision about padding and maximum scale. Worth its own ticket rather than being smuggled in here.
- Zoom controls for the `embedded` variant's file dock, since that dock is `full`-only ([CircuitSandbox.jsx:1064](../src/features/circuits/components/CircuitSandbox/CircuitSandbox.jsx#L1064)) and `embedded` runs with `persist={false}`, so it has no autosaved circuit to clear.
- Counter-scaling pin hit targets so they stay 24px on screen at any zoom. `SNAP_RADIUS` compensation above is what keeps wiring usable; making the shapes themselves zoom-invariant is a bigger visual change.

## References

- [T-096](T-096-figjam-circuit-workbench.md): establishes the floating-dock layout and the `offset` camera this extends
- [T-095](T-095-digital-logic-playground-and-input-language.md): the sandbox's interaction model
- [docs/rules.md](../docs/rules.md) §5.1 *CSS Modules*: every new dock and dialog needs its styles in the co-located `.module.css`
- Build the buttons from the local M3 primitives in [src/features/circuits/components/md/index.jsx](../src/features/circuits/components/md/index.jsx) (`IconButton`, `Button`), not a UI library. Note its file header cites "docs/rules.md §5.2" for the no-MUI rule and that section is actually *CSS Class Naming*. The rule is real and followed throughout the feature, but the citation is stale and worth correcting while nearby.
