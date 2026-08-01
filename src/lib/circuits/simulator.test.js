/**
 * Simulator and flip-flop tests (T-089).
 * Run with: npm run test:circuits
 *
 * The load-bearing fixtures are the shift register (proves flip-flops sample
 * before they commit), the ring oscillator (proves an unsettleable circuit is
 * reported rather than hung), and the SR forbidden state (proves it is flagged
 * rather than given a value).
 */

import {
  createSimulation,
  applyGate,
  evaluateCombinational,
  UNKNOWN,
  SETTLE_LIMIT,
} from './simulator.js'
import {
  nextState,
  excitation,
  dataPins,
  FLIP_FLOP_KINDS,
  FLIP_FLOP_PINS,
  characteristicRows,
  excitationRows,
} from './flipFlops.js'
import { synthesize } from './circuitSynthesis.js'
import { minimize } from './quineMcCluskey.js'
import { tableFromMinterms } from './truthTable.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

// --- Netlist construction helper --------------------------------------------

function build() {
  const components = []
  const wires = []
  let n = 0

  const add = (kind, opts = {}) => {
    const id = opts.id ?? `${kind}${n++}`
    const pinCount = opts.pins ?? (kind === 'output' ? 1 : 0)
    const component = {
      id,
      kind,
      label: opts.label ?? null,
      inputs: Array.from({ length: pinCount }, (_, i) => `${id}.in${i}`),
      outputs: kind === 'output' ? [] : [`${id}.out`],
    }
    if (kind === 'dff' || kind === 'tff' || kind === 'jkff' || kind === 'srff') {
      component.inputs = FLIP_FLOP_PINS[kind].map((_, i) => `${id}.in${i}`)
      component.outputs = [`${id}.out`, `${id}.outn`]
    }
    if (opts.value !== undefined) component.value = opts.value
    components.push(component)
    return component
  }

  const wire = (from, to) => { wires.push({ id: `w${wires.length}`, from, to }) }

  return {
    add,
    wire,
    netlist: () => ({ components, wires, inputNames: [], outputNames: [] }),
  }
}

// --- Three-valued gates ------------------------------------------------------

assert(applyGate('and', [1, 1]) === 1, '1: AND 1,1')
assert(applyGate('and', [0, UNKNOWN]) === 0, '2: a controlling 0 beats unknown on AND')
assert(applyGate('and', [1, UNKNOWN]) === UNKNOWN, '3: AND with a floating input is unknown')
assert(applyGate('or', [1, UNKNOWN]) === 1, '4: a controlling 1 beats unknown on OR')
assert(applyGate('or', [0, UNKNOWN]) === UNKNOWN, '5: OR with a floating input is unknown')
assert(applyGate('not', [UNKNOWN]) === UNKNOWN, '6: NOT of unknown')
assert(applyGate('xor', [1, UNKNOWN]) === UNKNOWN, '7: XOR has no controlling value')
assert(applyGate('nand', [0, UNKNOWN]) === 1, '8: NAND with a controlling 0')
assert(applyGate('nor', [1, UNKNOWN]) === 0, '9: NOR with a controlling 1')
assert(applyGate('xnor', [1, 1]) === 1, '10: XNOR 1,1')

// --- Undriven pins read as unknown, never as 0 -------------------------------

{
  const b = build()
  const gate = b.add('and', { pins: 2 })
  const probe = b.add('output', { label: 'F' })
  b.wire(gate.outputs[0], probe.inputs[0])
  const sim = createSimulation(b.netlist())
  assert(sim.outputOf(probe.id) === UNKNOWN, '11: a gate with no inputs wired reads unknown')
}

// --- Combinational: an inverter chain settles --------------------------------

{
  const b = build()
  const input = b.add('input', { label: 'A' })
  const n1 = b.add('not', { pins: 1 })
  const n2 = b.add('not', { pins: 1 })
  const probe = b.add('output', { label: 'F' })
  b.wire(input.outputs[0], n1.inputs[0])
  b.wire(n1.outputs[0], n2.inputs[0])
  b.wire(n2.outputs[0], probe.inputs[0])

  const sim = createSimulation(b.netlist())
  assert(sim.outputOf(probe.id) === 0, '12: double inverter passes 0')
  sim.setInput(input.id, 1)
  assert(sim.outputOf(probe.id) === 1, '12: double inverter passes 1')
}

