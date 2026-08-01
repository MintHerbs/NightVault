/**
 * Logisim `.circ` files (T-096).
 *
 * The course tool is Logisim, so "export" ought to produce something Logisim
 * opens, not the private JSON T-089 invented. This reads and writes `.circ`:
 * Logisim project XML, one circuit, `<comp>` elements for components and
 * `<wire>` segments for connections.
 *
 * Pure, with its own XML reader, so it behaves identically in the browser and
 * under plain node — the project has no test framework and no jsdom (T-039), and
 * `DOMParser` does not exist in node.
 *
 * ## Geometry
 *
 * Logisim gives a component one `loc` and derives every pin from it. The rule is
 * that `loc` is the component's **primary output**, with inputs to its left. We
 * reproduce that for the subset we can place, from this table — all offsets are
 * multiples of 10 so everything lands on Logisim's grid:
 *
 * | kind        | `loc` relative to our (x, y) | inputs relative to `loc`       | outputs |
 * |-------------|------------------------------|--------------------------------|---------|
 * | input       | (40, 20)                     | —                              | (0, 0)  |
 * | output      | (0, 20)                      | (0, 0)                         | —       |
 * | clock       | (60, 20)                     | —                              | (0, 0)  |
 * | const       | (40, 20)                     | —                              | (0, 0)  |
 * | not         | (60, 20)                     | (-30, 0)                       | (0, 0)  |
 * | gate (n in) | (80, h/2)                    | (-size, 20i - 10(n-1))         | (0, 0)  |
 * | flip-flop   | (80, 20)                     | (-80, 20i)                     | (0,0) (0,40) |
 *
 * where `h` is our own body height and `size` is Logisim's gate-size attribute,
 * 30 for up to three inputs and 50 above that.
 *
 * This is our *model* of Logisim's geometry, not a bit-exact reproduction of it:
 * Logisim's own offsets depend on version, negation attributes and rotation.
 * Combinational circuits land correctly; flip-flops may need nudging once
 * opened. Because that is a real risk, our own exports also carry the exact
 * document in an XML comment — a b-tree → b-tree round trip never depends on the
 * geometry being right, and Logisim ignores comments.
 *
 * Deliberately not supported, and refused by name rather than half-read: buses
 * (anything with a `width` above 1), splitters, tunnels, subcircuits, and any
 * component facing a direction other than east.
 */

import { FLIP_FLOP_PINS, isFlipFlop } from './flipFlops.js'
import { componentSize, SCHEMA_VERSION, snap } from './sandboxModel.js'

/** How our kinds map onto Logisim's libraries. */
const LOGISIM = {
  input: { lib: '0', name: 'Pin' },
  output: { lib: '0', name: 'Pin', attrs: { output: 'true' } },
  clock: { lib: '0', name: 'Clock' },
  const: { lib: '0', name: 'Constant' },
  and: { lib: '1', name: 'AND Gate' },
  or: { lib: '1', name: 'OR Gate' },
  not: { lib: '1', name: 'NOT Gate' },
  nand: { lib: '1', name: 'NAND Gate' },
  nor: { lib: '1', name: 'NOR Gate' },
  xor: { lib: '1', name: 'XOR Gate' },
  xnor: { lib: '1', name: 'XNOR Gate' },
  dff: { lib: '4', name: 'D Flip-Flop' },
  tff: { lib: '4', name: 'T Flip-Flop' },
  jkff: { lib: '4', name: 'J-K Flip-Flop' },
  srff: { lib: '4', name: 'S-R Flip-Flop' },
}

const LIBS = [
  ['0', '#Wiring'],
  ['1', '#Gates'],
  ['2', '#Plexers'],
  ['3', '#Arithmetic'],
  ['4', '#Memory'],
  ['5', '#I/O'],
  ['6', '#Base'],
]

/** The marker on the comment carrying our own lossless copy. */
const EMBED = 'b-tree-circuit '

/**
 * Where a component's `loc` and pins sit in Logisim coordinates.
 *
 * @param {Object} component - needs `kind`, `inputs`, `x`, `y`
 * @returns {{loc: {x: number, y: number}, inputs: {x: number, y: number}[], outputs: {x: number, y: number}[], size: number|null}}
 */
