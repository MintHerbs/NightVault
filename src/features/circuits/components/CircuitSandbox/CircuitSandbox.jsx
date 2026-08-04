/**
 * CircuitSandbox - the editable, runnable circuit surface (T-089 phase 2, T-095,
 * reshaped into a FigJam-style workbench in T-096).
 *
 * Logisim-shaped but deliberately narrower: 1-bit wires only, no buses, no
 * splitters, no subcircuits. That covers the whole course and removes most of
 * what makes a schematic editor hard to get right.
 *
 * The document lives in sandboxModel.js as plain data, so everything awkward
 * (port geometry, the one-driver-per-pin rule, serialisation) is tested without
 * a DOM. This component owns interaction and paint, and nothing else.
 *
 * Undo is a snapshot stack rather than a command log. The documents are small
 * enough that diffing them would be more code for no benefit.
 *
 * ## What T-096 changed
 *
 *  * **The canvas is the page.** Every control floats over it — transport
 *    top-left, files top-right, parts bottom-centre. T-095 had four horizontal
 *    bands of chrome above the canvas in the one mode that is nothing but
 *    canvas.
 *  * **Connectors route.** lib/circuits/wireRouting.js draws both the committed
 *    wire and the one in flight, with rounded corners and a detour around
 *    anything behind the source.
 *  * **Wiring snaps.** The nearest compatible pin within `SNAP_RADIUS` captures
 *    the endpoint and lights up, so there is nothing left to aim at. Dropping on
 *    an occupied input re-points it rather than refusing.
 *  * **The notices panel is gone.** A refusal is a toast that clears itself; a
 *    loose pin says so by being drawn hollow.
 *  * Inputs are blue, probes are green, gates stay neutral, and a clock is a
 *    thing you can click.
 *
 * The running animation is an overlay and nothing more — the values on screen
 * are the settled ones at every instant, never staged. See
 * lib/circuits/propagation.js.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Download, Eraser, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'
import {
  addComponent,
  allPortPositions,
  componentSize,
  deserialize,
  emptyDocument,
  GRID,
  loadFromStorage,
  moveComponent,
  nextFreePosition,
  pinLabels,
  portOwnerMap,
  reconnect,
  removeComponent,
  removeWire,
  saveToStorage,
  setConstValue,
  setGatePins,
  snap,
  toNetlist,
} from '../../../../lib/circuits/sandboxModel'
import {
  HOME as CAMERA_HOME,
  canStepZoom,
  stepZoom,
  toDocument,
  zoomAt,
  zoomLabel,
} from '../../../../lib/circuits/camera'
import { fromCirc, toCirc } from '../../../../lib/circuits/circFormat'
import { createSimulation, UNKNOWN } from '../../../../lib/circuits/simulator'
import { isFlipFlop, FLIP_FLOP_PINS } from '../../../../lib/circuits/flipFlops'
import { backEdgeAt, clockNotch, gateSilhouette, GATE_KINDS } from '../../../../lib/circuits/gateShapes'
import { propagationPlan, sweepTiming } from '../../../../lib/circuits/propagation'
import { routeWire } from '../../../../lib/circuits/wireRouting'
import { useSetAIActivity } from '../../../../hooks/useAIActivity'
import GatePalette from '../GatePalette/GatePalette'
import GateIcon from '../GateIcon/GateIcon'
import SandboxControls, { DEFAULT_PULSE_MS } from '../SandboxControls/SandboxControls'
import WaveformPanel from '../WaveformPanel/WaveformPanel'
import { Button, IconButton, md } from '../md'
import styles from './CircuitSandbox.module.css'

const HISTORY_LIMIT = 60
const TRACE_LIMIT = 32

/** How far a gate's body sits inside its box, leaving room for pin stubs. */
const STUB = 12

/** "Everything has been reached" — the resting state between sweeps. */
const SETTLED = Infinity

/**
 * How near a connector has to be for a pin to capture it.
 *
 * Generous on purpose. A two-input gate is 60px tall, so its pins sit 20px
 * apart; the old 16px drop radius meant aiming within ±10px or landing on the
 * wrong pin, and landing on the wrong pin usually meant the "that input already
 * has a wire" refusal. Snapping plus a highlight replaces aim with feedback.
 */
const SNAP_RADIUS = 26

/** How long a refusal stays on screen before clearing itself. */
const TOAST_MS = 3200

/**
 * @param {Object} props
 * @param {Object} [props.initialDocument] - seeds the canvas, e.g. "Open in sandbox"
 * @param {Function} [props.onDocumentChange]
 * @param {'full'|'embedded'} [props.variant] - full fills the viewport and owns
 *   the file dock and the back button; embedded is a panel inside another page
 * @param {boolean} [props.persist] - autosave to localStorage. Off for the
 *   embedded copy, which must not overwrite the student's own saved circuit
 * @param {Function} [props.onBack] - shown as the first control in full variant
 * @param {Function} [props.onRunningChange] - so the page can drive the island
 */
