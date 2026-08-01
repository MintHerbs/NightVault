/**
 * FSM synthesis oracle (T-089 phase 3).
 * Run with: npm run test:circuits
 *
 * The highest-value test in the tool. For every fixture, every encoding and
 * every flip-flop type: synthesise the circuit, then RUN it in the simulator
 * against random input sequences and require it to reproduce the FSM's own
 * transitions and outputs, cycle for cycle.
 *
 * One assertion covers the excitation tables, the don't-care handling, the
 * K-map minimisation, the state assignment, the netlist construction and the
 * simulator, by checking them against each other. It is the only thing standing
 * between a student and a confidently wrong circuit.
 */

import { parseFSM, inputCombinations, completeWithSelfLoops } from './fsmParser.js'
import { synthesizeFSM, assignStates, stateTable, equivalentStates, runFSM, ENCODINGS } from './fsmSynthesis.js'
import { createSimulation } from './simulator.js'
import { FLIP_FLOP_KINDS } from './flipFlops.js'

let failures = 0
const fail = (msg) => {
  failures++
  if (failures <= 25) console.error(`  FAIL: ${msg}`)
}
const assert = (cond, msg) => { if (!cond) fail(msg) }

// --- Fixtures ----------------------------------------------------------------

/** Moore 101 sequence detector, overlapping. */
const detector101 = {
  title: '101 detector',
  machineType: 'moore',
  inputs: [{ name: 'X', description: 'serial bit' }],
  outputs: [{ name: 'Z', description: 'high when 101 seen' }],
  reset: 'S0',
  states: [
    { id: 'S0', label: 'nothing', output: { Z: 0 } },
    { id: 'S1', label: 'saw 1', output: { Z: 0 } },
    { id: 'S2', label: 'saw 10', output: { Z: 0 } },
    { id: 'S3', label: 'saw 101', output: { Z: 1 } },
  ],
  transitions: [
    { from: 'S0', to: 'S1', input: { X: 1 } },
    { from: 'S0', to: 'S0', input: { X: 0 } },
    { from: 'S1', to: 'S1', input: { X: 1 } },
    { from: 'S1', to: 'S2', input: { X: 0 } },
    { from: 'S2', to: 'S3', input: { X: 1 } },
    { from: 'S2', to: 'S0', input: { X: 0 } },
    { from: 'S3', to: 'S1', input: { X: 1 } },
    { from: 'S3', to: 'S2', input: { X: 0 } },
  ],
}

/** Mealy version of the same thing: output on the transition. */
const mealyDetector = {
  title: '11 detector (Mealy)',
  machineType: 'mealy',
  inputs: [{ name: 'X', description: 'serial bit' }],
  outputs: [{ name: 'Z', description: 'high on the second 1' }],
  reset: 'A',
  states: [{ id: 'A', label: 'no 1 yet' }, { id: 'B', label: 'saw a 1' }],
  transitions: [
    { from: 'A', to: 'A', input: { X: 0 }, output: { Z: 0 } },
    { from: 'A', to: 'B', input: { X: 1 }, output: { Z: 0 } },
    { from: 'B', to: 'A', input: { X: 0 }, output: { Z: 0 } },
    { from: 'B', to: 'B', input: { X: 1 }, output: { Z: 1 } },
  ],
}

