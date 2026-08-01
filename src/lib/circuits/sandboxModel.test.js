/**
 * Sandbox document model tests (T-089 phase 2).
 * Run with: npm run test:circuits
 */

import {
  emptyDocument,
  addComponent,
  moveComponent,
  nextFreePosition,
  removeComponent,
  removeWire,
  connect,
  setGatePins,
  setConstValue,
  toNetlist,
  fromNetlist,
  portPositions,
  allPortPositions,
  componentSize,
  documentWarnings,
  serialize,
  deserialize,
  loadFromStorage,
  saveToStorage,
  kindLabel,
  snap,
  GRID,
  PLACEABLE_KINDS,
  SCHEMA_VERSION,
} from './sandboxModel.js'
import { createSimulation } from './simulator.js'
import { synthesize } from './circuitSynthesis.js'
import { layoutCircuit } from './circuitLayout.js'
import { minimize } from './quineMcCluskey.js'
import { tableFromMinterms } from './truthTable.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

// --- Construction ------------------------------------------------------------

let doc = emptyDocument()
assert(doc.components.length === 0 && doc.wires.length === 0, '1: empty document')

doc = addComponent(doc, 'input', 10, 20)
doc = addComponent(doc, 'input', 10, 80)
assert(doc.components[0].label === 'A' && doc.components[1].label === 'B', '2: inputs auto-label A, B')

doc = addComponent(doc, 'and', 120, 40)
assert(doc.components[2].inputs.length === 2, '3: a gate defaults to two pins')
assert(doc.components[2].outputs.length === 1, '3: and one output')

doc = addComponent(doc, 'not', 120, 140)
assert(doc.components[3].inputs.length === 1, '4: NOT has one pin')

doc = addComponent(doc, 'dff', 220, 40)
assert(doc.components[4].inputs.length === 2, '5: a D flip-flop has D and CLK')
assert(doc.components[4].outputs.length === 2, "5: and Q plus Q'")

doc = addComponent(doc, 'output', 320, 40)
assert(doc.components[5].outputs.length === 0, '6: a probe has no output')
assert(doc.components[5].label === 'F', '6: probes auto-label from F')

// Ids are unique and sequential, never random.
assert(new Set(doc.components.map(c => c.id)).size === doc.components.length, '7: ids are unique')

// Every placeable kind can actually be placed.
for (const kind of PLACEABLE_KINDS) {
  const test = addComponent(emptyDocument(), kind, 0, 0)
  assert(test.components.length === 1, `8: ${kind} can be placed`)
  assert(componentSize(test.components[0]).width > 0, `8: ${kind} has a size`)
  assert(typeof kindLabel(kind) === 'string', `8: ${kind} has a label`)
}

// --- Placement never overlaps ------------------------------------------------
//
// A fixed stagger wrapped after a few clicks and dropped new components on top
// of old ones, which reads as the click having done nothing.
{
  let d = emptyDocument()
  const kinds = ['input', 'and', 'dff', 'output', 'clock', 'or', 'not', 'jkff', 'xor', 'const',
    'nand', 'nor', 'srff', 'tff', 'xnor', 'input', 'and', 'output']

  for (const kind of kinds) {
    const spot = nextFreePosition(d, kind)
    d = addComponent(d, kind, spot.x, spot.y)
  }

  const boxes = d.components.map(c => ({ ...componentSize(c), x: c.x, y: c.y }))
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]
      const b = boxes[j]
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height
      assert(!overlap, `8b: placed components ${i} and ${j} overlap`)
    }
  }
  assert(d.components.every(c => c.x >= 0 && c.y >= 0), '8b: placements stay on the board')
}

// --- Wiring ------------------------------------------------------------------