export function circGeometry(component) {
  const { kind } = component
  const pins = component.inputs.length
  const offsets = locOffset(component)
  const loc = { x: component.x + offsets.x, y: component.y + offsets.y }

  if (kind === 'input' || kind === 'clock' || kind === 'const') {
    return { loc, inputs: [], outputs: [{ ...loc }], size: null }
  }
  if (kind === 'output') {
    return { loc, inputs: [{ ...loc }], outputs: [], size: null }
  }
  if (isFlipFlop(kind)) {
    return {
      loc,
      inputs: Array.from({ length: pins }, (_, i) => ({ x: loc.x - 80, y: loc.y + 20 * i })),
      outputs: [{ x: loc.x, y: loc.y }, { x: loc.x, y: loc.y + 40 }],
      size: null,
    }
  }
  if (kind === 'not') {
    return { loc, inputs: [{ x: loc.x - 30, y: loc.y }], outputs: [{ ...loc }], size: 30 }
  }

  const size = pins <= 3 ? 30 : 50
  return {
    loc,
    inputs: Array.from({ length: pins }, (_, i) => ({
      x: loc.x - size,
      y: loc.y + 20 * i - 10 * (pins - 1),
    })),
    outputs: [{ ...loc }],
    size,
  }
}

/** `loc` relative to our own (x, y). The inverse is what import uses. */
function locOffset(component) {
  const { kind } = component
  if (kind === 'output') return { x: 0, y: 20 }
  if (kind === 'input' || kind === 'const') return { x: 40, y: 20 }
  if (kind === 'clock' || kind === 'not') return { x: 60, y: 20 }
  if (isFlipFlop(kind)) return { x: 80, y: 20 }
  const { height } = componentSize(component)
  return { x: 80, y: height / 2 }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * The document as a Logisim project.
 *
 * @param {Object} doc - a sandbox document
 * @param {{name?: string}} [options]
 * @returns {string} XML
 */
export function toCirc(doc, options = {}) {
  const circuitName = options.name ?? 'main'
  const lines = []

  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>')
  lines.push('<project source="2.7.1" version="1.0">')
  lines.push('  This file is intended to be loaded by Logisim (http://www.cburch.com/logisim/).')
  for (const [name, desc] of LIBS) lines.push(`  <lib desc="${desc}" name="${name}"/>`)
  lines.push(`  <main name="${escapeAttr(circuitName)}"/>`)
  lines.push(`  <circuit name="${escapeAttr(circuitName)}">`)
  lines.push(`    <a name="circuit" val="${escapeAttr(circuitName)}"/>`)
  lines.push(`    <!--${EMBED}${embedPayload(doc)}-->`)

  const geometry = new Map(doc.components.map(c => [c.id, circGeometry(c)]))

  for (const component of doc.components) {
    const spec = LOGISIM[component.kind]
    const place = geometry.get(component.id)
    const attrs = { ...(spec.attrs ?? {}) }

    if (component.label) attrs.label = component.label
    if (component.kind === 'const') attrs.value = `0x${component.value ? 1 : 0}`
    if (place.size !== null) attrs.size = String(place.size)
    if (place.size !== null && component.kind !== 'not') {
      attrs.inputs = String(component.inputs.length)
    }

    const body = Object.entries(attrs)
      .map(([name, value]) => `      <a name="${escapeAttr(name)}" val="${escapeAttr(value)}"/>`)

    const open = `    <comp lib="${spec.lib}" loc="(${place.loc.x},${place.loc.y})" name="${escapeAttr(spec.name)}"`
    if (body.length === 0) lines.push(`${open}/>`)
    else lines.push(`${open}>`, ...body, '    </comp>')
  }

  // Every wire as a chain of axis-aligned segments along the route the canvas
  // draws, so the picture in Logisim matches the picture here.
  for (const wire of doc.wires) {
    for (const segment of wireSegments(doc, geometry, wire)) {
      lines.push(`    <wire from="(${segment.from.x},${segment.from.y})" to="(${segment.to.x},${segment.to.y})"/>`)
    }
  }

  lines.push('  </circuit>')
  lines.push('</project>')
  return `${lines.join('\n')}\n`
}

/**
 * One wire as Logisim segments.
 *
 * Deliberately its own simple elbow rather than wireRouting's: Logisim wires
 * must be axis-aligned and land on the 10 grid, and a rounded corner has no
 * representation there at all.
 */
function wireSegments(doc, geometry, wire) {
  const from = portPoint(doc, geometry, wire.from)
  const to = portPoint(doc, geometry, wire.to)
  if (!from || !to) return []

  const points = from.y === to.y
    ? [from, to]
    : [from, { x: midX(from.x, to.x), y: from.y }, { x: midX(from.x, to.x), y: to.y }, to]

  const segments = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    if (a.x === b.x && a.y === b.y) continue
    segments.push({ from: a, to: b })
  }
  return segments
}

