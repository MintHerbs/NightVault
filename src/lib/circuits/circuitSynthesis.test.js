/**
 * Synthesis tests (T-089).
 * Run with: npm run test:circuits
 *
 * The netlist evaluator below is written from scratch rather than imported,
 * so "the circuit computes the function" is checked by something that shares no
 * code with the thing that built it. Every synthesised circuit is simulated
 * across its whole input space and compared against the truth table it came
 * from, in both forms and both gate styles.
 */

import { synthesize, gateSummary, componentLevels, portOwners, isGate } from './circuitSynthesis.js'
import { minimize } from './quineMcCluskey.js'
import { tableFromMinterms } from './truthTable.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

// --- Independent netlist evaluator -------------------------------------------

function evaluateNetlist(netlist, assignment) {
  const owners = new Map()
  for (const component of netlist.components) {
    for (const port of [...component.inputs, ...component.outputs]) owners.set(port, component)
  }

  // Which port drives each input port.
  const driverOf = new Map()
  for (const wire of netlist.wires) driverOf.set(wire.to, wire.from)

  const cache = new Map()
  const depth = { value: 0 }

  const portValue = (port) => {
    if (cache.has(port)) return cache.get(port)
    depth.value += 1
    if (depth.value > 10000) throw new Error('cycle in synthesised netlist')

    const component = owners.get(port)
    if (!component) throw new Error(`no owner for port ${port}`)

    let value
    if (component.kind === 'input') value = assignment[component.label] ? 1 : 0
    else if (component.kind === 'const') value = component.value
    else {
      const args = component.inputs.map((pin) => {
        const source = driverOf.get(pin)
        if (source === undefined) throw new Error(`unconnected pin ${pin}`)
        return portValue(source)
      })
      value = applyGate(component.kind, args)
    }

    depth.value -= 1
    cache.set(port, value)
    return value
  }

  const out = netlist.components.find(c => c.kind === 'output')
  const source = driverOf.get(out.inputs[0])
  if (source === undefined) throw new Error('output is unconnected')
  return portValue(source)
}

function applyGate(kind, args) {
  switch (kind) {
    case 'and': return args.every(Boolean) ? 1 : 0
    case 'or': return args.some(Boolean) ? 1 : 0
    case 'not': return args[0] ? 0 : 1
    case 'nand': return args.every(Boolean) ? 0 : 1
    case 'nor': return args.some(Boolean) ? 0 : 1
    case 'xor': return args.reduce((a, b) => a ^ b, 0) ? 1 : 0
    case 'xnor': return args.reduce((a, b) => a ^ b, 0) ? 0 : 1
    default: throw new Error(`unknown gate ${kind}`)
  }
}

// --- Structural invariants ---------------------------------------------------

function checkStructure(netlist, label) {
  const owners = portOwners(netlist)
  const ids = new Set()

  for (const component of netlist.components) {
    if (ids.has(component.id)) assert(false, `${label}: duplicate component id ${component.id}`)
    ids.add(component.id)
  }

  const driven = new Map()
  for (const wire of netlist.wires) {
    assert(owners.has(wire.from), `${label}: wire from unknown port ${wire.from}`)
    assert(owners.has(wire.to), `${label}: wire to unknown port ${wire.to}`)
    // An input pin taking two drivers is a short, and it silently changes the
    // function rather than failing loudly, so it has to be caught here.
    assert(!driven.has(wire.to), `${label}: input pin ${wire.to} driven twice`)
    driven.set(wire.to, wire.from)
  }

  for (const component of netlist.components) {
    for (const pin of component.inputs) {
      assert(driven.has(pin), `${label}: pin ${pin} on ${component.kind} is unconnected`)
    }
  }

  const outs = netlist.components.filter(c => c.kind === 'output')
  assert(outs.length === 1, `${label}: exactly one output`)
}

// --- The sweep ---------------------------------------------------------------

const VARS = ['A', 'B', 'C', 'D']
let sweptCircuits = 0

// Deterministic sample plus every 3-variable function in full: 2^8 = 256 of
// those, times two forms times two styles.
const bitmaps3 = Array.from({ length: 256 }, (_, i) => i)

for (const bitmap of bitmaps3) {
  const vars = ['A', 'B', 'C']
  const minterms = []
  for (let i = 0; i < 8; i += 1) if (bitmap & (1 << i)) minterms.push(i)
  const table = tableFromMinterms({ vars, minterms })

  for (const form of ['sop', 'pos']) {
    const solution = minimize(table, { form })
    for (const style of ['basic', 'universal']) {
      const netlist = synthesize(solution, { style })
      sweptCircuits += 1
      checkStructure(netlist, `3v ${bitmap} ${form} ${style}`)

      for (let i = 0; i < 8; i += 1) {
        const assignment = {}
        vars.forEach((name, k) => { assignment[name] = (i >> (2 - k)) & 1 })
        const expected = (bitmap >> i) & 1
        let actual
        try {
          actual = evaluateNetlist(netlist, assignment)
        } catch (err) {
          assert(false, `3v ${bitmap} ${form} ${style}: ${err.message}`)
          break
        }
        if (actual !== expected) {
          assert(false, `3v ${bitmap} ${form} ${style}: index ${i} gave ${actual}, expected ${expected}`)
          break
        }
      }
      if (failures > 10) break
    }
    if (failures > 10) break
  }
  if (failures > 10) break
}

// Four variables with don't-cares, sampled. Only the care rows are checked: a
// don't-care may legitimately come out either way.
let seed = 20260801
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