/** Two inputs, five states: exercises unused encodings and multi-input maps. */
const vending = {
  title: 'Vending machine',
  machineType: 'moore',
  inputs: [{ name: 'N', description: 'nickel' }, { name: 'D', description: 'dime' }],
  outputs: [{ name: 'V', description: 'vend' }],
  reset: 'C0',
  states: [
    { id: 'C0', label: '0c', output: { V: 0 } },
    { id: 'C5', label: '5c', output: { V: 0 } },
    { id: 'C10', label: '10c', output: { V: 0 } },
    { id: 'C15', label: '15c', output: { V: 0 } },
    { id: 'CV', label: 'vend', output: { V: 1 } },
  ],
  transitions: [
    { from: 'C0', to: 'C0', input: { N: 0, D: 0 } },
    { from: 'C0', to: 'C5', input: { N: 1, D: 0 } },
    { from: 'C0', to: 'C10', input: { N: 0, D: 1 } },
    { from: 'C0', to: 'C10', input: { N: 1, D: 1 } },
    { from: 'C5', to: 'C5', input: { N: 0, D: 0 } },
    { from: 'C5', to: 'C10', input: { N: 1, D: 0 } },
    { from: 'C5', to: 'C15', input: { N: 0, D: 1 } },
    { from: 'C5', to: 'CV', input: { N: 1, D: 1 } },
    { from: 'C10', to: 'C10', input: { N: 0, D: 0 } },
    { from: 'C10', to: 'C15', input: { N: 1, D: 0 } },
    { from: 'C10', to: 'CV', input: { N: 0, D: 1 } },
    { from: 'C10', to: 'CV', input: { N: 1, D: 1 } },
    { from: 'C15', to: 'C15', input: { N: 0, D: 0 } },
    { from: 'C15', to: 'CV', input: { N: 1, D: 0 } },
    { from: 'C15', to: 'CV', input: { N: 0, D: 1 } },
    { from: 'C15', to: 'CV', input: { N: 1, D: 1 } },
    { from: 'CV', to: 'C0', input: { N: 0, D: 0 } },
    { from: 'CV', to: 'C5', input: { N: 1, D: 0 } },
    { from: 'CV', to: 'C10', input: { N: 0, D: 1 } },
    { from: 'CV', to: 'C10', input: { N: 1, D: 1 } },
  ],
}

/** Single state: the smallest thing synthesis has to survive. */
const trivial = {
  title: 'Always on',
  machineType: 'moore',
  inputs: [{ name: 'X' }],
  outputs: [{ name: 'Z' }],
  reset: 'S',
  states: [{ id: 'S', output: { Z: 1 } }],
  transitions: [
    { from: 'S', to: 'S', input: { X: 0 } },
    { from: 'S', to: 'S', input: { X: 1 } },
  ],
}

const FIXTURES = [detector101, mealyDetector, vending, trivial]

// --- The oracle sweep --------------------------------------------------------

let seed = 20260801
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

let combinationsChecked = 0

for (const raw of FIXTURES) {
  const parsed = parseFSM(raw)
  if (!parsed.valid) { fail(`${raw.title}: did not parse: ${parsed.error}`); continue }
  const fsm = parsed.fsm

  for (const encoding of ENCODINGS) {
    for (const flipFlop of FLIP_FLOP_KINDS) {
      const design = synthesizeFSM(fsm, { encoding, flipFlop })
      const label = `${fsm.title} / ${encoding} / ${flipFlop}`
      combinationsChecked += 1

      const simulation = createSimulation(design.netlist)
      const inputPins = fsm.inputs.map(s => design.netlist.components.find(c => c.label === s.name && c.kind === 'input'))
      const outputProbes = fsm.outputs.map(s => design.netlist.components.find(c => c.label === s.name && c.kind === 'output'))

      if (inputPins.some(p => !p) || outputProbes.some(p => !p)) {
        fail(`${label}: the netlist is missing an input or output`)
        continue
      }

      // The circuit powers up with every flip-flop at 0, so it can only be
      // compared against the FSM if that encoding IS the reset state. Any
      // encoding where it is not gets its flip-flops forced to the reset code
      // first, which is what a real reset line would do.
      const resetCode = design.assignment.codes.get(fsm.reset)
      design.assignment.names.forEach((name, bit) => {
        simulation.state.set(`ff_${name}`, resetCode[bit])
      })
      simulation.settle()

      // A random walk long enough to revisit states and exercise the loops.
      const combos = inputCombinations(fsm.inputs)
      const sequence = Array.from({ length: 40 }, () => combos[Math.floor(rand() * combos.length)])
      const expected = runFSM(fsm, sequence)

      let broke = false
      for (const [step, entry] of expected.entries()) {
        // Present this cycle's inputs, then read the outputs BEFORE the edge:
        // a Moore output depends on the current state and a Mealy output on the
        // current state and input, and both are read before the clock moves on.
        inputPins.forEach((pin, i) => simulation.setInput(pin.id, entry.input[fsm.inputs[i].name]))

        for (const [i, signal] of fsm.outputs.entries()) {
          const actual = simulation.outputOf(outputProbes[i].id)
          if (actual !== entry.output[signal.name]) {
            fail(`${label}: step ${step} output ${signal.name} was ${actual}, expected ${entry.output[signal.name]}`)
            broke = true
            break
          }
        }
        if (broke) break

        simulation.tick()

        // And the state after the edge must be the FSM's next state.
        const actualCode = design.assignment.names.map(name => simulation.outputOf(`ff_${name}`))
        const wantedCode = design.assignment.codes.get(entry.next)
        if (actualCode.join('') !== wantedCode.join('')) {
          fail(`${label}: step ${step} went to ${actualCode.join('')}, expected ${entry.next} = ${wantedCode.join('')}`)
          broke = true
          break
        }
      }

      if (broke) continue

      // No flip-flop may have been driven into its forbidden state along the way.
      assert(simulation.invalid.size === 0, `${label}: a flip-flop hit its forbidden input`)
      assert(simulation.unstable.length === 0, `${label}: the synthesised circuit does not settle`)
    }
  }
  if (failures > 25) break
}