function midX(a, b) {
  return Math.round((a + b) / 2 / 10) * 10
}

/** Logisim coordinates of one of our ports. */
function portPoint(doc, geometry, portId) {
  for (const component of doc.components) {
    const inputIndex = component.inputs.indexOf(portId)
    if (inputIndex >= 0) return geometry.get(component.id).inputs[inputIndex]
    const outputIndex = component.outputs.indexOf(portId)
    if (outputIndex >= 0) return geometry.get(component.id).outputs[outputIndex]
  }
  return null
}

/**
 * The exact document, JSON, with `--` neutralised.
 *
 * `--` cannot appear inside an XML comment, and a component label is free text.
 * The escape is a JSON string escape, so parsing gives back the original
 * character without a second decoding step.
 */
function embedPayload(doc) {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    components: doc.components,
    wires: doc.wires,
    nextId: doc.nextId,
  }).replace(/--/g, '-\\u002d')
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * @param {string} text
 * @returns {{ok: true, doc: Object} | {ok: false, reason: string}}
 */
export function fromCirc(text) {
  let root
  try {
    root = parseXml(text)
  } catch (error) {
    return { ok: false, reason: `That file is not valid XML (${error.message}).` }
  }

  if (root.name !== 'project') {
    return { ok: false, reason: 'That file is not a Logisim project.' }
  }

  const embedded = findEmbedded(root)
  if (embedded) return embedded

  const circuit = root.children.find(child => child.name === 'circuit')
  if (!circuit) return { ok: false, reason: 'That project has no circuit in it.' }

  return readCircuit(circuit)
}

/** Our own lossless copy, if this file came from here. */
function findEmbedded(root) {
  const comment = collectComments(root).find(value => value.startsWith(EMBED))
  if (!comment) return null

  let data
  try {
    data = JSON.parse(comment.slice(EMBED.length))
  } catch {
    // A hand-edited file whose comment no longer parses is not an error: the
    // XML underneath is still a real circuit, so fall through and read that.
    return null
  }
  if (!Array.isArray(data?.components) || !Array.isArray(data?.wires)) return null
  return {
    ok: true,
    doc: {
      version: SCHEMA_VERSION,
      components: data.components,
      wires: data.wires,
      nextId: data.nextId ?? data.components.length + data.wires.length + 1,
    },
  }
}

