/**
 * Sandbox document model (T-089 phase 2).
 *
 * Pure functions over the same netlist shape circuitSynthesis.js emits, plus
 * x/y on each component. Keeping the model out of React is what lets the
 * awkward parts (port geometry, the one-driver-per-pin rule, undo) be tested
 * without a DOM, and what makes "Open in sandbox" a no-op rather than a
 * conversion: a synthesised netlist is already a valid document once it has
 * coordinates.
 */

import { FLIP_FLOP_PINS, FLIP_FLOP_LABELS, isFlipFlop } from './flipFlops.js'

export const SCHEMA_VERSION = 1

/** What the palette offers. Deliberately narrow: 1-bit wires, no buses, no
 *  subcircuits. That covers the whole course and removes most of what makes a
 *  real schematic editor hard. */
export const PALETTE = [
  {
    group: 'Input / output',
    items: [
      { kind: 'input', label: 'Input', hint: 'Click it to toggle between 0 and 1' },
      { kind: 'output', label: 'Probe', hint: 'Shows the value on the wire' },
      { kind: 'clock', label: 'Clock', hint: 'Drives the flip-flops on each step' },
      { kind: 'const', label: 'Constant', hint: 'A fixed 0 or 1' },
    ],
  },
  {
    group: 'Gates',
    items: [
      { kind: 'and', label: 'AND' },
      { kind: 'or', label: 'OR' },
      { kind: 'not', label: 'NOT' },
      { kind: 'xor', label: 'XOR' },
      { kind: 'nand', label: 'NAND' },
      { kind: 'nor', label: 'NOR' },
      { kind: 'xnor', label: 'XNOR' },
    ],
  },
  {
    group: 'Flip-flops',
    items: [
      { kind: 'dff', label: 'D' },
      { kind: 'tff', label: 'T' },
      { kind: 'jkff', label: 'JK' },
      { kind: 'srff', label: 'SR' },
    ],
  },
]

export const PLACEABLE_KINDS = PALETTE.flatMap(g => g.items.map(i => i.kind))

const DEFAULT_GATE_PINS = 2
const SINGLE_PIN = new Set(['not', 'output'])

/**
 * The canvas grid, in document units.
 *
 * Everything lands on it: placement, drags, and the dotted background the
 * surface paints. A visible grid that components do not sit on is worse than no
 * grid at all, and snapping is what makes hand-drawn wires run straight instead
 * of stair-stepping by a few pixels (T-095).
 */
export const GRID = 20

/** Nearest grid multiple. */
export function snap(value) {
  return Math.round(value / GRID) * GRID
}

/**
 * How far the top of the canvas is spoken for by the floating transport dock.
 *
 * The docks sit *over* the canvas (T-096), so anything laid out at y = 0 is
 * hidden behind the controls and reads as missing. Both placement paths keep
 * clear of it: `nextFreePosition` starts its first row here, and `fromNetlist`
 * offsets an incoming layout by it.
 */
export const DOCK_INSET = GRID * 4

/**
 * Geometry per kind. One table, so the canvas and the hit-testing agree.
 *
 * Sized in grid multiples, and wide enough for the real gate silhouettes: an OR
 * body needs horizontal room its bounding box does not suggest, because the
 * concave back eats into the left edge.
 */
export function componentSize(component) {
  if (isFlipFlop(component.kind)) return { width: 80, height: 100 }
  switch (component.kind) {
    case 'input':
    case 'output':
    case 'const':
      return { width: 40, height: 40 }
    case 'clock':
      return { width: 60, height: 40 }
    case 'not':
      return { width: 60, height: 40 }
    default: {
      const pins = Math.max(2, component.inputs.length)
      return { width: 80, height: Math.max(60, snap(pins * 20)) }
    }
  }
}

/**
 * Where each port sits, in document coordinates.
 * Inputs down the left edge, outputs down the right.
 *
 * Pin spacing is rounded to whole pixels so a wire meeting a pin lands exactly
 * on it. Half-pixel port centres were what made wires appear to miss their
 * targets by a hairline at high zoom in the read-only canvas (T-089).
 */
export function portPositions(component) {
  const { width, height } = componentSize(component)
  const positions = {}

  component.inputs.forEach((port, i) => {
    const step = height / (component.inputs.length + 1)
    positions[port] = { x: component.x, y: Math.round(component.y + step * (i + 1)), side: 'in' }
  })

  component.outputs.forEach((port, i) => {
    const step = height / (component.outputs.length + 1)
    positions[port] = { x: component.x + width, y: Math.round(component.y + step * (i + 1)), side: 'out' }
  })

  return positions
}

