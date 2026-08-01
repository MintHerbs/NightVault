/**
 * Logisim `.circ` codec tests (T-096).
 * Run with: npm run test:circuits
 *
 * Two separate claims, and they need separate tests because they can pass and
 * fail independently:
 *
 *  1. **A b-tree file round-trips exactly.** That is carried by the embedded
 *     comment, so it holds even if the geometry table is wrong.
 *  2. **A Logisim file is reconstructed from coordinates alone.** Test 3 strips
 *     the comment before reading, which is the only way to exercise the path a
 *     file written by Logisim proper would take.
 */

import { toCirc, fromCirc, parseXml, circGeometry } from './circFormat.js'
import {
  addComponent,
  connect,
  emptyDocument,
  PLACEABLE_KINDS,
  serialize,
} from './sandboxModel.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

/** Strips our lossless copy, so the reader has to work from the XML. */
const stripEmbed = text => text.replace(/^\s*<!--b-tree-circuit .*-->\s*$/m, '')

/** One of every kind the palette offers, wired where wiring makes sense. */
function everyKind() {
  let doc = emptyDocument()
  PLACEABLE_KINDS.forEach((kind, i) => {
    doc = addComponent(doc, kind, 40 + (i % 4) * 180, 40 + Math.floor(i / 4) * 160)
  })
  return doc
}

/** A -> NOT -> AND <- B -> probe, plus a clock into a D flip-flop. */
function realCircuit() {
  let doc = emptyDocument()
  doc = addComponent(doc, 'input', 40, 40)
  doc = addComponent(doc, 'input', 40, 160)
  doc = addComponent(doc, 'not', 180, 40)
  doc = addComponent(doc, 'and', 320, 80)
  doc = addComponent(doc, 'output', 480, 100)
  doc = addComponent(doc, 'clock', 40, 320)
  doc = addComponent(doc, 'dff', 320, 300)

  const [a, b, not, and, probe, clock, dff] = doc.components
  const links = [
    [a.outputs[0], not.inputs[0]],
    [not.outputs[0], and.inputs[0]],
    [b.outputs[0], and.inputs[1]],
    [and.outputs[0], probe.inputs[0]],
    [and.outputs[0], dff.inputs[0]],
    [clock.outputs[0], dff.inputs[1]],
  ]
  for (const [from, to] of links) {
    const result = connect(doc, from, to)
    if (!result.ok) throw new Error(`fixture: ${result.reason}`)
    doc = result.doc
  }
  return doc
}