function readCircuit(circuit) {
  const components = []
  const pins = [] // { key, componentIndex, portIndex, side }
  let serial = 0

  for (const node of circuit.children) {
    if (node.name !== 'comp') continue

    const attrs = attrMap(node)
    const kind = kindOf(node.attrs.name, attrs)
    if (!kind) return { ok: false, reason: `This file uses "${node.attrs.name}", which the sandbox cannot place.` }

    if (attrs.facing && attrs.facing !== 'east') {
      return { ok: false, reason: `"${node.attrs.name}" is rotated, and the sandbox only places east-facing parts.` }
    }
    if (attrs.width && attrs.width !== '1') {
      return { ok: false, reason: `"${node.attrs.name}" carries a ${attrs.width}-bit bus. The sandbox is 1-bit only.` }
    }

    const loc = parsePoint(node.attrs.loc)
    if (!loc) return { ok: false, reason: `"${node.attrs.name}" has no position.` }

    serial += 1
    const pinCount = importPinCount(kind, attrs)
    const id = `${kind}_${serial}`
    const component = {
      id,
      kind,
      label: attrs.label ?? null,
      inputs: Array.from({ length: pinCount }, (_, i) => `${id}.in${i}`),
      outputs: kind === 'output' ? []
        : isFlipFlop(kind) ? [`${id}.out`, `${id}.outn`]
          : [`${id}.out`],
      x: 0,
      y: 0,
    }
    if (kind === 'const') component.value = /0x0|^0$/.test(attrs.value ?? '0x1') ? 0 : 1

    const offsets = locOffset(component)
    component.x = snap(loc.x - offsets.x)
    component.y = snap(loc.y - offsets.y)

    const index = components.length
    components.push(component)

    // Pin coordinates come from the *declared* loc, not from the snapped
    // position: a Logisim file need not sit on our 20 grid, and moving the body
    // to the nearest cell must not move the points its wires attach to.
    const geometry = circGeometry({ ...component, x: loc.x - offsets.x, y: loc.y - offsets.y })
    geometry.inputs.forEach((point, i) => pins.push({ key: keyOf(point), index, port: i, side: 'in' }))
    geometry.outputs.forEach((point, i) => pins.push({ key: keyOf(point), index, port: i, side: 'out' }))
  }

  const segments = []
  for (const node of circuit.children) {
    if (node.name !== 'wire') continue
    const from = parsePoint(node.attrs.from)
    const to = parsePoint(node.attrs.to)
    if (!from || !to) return { ok: false, reason: 'This file has a wire with no endpoints.' }
    segments.push({ from, to })
  }

  const nets = buildNets(segments, pins.map(p => p.key))
  const wires = []
  const driven = new Set()
  let wireId = 0

  const byNet = new Map()
  for (const pin of pins) {
    const net = nets.get(pin.key)
    if (net === undefined) continue
    if (!byNet.has(net)) byNet.set(net, [])
    byNet.get(net).push(pin)
  }

  for (const members of byNet.values()) {
    const sources = members.filter(p => p.side === 'out')
    const sinks = members.filter(p => p.side === 'in')
    if (sources.length === 0 || sinks.length === 0) continue
    if (sources.length > 1) {
      return { ok: false, reason: 'This file joins two outputs onto one wire, which is a short.' }
    }
    const source = components[sources[0].index].outputs[sources[0].port]
    for (const sink of sinks) {
      const target = components[sink.index].inputs[sink.port]
      if (driven.has(target)) continue
      driven.add(target)
      wireId += 1
      wires.push({ id: `w_${wireId}`, from: source, to: target })
    }
  }

  return {
    ok: true,
    doc: {
      version: SCHEMA_VERSION,
      components,
      wires,
      nextId: components.length + wires.length + 1,
    },
  }
}

/** Which of our kinds a `<comp name=...>` is, or null. */
function kindOf(name, attrs) {
  if (name === 'Pin') return attrs.output === 'true' ? 'output' : 'input'
  for (const [kind, spec] of Object.entries(LOGISIM)) {
    if (kind === 'input' || kind === 'output') continue
    if (spec.name === name) return kind
  }
  return null
}

function importPinCount(kind, attrs) {
  if (isFlipFlop(kind)) return FLIP_FLOP_PINS[kind].length
  if (kind === 'output' || kind === 'not') return 1
  if (kind === 'input' || kind === 'clock' || kind === 'const') return 0
  const declared = Number.parseInt(attrs.inputs ?? '2', 10)
  return Number.isFinite(declared) ? Math.max(2, Math.min(6, declared)) : 2
}

/**
 * Which points are electrically the same, as a point-key → net-id map.
 *
 * Logisim has no wire objects joining named ports: a connection is a run of
 * segments whose ends touch, and anything sitting on one of those segments joins
 * it. The T-junction case is why this checks points against segment interiors
 * and not only against other endpoints.
 */
function buildNets(segments, pinKeys) {
  const parent = new Map()

  const find = (key) => {
    if (!parent.has(key)) parent.set(key, key)
    let root = key
    while (parent.get(root) !== root) root = parent.get(root)
    let walk = key
    while (parent.get(walk) !== walk) {
      const next = parent.get(walk)
      parent.set(walk, root)
      walk = next
    }
    return root
  }
  const union = (a, b) => { parent.set(find(a), find(b)) }

  const points = new Set(pinKeys)
  for (const segment of segments) {
    points.add(keyOf(segment.from))
    points.add(keyOf(segment.to))
  }

  for (const segment of segments) {
    union(keyOf(segment.from), keyOf(segment.to))
    for (const key of points) {
      if (key === keyOf(segment.from) || key === keyOf(segment.to)) continue
      if (onSegment(parsePoint(key), segment)) union(key, keyOf(segment.from))
    }
  }

  const nets = new Map()
  for (const key of points) nets.set(key, find(key))
  return nets
}