/** Pin labels shown beside a flip-flop's ports. */
export function pinLabels(component) {
  if (isFlipFlop(component.kind)) {
    return { inputs: FLIP_FLOP_PINS[component.kind], outputs: ['Q', "Q'"] }
  }
  return { inputs: component.inputs.map(() => ''), outputs: component.outputs.map(() => '') }
}

export function kindLabel(kind) {
  if (isFlipFlop(kind)) return FLIP_FLOP_LABELS[kind]
  const found = PALETTE.flatMap(g => g.items).find(i => i.kind === kind)
  return found ? found.label : kind.toUpperCase()
}

/** A fresh empty document. */
export function emptyDocument() {
  return { version: SCHEMA_VERSION, components: [], wires: [], nextId: 1 }
}

/**
 * Adds a component. Ids are sequential per document rather than random so a
 * saved file diffs cleanly and Math.random stays out of the model.
 */
export function addComponent(doc, kind, x, y, options = {}) {
  const id = `${kind}_${doc.nextId}`
  const pinCount = isFlipFlop(kind)
    ? FLIP_FLOP_PINS[kind].length
    : SINGLE_PIN.has(kind) ? 1
      : kind === 'input' || kind === 'clock' || kind === 'const' ? 0
        : (options.pins ?? DEFAULT_GATE_PINS)

  const component = {
    id,
    kind,
    label: options.label ?? autoLabel(doc, kind),
    inputs: Array.from({ length: pinCount }, (_, i) => `${id}.in${i}`),
    outputs: kind === 'output' ? [] : isFlipFlop(kind) ? [`${id}.out`, `${id}.outn`] : [`${id}.out`],
    x: snap(x),
    y: snap(y),
  }
  if (kind === 'const') component.value = options.value ?? 1

  return {
    ...doc,
    components: [...doc.components, component],
    nextId: doc.nextId + 1,
  }
}

/** A, B, C... for inputs; F, G... for probes; nothing for gates. */
function autoLabel(doc, kind) {
  if (kind === 'input') {
    const used = doc.components.filter(c => c.kind === 'input').length
    return String.fromCharCode(65 + (used % 26))
  }
  if (kind === 'output') {
    const used = doc.components.filter(c => c.kind === 'output').length
    return String.fromCharCode(70 + (used % 21))
  }
  if (kind === 'clock') return 'CLK'
  return null
}

/**
 * A free spot for the next component, scanning a grid left to right.
 *
 * A fixed stagger was not enough: after a handful of clicks the offsets wrap
 * and new components land on top of old ones, which reads as the click having
 * done nothing. This walks the grid until it finds a cell nothing overlaps.
 */
export function nextFreePosition(doc, kind) {
  const probe = { kind, inputs: [], outputs: [], x: 0, y: 0 }
  const size = componentSize(isFlipFlop(kind) ? { ...probe, inputs: FLIP_FLOP_PINS[kind] } : probe)
  // Grid multiples, so a placed component is already snapped and does not jump
  // the first time it is dragged.
  const COLUMN = GRID * 7
  const ROW = GRID * 6
  const MARGIN = GRID

  const boxes = doc.components.map(c => ({ ...componentSize(c), x: c.x, y: c.y }))
  const clashes = (x, y) => boxes.some(box => (
    x < box.x + box.width + MARGIN && box.x < x + size.width + MARGIN
    && y < box.y + box.height + MARGIN && box.y < y + size.height + MARGIN
  ))

  // The first row starts below the floating transport dock (T-096): a component
  // placed at the very top-left lands underneath it and reads as a click that
  // did nothing.
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const x = GRID * 2 + column * COLUMN
      const y = DOCK_INSET + GRID + row * ROW
      if (!clashes(x, y)) return { x, y }
    }
  }

  // Board full: stack at the end rather than refusing to place anything.
  return { x: GRID * 2, y: snap(GRID * 2 + doc.components.length * 8) }
}

export function moveComponent(doc, id, x, y) {
  return {
    ...doc,
    components: doc.components.map(c => (
      c.id === id ? { ...c, x: snap(x), y: snap(y) } : c
    )),
  }
}

/** Removes a component and every wire touching it. */
export function removeComponent(doc, id) {
  const component = doc.components.find(c => c.id === id)
  if (!component) return doc
  const ports = new Set([...component.inputs, ...component.outputs])

  return {
    ...doc,
    components: doc.components.filter(c => c.id !== id),
    wires: doc.wires.filter(w => !ports.has(w.from) && !ports.has(w.to)),
  }
}

export function removeWire(doc, wireId) {
  return { ...doc, wires: doc.wires.filter(w => w.id !== wireId) }
}