export default function CircuitSandbox({
  initialDocument,
  onDocumentChange,
  variant = 'embedded',
  persist = true,
  onBack,
  onRunningChange,
}) {
  const [doc, setDocState] = useState(
    () => initialDocument ?? (persist ? loadStored() : null) ?? emptyDocument()
  )
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [selection, setSelection] = useState(null)
  const [pendingPort, setPendingPort] = useState(null)
  const [message, setMessage] = useState(null)
  const [trace, setTrace] = useState([])
  const [running, setRunning] = useState(false)
  // How often free run toggles the clock. A user-facing setting (SandboxControls'
  // pulseRate select) — see the note on `pulse` below for why it is a toggle
  // rather than the "one full cycle" tick() the manual Step button still uses.
  const [pulseMs, setPulseMs] = useState(DEFAULT_PULSE_MS)
  const [version, setVersion] = useState(0)
  const [timingOpen, setTimingOpen] = useState(false)
  const [menu, setMenu] = useState(null)
  // The clear-the-canvas confirmation is open. Its own state rather than a
  // generic dialog stack: it is the only destructive control here, and the
  // timing diagram already owns the other modal.
  const [confirmingClear, setConfirmingClear] = useState(false)

  // Hover, in three parts: the component under the pointer (its pins grow), the
  // pin under the pointer (it grows further), and the pin a connector in flight
  // would land on (it lights up). The third is what replaces aiming.
  const [hoverComponent, setHoverComponent] = useState(null)
  const [hoverPort, setHoverPort] = useState(null)
  const [snapPort, setSnapPort] = useState(null)

  // A part being dragged out of the parts dock, in client coordinates.
  const [carry, setCarry] = useState(null)

  // The propagation wavefront. `SETTLED` means the sweep is over and every wire
  // is drawn; a finite number means the front has reached that level.
  const [front, setFront] = useState(SETTLED)
  const [sweepId, setSweepId] = useState(0)
  // Free end of a wire being dragged out of a port, in document coordinates.
  const [wireEnd, setWireEnd] = useState(null)

  // The camera: `x`/`y` are how far the document is shifted from its own
  // origin in screen pixels, `zoom` scales document units (T-102 added the
  // scale; before that this was a pan-only `offset`). A pure view transform:
  // component x/y (their real "document" position) never change from panning
  // or zooming, only what part of the document renders where and at what size.
  // Replaces scrollLeft/scrollTop, which could only reveal what already
  // overflowed the surface, and a circuit smaller than the viewport had nowhere to
  // pan *into*, which is what made panning look broken rather than merely
  // unnecessary (owner report).
  //
  // All of the screen/document arithmetic lives in lib/circuits/camera.js, and
  // every gesture below goes through it rather than doing the sums inline.
  const [camera, setCamera] = useState(CAMERA_HOME)

  // A brief flourish for edits that are not the free-run itself — placing a
  // part, dragging one around — so the island has something to say about
  // editing too, not only running. 'placing' clears itself after a beat;
  // 'dragging' is tied to the gesture's own start/end instead (owner request).
  const [editingPulse, setEditingPulse] = useState(null)
  const editingTimeoutRef = useRef(null)
  const setEditingActivity = useCallback((kind, autoClearMs = null) => {
    if (editingTimeoutRef.current) {
      clearTimeout(editingTimeoutRef.current)
      editingTimeoutRef.current = null
    }
    setEditingPulse(kind ? { kind } : null)
    if (kind && autoClearMs) {
      editingTimeoutRef.current = setTimeout(() => setEditingPulse(null), autoClearMs)
    }
  }, [])
  useEffect(() => () => {
    if (editingTimeoutRef.current) clearTimeout(editingTimeoutRef.current)
  }, [])

  const surfaceRef = useRef(null)
  const dragRef = useRef(null)
  const fileRef = useRef(null)
  const sweepRef = useRef(null)
  const wireRef = useRef(null)
  const carryRef = useRef(null)
  // A press on bare canvas (never on a component or a pin — both of those
  // stop propagation before this can see it) pans the surface's own scroll
  // position. Nothing else on this canvas moved the viewport at all before
  // this, so a circuit wider than the visible surface had no way to reach its
  // far side except a scrollbar.
  const panRef = useRef(null)
  // Set by any gesture that starts on something (a pin, a component) rather
  // than on bare canvas. See the surface's onClick.
  const gestureRef = useRef(false)
  // The level free run's next pulse will drive the clock to. Mirrors
  // simulation.previousClock's own seed (reset() settles every clock to 0
  // before the first edge), so the first pulse is a genuine 0 -> 1 rising
  // edge rather than a false start.
  const clockPhaseRef = useRef(0)

  const reducedMotion = useReducedMotion()
  const full = variant === 'full'

  // The island shows a state while the circuit is free-running (owner decision,
  // T-095 follow-up) — and now also while an edit is in flight (placing a
  // part, dragging one), since those got their own island moment too (owner
  // request, T-094). Reported rather than set here: the island is App's, and a
  // leaf component reaching for it directly is how the raw-prop bypass T-095
  // already fixed once got in.
  const busy = running || Boolean(editingPulse)
  useEffect(() => {
    onRunningChange?.(busy)
    return () => onRunningChange?.(false)
  }, [busy, onRunningChange])

  // A fresh document arriving from another mode ("Open in sandbox") replaces
  // whatever was here, and starts its own history.
  useEffect(() => {
    if (!initialDocument) return
    setDocState(initialDocument)
    setPast([])
    setFuture([])
    setSelection(null)
  }, [initialDocument])

  // One simulation per document shape. Rebuilt on every edit rather than
  // patched: the state a stale simulation carries is exactly the state that
  // makes a rewired circuit behave like the old one.
  const simulation = useMemo(() => createSimulation(toNetlist(doc)), [doc])
  useEffect(() => { setTrace([]); setVersion(v => v + 1) }, [simulation])

  // What the island's "thinking" state should show — see useAIActivity.jsx.
  // An edit in flight (placing, dragging) always leads: it is the most
  // immediate thing happening, and it's rare for a student to also be editing
  // while a clock free-runs. A stuck pin or a feedback loop that never settles
  // is worth interrupting for; a clock that is simply ticking is not — any
  // label that changes with the pulse reads as noise once the pulse is fast
  // enough to notice (owner report), so "running" says nothing at all and the
  // island just shows the grid breathing instead (ThinkingAnimation's `circle`
  // mode). "Stopping" is its own brief, one-shot moment below, not a
  // per-render kind — see the effect after this one.
  const setActivity = useSetAIActivity()
  const activityKind = editingPulse ? editingPulse.kind
    : simulation.invalid.size > 0 ? 'invalid'
      : simulation.unstable.length > 0 ? 'unstable'
        : 'running'

  useEffect(() => {
    if (!busy) return undefined
    setActivity({ kind: activityKind })
    return () => setActivity(null)
  }, [busy, activityKind, setActivity])

  // The falling edge of `running`, specifically — a one-shot "Stopping..."
  // beat rather than a fifth activityKind, because it has to survive the
  // instant `running` goes false (when activityKind above would otherwise
  // read as nothing running at all) and clear itself afterwards, exactly what
  // setEditingActivity's timeout already does for "placing".
  const prevRunningRef = useRef(false)
  useEffect(() => {
    if (prevRunningRef.current && !running) {
      setEditingActivity('stopping', 900)
    } else if (!prevRunningRef.current && running && editingPulse?.kind === 'stopping') {
      // A quick pause-then-run before the beat's own 900ms finished: resuming
      // makes it stale immediately, not in however much of that was left, so
      // the circle mode can take over rather than showing "Stopping..." while
      // the circuit is, in fact, running again.
      setEditingActivity(null)
    }
    prevRunningRef.current = running
  }, [running, editingPulse, setEditingActivity])

  const plan = useMemo(() => propagationPlan(toNetlist(doc)), [doc])
  const ports = useMemo(() => allPortPositions(doc), [doc])
  const owners = useMemo(() => portOwnerMap(doc), [doc])

  const commit = useCallback((next, { history = true } = {}) => {
    if (history) {
      setPast(p => [...p.slice(-HISTORY_LIMIT), doc])
      setFuture([])
    }
    setDocState(next)
    if (persist) saveToStorage(safeStorage(), next)
    onDocumentChange?.(next)
  }, [doc, onDocumentChange, persist])

  /**
   * Undo and redo have to autosave too.
   *
   * They used to move `doc` without touching storage, so the last *edit* stayed
   * saved and the undo did not: reloading the tab silently brought back work
   * the student had already undone, and no amount of undoing could get rid of
   * it. Found by driving the real UI (T-095 follow-up).
   */
  const restore = useCallback((next) => {
    setDocState(next)
    if (persist) saveToStorage(safeStorage(), next)
    onDocumentChange?.(next)
  }, [persist, onDocumentChange])

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      setFuture(f => [doc, ...f])
      restore(p[p.length - 1])
      return p.slice(0, -1)
    })
  }, [doc, restore])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      setPast(p => [...p, doc])
      restore(f[0])
      return f.slice(1)
    })
  }, [doc, restore])

  const remove = useCallback((target) => {
    if (!target) return
    commit(target.type === 'wire' ? removeWire(doc, target.id) : removeComponent(doc, target.id))
    setSelection(current => (current && current.id === target.id ? null : current))
  }, [commit, doc])

  /**
   * One transient line over the canvas.
   *
   * Replaces T-095's `.notices` panel, which was pinned along the bottom and
   * showed one entry per component with a loose pin — that is every component,
   * continuously, while a circuit is being built. A refusal is news; a
   * half-built circuit is not.
   */
  const flash = useCallback((text) => setMessage({ text, at: Date.now() }), [])

  useEffect(() => {
    if (!message) return undefined
    const id = setTimeout(() => setMessage(null), TOAST_MS)
    return () => clearTimeout(id)
  }, [message])

  // --- The propagation sweep -------------------------------------------------

  const stopSweep = useCallback(() => {
    if (sweepRef.current === null) return
    clearInterval(sweepRef.current)
    sweepRef.current = null
  }, [])

  /**
   * Advance a wavefront from the inputs outwards.
   *
   * Purely cosmetic: it decides which wires have a pulse drawn over them, and
   * nothing else. The colours and digits underneath are the settled values the
   * whole time.
   */
  const startSweep = useCallback(() => {
    stopSweep()
    if (reducedMotion || plan.depth === 0) { setFront(SETTLED); return }

    const { stepMs, levelsPerStep } = sweepTiming(plan.depth)
    setSweepId(id => id + 1)
    setFront(0)

    let level = 0
    sweepRef.current = setInterval(() => {
      level += levelsPerStep
      if (level > plan.depth) {
        stopSweep()
        setFront(SETTLED)
        return
      }
      setFront(level)
    }, stepMs)
  }, [plan.depth, reducedMotion, stopSweep])

  useEffect(() => stopSweep, [stopSweep])

  // Editing the circuit invalidates whatever the last sweep was showing.
  useEffect(() => { stopSweep(); setFront(SETTLED) }, [doc, stopSweep])

  // --- The camera ------------------------------------------------------------
  //
  // Declared above the keyboard and wheel effects that depend on them: a
  // `useCallback` referenced in a dependency array further up the component
  // would be read before its own `const` is initialised.

  /** The middle of the visible surface. The anchor for zooms with no pointer
   *  behind them (the dock buttons and the keyboard chords). */
  const surfaceCentre = useCallback(() => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: rect.width / 2, y: rect.height / 2 }
  }, [])

  /** One rung up (`direction` 1) or down (-1) the zoom ladder, held at
   *  `anchor` (surface-relative screen coordinates). */
  const zoomBy = useCallback((direction, anchor) => {
    setCamera((current) => zoomAt(current, stepZoom(current.zoom, direction), anchor))
  }, [])

  // --- Keyboard --------------------------------------------------------------

  useEffect(() => {
    const onKey = (event) => {
      const target = event.target
      if (target instanceof HTMLElement && /input|textarea|select/i.test(target.tagName)) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      // The browser's own page zoom is on these chords, so preventDefault is
      // not optional here: without it both zooms fire and the whole app scales
      // along with the circuit. '=' is the unshifted '+' on most layouts.
      //
      // Full variant only. This listener is on `window`, so it fires wherever
      // focus happens to be, and the embedded copy is one panel on a page of
      // mostly text (the K-map and FSM circuit stages). Taking ctrl+minus away
      // from someone trying to zoom *that* page, to scale a canvas they may not
      // even be looking at, is not a trade worth making. The dock buttons are
      // in both variants and are enough there.
      if (full && (event.ctrlKey || event.metaKey)) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          zoomBy(1, surfaceCentre())
          return
        }
        if (event.key === '-' || event.key === '_') {
          event.preventDefault()
          zoomBy(-1, surfaceCentre())
          return
        }
        if (event.key === '0') {
          // Back to 100% *and* back to the origin. A zoom reset that left the
          // pan where it was could still leave the circuit off-screen, which
          // is the state this chord exists to escape.
          event.preventDefault()
          setCamera(CAMERA_HOME)
          return
        }
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selection) return
        event.preventDefault()
        remove(selection)
        return
      }
      if (event.key === 'Escape') {
        setPendingPort(null)
        setSnapPort(null)
        setMenu(null)
        wireRef.current = null
        setWireEnd(null)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, remove, undo, redo, zoomBy, surfaceCentre, full])

  /**
   * Wheel: ctrl/cmd to zoom, otherwise pan.
   *
   * Registered by hand rather than as an `onWheel` prop because both branches
   * call preventDefault, and React attaches its wheel listener passively. A
   * passive listener that calls preventDefault does nothing except log a
   * warning, so the page behind the canvas would scroll away underneath the
   * gesture.
   *
   * A trackpad pinch arrives here as a wheel event with ctrlKey set. Browsers
   * synthesise that, which is why pinch needs no separate code path.
   *
   * Full variant only, and for the reason the paragraph above is pleased about:
   * swallowing the wheel is right when the canvas *is* the page (.pageFull is
   * `height: 100vh; overflow: hidden`, so there is nothing behind it to
   * scroll), and wrong when it is a panel partway down a scrolling one. The
   * embedded copy would otherwise trap the wheel and leave no way to scroll
   * past the canvas with a mouse.
   */
  useEffect(() => {
    if (!full) return undefined
    const surface = surfaceRef.current
    if (!surface) return undefined

    const onWheel = (event) => {
      event.preventDefault()
      const rect = surface.getBoundingClientRect()

      if (event.ctrlKey || event.metaKey) {
        // Continuous rather than snapped to the ladder: a pinch that could only
        // land on preset rungs feels notched. clampZoom inside zoomAt keeps it
        // in range. The exponential keeps a given wheel delta the same
        // *proportional* change at every scale, so zooming out from 300% takes
        // as many notches as zooming in from 100% took.
        const factor = Math.exp(-event.deltaY / 400)
        setCamera((current) => zoomAt(current, current.zoom * factor, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }))
        return
      }

      // Shift+wheel is the conventional "scroll sideways" on a mouse with only
      // one wheel; a trackpad reports deltaX itself.
      const dx = event.shiftKey ? -event.deltaY : -event.deltaX
      const dy = event.shiftKey ? 0 : -event.deltaY
      setCamera((current) => ({ ...current, x: current.x + dx, y: current.y + dy }))
    }

    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => surface.removeEventListener('wheel', onWheel)
  }, [full])

  // An open context menu closes on the next click anywhere, including a click
  // on the canvas that is about to do something else.
  useEffect(() => {
    if (!menu) return undefined
    const close = () => setMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  // --- Free run --------------------------------------------------------------

  // Manual Step: one full clock cycle (rising edge, then falling) per press —
  // "a step" to a student, and tick() already models exactly that.
  const advance = useCallback(() => {
    simulation.tick()
    setTrace(t => [...t, simulation.sample()].slice(-TRACE_LIMIT))
    setVersion(v => v + 1)
    startSweep()
  }, [simulation, startSweep])

  /**
   * Free run: one edge per timer firing, not one full cycle.
   *
   * tick() drives the clock high then immediately low again inside a single
   * synchronous call, so between one render and the next its own displayed
   * level never actually changed — everything downstream still updated
   * correctly, but the clock itself looked frozen while the rest of the
   * circuit visibly ran, which is backwards for the one component whose whole
   * job is to be seen ticking. Toggling a single phase per firing means the
   * pulse rate on screen is the pulse rate a viewer would time with a
   * stopwatch, at the cost of needing two firings (not one) per full cycle —
   * exactly like a real clock's high and low half-periods.
   */
  const pulse = useCallback(() => {
    const next = clockPhaseRef.current ? 0 : 1
    clockPhaseRef.current = next
    simulation.phase(next)
    setTrace(t => [...t, simulation.sample()].slice(-TRACE_LIMIT))
    setVersion(v => v + 1)
    startSweep()
  }, [simulation, startSweep])

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(pulse, pulseMs)
    return () => clearInterval(id)
  }, [running, pulse, pulseMs])

  const resetSimulation = () => {
    simulation.reset()
    clockPhaseRef.current = 0
    setTrace([])
    setVersion(v => v + 1)
    startSweep()
  }

  // --- Placement -------------------------------------------------------------

  // The model picks a spot nothing overlaps, so a run of clicks lays out a
  // readable grid instead of a pile.
  const place = (kind) => {
    const { x, y } = nextFreePosition(doc, kind)
    commit(addComponent(doc, kind, x, y, {}))
    setEditingActivity('placing', 900)
  }

  const startCarry = (kind, event) => {
    carryRef.current = {
      kind,
      originX: event.clientX,
      originY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    }
    setCarry(carryRef.current)
  }

  /**
   * Dragging a part off the dock and dropping it on the canvas.
   *
   * Window-level rather than surface-level: the gesture starts on a button that
   * is not inside the canvas, so the canvas never sees the pointerdown and
   * cannot own the drag. A press that never moves is left alone — the button's
   * own onClick places it at the next free spot.
   */
  useEffect(() => {
    if (!carry) return undefined

    const move = (event) => {
      const current = carryRef.current
      if (!current) return
      const moved = current.moved
        || Math.hypot(event.clientX - current.originX, event.clientY - current.originY) > 6
      carryRef.current = { ...current, x: event.clientX, y: event.clientY, moved }
      setCarry(carryRef.current)
    }

    const up = (event) => {
      const current = carryRef.current
      carryRef.current = null
      setCarry(null)
      if (!current?.moved) return

      const surface = surfaceRef.current
      const rect = surface?.getBoundingClientRect()
      if (!rect) return
      const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom
      // The docks float *over* the canvas, so "inside the surface" is not
      // enough — dropping back onto the dock has to cancel, not place a
      // component underneath it where it cannot be seen.
      const onDock = event.target instanceof Element && event.target.closest('[data-dock]')
      if (!inside || onDock) return

      // The drop point is a screen position; the component's x/y are document
      // units. Half the component's size is subtracted *after* the conversion
      // so the part lands centred under the pointer at every zoom level, not
      // just at 100%.
      const size = componentSize({ kind: current.kind, inputs: [], outputs: [] })
      const point = toDocument(camera, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
      commit(addComponent(
        doc,
        current.kind,
        point.x - size.width / 2,
        point.y - size.height / 2,
      ))
      setEditingActivity('placing', 900)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    // Only the presence of a carry re-registers the listeners; its coordinates
    // change on every frame and would otherwise churn them 60 times a second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carry !== null, doc, commit, camera, setEditingActivity])

  // --- Dragging components ---------------------------------------------------

  /**
   * Take the pointer for the whole gesture, on the **surface**.
   *
   * Not on the element that was pressed. Every shape on this canvas is redrawn
   * as the document changes — pressing a pin re-renders it as an armed pin, and
   * Chromium answers the removal of a captured target with `pointercancel`,
   * which silently ends the drag one frame after it starts. The surface is the
   * one element that is never re-created.
   *
   * This is not the capture T-095 removed. That one was on the source pin and
   * broke the *drop*, because the release over the target pin was delivered to
   * the source. Capturing the surface has no such problem: the surface is where
   * the release is handled anyway, and the drop is resolved by hit-testing the
   * pointer against port geometry rather than by whatever the event hit.
   */
  const captureGesture = (event) => {
    try {
      surfaceRef.current?.setPointerCapture?.(event.pointerId)
    } catch {
      // Safari throws for a pointer it has already released. Losing the capture
      // costs a smoother drag, never the gesture.
    }
  }

  const onComponentPointerDown = (event, component) => {
    if (event.button !== 0) return
    event.stopPropagation()
    // The grab offset is in document units, so it stays correct if the zoom
    // changes mid-drag and so the same arithmetic works at any scale.
    const grab = documentPoint(event)
    dragRef.current = {
      id: component.id,
      dx: grab.x - component.x,
      dy: grab.y - component.y,
      moved: false,
      origin: doc,
    }
    setSelection({ type: 'component', id: component.id })
    gestureRef.current = true
    captureGesture(event)
  }

  /**
   * A press that reaches the surface itself started on bare canvas — a
   * component or a pin would have stopped it already. Arm a pan; whether it
   * actually becomes one is decided in onSurfacePointerMove by the same
   * moved-threshold every other gesture here uses, so a plain click still
   * clears the selection exactly as before.
   */
  const onSurfacePointerDown = (event) => {
    if (event.button !== 0) return
    panRef.current = { x: event.clientX, y: event.clientY, moved: false }
    captureGesture(event)
  }

  /** Pointer position in document coordinates. */
  const documentPoint = (event) => {
    const surface = surfaceRef.current
    const rect = surface.getBoundingClientRect()
    return toDocument(camera, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  /**
   * The pin a connector released here would land on.
   *
   * Only *compatible* pins are candidates: an output cannot feed an output, and
   * a component cannot drive itself. Filtering here rather than refusing later
   * is what makes the highlight honest — if a pin lights up, the drop works.
   */
  const nearestPort = (point, sourceId) => {
    const source = sourceId ? ports.get(sourceId) : null
    let best = null
    // SNAP_RADIUS is a distance on *screen*, but this hit-test runs in document
    // units, so it has to be divided by the zoom. Left as a document constant
    // it would shrink to 13px of aim at 50% and balloon to 52px at 200%: the
    // capture would get harder exactly when the pins got smaller, which is
    // backwards (T-102).
    let bestDistance = SNAP_RADIUS / camera.zoom

    for (const [id, position] of ports) {
      if (id === sourceId) continue
      if (source && (position.componentId === source.componentId || position.side === source.side)) {
        continue
      }
      const distance = Math.hypot(position.x - point.x, position.y - point.y)
      if (distance > bestDistance) continue
      best = id
      bestDistance = distance
    }
    return best
  }

  const onSurfacePointerMove = (event) => {
    const pan = panRef.current
    if (pan) {
      const dx = event.clientX - pan.x
      const dy = event.clientY - pan.y
      const moved = pan.moved || Math.hypot(dx, dy) > 4
      if (moved) {
        // The content follows the hand: dragging right moves the whole
        // document right, exactly like grabbing a piece of paper. No bound —
        // this is a camera offset, not a scroll position clamped to whatever
        // the circuit currently overflows, so there is always somewhere left
        // to pan into.
        // Raw client deltas, deliberately unscaled: the pan lives in screen
        // pixels, so the content keeps up with the hand 1:1 at every zoom.
        if (!pan.moved) setEditingActivity('dragging')
        setCamera(c => ({ ...c, x: c.x + dx, y: c.y + dy }))
      }
      panRef.current = { x: event.clientX, y: event.clientY, moved }
      return
    }

    // A wire being dragged out of a port follows the pointer.
    if (wireRef.current) {
      const point = documentPoint(event)
      const from = wireRef.current.origin
      if (Math.hypot(point.x - from.x, point.y - from.y) > 4) wireRef.current.dragged = true
      setWireEnd(point)
      setSnapPort(nearestPort(point, pendingPort))
      return
    }

    const drag = dragRef.current
    if (!drag) return
    const point = documentPoint(event)
    const x = point.x - drag.dx
    const y = point.y - drag.dy

    // A snapped position that has not changed is not a move. Without this a
    // one-pixel wobble on mousedown counts as a drag and swallows the click
    // that was meant to toggle an input.
    const next = { x: Math.max(0, snap(x)), y: Math.max(0, snap(y)) }
    const current = doc.components.find(c => c.id === drag.id)
    if (current && current.x === next.x && current.y === next.y) return

    if (!drag.moved) setEditingActivity('dragging')
    drag.moved = true
    // Moves are applied without a history entry on every frame; the entry is
    // pushed once on release, so undo steps by gesture rather than by pixel.
    setDocState(currentDoc => moveComponent(currentDoc, drag.id, next.x, next.y))
  }

  const onSurfacePointerUp = (event) => {
    if (panRef.current) {
      // A pan that moved already did its job through the offset; the trailing
      // click on the surface must not also clear the selection. A pan that
      // never moved was a plain click and falls through to that click exactly
      // as before.
      if (panRef.current.moved) {
        gestureRef.current = true
        setEditingActivity(null)
      }
      panRef.current = null
      return
    }

    // The drop is resolved by geometry, not by whichever element received the
    // pointerup. That distinction is the whole bug this replaced: capturing the
    // pointer on the source pin meant every subsequent event — including the
    // release over the *target* pin — was delivered to the source, so a dragged
    // wire could never land anywhere.
    if (wireRef.current) {
      const { dragged } = wireRef.current
      wireRef.current = null
      setWireEnd(null)
      if (!dragged) { setSnapPort(null); return } // a click: leave the wire armed

      const target = snapPort ?? (event ? nearestPort(documentPoint(event), pendingPort) : null)
      setSnapPort(null)
      if (target) { finishWire(target); return }
      setPendingPort(null)
      return
    }

    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return

    if (drag.moved) {
      setEditingActivity(null)
      setPast(p => [...p.slice(-HISTORY_LIMIT), drag.origin])
      setFuture([])
      if (persist) saveToStorage(safeStorage(), doc)
      onDocumentChange?.(doc)
      return
    }

    // A click that never moved is an interaction, not a drag.
    const component = doc.components.find(c => c.id === drag.id)
    if (!component) return
    if (component.kind === 'input' || component.kind === 'clock') {
      // The clock used to fall through here and do nothing, even though it has
      // a level like any other source (T-096).
      simulation.toggleInput(component.id)
      setVersion(v => v + 1)
      startSweep()
    } else if (component.kind === 'const') {
      commit(setConstValue(doc, component.id, component.value ? 0 : 1))
    }
  }

  /**
   * Wiring, both ways round and in either direction.
   *
   * Press a pin and drag to another, or click one then click the other. Both
   * gestures run through the same two handlers: pointerdown arms a source,
   * pointerup on a pin completes. A press that never moves leaves the source
   * armed, which is what makes the click-click form work without a second code
   * path.
   *
   * Starting at an *input* is as valid as starting at an output — a student
   * aiming at a gate's pin and dragging back to a source is describing the same
   * connection, and refusing it was a rule with no reason behind it.
   *
   * Pressing an input pin that is already wired detaches that wire and picks it
   * up from its original source, so re-routing is a drag rather than a
   * delete-then-redraw.
   */
  const onPortPointerDown = (event, portId, side) => {
    if (event.button !== 0) return
    event.stopPropagation()
    setMenu(null)

    if (pendingPort && pendingPort !== portId) {
      finishWire(portId)
      return
    }

    if (side === 'in') {
      const existing = doc.wires.find(w => w.to === portId)
      if (existing) {
        commit(removeWire(doc, existing.id))
        arm(existing.from, event)
        return
      }
    }

    arm(portId, event)
  }

  const arm = (portId, event) => {
    setPendingPort(portId)
    setSnapPort(null)
    wireRef.current = { origin: ports.get(portId), dragged: false }
    setWireEnd(documentPoint(event))
    gestureRef.current = true
    captureGesture(event)
  }

  /**
   * The browser took the pointer away mid-gesture. Put everything back rather
   * than leaving a wire armed with no way to see it, which is what a half-ended
   * drag looks like from the student's side.
   */
  const onSurfacePointerCancel = () => {
    panRef.current = null
    wireRef.current = null
    dragRef.current = null
    setWireEnd(null)
    setSnapPort(null)
    setPendingPort(null)
    setEditingActivity(null)
  }

  const finishWire = (portId) => {
    const source = pendingPort
    setPendingPort(null)
    setSnapPort(null)
    if (!source || source === portId) return

    const a = ports.get(source)
    const b = ports.get(portId)
    if (!a || !b) return
    if (a.side === b.side) {
      flash('A wire runs from an output to an input. Those are both the same kind of pin.')
      return
    }

    // Whichever end was the output is the source, so the gesture's direction
    // does not change the circuit it describes.
    const from = a.side === 'out' ? source : portId
    const to = a.side === 'out' ? portId : source

    // reconnect, not connect: dropping on an occupied input re-points it. See
    // the note on reconnect() in sandboxModel.js.
    const result = reconnect(doc, from, to)
    if (!result.ok) { flash(result.reason); return }
    commit(result.doc)
  }

  /** Right-click anything on the canvas: the Logisim reflex. */
  const openMenu = (event, target) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return
    setSelection(target)
    setMenu({
      target,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  // --- Clearing the canvas ---------------------------------------------------

  /**
   * Empty the canvas and send the camera home (T-102).
   *
   * Called only from the confirmation dialog, never straight off the button:
   * there was no way to start a fresh circuit before this except deleting every
   * component by hand, and the control that fixes that is also the most
   * destructive one on the page.
   *
   * The document goes through `commit()` rather than `setDocState`, which does
   * two things that both matter. It pushes an undo entry, so Ctrl+Z brings the
   * circuit back and the dialog is a speed bump rather than the only safety
   * net. And it autosaves, so the cleared canvas is what a reload finds; the
   * saved circuit would otherwise still be sitting in localStorage under
   * STORAGE_KEY, and clearing would silently undo itself on the next visit.
   */
  const clearCanvas = () => {
    setRunning(false)
    stopSweep()
    setFront(SETTLED)

    commit(emptyDocument())

    // Every in-flight gesture refers to components that no longer exist.
    setSelection(null)
    setPendingPort(null)
    setSnapPort(null)
    setWireEnd(null)
    setMenu(null)
    wireRef.current = null
    dragRef.current = null
    panRef.current = null
    carryRef.current = null
    setCarry(null)
    setEditingActivity(null)

    // The simulation itself rebuilds on its own; it is a useMemo over `doc`.
    setTrace([])
    clockPhaseRef.current = 0

    setCamera(CAMERA_HOME)
    setConfirmingClear(false)
    flash('Canvas cleared. Ctrl+Z brings it back.')
  }

  // --- Import / export -------------------------------------------------------

  const exportFile = () => {
    const blob = new Blob([toCirc(doc)], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = 'circuit.circ'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result)
      // T-095 and earlier exported our own JSON. Those files are on students'
      // disks, so they still open.
      const result = text.trimStart().startsWith('{') ? deserialize(text) : fromCirc(text)
      if (!result.ok) { flash(result.reason); return }
      commit(result.doc)
      setSelection(null)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  // --- Paint -----------------------------------------------------------------

  const valueOf = (portId) => {
    const owner = owners.get(portId)
    if (!owner) return UNKNOWN
    return owner.side === 'out' ? simulation.portValue(portId) : simulation.pinValue(portId)
  }

  const draftEnd = snapPort ? { ...ports.get(snapPort) } : wireEnd

  return (
    <div className={styles.wrap} data-variant={variant}>
      <div className={styles.surfaceShell}>
        <div
          ref={surfaceRef}
          className={styles.surface}
          // The dot grid is a background-image, not part of the SVG's own
          // transformed content, so it has to be moved in step with the camera
          // by hand — otherwise the lattice would sit still while the circuit
          // panned across it, which looked like the components were sliding
          // off their own snap grid. The spacing has to track the zoom for the
          // same reason: the dots are a picture of the lattice components
          // actually snap to, and a 20px grid under a circuit drawn at 50% is
          // a picture of a lattice that does not exist.
          style={{
            backgroundPosition: `${camera.x}px ${camera.y}px`,
            backgroundSize: `${GRID * camera.zoom}px ${GRID * camera.zoom}px`,
          }}
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
          onPointerCancel={onSurfacePointerCancel}
          // The browser's own drag-and-drop is the other thing that wants this
          // gesture. Once it starts, it takes the pointer and every wire in
          // flight is cancelled mid-drag — which looked exactly like the
          // connector "not working" on some drags and working on others,
          // because the native drag only kicks in past a movement threshold.
          onDragStart={(event) => event.preventDefault()}
          // Clearing belongs to a click on *bare canvas*. Capturing the
          // pointer on the surface means a click that began on a pin or a
          // component is delivered here too, and clearing on that un-armed the
          // wire it had just armed and dropped the selection it had just made —
          // the same shape of bug T-095 fixed with a stopPropagation that the
          // capture then routed around.
          onClick={() => {
            if (gestureRef.current) { gestureRef.current = false; return }
            setSelection(null)
            setPendingPort(null)
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <svg
            className={styles.canvas}
            role="application"
            aria-label="Circuit editor"
          >
            {/* Every shape below is in document space, unchanged by panning or
                zooming. This transform is the only thing that moves.
                Everything drawn outside the visible rect is simply not painted
                (an <svg>'s default overflow is hidden), which is what makes
                this an infinite canvas rather than a bigger fixed one: there is
                no edge for the camera to run out of.

                translate before scale, so `camera.x`/`y` keep meaning screen
                pixels. The other order would scale the pan too, and dragging
                the canvas would move it at half speed at 50%. */}
            <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
            {doc.wires.map((wire) => {
              const from = ports.get(wire.from)
              const to = ports.get(wire.to)
              if (!from || !to) return null
              const value = valueOf(wire.from)
              const d = routeWire(from, to)
              return (
                <g key={wire.id}>
                  {/* An invisible fat copy underneath, so a 2px wire has a
                      target you can actually click to select or delete. */}
                  <path
                    d={d}
                    className={styles.wireHit}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelection({ type: 'wire', id: wire.id })
                    }}
                    onContextMenu={(event) => openMenu(event, { type: 'wire', id: wire.id })}
                  />
                  <path
                    d={d}
                    className={[
                      styles.wire,
                      value === 1 ? styles.wireHigh : '',
                      value === UNKNOWN ? styles.wireUnknown : '',
                      selection?.type === 'wire' && selection.id === wire.id ? styles.wireSelected : '',
                    ].filter(Boolean).join(' ')}
                  />
                </g>
              )
            })}

            {/* The travelling current. Drawn over the wires, never instead of
                them, so the settled colours stay readable throughout.

                Only a 1 pulses. A wire holding 0 is carrying no current, and
                animating it said the opposite of what the circuit was doing. */}
            {doc.wires.map((wire) => {
              const level = plan.wireLevel.get(wire.id) ?? 0
              if (level > front) return null
              const from = ports.get(wire.from)
              const to = ports.get(wire.to)
              if (!from || !to) return null
              if (valueOf(wire.from) !== 1) return null
              return (
                <path
                  key={`pulse-${sweepId}-${wire.id}`}
                  d={routeWire(from, to)}
                  pathLength="1"
                  className={styles.pulse}
                />
              )
            })}

            {/* The connector in flight. Same router as a committed wire, so the
                gesture previews the shape it is about to produce. */}
            {pendingPort && draftEnd && ports.get(pendingPort) && (
              <path
                d={routeWire(ports.get(pendingPort), draftEnd)}
                className={`${styles.draftWire} ${snapPort ? styles.draftWireSnapped : ''}`}
              />
            )}

            {doc.components.map(component => (
              <SandboxComponent
                key={component.id}
                component={component}
                simulation={simulation}
                selected={selection?.type === 'component' && selection.id === component.id}
                hovered={hoverComponent === component.id}
                onPointerDown={(event) => onComponentPointerDown(event, component)}
                onPointerEnter={() => setHoverComponent(component.id)}
                onPointerLeave={() => setHoverComponent(current => (
                  current === component.id ? null : current
                ))}
                onContextMenu={(event) => openMenu(event, { type: 'component', id: component.id })}
                onPortPointerDown={onPortPointerDown}
                onPortHover={setHoverPort}
                hoverPort={hoverPort}
                pendingPort={pendingPort}
                snapPort={snapPort}
                valueOf={valueOf}
              />
            ))}
            </g>
          </svg>

          {doc.components.length === 0 && (
            <p className={`${styles.empty} ${md.bodyMedium}`}>
              Drag a part off the bar below, or click it. Drag between two pins to wire them —
              either direction, and the nearest pin catches the wire. Click an input or a clock to
              flip it, and right-click anything to delete it.
            </p>
          )}

          {message && (
            <p className={`${styles.toast} ${md.bodyMedium}`} role="alert">{message.text}</p>
          )}
        </div>

        {/* Floating chrome. Everything is over the canvas, nothing is in the
            flow: the canvas is the tool, and the controls are things on it. */}
        <div className={styles.dockTopLeft} data-dock="transport">
          <SandboxControls
            onBack={full ? onBack : null}
            running={running}
            onToggleRun={() => setRunning(r => !r)}
            onStep={advance}
            onReset={resetSimulation}
            onUndo={undo}
            canUndo={past.length > 0}
            onRedo={redo}
            canRedo={future.length > 0}
            onDelete={() => remove(selection)}
            canDelete={Boolean(selection)}
            unstable={simulation.unstable.length > 0}
            invalid={simulation.invalid.size > 0}
            waveformOpen={timingOpen}
            onToggleWaveform={() => setTimingOpen(open => !open)}
            pulseMs={pulseMs}
            onPulseMsChange={setPulseMs}
          />
        </div>

        {full && (
          <div className={styles.dockTopRight} data-dock="files">
            <div className={styles.fileDock}>
              <IconButton
                label="Export as a Logisim .circ file"
                onClick={exportFile}
                disabled={doc.components.length === 0}
              >
                <Download size={20} aria-hidden="true" />
              </IconButton>
              <IconButton label="Import a .circ file" onClick={() => fileRef.current?.click()}>
                <Upload size={20} aria-hidden="true" />
              </IconButton>
              <input
                ref={fileRef}
                type="file"
                accept=".circ,application/xml,text/xml,.json,application/json"
                className={styles.fileInput}
                onChange={importFile}
              />

              <span className={styles.dockDivider} aria-hidden="true" />

              {/* Deliberately not called "Reset": the transport dock already
                  has "Reset every flip-flop", and two controls called reset in
                  one workbench is a coin toss over which one empties your
                  work. */}
              <IconButton
                label="Clear the canvas"
                onClick={() => setConfirmingClear(true)}
                disabled={doc.components.length === 0 && doc.wires.length === 0}
              >
                <Eraser size={20} aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        )}

        {/* Zoom sits bottom-left. Top-left is the transport dock with the pin
            control beneath it, bottom-centre is the parts dock, and
            bottom-right is where the dynamic island parks in this mode (see
            .dockBottom's max-width). Unlike the file dock this is in both
            variants: it is a camera control, and panning already works in the
            embedded copy. */}
        <div className={styles.dockBottomLeft} data-dock="zoom">
          <div className={`${styles.fileDock} ${styles.zoomDock}`}>
            <IconButton
              label="Zoom out"
              onClick={() => zoomBy(-1, surfaceCentre())}
              disabled={!canStepZoom(camera.zoom, -1)}
            >
              <ZoomOut size={20} aria-hidden="true" />
            </IconButton>
            {/* The visible text is the current zoom, but a button named "150%"
                tells a screen reader nothing about what pressing it does. */}
            <button
              type="button"
              className={`${styles.zoomReadout} ${md.labelMedium}`}
              onClick={() => setCamera(CAMERA_HOME)}
              title="Reset the view to 100%"
              aria-label={`Zoom is ${zoomLabel(camera.zoom)}. Reset the view to 100%`}
            >
              {zoomLabel(camera.zoom)}
            </button>
            <IconButton
              label="Zoom in"
              onClick={() => zoomBy(1, surfaceCentre())}
              disabled={!canStepZoom(camera.zoom, 1)}
            >
              <ZoomIn size={20} aria-hidden="true" />
            </IconButton>
          </div>
        </div>

        <div className={styles.dockBottom} data-dock="parts">
          <GatePalette onPlace={place} onCarryStart={startCarry} />
        </div>

        {/* Pin-count is a property of the selected gate, so it sits with the
            selection rather than in a dock that is mostly empty. */}
        {selection?.type === 'component' && (
          <PinCountControl doc={doc} selection={selection} commit={commit} />
        )}

        {menu && (
          <ContextMenu
            menu={menu}
            doc={doc}
            simulation={simulation}
            onDelete={() => { remove(menu.target); setMenu(null) }}
            onAction={(next) => { commit(next); setMenu(null) }}
            onToggleInput={(id) => {
              simulation.toggleInput(id)
              setVersion(v => v + 1)
              startSweep()
              setMenu(null)
            }}
          />
        )}
      </div>

      {/* The part following the pointer out of the dock. Fixed-position and
          inert, so it never intercepts the drop it exists to describe. */}
      {carry?.moved && (
        <div className={styles.ghost} style={{ left: carry.x, top: carry.y }} aria-hidden="true">
          <GateIcon kind={carry.kind} size={28} />
        </div>
      )}

      {/* A popup rather than a panel in the flow. The timing diagram is a
          reference you consult about a circuit that already runs, not something
          to watch while building one. */}
      {timingOpen && (
        <TimingDialog
          simulation={simulation}
          trace={trace}
          version={version}
          onClose={() => setTimingOpen(false)}
        />
      )}

      {confirmingClear && (
        <ConfirmDialog
          title="Clear the canvas?"
          body="This removes every component and wire. You can undo it."
          confirmLabel="Clear canvas"
          onConfirm={clearCanvas}
          onCancel={() => setConfirmingClear(false)}
        />
      )}
    </div>
  )
}

/**
 * A yes/no modal for a destructive action.
 *
 * Not `window.confirm`: nothing in this app uses it, it cannot follow the nine
 * themes, and it blocks the main thread while a circuit may be free-running.
 *
 * Same shape as TimingDialog above, including the capture-phase Escape
 * listener, because the canvas also listens for Escape to cancel a half-drawn wire, so
 * without stopping the event here one press would both close this dialog and
 * throw away an unrelated gesture underneath it.
 *
 * Cancel takes focus on open rather than the confirm button. The dialog exists
 * because the action is hard to take back; the default answer should be the
 * safe one, so a stray Enter closes it rather than emptying the canvas.
 */
function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }) {
  const panelRef = useRef(null)

  // Read through a ref so the effect below can run exactly once. Depending on
  // `onCancel` directly would re-run it on every render of the sandbox, and the
  // sandbox re-renders on every clock pulse while a circuit free-runs. That
  // would move focus back to Cancel a few times a second and make it
  // impossible to Tab to the confirm button.
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel

  useEffect(() => {
    // Focused through the panel rather than with a ref on the button itself:
    // md's Button is a plain function component on React 18, so a `ref` prop
    // would be dropped with a warning rather than reaching the DOM node.
    panelRef.current?.querySelector('[data-autofocus]')?.focus()

    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      cancelRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div className={styles.dialogScrim} onMouseDown={onCancel}>
      <div
        ref={panelRef}
        className={styles.confirmDialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sandbox-confirm-title"
        aria-describedby="sandbox-confirm-body"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="sandbox-confirm-title" className={`${styles.dialogTitle} ${md.titleMedium}`}>
          {title}
        </h2>
        <p id="sandbox-confirm-body" className={`${styles.confirmBody} ${md.bodyMedium}`}>
          {body}
        </p>
        <div className={styles.confirmActions}>
          <Button variant="text" data-autofocus onClick={onCancel}>Cancel</Button>
          <Button variant="filled" className={styles.confirmDanger} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * The timing diagram, as a modal.
 *
 * Escape closes, the backdrop closes, and focus moves into the dialog on open
 * so the keyboard is not left behind on the button that opened it.
 */
function TimingDialog({ simulation, trace, version, onClose }) {
  const panelRef = useRef(null)

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      // The canvas also listens for Escape (to cancel a half-drawn wire); this
      // one runs first and stops it, so one press closes one thing.
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className={styles.dialogScrim} onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Timing diagram"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 className={`${styles.dialogTitle} ${md.titleMedium}`}>Timing diagram</h2>
          <span className={`${md.labelMedium} ${md.variantText}`}>
            {trace.length} cycle{trace.length === 1 ? '' : 's'}
          </span>
          <IconButton label="Close timing diagram" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </header>
        <div className={styles.dialogBody}>
          <WaveformPanel simulation={simulation} trace={trace} version={version} />
        </div>
      </div>
    </div>
  )
}

/** Right-click menu. Only offers what applies to the thing under the pointer. */
function ContextMenu({ menu, doc, simulation, onDelete, onAction, onToggleInput }) {
  const component = menu.target.type === 'component'
    ? doc.components.find(c => c.id === menu.target.id)
    : null

  const items = []

  if (component?.kind === 'input' || component?.kind === 'clock') {
    items.push({
      label: `Set to ${simulation.getInput(component.id) ? 0 : 1}`,
      run: () => onToggleInput(component.id),
    })
  }
  if (component?.kind === 'const') {
    items.push({
      label: `Set to ${component.value ? 0 : 1}`,
      run: () => onAction(setConstValue(doc, component.id, component.value ? 0 : 1)),
    })
  }
  if (component && canResize(component)) {
    if (component.inputs.length < 6) {
      items.push({
        label: 'Add an input',
        run: () => onAction(setGatePins(doc, component.id, component.inputs.length + 1)),
      })
    }
    if (component.inputs.length > 2) {
      items.push({
        label: 'Remove an input',
        run: () => onAction(setGatePins(doc, component.id, component.inputs.length - 1)),
      })
    }
  }

  items.push({
    label: menu.target.type === 'wire' ? 'Delete wire' : 'Delete',
    run: onDelete,
    danger: true,
  })

  return (
    <div
      className={styles.menu}
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      // The window-level listener that closes this fires on mousedown, so a
      // click inside must not bubble up to it before the button's own onClick.
      onMouseDown={(event) => event.stopPropagation()}
    >
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={[styles.menuItem, md.stateLayer, md.bodyMedium, item.danger ? styles.menuItemDanger : '']
            .filter(Boolean).join(' ')}
          onClick={item.run}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function canResize(component) {
  if (isFlipFlop(component.kind)) return false
  return !['input', 'output', 'clock', 'const', 'not'].includes(component.kind)
}

/** Pin-count stepper for the selected gate, when it has one. */
function PinCountControl({ doc, selection, commit }) {
  const component = doc.components.find(c => c.id === selection.id)
  if (!component || !canResize(component)) return null

  return (
    <div className={styles.pinControl} data-dock="pins">
      <span className={`${md.labelMedium} ${md.variantText}`}>Inputs</span>
      <IconButton
        label="Fewer inputs"
        disabled={component.inputs.length <= 2}
        onClick={() => commit(setGatePins(doc, component.id, component.inputs.length - 1))}
      >
        <span aria-hidden="true">−</span>
      </IconButton>
      <span className={styles.pinCount}>{component.inputs.length}</span>
      <IconButton
        label="More inputs"
        disabled={component.inputs.length >= 6}
        onClick={() => commit(setGatePins(doc, component.id, component.inputs.length + 1))}
      >
        <span aria-hidden="true">+</span>
      </IconButton>
    </div>
  )
}

function SandboxComponent({
  component,
  simulation,
  selected,
  hovered,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onContextMenu,
  onPortPointerDown,
  onPortHover,
  hoverPort,
  pendingPort,
  snapPort,
  valueOf,
}) {
  const { width, height } = componentSize(component)
  const labels = pinLabels(component)
  const invalid = simulation.invalid.has(component.id)
  const { x, y, kind } = component

  const bodyValue = kind === 'input' || kind === 'clock'
    ? simulation.getInput(component.id)
    : simulation.outputOf(component.id)

  // Inputs and probes carry the bits the student is reading off the canvas, so
  // they get their own fixed colours rather than the neutral gate surface they
  // all shared before (T-096). Blue is a source, green is a reading.
  const role = kind === 'input' || kind === 'const' || kind === 'clock' ? styles.bodySource
    : kind === 'output' ? styles.bodyProbe
      : ''

  // 0 is drawn, not just left in the role's resting tint: a source reads as a
  // duller grey at 0 (nothing to read off it yet) and a probe reads red (the
  // "off" result), so the colour carries the bit on its own rather than
  // leaning entirely on the digit inside it. An unknown value (a loose pin)
  // is neither — that already has its own dashed/hollow treatment elsewhere.
  const stateClass = bodyValue === 1 ? styles.bodyHigh : bodyValue === 0 ? styles.bodyLow : ''

  const bodyClass = [
    styles.body,
    role,
    selected ? styles.bodySelected : '',
    invalid ? styles.bodyInvalid : '',
    stateClass,
  ].filter(Boolean).join(' ')

  const interaction = { onPointerDown, onContextMenu }

  return (
    <g className={styles.component} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <Silhouette
        component={component}
        width={width}
        height={height}
        className={bodyClass}
        value={bodyValue}
        invalid={invalid}
        interaction={interaction}
      />

      {component.inputs.map((port, i) => {
        const step = height / (component.inputs.length + 1)
        const pinY = Math.round(y + step * (i + 1))
        const stubTo = GATE_KINDS.includes(kind)
          ? backEdgeAt(kind, { x: x + STUB, y, width: width - STUB, height }, pinY)
          : null

        return (
          <g key={port}>
            {stubTo !== null && (
              <line x1={x} y1={pinY} x2={stubTo} y2={pinY} className={styles.stub} />
            )}
            <Port
              cx={x}
              cy={pinY}
              id={port}
              side="in"
              armed={pendingPort === port}
              snapped={snapPort === port}
              grown={hovered || hoverPort === port}
              value={valueOf(port)}
              onPortPointerDown={onPortPointerDown}
              onPortHover={onPortHover}
              onContextMenu={onContextMenu}
            />
            {labels.inputs[i] && (
              <text x={x + 8} y={pinY + 3.5} className={styles.pinLabel} pointerEvents="none">
                {labels.inputs[i]}
              </text>
            )}
          </g>
        )
      })}

      {component.outputs.map((port, i) => {
        const step = height / (component.outputs.length + 1)
        const pinY = Math.round(y + step * (i + 1))
        return (
          <g key={port}>
            <Port
              cx={x + width}
              cy={pinY}
              id={port}
              side="out"
              armed={pendingPort === port}
              snapped={snapPort === port}
              grown={hovered || hoverPort === port}
              value={valueOf(port)}
              onPortPointerDown={onPortPointerDown}
              onPortHover={onPortHover}
              onContextMenu={onContextMenu}
            />
            {labels.outputs[i] && (
              <text x={x + width - 8} y={pinY + 3.5} className={styles.pinLabelRight} pointerEvents="none">
                {labels.outputs[i]}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

/**
 * One connection point.
 *
 * Three circles: a dot you can see, a ring when a connector would land here, and
 * a 12px transparent disc you can hit. The visible dot alone gave a 10px target,
 * which is under every pointer-size guideline and was why the sandbox felt like
 * it could not be wired — the mechanism worked, the aim was the problem.
 *
 * The dot grows when its component is hovered, the way a FigJam shape grows its
 * connection handles, so the pins read as things to grab rather than decoration.
 */
function Port({
  cx, cy, id, side, armed, snapped, grown, value,
  onPortPointerDown, onPortHover, onContextMenu,
}) {
  const r = snapped ? 7 : grown ? 6.5 : 5

  return (
    <g>
      {snapped && <circle cx={cx} cy={cy} r="12" className={styles.snapRing} pointerEvents="none" />}
      <circle cx={cx} cy={cy} r={r} className={portClass(value)} pointerEvents="none" />
      {armed && <circle cx={cx} cy={cy} r="9" className={styles.pendingPort} pointerEvents="none" />}
      <circle
        cx={cx}
        cy={cy}
        r="12"
        className={styles.portHit}
        onPointerDown={(event) => onPortPointerDown(event, id, side)}
        onPointerEnter={() => onPortHover(id)}
        onPointerLeave={() => onPortHover(current => (current === id ? null : current))}
        // The surface's own click handler clears the armed wire. Without this,
        // the click that arms it immediately un-arms it and click-then-click
        // wiring never worked.
        onClick={(event) => event.stopPropagation()}
        onContextMenu={onContextMenu}
      />
    </g>
  )
}

/**
 * The body of one component.
 *
 * Gates come straight from gateShapes.js. Everything else gets the shape its
 * job implies: a square you click for an input, a circle for a probe, a hexagon
 * for a constant so it cannot be mistaken for one, and a rectangle with a clock
 * notch for a flip-flop.
 */
function Silhouette({ component, width, height, className, value, invalid, interaction }) {
  const { x, y, kind, label } = component
  const cx = x + width / 2
  const cy = y + height / 2
  const digit = value === UNKNOWN ? 'x' : String(value)

  if (kind === 'input' || kind === 'const') {
    const shape = kind === 'const'
      ? <path d={hexagon(x, y, width, height)} className={className} {...interaction} />
      : <rect x={x} y={y} width={width} height={height} rx="4" className={className} {...interaction} />
    return (
      <g>
        {shape}
        <text x={cx} y={cy + 5} className={`${styles.valueDigit} ${styles.digitSource}`} pointerEvents="none">
          {kind === 'const' ? component.value : digit}
        </text>
        {label && (
          <text x={x} y={y - 6} className={styles.outsideLabel} pointerEvents="none">{label}</text>
        )}
        <title>{kind === 'const' ? 'Constant' : `Input ${label} — click to flip`}</title>
      </g>
    )
  }

  if (kind === 'output') {
    return (
      <g>
        <circle cx={cx} cy={cy} r={Math.min(width, height) / 2} className={className} {...interaction} />
        <text x={cx} y={cy + 5} className={`${styles.valueDigit} ${styles.digitProbe}`} pointerEvents="none">
          {digit}
        </text>
        {label && (
          <text x={x} y={y - 6} className={styles.outsideLabel} pointerEvents="none">{label}</text>
        )}
        <title>Probe {label}</title>
      </g>
    )
  }

  if (kind === 'clock') {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx="4" className={className} {...interaction} />
        <path
          d={`M${x + 6},${y + height - 10} L${x + 6},${y + 10} L${x + 17},${y + 10} L${x + 17},${y + height - 10} L${x + 28},${y + height - 10} L${x + 28},${y + 10}`}
          className={styles.clockWave}
          pointerEvents="none"
        />
        {/* Its level, drawn on it: a clock you can click has a state worth
            reading, and without this the click had nothing to show for it. */}
        <text x={x + width - 12} y={cy + 5} className={`${styles.valueDigit} ${styles.digitSource}`} pointerEvents="none">
          {digit}
        </text>
        <title>Clock — click to flip</title>
      </g>
    )
  }

  if (isFlipFlop(kind)) {
    const pins = FLIP_FLOP_PINS[kind]
    const clockY = Math.round(y + (height / (pins.length + 1)) * pins.length)
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx="4" className={className} {...interaction} />
        <path d={clockNotch(x, clockY)} className={styles.notch} pointerEvents="none" />
        <text x={cx} y={y + 22} className={styles.bodyLabel} pointerEvents="none">
          {kind.replace('ff', '').toUpperCase()}
        </text>
        <text x={cx} y={y + height - 10} className={styles.bodySub} pointerEvents="none">
          {invalid ? 'invalid' : `Q=${value}`}
        </text>
        <title>{kind.replace('ff', '').toUpperCase()} flip-flop</title>
      </g>
    )
  }

  const shape = gateSilhouette(kind, { x: x + STUB, y, width: width - STUB, height })
  if (!shape) {
    return <rect x={x} y={y} width={width} height={height} rx="6" className={className} {...interaction} />
  }

  return (
    <g>
      <path d={shape.body} className={className} {...interaction} />
      {shape.tail && <path d={shape.tail} className={styles.gateTail} pointerEvents="none" />}
      {shape.bubble && (
        <circle
          cx={shape.bubble.cx}
          cy={shape.bubble.cy}
          r={shape.bubble.r}
          className={className}
          {...interaction}
        />
      )}
      <title>{kind.toUpperCase()}</title>
    </g>
  )
}

/** Flat-topped hexagon, so a constant never reads as a clickable input. */
function hexagon(x, y, w, h) {
  const notch = w * 0.22
  return `M${x + notch},${y} L${x + w - notch},${y} L${x + w},${y + h / 2} L${x + w - notch},${y + h} L${x + notch},${y + h} L${x},${y + h / 2} Z`
}

function portClass(value) {
  if (value === 1) return styles.portHigh
  if (value === 0) return styles.portLow
  return styles.portUnknown
}

function safeStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function loadStored() {
  return loadFromStorage(safeStorage())
}