{
  let d = emptyDocument()
  d = addComponent(d, 'input', 0, 0)
  d = addComponent(d, 'input', 0, 60)
  d = addComponent(d, 'and', 100, 0)
  const [a, b, gate] = d.components

  const first = connect(d, a.outputs[0], gate.inputs[0])
  assert(first.ok, '9: a valid wire connects')
  d = first.doc
  assert(d.wires.length === 1, '9: the wire is recorded')

  // One driver per input pin. A second is refused rather than replacing the
  // first, because a silent overwrite looks like the wire failed to draw.
  const dup = connect(d, b.outputs[0], gate.inputs[0])
  assert(!dup.ok, '10: a second wire to the same input is refused')
  assert(/short/i.test(dup.reason), '10: and says why')

  // An output may fan out freely.
  const fan = connect(d, a.outputs[0], gate.inputs[1])
  assert(fan.ok, '11: an output can drive several inputs')
  d = fan.doc

  assert(!connect(d, gate.inputs[0], a.outputs[0]).ok, '12: input to output is refused')
  assert(!connect(d, a.outputs[0], b.outputs[0]).ok, '13: output to output is refused')
  assert(!connect(d, 'nope.out', gate.inputs[0]).ok, '14: an unknown port is refused')

  let self = addComponent(emptyDocument(), 'not', 0, 0)
  const loop = connect(self, self.components[0].outputs[0], self.components[0].inputs[0])
  assert(!loop.ok, '15: a component cannot wire straight back to itself')

  // Wire ids stay unique across the id counter.
  assert(new Set(d.wires.map(w => w.id)).size === d.wires.length, '16: wire ids are unique')
}

// --- Removal -----------------------------------------------------------------

{
  let d = emptyDocument()
  d = addComponent(d, 'input', 0, 0)
  d = addComponent(d, 'and', 100, 0)
  const [a, gate] = d.components
  d = connect(d, a.outputs[0], gate.inputs[0]).doc
  d = connect(d, a.outputs[0], gate.inputs[1]).doc
  assert(d.wires.length === 2, '17: two wires placed')

  const afterRemove = removeComponent(d, a.id)
  assert(afterRemove.components.length === 1, '17: the component is gone')
  assert(afterRemove.wires.length === 0, '17: and every wire touching it')

  const afterWire = removeWire(d, d.wires[0].id)
  assert(afterWire.wires.length === 1, '18: removing one wire leaves the other')
  assert(afterWire.components.length === 2, '18: components untouched')

  assert(removeComponent(d, 'missing').components.length === 2, '19: removing a missing id is a no-op')
}

// --- Pin count ---------------------------------------------------------------

{
  let d = emptyDocument()
  d = addComponent(d, 'input', 0, 0)
  d = addComponent(d, 'or', 100, 0)
  const [a, gate] = d.components
  d = connect(d, a.outputs[0], gate.inputs[1]).doc

  const grown = setGatePins(d, gate.id, 4)
  assert(grown.components[1].inputs.length === 4, '20: a gate can grow to four pins')
  assert(grown.wires.length === 1, '20: existing wires survive growing')

  // Shrinking past a wired pin drops that wire rather than leaving it pointing
  // at a port that no longer exists.
  const shrunk = setGatePins(grown, gate.id, 2)
  assert(shrunk.components[1].inputs.length === 2, '21: and shrink back')
  const shrunkFurther = setGatePins(grown, gate.id, 2)
  assert(shrunkFurther.wires.length === 1, '21: a wire on a surviving pin is kept')

  let wired = grown
  wired = connect(wired, a.outputs[0], grown.components[1].inputs[3]).doc
  const cut = setGatePins(wired, gate.id, 2)
  assert(cut.wires.every(w => w.to !== `${gate.id}.in3`), '22: shrinking drops wires on removed pins')

  assert(setGatePins(d, gate.id, 99).components[1].inputs.length === 6, '23: pin count is capped at 6')
  assert(setGatePins(d, gate.id, 0).components[1].inputs.length === 2, '24: and floored at 2')

  let notDoc = addComponent(emptyDocument(), 'not', 0, 0)
  assert(setGatePins(notDoc, notDoc.components[0].id, 4).components[0].inputs.length === 1,
    '25: NOT keeps one pin')
}

// --- Constants ---------------------------------------------------------------

{
  let d = addComponent(emptyDocument(), 'const', 0, 0)
  const id = d.components[0].id
  assert(d.components[0].value === 1, '26: a constant defaults to 1')
  d = setConstValue(d, id, 0)
  assert(d.components[0].value === 0 && d.components[0].label === '0', '27: and can be set to 0')
}

// --- Geometry ----------------------------------------------------------------