/** Adds or removes a pin on a variable-width gate. */
export function setGatePins(doc, id, count) {
  const component = doc.components.find(c => c.id === id)
  if (!component || isFlipFlop(component.kind)) return doc
  if (['input', 'output', 'clock', 'const', 'not'].includes(component.kind)) return doc

  const next = Math.max(2, Math.min(6, count))
  const inputs = Array.from({ length: next }, (_, i) => `${id}.in${i}`)
  const dropped = new Set(component.inputs.slice(next))

  return {
    ...doc,
    components: doc.components.map(c => (c.id === id ? { ...c, inputs } : c)),
    wires: doc.wires.filter(w => !dropped.has(w.to)),
  }
}

export function setConstValue(doc, id, value) {
  return {
    ...doc,
    components: doc.components.map(c => (
      c.id === id ? { ...c, value: value ? 1 : 0, label: String(value ? 1 : 0) } : c
    )),
  }
}

/**
 * @typedef {{ok: true, doc: Object} | {ok: false, reason: string}} ConnectResult
 */

/**
 * Connects an output port to an input port.
 *
 * An input pin takes exactly one driver. A second connection is refused rather
 * than replacing the first: silently overwriting looks like the wire simply did
 * not draw, and two outputs on one pin is a short, which is a thing worth being
 * told about rather than resolved.
 *
 * @returns {ConnectResult}
 */
export function connect(doc, fromPort, toPort) {
  const owners = portOwnerMap(doc)
  const from = owners.get(fromPort)
  const to = owners.get(toPort)

  if (!from || !to) return { ok: false, reason: 'That port does not exist.' }
  if (from.component.id === to.component.id) {
    return { ok: false, reason: 'A component cannot drive itself directly.' }
  }
  if (from.side !== 'out' || to.side !== 'in') {
    return { ok: false, reason: 'Wire from an output to an input.' }
  }
  if (doc.wires.some(w => w.to === toPort)) {
    return { ok: false, reason: 'That input already has a wire. Two outputs on one input is a short.' }
  }

  // The wire consumes an id from the same counter as components, so undo then
  // redo then a fresh wire cannot mint a duplicate id.
  return {
    ok: true,
    doc: {
      ...doc,
      wires: [...doc.wires, { id: `w_${doc.nextId}`, from: fromPort, to: toPort }],
      nextId: doc.nextId + 1,
    },
  }
}

/**
 * Connects, taking the input's existing driver off first.
 *
 * `connect` refuses a second driver, which is the right rule for a *file*: two
 * outputs on one pin is a short and a document that contains one is broken. It
 * is the wrong rule for a *gesture*. Dropping a connector on an occupied point
 * in any diagram editor re-points it, and refusing left the student with no way
 * to change a connection short of finding and deleting the old wire — which is
 * the "That input already has a wire" bar in T-096's screenshot.
 *
 * So the editor calls this and the file format still calls `connect`. The
 * invariant is unchanged; only the interaction is.
 *
 * @returns {ConnectResult}
 */
export function reconnect(doc, fromPort, toPort) {
  const existing = doc.wires.find(w => w.to === toPort)
  return connect(existing ? removeWire(doc, existing.id) : doc, fromPort, toPort)
}

export function portOwnerMap(doc) {
  const map = new Map()
  for (const component of doc.components) {
    for (const port of component.inputs) map.set(port, { component, side: 'in' })
    for (const port of component.outputs) map.set(port, { component, side: 'out' })
  }
  return map
}

/** Every port with its document coordinates. */
export function allPortPositions(doc) {
  const map = new Map()
  for (const component of doc.components) {
    for (const [port, position] of Object.entries(portPositions(component))) {
      map.set(port, { ...position, componentId: component.id })
    }
  }
  return map
}

/**
 * The document as a netlist the simulator accepts.
 *
 * The shapes are already the same; this only drops the editor-only fields so a
 * stray x/y cannot end up meaning something to the simulator later.
 */
export function toNetlist(doc) {
  return {
    components: doc.components.map(({ x, y, ...rest }) => rest),
    wires: doc.wires.map(({ id, from, to }) => ({ id, from, to })),
    inputNames: doc.components.filter(c => c.kind === 'input').map(c => c.label),
    outputNames: doc.components.filter(c => c.kind === 'output').map(c => c.label),
  }
}

/**
 * A synthesised netlist plus a layout becomes a sandbox document.
 * This is the whole of "Open in sandbox".
 */