// --- Ring oscillator: reported unstable, and does not hang -------------------
//
// An unpowered ring of inverters does NOT oscillate under three-valued
// semantics: NOT(x) is x, so all-unknown is a legitimate fixed point and the
// simulator is right to settle there. Asserted deliberately, because "it
// settled" looks like a bug until you see why.
{
  const b = build()
  const n1 = b.add('not', { pins: 1 })
  const n2 = b.add('not', { pins: 1 })
  const n3 = b.add('not', { pins: 1 })
  b.wire(n1.outputs[0], n2.inputs[0])
  b.wire(n2.outputs[0], n3.inputs[0])
  b.wire(n3.outputs[0], n1.inputs[0])
  assert(createSimulation(b.netlist()).settle().stable === true,
    '13: an unforced ring settles at unknown rather than oscillating')
}

// A ring that has been forced to a defined value DOES oscillate. The NAND lets
// a definite value in: NAND(0, x) is 1 regardless of the unknown, so holding
// the enable low fills the loop, and raising it turns the NAND into the third
// inverter of an odd ring that can no longer settle.
{
  const b = build()
  const enable = b.add('input', { label: 'EN' })
  const nand = b.add('nand', { pins: 2 })
  const n2 = b.add('not', { pins: 1 })
  const n3 = b.add('not', { pins: 1 })
  b.wire(enable.outputs[0], nand.inputs[0])
  b.wire(n3.outputs[0], nand.inputs[1])
  b.wire(nand.outputs[0], n2.inputs[0])
  b.wire(n2.outputs[0], n3.inputs[0])

  const sim = createSimulation(b.netlist())
  assert(sim.settle().stable === true, '14: held low, the ring settles')

  const started = Date.now()
  sim.inputs.set(enable.id, 1)
  const result = sim.settle()
  const elapsed = Date.now() - started

  assert(result.stable === false, '14: released, the odd ring does not settle')
  assert(result.unstable.length > 0, '14: unstable nets reported')
  assert(elapsed < 2000, `14: bounded in time, took ${elapsed}ms`)
}

assert(SETTLE_LIMIT > 0 && SETTLE_LIMIT <= 1000, '15: settle limit is sane')

// --- Shift register: the simultaneous-commit fixture -------------------------
//
// Four D flip-flops in a chain on one clock. If Q outputs were committed one at
// a time, a 1 fed in at the front would appear at the far end after ONE tick
// instead of four, because each stage would already see the new value of the
// stage before it.

function shiftRegister(stages) {
  const b = build()
  const data = b.add('input', { label: 'DIN' })
  const clock = b.add('clock', { label: 'CLK' })
  const flops = []
  const probes = []

  for (let i = 0; i < stages; i += 1) {
    const ff = b.add('dff', { id: `ff${i}` })
    const probe = b.add('output', { label: `Q${i}` })
    b.wire(clock.outputs[0], ff.inputs[1])
    b.wire(ff.outputs[0], probe.inputs[0])
    b.wire(i === 0 ? data.outputs[0] : flops[i - 1].outputs[0], ff.inputs[0])
    flops.push(ff)
    probes.push(probe)
  }

  return { netlist: b.netlist(), data, probes, flops }
}

{
  const { netlist, data, probes } = shiftRegister(4)
  const sim = createSimulation(netlist)

  const read = () => probes.map(p => sim.outputOf(p.id)).join('')
  assert(read() === '0000', '16: shift register starts empty')

  sim.setInput(data.id, 1)
  sim.tick()
  assert(read() === '1000', `16: after one tick only stage 0 is set, got ${read()}`)

  sim.setInput(data.id, 0)
  sim.tick()
  assert(read() === '0100', `16: the 1 walks to stage 1, got ${read()}`)
  sim.tick()
  assert(read() === '0010', `16: then stage 2, got ${read()}`)
  sim.tick()
  assert(read() === '0001', `16: then stage 3, got ${read()}`)
  sim.tick()
  assert(read() === '0000', `16: then out, got ${read()}`)
}

// --- Mod-8 counter from T flip-flops -----------------------------------------
//
// T0 toggles every clock, T1 toggles when Q0 is high, T2 when Q0 and Q1 are.