{
  let d = addComponent(emptyDocument(), 'and', 100, 50)
  const gate = d.components[0]
  const positions = portPositions(gate)
  const size = componentSize(gate)

  for (const pin of gate.inputs) {
    assert(positions[pin].x === gate.x, '28: input ports sit on the left edge')
    assert(positions[pin].y > gate.y && positions[pin].y < gate.y + size.height, '28: within the body')
  }
  assert(positions[gate.outputs[0]].x === gate.x + size.width, '29: the output sits on the right edge')

  // Snapped, not stored raw: the surface paints a GRID-spaced dot grid, and a
  // component that lands between dots makes every wire off it stair-step.
  d = moveComponent(d, gate.id, 200, 90)
  assert(d.components[0].x === 200 && d.components[0].y === 100, '30: move snaps to the grid')
  assert(d.components[0].x % GRID === 0 && d.components[0].y % GRID === 0, '30: on the grid')

  // Dragging an already-snapped component by less than half a cell must leave
  // it where it is, or a component creeps every time it is touched.
  const settled = moveComponent(d, gate.id, 200 + GRID / 2 - 1, 100)
  assert(settled.components[0].x === 200, '30: a sub-cell nudge does not move it')

  const all = allPortPositions(d)
  assert(all.get(`${gate.id}.in0`).x === 200, '31: allPortPositions follows the move')
  assert(all.get(`${gate.id}.in0`).componentId === gate.id, '31: and carries the owner')
}

// --- Warnings ----------------------------------------------------------------

{
  let d = emptyDocument()
  d = addComponent(d, 'and', 0, 0)
  assert(documentWarnings(d).some(w => w.kind === 'unconnected'), '32: unconnected inputs are reported')

  d = emptyDocument()
  d = addComponent(d, 'dff', 0, 0)
  assert(documentWarnings(d).some(w => w.kind === 'no-clock'), '33: flip-flops without a clock are reported')

  d = addComponent(d, 'clock', 100, 0)
  assert(!documentWarnings(d).some(w => w.kind === 'no-clock'), '34: adding a clock clears it')

  assert(documentWarnings(emptyDocument()).length === 0, '35: an empty document has nothing to warn about')
}

// --- Round trip through the simulator ----------------------------------------

{
  let d = emptyDocument()
  d = addComponent(d, 'input', 0, 0)
  d = addComponent(d, 'input', 0, 80)
  d = addComponent(d, 'and', 120, 20)
  d = addComponent(d, 'output', 240, 20)
  const [a, b, gate, probe] = d.components
  d = connect(d, a.outputs[0], gate.inputs[0]).doc
  d = connect(d, b.outputs[0], gate.inputs[1]).doc
  d = connect(d, gate.outputs[0], probe.inputs[0]).doc

  const sim = createSimulation(toNetlist(d))
  assert(sim.outputOf(probe.id) === 0, '36: 0 AND 0')
  sim.setInput(a.id, 1)
  assert(sim.outputOf(probe.id) === 0, '36: 1 AND 0')
  sim.setInput(b.id, 1)
  assert(sim.outputOf(probe.id) === 1, '36: 1 AND 1')

  // toNetlist must not leak editor-only fields.
  const netlist = toNetlist(d)
  assert(netlist.components.every(c => c.x === undefined && c.y === undefined),
    '37: coordinates are stripped from the netlist')
  assert(netlist.inputNames.join('') === 'AB', '37: input names carried over')
}

// --- Open in sandbox ---------------------------------------------------------

{
  const solution = minimize(tableFromMinterms({ vars: ['A', 'B', 'C'], minterms: [0, 1, 6, 7] }))
  const netlist = synthesize(solution)
  const layout = layoutCircuit(netlist)
  const sandbox = fromNetlist(netlist, layout)

  assert(sandbox.components.length === netlist.components.length, '38: every component carried over')
  assert(sandbox.wires.length === netlist.wires.length, '38: every wire carried over')
  assert(sandbox.components.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)),
    '38: every component is positioned')

  // The handoff must preserve behaviour exactly, which is the entire claim
  // behind putting all four modes in one tool.
  const before = createSimulation(netlist)
  const after = createSimulation(toNetlist(sandbox))
  const inputs = netlist.components.filter(c => c.kind === 'input')
  const probe = netlist.components.find(c => c.kind === 'output')

  for (let i = 0; i < 8; i += 1) {
    inputs.forEach((component, k) => {
      const bit = (i >> (inputs.length - 1 - k)) & 1
      before.setInput(component.id, bit)
      after.setInput(component.id, bit)
    })
    assert(before.outputOf(probe.id) === after.outputOf(probe.id),
      `39: the sandbox copy behaves identically at index ${i}`)
  }

  // Without a layout it still lands somewhere sane rather than stacking
  // everything at the origin.
  const unplaced = fromNetlist(netlist, null)
  assert(new Set(unplaced.components.map(c => `${c.x},${c.y}`)).size === unplaced.components.length,
    '40: without a layout, components do not overlap exactly')
}