export function fromNetlist(netlist, layout) {
  const positionOf = new Map((layout?.components ?? []).map(c => [c.id, c]))

  return {
    version: SCHEMA_VERSION,
    components: netlist.components.map((component, i) => {
      const placed = positionOf.get(component.id)
      return {
        ...component,
        x: snap(placed?.x ?? 40 + (i % 6) * 110),
        // Cleared of the floating transport dock, the same reason
        // nextFreePosition starts its first row low (T-096). The layout engine
        // starts near zero, which put the first input underneath the controls.
        y: DOCK_INSET + snap(placed?.y ?? 40 + Math.floor(i / 6) * 110),
      }
    }),
    wires: netlist.wires.map(w => ({ ...w })),
    nextId: netlist.components.length + netlist.wires.length + 1,
  }
}

/**
 * Problems worth telling the student about before they wonder why nothing
 * happens. Warnings, not errors: a half-built circuit is the normal state of a
 * circuit being built, and refusing to simulate it would be useless.
 */
export function documentWarnings(doc) {
  const warnings = []
  const driven = new Set(doc.wires.map(w => w.to))

  for (const component of doc.components) {
    const loose = component.inputs.filter(pin => !driven.has(pin))
    if (loose.length > 0) {
      warnings.push({
        componentId: component.id,
        kind: 'unconnected',
        message: `${kindLabel(component.kind)}${component.label ? ` ${component.label}` : ''} has ${loose.length} unconnected input${loose.length === 1 ? '' : 's'}`,
      })
    }
  }

  const hasClock = doc.components.some(c => c.kind === 'clock')
  const hasFlipFlop = doc.components.some(c => isFlipFlop(c.kind))
  if (hasFlipFlop && !hasClock) {
    warnings.push({
      componentId: null,
      kind: 'no-clock',
      message: 'There are flip-flops but no clock, so stepping will not change anything.',
    })
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export function serialize(doc) {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    components: doc.components,
    wires: doc.wires,
    nextId: doc.nextId,
  }, null, 2)
}

/**
 * @returns {{ok: true, doc: Object} | {ok: false, reason: string}}
 *
 * Validated rather than trusted: this parses a file the student may have
 * hand-edited, and a malformed document that reaches the simulator produces a
 * stack trace instead of a message.
 */
export function deserialize(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'That file is not valid JSON.' }
  }

  if (!data || typeof data !== 'object') return { ok: false, reason: 'That file is not a circuit.' }
  if (!Array.isArray(data.components) || !Array.isArray(data.wires)) {
    return { ok: false, reason: 'That file is missing its components or wires.' }
  }
  if (data.version !== SCHEMA_VERSION) {
    return { ok: false, reason: `That circuit was saved by a different version (${data.version ?? 'unknown'}).` }
  }

  const ids = new Set()
  for (const component of data.components) {
    if (typeof component?.id !== 'string' || ids.has(component.id)) {
      return { ok: false, reason: 'That file has a missing or duplicated component id.' }
    }
    ids.add(component.id)
    if (!PLACEABLE_KINDS.includes(component.kind)) {
      return { ok: false, reason: `Unknown component "${component.kind}".` }
    }
    if (!Array.isArray(component.inputs) || !Array.isArray(component.outputs)) {
      return { ok: false, reason: `Component "${component.id}" has no ports.` }
    }
    if (!Number.isFinite(component.x) || !Number.isFinite(component.y)) {
      return { ok: false, reason: `Component "${component.id}" has no position.` }
    }
  }

  const ports = new Set(data.components.flatMap(c => [...c.inputs, ...c.outputs]))
  const usedInputs = new Set()
  for (const wire of data.wires) {
    if (!ports.has(wire?.from) || !ports.has(wire?.to)) {
      return { ok: false, reason: 'That file has a wire to a port that does not exist.' }
    }
    if (usedInputs.has(wire.to)) {
      return { ok: false, reason: 'That file drives one input from two outputs.' }
    }
    usedInputs.add(wire.to)
  }

  const nextId = Number.isFinite(data.nextId)
    ? data.nextId
    : data.components.length + data.wires.length + 1

  return { ok: true, doc: { version: SCHEMA_VERSION, components: data.components, wires: data.wires, nextId } }
}

export const STORAGE_KEY = 'digital-logic:sandbox'

export function loadFromStorage(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const result = deserialize(raw)
    return result.ok ? result.doc : null
  } catch {
    // Private mode, quota, a corrupt entry: an autosave failing to restore is
    // never worth breaking the page over.
    return null
  }
}

export function saveToStorage(storage, doc) {
  try {
    storage?.setItem(STORAGE_KEY, serialize(doc))
    return true
  } catch {
    return false
  }
}