for (let trial = 0; trial < 500 && failures <= 10; trial += 1) {
  const minterms = []
  const dontCares = []
  for (let i = 0; i < 16; i += 1) {
    const roll = rand()
    if (roll < 0.35) minterms.push(i)
    else if (roll < 0.5) dontCares.push(i)
  }
  const table = tableFromMinterms({ vars: VARS, minterms, dontCares })

  for (const form of ['sop', 'pos']) {
    for (const style of ['basic', 'universal']) {
      const netlist = synthesize(minimize(table, { form }), { style })
      sweptCircuits += 1
      checkStructure(netlist, `4v dc ${trial} ${form} ${style}`)

      const ones = new Set(minterms)
      const skip = new Set(dontCares)
      for (let i = 0; i < 16; i += 1) {
        if (skip.has(i)) continue
        const assignment = {}
        VARS.forEach((name, k) => { assignment[name] = (i >> (3 - k)) & 1 })
        const expected = ones.has(i) ? 1 : 0
        if (evaluateNetlist(netlist, assignment) !== expected) {
          assert(false, `4v dc ${trial} ${form} ${style}: index ${i} wrong`)
          break
        }
      }
    }
  }
}

console.log(`  synthesised and simulated ${sweptCircuits} circuits`)

// --- Shapes ------------------------------------------------------------------

const sop = minimize(tableFromMinterms({ vars: VARS, minterms: [0, 2, 8, 10] }))
const basic = synthesize(sop)
assert(basic.components.filter(c => c.kind === 'and').length === 1, "45: B'D' needs one AND")
assert(basic.components.filter(c => c.kind === 'or').length === 0, '46: a single term needs no OR')
assert(basic.components.filter(c => c.kind === 'not').length === 2, '47: two inverters')
assert(basic.components.filter(c => c.kind === 'input').length === 4, '48: all four variables get a pin')

// One inverter per variable, shared, not one per literal occurrence.
const shared = synthesize(minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [0, 1] })))
assert(shared.components.filter(c => c.kind === 'not').length <= 1, '49: inverters are shared')

const twoTerms = minimize(tableFromMinterms({ vars: ['A', 'B', 'C'], minterms: [0, 1, 6, 7] }))
const twoBasic = synthesize(twoTerms)
assert(twoBasic.components.filter(c => c.kind === 'or').length === 1, '50: two terms join with one OR')

// The universal form must give every term its own NAND even when it has a
// single literal, because that inversion is what the final NAND cancels.
const singleLiteralTerm = minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [1, 2, 3] }))
const universal = synthesize(singleLiteralTerm, { style: 'universal' })
assert(universal.components.every(c => !['and', 'or'].includes(c.kind)), '51: universal form has no AND or OR')
assert(universal.components.filter(c => c.kind === 'nand').length >= 2, '52: universal form keeps a gate per term')

// Constants.
const zero = synthesize(minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [] })))
assert(zero.components.some(c => c.kind === 'const' && c.value === 0), '53: constant 0 circuit')
assert(zero.components.filter(c => c.kind === 'input').length === 2, '53: variables still shown')
checkStructure(zero, '53')

const one = synthesize(minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [0, 1, 2, 3] })))
assert(one.components.some(c => c.kind === 'const' && c.value === 1), '54: constant 1 circuit')
checkStructure(one, '54')

// POS of a constant inverts which constant is emitted.
const posZero = synthesize(minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [0, 1, 2, 3] }), { form: 'pos' }))
assert(posZero.components.some(c => c.kind === 'const' && c.value === 1), '55: pos constant 1')
assert(evaluateNetlist(posZero, { A: 0, B: 0 }) === 1, '55: pos constant evaluates to 1')

// --- Summary and levels ------------------------------------------------------

const summary = gateSummary(twoBasic)
assert(summary.counts.and === 2 && summary.counts.or === 1, '56: gate tally')
assert(summary.inverters === summary.counts.not, '57: inverters counted separately')
assert(summary.gates === 3, '58: inverters excluded from the gate count')
assert(summary.total === summary.gates + summary.inverters, '59: total is the sum')
assert(summary.pins === twoBasic.components.filter(isGate).reduce((n, c) => n + c.inputs.length, 0), '60: pin count')

const levels = componentLevels(twoBasic)
for (const component of twoBasic.components) {
  if (component.kind === 'input') assert(levels.get(component.id) === 0, '61: inputs at level 0')
}
const outLevel = levels.get(twoBasic.components.find(c => c.kind === 'output').id)
assert(outLevel > 0, '62: the output sits after the gates')
// AND -> OR -> output over an inverted input is four levels deep.
assert(outLevel === 4, `63: expected depth 4, got ${outLevel}`)

// componentLevels must terminate on a cyclic netlist, since the sandbox will
// hand it exactly that.
const cyclic = {
  components: [
    { id: 'g1', kind: 'not', label: null, inputs: ['g1.in0'], outputs: ['g1.out'] },
    { id: 'g2', kind: 'not', label: null, inputs: ['g2.in0'], outputs: ['g2.out'] },
  ],
  wires: [
    { id: 'w0', from: 'g1.out', to: 'g2.in0' },
    { id: 'w1', from: 'g2.out', to: 'g1.in0' },
  ],
  inputNames: [], outputNames: [],
}
const cyclicLevels = componentLevels(cyclic)
assert(cyclicLevels.size === 2, '64: cyclic netlist does not hang componentLevels')

if (failures === 0) console.log('circuitSynthesis: all tests passed')
else { console.error(`circuitSynthesis: ${failures} failure(s)`); process.exit(1) }