{
  const b = build()
  const clock = b.add('clock', { label: 'CLK' })
  const one = b.add('const', { value: 1 })
  const ff0 = b.add('tff', { id: 'q0' })
  const ff1 = b.add('tff', { id: 'q1' })
  const ff2 = b.add('tff', { id: 'q2' })
  const and01 = b.add('and', { pins: 2 })

  b.wire(one.outputs[0], ff0.inputs[0])
  b.wire(ff0.outputs[0], ff1.inputs[0])
  b.wire(ff0.outputs[0], and01.inputs[0])
  b.wire(ff1.outputs[0], and01.inputs[1])
  b.wire(and01.outputs[0], ff2.inputs[0])
  for (const ff of [ff0, ff1, ff2]) b.wire(clock.outputs[0], ff.inputs[1])

  const sim = createSimulation(b.netlist())
  const value = () => sim.outputOf('q2') * 4 + sim.outputOf('q1') * 2 + sim.outputOf('q0')

  assert(value() === 0, '17: counter starts at 0')
  for (let expected = 1; expected <= 16; expected += 1) {
    sim.tick()
    if (value() !== expected % 8) {
      assert(false, `17: tick ${expected} gave ${value()}, expected ${expected % 8}`)
      break
    }
  }
}

// --- SR forbidden state is flagged, never resolved ---------------------------

{
  const b = build()
  const s = b.add('input', { label: 'S' })
  const r = b.add('input', { label: 'R' })
  const clock = b.add('clock', { label: 'CLK' })
  const ff = b.add('srff', { id: 'sr' })
  b.wire(s.outputs[0], ff.inputs[0])
  b.wire(r.outputs[0], ff.inputs[1])
  b.wire(clock.outputs[0], ff.inputs[2])

  const sim = createSimulation(b.netlist())

  sim.setInput(s.id, 1)
  sim.tick()
  assert(sim.outputOf('sr') === 1, '18: S=1 sets')
  assert(sim.invalid.size === 0, '18: setting is not invalid')

  sim.setInput(s.id, 0)
  sim.setInput(r.id, 1)
  sim.tick()
  assert(sim.outputOf('sr') === 0, '19: R=1 resets')

  sim.setInput(s.id, 1)
  const ticked = sim.tick()
  assert(ticked.invalid.includes('sr'), '20: S=R=1 is flagged invalid')
  assert(sim.outputOf('sr') === 0, '20: the forbidden input holds rather than picking a value')

  // Clearing the forbidden combination clears the flag.
  sim.setInput(r.id, 0)
  sim.tick()
  assert(sim.invalid.size === 0, '21: flag clears once the input is legal')
}

// --- A flip-flop with no clock wired never fires -----------------------------

{
  const b = build()
  const d = b.add('input', { label: 'D' })
  const ff = b.add('dff', { id: 'ff' })
  b.wire(d.outputs[0], ff.inputs[0])

  const sim = createSimulation(b.netlist())
  sim.setInput(d.id, 1)
  sim.tick()
  assert(sim.outputOf('ff') === 0, '22: an unclocked flip-flop does not change state')
}

// --- Q' really is the complement ---------------------------------------------

{
  const b = build()
  const d = b.add('input', { label: 'D' })
  const clock = b.add('clock', { label: 'CLK' })
  const ff = b.add('dff', { id: 'ff' })
  b.wire(d.outputs[0], ff.inputs[0])
  b.wire(clock.outputs[0], ff.inputs[1])

  const sim = createSimulation(b.netlist())
  sim.setInput(d.id, 1)
  sim.tick()
  assert(sim.portValue('ff.out') === 1 && sim.portValue('ff.outn') === 0, "23: Q' is the complement of Q")
}

// --- reset() really resets ---------------------------------------------------

{
  const { netlist, data, probes } = shiftRegister(3)
  const sim = createSimulation(netlist)
  sim.setInput(data.id, 1)
  sim.tick(); sim.tick()
  sim.reset()
  assert(probes.every(p => sim.outputOf(p.id) === 0), '24: reset clears every flip-flop')
  assert(sim.getInput(data.id) === 0, '24: reset clears toggles too')
}

// --- Flip-flop semantics: next state -----------------------------------------

assert(nextState('dff', 0, { D: 1 }).next === 1, '25: D captures')
assert(nextState('tff', 1, { T: 1 }).next === 0, '26: T toggles')
assert(nextState('tff', 1, { T: 0 }).next === 1, '27: T holds')
assert(nextState('jkff', 0, { J: 0, K: 0 }).next === 0, '28: JK 00 holds')
assert(nextState('jkff', 1, { J: 0, K: 1 }).next === 0, '29: JK 01 resets')
assert(nextState('jkff', 0, { J: 1, K: 0 }).next === 1, '30: JK 10 sets')
assert(nextState('jkff', 1, { J: 1, K: 1 }).next === 0, '31: JK 11 toggles')
assert(nextState('srff', 1, { S: 1, R: 1 }).invalid === true, '32: SR 11 is invalid')
assert(nextState('dff', 0, { D: UNKNOWN }).next === UNKNOWN, '33: an unknown input gives an unknown state')