// --- Serialisation -----------------------------------------------------------

{
  let d = emptyDocument()
  d = addComponent(d, 'input', 5, 5)
  d = addComponent(d, 'not', 100, 5)
  d = connect(d, d.components[0].outputs[0], d.components[1].inputs[0]).doc

  const round = deserialize(serialize(d))
  assert(round.ok, '41: a document round trips')
  assert(round.doc.components.length === 2 && round.doc.wires.length === 1, '41: contents preserved')
  assert(round.doc.nextId === d.nextId, '41: the id counter survives, so ids stay unique after reload')

  assert(!deserialize('not json').ok, '42: junk is refused')
  assert(!deserialize('{}').ok, '43: a document with no components array is refused')
  assert(!deserialize(JSON.stringify({ version: 99, components: [], wires: [] })).ok,
    '44: a future version is refused rather than half-read')

  const badKind = JSON.stringify({
    version: SCHEMA_VERSION,
    components: [{ id: 'x', kind: 'quantum', inputs: [], outputs: [], x: 0, y: 0 }],
    wires: [],
  })
  assert(!deserialize(badKind).ok, '45: an unknown component kind is refused')

  const danglingWire = JSON.stringify({
    version: SCHEMA_VERSION,
    components: [{ id: 'x', kind: 'input', inputs: [], outputs: ['x.out'], x: 0, y: 0 }],
    wires: [{ id: 'w', from: 'x.out', to: 'ghost.in0' }],
  })
  assert(!deserialize(danglingWire).ok, '46: a wire to a missing port is refused')

  const shorted = JSON.stringify({
    version: SCHEMA_VERSION,
    components: [
      { id: 'a', kind: 'input', inputs: [], outputs: ['a.out'], x: 0, y: 0 },
      { id: 'b', kind: 'input', inputs: [], outputs: ['b.out'], x: 0, y: 0 },
      { id: 'g', kind: 'not', inputs: ['g.in0'], outputs: ['g.out'], x: 0, y: 0 },
    ],
    wires: [{ id: 'w1', from: 'a.out', to: 'g.in0' }, { id: 'w2', from: 'b.out', to: 'g.in0' }],
  })
  assert(!deserialize(shorted).ok, '47: a file driving one input twice is refused')

  const noPosition = JSON.stringify({
    version: SCHEMA_VERSION,
    components: [{ id: 'x', kind: 'input', inputs: [], outputs: ['x.out'] }],
    wires: [],
  })
  assert(!deserialize(noPosition).ok, '48: a component with no position is refused')
}

// --- Storage -----------------------------------------------------------------

{
  const store = new Map()
  const fake = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  }

  let d = addComponent(emptyDocument(), 'input', 1, 2)
  assert(saveToStorage(fake, d), '49: saves')
  const loaded = loadFromStorage(fake)
  assert(loaded && loaded.components.length === 1, '49: and loads back')

  assert(loadFromStorage({ getItem: () => null }) === null, '50: nothing stored gives null')
  assert(loadFromStorage({ getItem: () => '{{{' }) === null, '51: a corrupt entry gives null, not a throw')

  // A storage that throws (private mode, quota) must not break the page.
  const hostile = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
  assert(loadFromStorage(hostile) === null, '52: a throwing storage reads as empty')
  assert(saveToStorage(hostile, d) === false, '52: and reports the failed save rather than throwing')
}

if (failures === 0) console.log('sandboxModel: all tests passed')
else { console.error(`sandboxModel: ${failures} failure(s)`); process.exit(1) }