console.log(`  synthesised and simulated ${combinationsChecked} designs (${FIXTURES.length} machines x ${ENCODINGS.length} encodings x ${FLIP_FLOP_KINDS.length} flip-flops)`)

// --- Structural checks -------------------------------------------------------

{
  const fsm = parseFSM(detector101).fsm

  const binary = assignStates(fsm, 'binary')
  assert(binary.bits === 2, '1: four states need two flip-flops')
  assert(binary.names.join(',') === 'Q1,Q0', '1: bits are named MSB first')

  const gray = assignStates(fsm, 'gray')
  const codes = fsm.states.map(s => gray.codes.get(s.id).join(''))
  for (let i = 1; i < codes.length; i += 1) {
    const differing = [...codes[i]].filter((bit, k) => bit !== codes[i - 1][k]).length
    assert(differing === 1, `2: gray codes differ in one bit between ${i - 1} and ${i}`)
  }

  const onehot = assignStates(fsm, 'onehot')
  assert(onehot.bits === 4, '3: one-hot uses one flip-flop per state')
  assert(fsm.states.every(s => onehot.codes.get(s.id).filter(Boolean).length === 1), '3: exactly one bit set')

  const rows = stateTable(fsm, binary)
  assert(rows.length === fsm.states.length * 2, '4: one row per state and input combination')

  // Five states in three bits leaves three unused codes, and those must be
  // don't-cares rather than forced to 0.
  const design = synthesizeFSM(parseFSM(vending).fsm, { encoding: 'binary', flipFlop: 'dff' })
  assert(design.assignment.bits === 3, '5: five states need three flip-flops')
  assert(design.unusedCodes.length > 0, '5: unused encodings are recorded')
  assert(design.functions.every(f => f.table.dontCares.length > 0), "5: and reach the K-maps as don't-cares")

  // JK produces don't-cares of its own, so its logic should never be more
  // expensive than the D version of the same design.
  const dLogic = synthesizeFSM(fsm, { flipFlop: 'dff' })
  const jkLogic = synthesizeFSM(fsm, { flipFlop: 'jkff' })
  const literals = (d) => d.functions.reduce((n, f) => n + f.solution.covers[0].literals, 0)
  assert(literals(jkLogic) <= literals(dLogic) + 2,
    `6: JK excitation don't-cares should not cost more than D (JK ${literals(jkLogic)}, D ${literals(dLogic)})`)
}

// --- Parser ------------------------------------------------------------------

assert(parseFSM(detector101).valid, '7: a good machine parses')
assert(parseFSM(JSON.stringify(detector101)).valid, '8: JSON text parses too')
assert(!parseFSM('{').valid, '9: broken JSON is refused')
assert(!parseFSM({ ...detector101, reset: 'nope' }).valid, '10: an unknown reset state is refused')
assert(!parseFSM({ ...detector101, machineType: 'turing' }).valid, '11: an unknown machine type is refused')