function onSegment(point, segment) {
  if (!point) return false
  const { from, to } = segment
  const cross = (point.x - from.x) * (to.y - from.y) - (point.y - from.y) * (to.x - from.x)
  if (cross !== 0) return false
  return point.x >= Math.min(from.x, to.x) && point.x <= Math.max(from.x, to.x)
    && point.y >= Math.min(from.y, to.y) && point.y <= Math.max(from.y, to.y)
}

function keyOf(point) {
  return `${point.x},${point.y}`
}

function parsePoint(value) {
  const match = /^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/.exec(String(value ?? ''))
  if (!match) return null
  return { x: Number(match[1]), y: Number(match[2]) }
}

function attrMap(node) {
  const attrs = {}
  for (const child of node.children) {
    if (child.name !== 'a') continue
    attrs[child.attrs.name] = child.attrs.val
  }
  return attrs
}

function collectComments(node) {
  const out = [...(node.comments ?? [])]
  for (const child of node.children) out.push(...collectComments(child))
  return out
}

// ---------------------------------------------------------------------------
// A very small XML reader
// ---------------------------------------------------------------------------

/**
 * Parses the subset Logisim writes: a declaration, comments, and nested
 * elements with quoted attributes. Text between elements is dropped — every
 * `.circ` file has one such node ("This file is intended to be loaded by...")
 * and nothing reads it.
 *
 * Throws on anything malformed, so callers get one place to turn a bad file
 * into a sentence.
 *
 * @param {string} text
 * @returns {{name: string, attrs: Record<string,string>, children: Array, comments: string[]}}
 */
export function parseXml(text) {
  let i = 0
  let root = null
  const stack = []

  const fail = (message) => { throw new Error(`${message} at character ${i}`) }

  while (i < text.length) {
    const open = text.indexOf('<', i)
    if (open < 0) break
    i = open

    if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i)
      if (end < 0) fail('unterminated declaration')
      i = end + 2
      continue
    }

    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i)
      if (end < 0) fail('unterminated comment')
      const body = text.slice(i + 4, end)
      if (stack.length > 0) stack[stack.length - 1].comments.push(body)
      i = end + 3
      continue
    }

    if (text.startsWith('<!', i)) {
      const end = text.indexOf('>', i)
      if (end < 0) fail('unterminated declaration')
      i = end + 1
      continue
    }

    if (text.startsWith('</', i)) {
      const end = text.indexOf('>', i)
      if (end < 0) fail('unterminated closing tag')
      const name = text.slice(i + 2, end).trim()
      const top = stack.pop()
      if (!top) fail(`unexpected </${name}>`)
      if (top.name !== name) fail(`</${name}> closes <${top.name}>`)
      i = end + 1
      continue
    }

    const end = findTagEnd(text, i)
    if (end < 0) fail('unterminated tag')
    const selfClosing = text[end - 1] === '/'
    const inner = text.slice(i + 1, selfClosing ? end - 1 : end)
    const node = readTag(inner)

    if (stack.length === 0) {
      if (root) fail('a second root element')
      root = node
    } else {
      stack[stack.length - 1].children.push(node)
    }
    if (!selfClosing) stack.push(node)
    i = end + 1
  }

  if (stack.length > 0) throw new Error(`<${stack[stack.length - 1].name}> is never closed`)
  if (!root) throw new Error('there is no root element')
  return root
}

/** The `>` that ends a tag, skipping any inside quoted attribute values. */
function findTagEnd(text, start) {
  let quote = null
  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i]
    if (quote) { if (char === quote) quote = null; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '>') return i
  }
  return -1
}

function readTag(inner) {
  const match = /^([\w:.-]+)/.exec(inner.trim())
  if (!match) throw new Error(`"${inner.slice(0, 20)}" is not a tag name`)
  const name = match[1]
  const attrs = {}
  const pattern = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  let attr = pattern.exec(inner)
  while (attr) {
    attrs[attr[1]] = unescapeAttr(attr[3] ?? attr[4] ?? '')
    attr = pattern.exec(inner)
  }
  return { name, attrs, children: [], comments: [] }
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function unescapeAttr(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
}
