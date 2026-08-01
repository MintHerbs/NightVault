/**
 * Circuit layout tests (T-089).
 * Run with: npm run test:circuits
 *
 * Geometry only. The properties worth asserting are the ones a reader would
 * notice immediately if they broke: boxes that overlap, wires that do not touch
 * the pins they claim to connect, and diagonal segments in what is meant to be
 * orthogonal routing.
 */

import { layoutCircuit, wirePath, DEFAULTS } from './circuitLayout.js'
import { synthesize } from './circuitSynthesis.js'
import { minimize } from './quineMcCluskey.js'
import { tableFromMinterms } from './truthTable.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

const overlaps = (a, b) => (
  a.x < b.x + b.width && b.x < a.x + a.width
  && a.y < b.y + b.height && b.y < a.y + a.height
)

let checked = 0
let seed = 424242
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

for (let trial = 0; trial < 300; trial += 1) {
  const width = 2 + (trial % 3)
  const vars = ['A', 'B', 'C', 'D'].slice(0, width)
  const size = 2 ** width

  const minterms = []
  for (let i = 0; i < size; i += 1) if (rand() < 0.5) minterms.push(i)
  const table = tableFromMinterms({ vars, minterms })

  for (const form of ['sop', 'pos']) {
    for (const style of ['basic', 'universal']) {
      const netlist = synthesize(minimize(table, { form }), { style })
      const layout = layoutCircuit(netlist)
      checked += 1
      const label = `${width}v ${trial} ${form} ${style}`

      // Every component placed, exactly once.
      assert(layout.components.length === netlist.components.length, `${label}: all components placed`)

      // No two boxes overlap.
      for (let i = 0; i < layout.components.length && failures <= 8; i += 1) {
        for (let j = i + 1; j < layout.components.length; j += 1) {
          if (overlaps(layout.components[i], layout.components[j])) {
            assert(false, `${label}: ${layout.components[i].id} overlaps ${layout.components[j].id}`)
            break
          }
        }
      }

      // Everything sits inside the reported canvas.
      for (const c of layout.components) {
        assert(c.x >= 0 && c.y >= 0 && c.x + c.width <= layout.width + 0.01 && c.y + c.height <= layout.height + 0.01,
          `${label}: ${c.id} inside the canvas`)
      }

      // Inputs are leftmost, the output is rightmost. A student reading the
      // diagram assumes signal flows left to right.
      const inputs = layout.components.filter(c => c.kind === 'input')
      const output = layout.components.find(c => c.kind === 'output')
      for (const input of inputs) {
        assert(input.x <= output.x, `${label}: input ${input.label} left of the output`)
        assert(input.layer === 0, `${label}: input ${input.label} in layer 0`)
      }

      for (const wire of layout.wires) {
        const from = layout.ports.get(wire.from)
        const to = layout.ports.get(wire.to)

        assert(wire.points.length >= 2, `${label}: wire ${wire.id} has a path`)
        const first = wire.points[0]
        const last = wire.points[wire.points.length - 1]
        assert(Math.abs(first.x - from.x) < 0.01 && Math.abs(first.y - from.y) < 0.01,
          `${label}: wire ${wire.id} starts at its source pin`)
        assert(Math.abs(last.x - to.x) < 0.01 && Math.abs(last.y - to.y) < 0.01,
          `${label}: wire ${wire.id} ends at its target pin`)

        // Every segment axis-aligned.
        for (let k = 1; k < wire.points.length; k += 1) {
          const p = wire.points[k - 1]
          const q = wire.points[k]
          assert(Math.abs(p.x - q.x) < 0.01 || Math.abs(p.y - q.y) < 0.01,
            `${label}: wire ${wire.id} segment ${k} is diagonal`)
        }

        // A wire always moves forward. Doubling back means the lane offset
        // pushed the vertical run behind the gate that drives it.
        for (const point of wire.points) {
          assert(point.x >= from.x - 0.01 && point.x <= to.x + 0.01,
            `${label}: wire ${wire.id} doubles back`)
        }
      }
      if (failures > 8) break
    }
    if (failures > 8) break
  }
  if (failures > 8) break
}

console.log(`  laid out ${checked} circuits`)

// --- Specifics ---------------------------------------------------------------

const netlist = synthesize(minimize(tableFromMinterms({ vars: ['A', 'B', 'C'], minterms: [0, 1, 6, 7] })))
const layout = layoutCircuit(netlist)

const layers = new Set(layout.components.map(c => c.layer))
assert(layers.size >= 3, '1: inputs, gates and output occupy distinct layers')

const output = layout.components.find(c => c.kind === 'output')
const maxLayer = Math.max(...layout.components.map(c => c.layer))
assert(output.layer === maxLayer, '2: the output is pushed to the last layer')

// Ports land on the box edges: inputs on the left, outputs on the right.
for (const component of netlist.components) {
  const box = layout.components.find(c => c.id === component.id)
  for (const port of component.inputs) {
    const point = layout.ports.get(port)
    assert(Math.abs(point.x - box.x) < 0.01, `3: ${port} sits on the left edge`)
    assert(point.y > box.y && point.y < box.y + box.height, `3: ${port} within the box height`)
  }
  for (const port of component.outputs) {
    const point = layout.ports.get(port)
    assert(Math.abs(point.x - (box.x + box.width)) < 0.01, `4: ${port} sits on the right edge`)
  }
}

// Gate boxes grow with pin count so pins never crowd.
const wide = synthesize(minimize(tableFromMinterms({
  vars: ['A', 'B', 'C', 'D'],
  minterms: [0, 3, 5, 6, 9, 10, 12, 15],
})))
const wideLayout = layoutCircuit(wide)
const joinGate = wideLayout.components.find(c => c.kind === 'or')
assert(joinGate.height >= joinGate.inputs.length * 16, '5: a wide gate is tall enough for its pins')

// Overrides are honoured.
const tight = layoutCircuit(netlist, { layerGap: 200 })
assert(tight.width > layout.width, '6: a larger layer gap widens the canvas')

// A constant circuit still lays out.
const constant = layoutCircuit(synthesize(minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [] }))))
assert(constant.components.length === 4, '7: constant circuit places pins, const and output')
assert(constant.width > 0 && constant.height > 0, '7: constant circuit has a canvas')

// wirePath output.
const path = wirePath(layout.wires[0])
assert(path.startsWith('M'), '8: path starts with a move')
assert(!path.includes('NaN'), '8: path has no NaN')
assert(wirePath({ points: [] }) === '', '9: empty path for an unrouted wire')

assert(DEFAULTS.layerGap > 0 && DEFAULTS.padding > 0, '10: defaults are sane')

if (failures === 0) console.log('circuitLayout: all tests passed')
else { console.error(`circuitLayout: ${failures} failure(s)`); process.exit(1) }