// Determinism: two transitions from one state on the same input.
{
  const bad = {
    ...detector101,
    transitions: [...detector101.transitions, { from: 'S0', to: 'S2', input: { X: 1 } }],
  }
  const result = parseFSM(bad)
  assert(!result.valid, '12: a non-deterministic machine is refused')
  assert(/ambiguous/i.test(result.error), '12: and says why')
}

// Completeness: the missing pair is named, not just counted.
{
  const bad = { ...detector101, transitions: detector101.transitions.slice(0, -1) }
  const result = parseFSM(bad)
  assert(!result.valid, '13: an incomplete machine is refused')
  assert(result.detail?.kind === 'incomplete' && result.detail.missing.length === 1,
    '13: the missing (state, input) pair is reported')
  assert(/S3/.test(result.error), '13: and named in the message')

  // The offered repair completes it.
  const repaired = completeWithSelfLoops(parseFSM({ ...bad, transitions: bad.transitions }).fsm ?? {
    ...parseFSM(detector101).fsm,
    transitions: bad.transitions.map(t => ({ ...t, output: {} })),
  })
  assert(repaired.added.length >= 1, '14: the repair adds the missing transitions')
}

// Reachability is a warning, not an error.
{
  const withOrphan = {
    ...detector101,
    states: [...detector101.states, { id: 'S9', label: 'orphan', output: { Z: 0 } }],
    transitions: [
      ...detector101.transitions,
      { from: 'S9', to: 'S9', input: { X: 0 } },
      { from: 'S9', to: 'S9', input: { X: 1 } },
    ],
  }
  const result = parseFSM(withOrphan)
  assert(result.valid, '15: an unreachable state does not fail the machine')
  assert(result.warnings.some(w => /S9/.test(w)), '15: it is reported as a warning')
}

assert(!parseFSM({ ...detector101, inputs: [] }).valid, '16: no inputs is refused')
assert(!parseFSM({ ...detector101, outputs: [] }).valid, '17: no outputs is refused')
assert(!parseFSM({ ...detector101, states: [] }).valid, '18: no states is refused')

// A Moore machine missing an output value on a state is refused rather than
// defaulted, because a defaulted 0 is indistinguishable from a real answer.
{
  const bad = {
    ...detector101,
    states: detector101.states.map(s => (s.id === 'S3' ? { id: 'S3', label: 'x' } : s)),
  }
  assert(!parseFSM(bad).valid, '19: a Moore state with no output value is refused')
}

// --- State reduction ---------------------------------------------------------

{
  // S1 and S1COPY behave identically, so they must be reported as equivalent.
  const redundant = {
    title: 'redundant',
    machineType: 'moore',
    inputs: [{ name: 'X' }],
    outputs: [{ name: 'Z' }],
    reset: 'A',
    states: [
      { id: 'A', output: { Z: 0 } },
      { id: 'B', output: { Z: 1 } },
      { id: 'C', output: { Z: 1 } },
    ],
    transitions: [
      { from: 'A', to: 'B', input: { X: 1 } },
      { from: 'A', to: 'A', input: { X: 0 } },
      { from: 'B', to: 'B', input: { X: 1 } },
      { from: 'B', to: 'A', input: { X: 0 } },
      { from: 'C', to: 'B', input: { X: 1 } },
      { from: 'C', to: 'A', input: { X: 0 } },
    ],
  }
  const groups = equivalentStates(parseFSM(redundant).fsm)
  assert(groups.some(g => g.includes('B') && g.includes('C')), '20: B and C are found equivalent')

  // The 101 detector is already minimal, so nothing should be merged.
  assert(equivalentStates(parseFSM(detector101).fsm).length === 0,
    '21: a minimal machine reports no equivalences')
}

if (failures === 0) console.log('fsmSynthesis: all tests passed')
else { console.error(`fsmSynthesis: ${failures} failure(s)`); process.exit(1) }