// ---------------------------------------------------------------------------
console.log('1. the XML reader handles what Logisim writes')
// ---------------------------------------------------------------------------
{
  const root = parseXml(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<project source="2.7.1" version="1.0">
  This file is intended to be loaded by Logisim.
  <lib desc="#Wiring" name="0"/>
  <!-- a comment -->
  <circuit name="main">
    <comp lib="1" loc="(300,150)" name="AND Gate">
      <a name="inputs" val="2"/>
    </comp>
    <wire from="(100,100)" to="(200,100)"/>
  </circuit>
</project>`)

  assert(root.name === 'project', 'root should be <project>')
  assert(root.attrs.source === '2.7.1', 'attributes not read')
  const circuit = root.children.find(c => c.name === 'circuit')
  assert(circuit && circuit.attrs.name === 'main', 'circuit not found')
  const comp = circuit.children.find(c => c.name === 'comp')
  assert(comp.children.length === 1 && comp.children[0].attrs.val === '2', 'nested <a> not read')
  assert(root.comments.includes(' a comment '), 'comment not captured')

  for (const bad of ['<a><b></a>', '<a', '<!-- never ends', 'no elements at all', '<a></a><b></b>']) {
    let threw = false
    try { parseXml(bad) } catch { threw = true }
    assert(threw, `"${bad}" should not have parsed`)
  }
}

// ---------------------------------------------------------------------------
console.log('2. a b-tree circuit round-trips exactly')
// ---------------------------------------------------------------------------
{
  for (const [label, doc] of [['every kind', everyKind()], ['a real circuit', realCircuit()]]) {
    const result = fromCirc(toCirc(doc))
    if (!result.ok) { assert(false, `${label}: ${result.reason}`); continue }
    assert(serialize(result.doc) === serialize(doc), `${label} did not round-trip byte for byte`)
  }
}

// ---------------------------------------------------------------------------
console.log('3. a circuit is reconstructed from the XML alone, with no embed')
// ---------------------------------------------------------------------------
{
  const doc = realCircuit()
  const text = stripEmbed(toCirc(doc))
  assert(!text.includes('b-tree-circuit'), 'the embed was not stripped, so this test proves nothing')

  const result = fromCirc(text)
  if (!result.ok) {
    assert(false, `structural read failed: ${result.reason}`)
  } else {
    const rebuilt = result.doc
    assert(rebuilt.components.length === doc.components.length,
      `expected ${doc.components.length} components, got ${rebuilt.components.length}`)
    assert(rebuilt.wires.length === doc.wires.length,
      `expected ${doc.wires.length} wires, got ${rebuilt.wires.length}`)

    // Same kinds in the same reading order, same positions.
    doc.components.forEach((original, i) => {
      const copy = rebuilt.components[i]
      assert(copy.kind === original.kind, `component ${i} came back as ${copy.kind}, not ${original.kind}`)
      assert(copy.x === original.x && copy.y === original.y,
        `component ${i} moved from ${original.x},${original.y} to ${copy.x},${copy.y}`)
      assert(copy.inputs.length === original.inputs.length,
        `component ${i} came back with ${copy.inputs.length} pins, not ${original.inputs.length}`)
    })

    // Same connectivity, expressed as (kind index -> kind index, pin).
    const indexOf = (components, port) =>
      components.findIndex(c => c.inputs.includes(port) || c.outputs.includes(port))
    const shape = (source, wires) => wires.map((w) => {
      const from = indexOf(source, w.from)
      const to = indexOf(source, w.to)
      return `${from}:${source[from].outputs.indexOf(w.from)}->${to}:${source[to].inputs.indexOf(w.to)}`
    }).sort().join(' ')

    assert(shape(rebuilt.components, rebuilt.wires) === shape(doc.components, doc.wires),
      `connectivity changed:\n  was ${shape(doc.components, doc.wires)}\n  now ${shape(rebuilt.components, rebuilt.wires)}`)
  }
}

// ---------------------------------------------------------------------------
console.log('4. fan-out survives: one output feeding two inputs')
// ---------------------------------------------------------------------------
{
  const doc = realCircuit() // the AND feeds both the probe and the flip-flop
  const text = stripEmbed(toCirc(doc))
  const result = fromCirc(text)
  assert(result.ok, 'fan-out circuit failed to read back')
  if (result.ok) {
    const counts = new Map()
    for (const wire of result.doc.wires) counts.set(wire.from, (counts.get(wire.from) ?? 0) + 1)
    assert([...counts.values()].some(n => n === 2), 'the fan-out collapsed to one wire')
  }
}

// ---------------------------------------------------------------------------
console.log('5. the geometry table agrees with itself')
// ---------------------------------------------------------------------------
{
  // Every pin coordinate lands on Logisim's 10 grid. A pin off the grid is a
  // pin no Logisim wire can ever reach.
  for (const kind of PLACEABLE_KINDS) {
    let doc = emptyDocument()
    doc = addComponent(doc, kind, 100, 100)
    const geometry = circGeometry(doc.components[0]);
    [...geometry.inputs, ...geometry.outputs, geometry.loc].forEach((point) => {
      assert(point.x % 10 === 0 && point.y % 10 === 0,
        `${kind} has a pin off the 10 grid at ${point.x},${point.y}`)
    })
  }

  // No two pins on the same component share a coordinate.
  let wide = emptyDocument()
  wide = addComponent(wide, 'and', 100, 100, { pins: 5 })
  const geometry = circGeometry(wide.components[0])
  const keys = new Set(geometry.inputs.map(p => `${p.x},${p.y}`))
  assert(keys.size === geometry.inputs.length, 'a wide gate has two pins in the same place')
}

// ---------------------------------------------------------------------------
console.log('6. bad files are refused with a sentence, not a stack trace')
// ---------------------------------------------------------------------------
{
  const cases = [
    ['not XML at all', 'hello'],
    ['a different document', '<html><body>hi</body></html>'],
    ['an unsupported component', `<project><circuit name="main">
        <comp lib="2" loc="(10,10)" name="Multiplexer"/></circuit></project>`],
    ['a rotated component', `<project><circuit name="main">
        <comp lib="1" loc="(10,10)" name="AND Gate"><a name="facing" val="north"/></comp>
        </circuit></project>`],
    ['a bus', `<project><circuit name="main">
        <comp lib="0" loc="(10,10)" name="Pin"><a name="width" val="8"/></comp>
        </circuit></project>`],
    ['no circuit', '<project><lib desc="#Wiring" name="0"/></project>'],
  ]

  for (const [label, text] of cases) {
    let result
    try {
      result = fromCirc(text)
    } catch (error) {
      assert(false, `${label} threw instead of refusing: ${error.message}`)
      continue
    }
    assert(result.ok === false, `${label} should have been refused`)
    assert(typeof result.reason === 'string' && result.reason.length > 10,
      `${label} was refused without a reason`)
  }
}

// ---------------------------------------------------------------------------
console.log('7. a label with an XML-hostile character survives')
// ---------------------------------------------------------------------------
{
  let doc = emptyDocument()
  doc = addComponent(doc, 'input', 40, 40, { label: `A"<&'>--B` })
  const result = fromCirc(toCirc(doc))
  assert(result.ok, `awkward label failed to read back: ${result.ok ? '' : result.reason}`)
  if (result.ok) {
    assert(result.doc.components[0].label === `A"<&'>--B`,
      `label came back as ${JSON.stringify(result.doc.components[0].label)}`)
  }

  // And through the structural path, where it travels as an XML attribute.
  const structural = fromCirc(stripEmbed(toCirc(doc)))
  assert(structural.ok && structural.doc.components[0].label === `A"<&'>--B`,
    'the attribute escape did not survive a structural read')
}

// ---------------------------------------------------------------------------
console.log('8. the output is shaped like a Logisim project')
// ---------------------------------------------------------------------------
{
  const text = toCirc(realCircuit())
  assert(text.startsWith('<?xml version="1.0"'), 'no XML declaration')
  assert(/<project source="[\d.]+" version="[\d.]+">/.test(text), 'no <project> with a version')
  assert(/<lib desc="#Gates" name="1"\/>/.test(text), 'the Gates library is not declared')
  assert(/<main name="main"\/>/.test(text), 'no <main>')
  assert((text.match(/<circuit /g) ?? []).length === 1, 'expected exactly one circuit')
  assert(/<comp lib="1" loc="\(\d+,\d+\)" name="AND Gate">/.test(text), 'the AND gate is not a Logisim comp')
  assert(/<wire from="\(\d+,\d+\)" to="\(\d+,\d+\)"\/>/.test(text), 'no wire segments')

  // Every segment is axis-aligned. A diagonal wire does not exist in Logisim.
  const segments = [...text.matchAll(/<wire from="\((\d+),(\d+)\)" to="\((\d+),(\d+)\)"\/>/g)]
  assert(segments.length > 0, 'no segments to check')
  for (const [, x1, y1, x2, y2] of segments) {
    assert(x1 === x2 || y1 === y2, `diagonal wire segment (${x1},${y1}) -> (${x2},${y2})`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\ncircFormat: all checks passed')