// --- Excitation and next-state must agree ------------------------------------
//
// This is the check that keeps FSM synthesis honest: the table used to BUILD a
// circuit and the function used to RUN it are two readings of one truth table,
// and a disagreement produces a circuit that is wrong in a way the K-map cannot
// show. Don't-cares are checked under BOTH substitutions.

for (const kind of FLIP_FLOP_KINDS) {
  for (const from of [0, 1]) {
    for (const to of [0, 1]) {
      const required = excitation(kind, from, to)
      const pins = dataPins(kind)
      const freePins = pins.filter(pin => required[pin] === null)

      for (let mask = 0; mask < 2 ** freePins.length; mask += 1) {
        const inputs = {}
        for (const pin of pins) inputs[pin] = required[pin]
        freePins.forEach((pin, i) => { inputs[pin] = (mask >> i) & 1 })

        const result = nextState(kind, from, inputs)
        if (result.invalid) {
          assert(false, `34: ${kind} ${from}->${to} excitation produced the forbidden input`)
          continue
        }
        assert(result.next === to,
          `34: ${kind} ${from}->${to} with ${JSON.stringify(inputs)} gave ${result.next}`)
      }
    }
  }
}

// Every kind can reach both states from both states, so the excitation table is
// total. A missing row would show up as a synthesis crash much later.
for (const kind of FLIP_FLOP_KINDS) {
  for (const from of [0, 1]) {
    for (const to of [0, 1]) {
      const values = excitation(kind, from, to)
      assert(dataPins(kind).every(pin => pin in values), `35: ${kind} ${from}->${to} covers every pin`)
    }
  }
}

// --- Reference tables render ---------------------------------------------------

for (const kind of FLIP_FLOP_KINDS) {
  assert(excitationRows(kind).length === 4, `36: ${kind} excitation has four rows`)
  assert(characteristicRows(kind).length === 2 ** dataPins(kind).length * 2,
    `37: ${kind} characteristic table is complete`)
}
assert(characteristicRows('srff').some(r => r.invalid), '38: SR characteristic table marks the forbidden row')
assert(!characteristicRows('jkff').some(r => r.invalid), '39: JK has no forbidden row')

// --- evaluateCombinational agrees with the synthesised truth table -----------

{
  let seed = 991
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const VARS = ['A', 'B', 'C', 'D']

  for (let trial = 0; trial < 200 && failures < 10; trial += 1) {
    const minterms = []
    for (let i = 0; i < 16; i += 1) if (rand() < 0.5) minterms.push(i)
    const table = tableFromMinterms({ vars: VARS, minterms })

    for (const style of ['basic', 'universal']) {
      const netlist = synthesize(minimize(table), { style })
      const ones = new Set(minterms)

      for (let i = 0; i < 16; i += 1) {
        const assignment = {}
        VARS.forEach((name, k) => { assignment[name] = (i >> (3 - k)) & 1 })
        const out = evaluateCombinational(netlist, assignment)
        if (out.F !== (ones.has(i) ? 1 : 0)) {
          assert(false, `40: trial ${trial} ${style} index ${i} gave ${out.F}`)
          break
        }
      }
    }
  }
}

// A partly-wired netlist reports unknown rather than guessing.
{
  const b = build()
  b.add('input', { label: 'A' })
  const gate = b.add('and', { pins: 2 })
  const probe = b.add('output', { label: 'F' })
  b.wire(gate.outputs[0], probe.inputs[0])
  const out = evaluateCombinational(b.netlist(), { A: 1 })
  assert(out.F === UNKNOWN, '41: an unwired gate reports unknown, not 0')
}

// --- Waveform sampling -------------------------------------------------------

{
  const { netlist, data } = shiftRegister(2)
  const sim = createSimulation(netlist)
  // DIN, CLK, two flip-flops, two probes.
  const traced = sim.traceable()
  assert(traced.length === 6, `42: every plottable component is traceable, got ${traced.length}`)
  assert(traced[0].kind === 'input' && traced[traced.length - 1].kind === 'output',
    '42: traceable is in reading order, inputs first and probes last')

  sim.setInput(data.id, 1)
  const before = sim.sample()
  sim.tick()
  const after = sim.sample()
  assert(before.ff0 === 0 && after.ff0 === 1, '43: the sample tracks state across a tick')
}

if (failures === 0) console.log('simulator: all tests passed')
else { console.error(`simulator: ${failures} failure(s)`); process.exit(1) }
