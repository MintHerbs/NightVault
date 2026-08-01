/**
 * Sandbox robustness suite (T-092 follow-up).
 * Run with: npm run test:circuits
 *
 * Three separate jobs, because "the sandbox works" means three different
 * things:
 *
 *   1. **The model survives abuse.** Thousands of random edit sequences —
 *      place, wire, move, resize, delete, undo — with the document's invariants
 *      re-checked after every single operation. This is where a real editor
 *      breaks: not on the happy path but on the twentieth undo after deleting
 *      a component that a wire was still attached to.
 *
 *   2. **Combinational results are right.** Random gate DAGs evaluated by the
 *      simulator's iterate-to-fixed-point loop, compared against a reference
 *      that evaluates in topological order with its own restatement of the gate
 *      truth tables. Different algorithm, independently written tables — a bug
 *      in either shows up as a disagreement.
 *
 *   3. **Sequential results are right.** Random flip-flop networks clocked for
 *      many cycles against a reference stepper that samples every flip-flop
 *      before committing any. The sample-then-commit rule is the one thing a
 *      naive implementation gets wrong, and a shift register is the only shape
 *      that reveals it.
 *
 * Seeded throughout, so a failure is reproducible from the printed seed rather
 * than being a story about a run nobody can repeat.
 */

import {
  addComponent,
  allPortPositions,
  componentSize,
  connect,
  deserialize,
  documentWarnings,
  emptyDocument,
  moveComponent,
  nextFreePosition,
  removeComponent,
  removeWire,
  serialize,
  setConstValue,
  setGatePins,
  toNetlist,
  GRID,
} from './sandboxModel.js'
import { createSimulation } from './simulator.js'
import { propagationPlan } from './propagation.js'
import { FLIP_FLOP_PINS, isFlipFlop } from './flipFlops.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

/** Deterministic PRNG, so a failure comes with a seed that reproduces it. */
function rng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const pick = (random, list) => list[Math.floor(random() * list.length)]

// ---------------------------------------------------------------------------
// 1. Document invariants under random editing
// ---------------------------------------------------------------------------

const PLACEABLE = [
  'input', 'output', 'clock', 'const',
  'and', 'or', 'not', 'xor', 'nand', 'nor', 'xnor',
  'dff', 'tff', 'jkff', 'srff',
]

/**
 * Everything that must be true of a document at all times, whatever was just
 * done to it.
 */
function checkInvariants(doc, where) {
  const ids = new Set()
  const ports = new Set()

  for (const component of doc.components) {
    assert(!ids.has(component.id), `${where}: duplicate component id ${component.id}`)
    ids.add(component.id)

    assert(component.x % GRID === 0 && component.y % GRID === 0, `${where}: ${component.id} off grid`)
    assert(Number.isFinite(component.x) && Number.isFinite(component.y), `${where}: ${component.id} has no position`)

    for (const port of [...component.inputs, ...component.outputs]) {
      assert(!ports.has(port), `${where}: duplicate port ${port}`)
      ports.add(port)
    }

    // Geometry must agree with the port list, or the canvas draws pins where
    // nothing can be clicked.
    const size = componentSize(component)
    assert(size.width > 0 && size.height > 0, `${where}: ${component.id} has no size`)
  }

  const driven = new Set()
  for (const wire of doc.wires) {
    assert(ports.has(wire.from), `${where}: wire ${wire.id} leaves a port that does not exist`)
    assert(ports.has(wire.to), `${where}: wire ${wire.id} reaches a port that does not exist`)
    assert(!driven.has(wire.to), `${where}: ${wire.to} has two drivers`)
    driven.add(wire.to)
  }

  // Port positions must exist for every port, since the canvas indexes by them.
  const positions = allPortPositions(doc)
  for (const port of ports) {
    assert(positions.has(port), `${where}: no position for ${port}`)
  }

  // Nothing below may throw on a document the editor can actually produce.
  const netlist = toNetlist(doc)
  const simulation = createSimulation(netlist)
  simulation.settle()
  simulation.tick()
  documentWarnings(doc)

  const plan = propagationPlan(netlist)
  assert(Number.isFinite(plan.depth), `${where}: propagation depth is not finite`)

  // Round-trip. A document that cannot be reloaded is a document that is lost
  // the moment the tab reloads.
  const restored = deserialize(serialize(doc))
  assert(restored.ok, `${where}: does not round-trip (${restored.reason})`)
  if (restored.ok) {
    assert(
      restored.doc.components.length === doc.components.length
      && restored.doc.wires.length === doc.wires.length,
      `${where}: round-trip changed the document`
    )
  }
}

{
  const RUNS = 60
  const OPS = 40
  let edits = 0

  for (let seed = 1; seed <= RUNS; seed += 1) {
    const random = rng(seed * 7919)
    let doc = emptyDocument()
    const history = [doc]

    for (let step = 0; step < OPS; step += 1) {
      const roll = random()

      if (roll < 0.34 || doc.components.length < 2) {
        const kind = pick(random, PLACEABLE)
        const at = nextFreePosition(doc, kind)
        doc = addComponent(doc, kind, at.x, at.y, {})
      } else if (roll < 0.58) {
        // Wire two random ports. Most attempts are refused, which is the point:
        // a refusal must leave the document untouched.
        const outs = doc.components.flatMap(c => c.outputs)
        const ins = doc.components.flatMap(c => c.inputs)
        if (outs.length && ins.length) {
          const before = doc
          const result = connect(doc, pick(random, outs), pick(random, ins))
          if (result.ok) doc = result.doc
          else assert(doc === before, `seed ${seed}: a refused connect mutated the document`)
        }
      } else if (roll < 0.7) {
        const component = pick(random, doc.components)
        doc = moveComponent(doc, component.id, random() * 900, random() * 600)
      } else if (roll < 0.8) {
        const component = pick(random, doc.components)
        doc = setGatePins(doc, component.id, 2 + Math.floor(random() * 6))
      } else if (roll < 0.86) {
        const consts = doc.components.filter(c => c.kind === 'const')
        if (consts.length) doc = setConstValue(doc, pick(random, consts).id, random() < 0.5 ? 0 : 1)
      } else if (roll < 0.94) {
        const component = pick(random, doc.components)
        doc = removeComponent(doc, component.id)
      } else if (doc.wires.length) {
        doc = removeWire(doc, pick(random, doc.wires).id)
      }

      history.push(doc)
      edits += 1
      checkInvariants(doc, `seed ${seed} step ${step}`)
    }

    // Walk the whole history backwards, the way undo does. Every intermediate
    // document must still be valid — a stale snapshot referencing a deleted
    // component is exactly the bug undo stacks produce.
    for (let i = history.length - 1; i >= 0; i -= 1) {
      checkInvariants(history[i], `seed ${seed} undo to ${i}`)
    }

    // Undoing everything must land exactly on the empty document.
    assert(history[0].components.length === 0, `seed ${seed}: undo does not reach empty`)
  }

  console.log(`  ${RUNS} edit sequences, ${edits} operations, invariants checked after each`)
}

// ---------------------------------------------------------------------------
// 2. Combinational agreement with an independent reference
// ---------------------------------------------------------------------------

/**
 * Gate truth tables, restated. Deliberately not imported from simulator.js —
 * if both sides share the table, the comparison only tests the plumbing.
 */
function refGate(kind, args) {
  const ones = args.filter(v => v === 1).length
  switch (kind) {
    case 'and': return args.every(v => v === 1) ? 1 : 0
    case 'nand': return args.every(v => v === 1) ? 0 : 1
    case 'or': return args.some(v => v === 1) ? 1 : 0
    case 'nor': return args.some(v => v === 1) ? 0 : 1
    case 'not': return args[0] === 1 ? 0 : 1
    case 'xor': return ones % 2 === 1 ? 1 : 0
    case 'xnor': return ones % 2 === 1 ? 0 : 1
    default: throw new Error(`reference has no gate "${kind}"`)
  }
}

/**
 * Evaluate a fully-driven netlist in topological order.
 *
 * The simulator iterates to a fixed point; this walks the DAG once. Two
 * different strategies reaching the same answer is the assurance.
 */
function referenceEvaluate(netlist, { inputs, state = new Map() }) {
  const ownerOf = new Map()
  for (const component of netlist.components) {
    for (const port of component.outputs) ownerOf.set(port, component)
  }
  const driverOf = new Map(netlist.wires.map(w => [w.to, w.from]))
  const value = new Map()

  const settle = (component) => {
    if (component.kind === 'input' || component.kind === 'clock') {
      value.set(component.outputs[0], inputs.get(component.id) ?? 0)
      return true
    }
    if (component.kind === 'const') {
      value.set(component.outputs[0], component.value)
      return true
    }
    if (isFlipFlop(component.kind)) {
      const q = state.get(component.id) ?? 0
      value.set(component.outputs[0], q)
      value.set(component.outputs[1], q ? 0 : 1)
      return true
    }
    if (component.kind === 'output') return true

    const args = component.inputs.map(pin => value.get(driverOf.get(pin)))
    if (args.some(v => v === undefined)) return false
    value.set(component.outputs[0], refGate(component.kind, args))
    return true
  }

  // Repeatedly settle whatever is ready. Terminates because the generated
  // circuits are acyclic through their gates.
  const pending = [...netlist.components]
  let guard = pending.length + 2
  while (pending.length > 0 && guard > 0) {
    guard -= 1
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      if (settle(pending[i])) pending.splice(i, 1)
    }
  }
  return { value, driverOf, ownerOf, unresolved: pending.length }
}

/** A random, fully-wired combinational circuit. */
function buildCombinational(random, { inputCount, gateCount }) {
  let doc = emptyDocument()
  const pool = []

  for (let i = 0; i < inputCount; i += 1) {
    doc = addComponent(doc, 'input', 0, i * GRID * 3)
    pool.push(doc.components[doc.components.length - 1].outputs[0])
  }

  const kinds = ['and', 'or', 'not', 'xor', 'nand', 'nor', 'xnor']
  for (let g = 0; g < gateCount; g += 1) {
    const kind = pick(random, kinds)
    const pins = kind === 'not' ? 1 : 2 + Math.floor(random() * 3)
    doc = addComponent(doc, kind, 0, 0, { pins })
    const gate = doc.components[doc.components.length - 1]

    for (const pin of gate.inputs) {
      const result = connect(doc, pick(random, pool), pin)
      if (result.ok) doc = result.doc
    }
    pool.push(gate.outputs[0])
  }

  // One probe on the last gate, so `output` components are exercised too.
  doc = addComponent(doc, 'output', 0, 0)
  const probe = doc.components[doc.components.length - 1]
  const wired = connect(doc, pool[pool.length - 1], probe.inputs[0])
  if (wired.ok) doc = wired.doc

  return doc
}

{
  const CIRCUITS = 220
  const VECTORS = 12
  let checks = 0

  for (let seed = 1; seed <= CIRCUITS; seed += 1) {
    const random = rng(seed * 2654435761)
    const inputCount = 2 + Math.floor(random() * 4)
    const doc = buildCombinational(random, { inputCount, gateCount: 3 + Math.floor(random() * 8) })
    const netlist = toNetlist(doc)
    const inputComponents = netlist.components.filter(c => c.kind === 'input')

    for (let v = 0; v < VECTORS; v += 1) {
      const assignment = new Map()
      for (const component of inputComponents) {
        assignment.set(component.id, random() < 0.5 ? 0 : 1)
      }

      const simulation = createSimulation(netlist)
      for (const [id, bit] of assignment) simulation.inputs.set(id, bit)
      const settled = simulation.settle()
      assert(settled.stable, `seed ${seed}: an acyclic circuit failed to settle`)

      const reference = referenceEvaluate(netlist, { inputs: assignment })
      assert(reference.unresolved === 0, `seed ${seed}: the reference could not resolve every gate`)

      for (const component of netlist.components) {
        if (component.outputs.length === 0) continue
        const port = component.outputs[0]
        const expected = reference.value.get(port)
        if (expected === undefined) continue
        assert(
          simulation.portValue(port) === expected,
          `seed ${seed} vector ${v}: ${component.kind} ${component.id} = ${simulation.portValue(port)}, reference says ${expected}`
        )
        checks += 1
      }

      // The probe must read what drives it, not its own (absent) output.
      for (const component of netlist.components) {
        if (component.kind !== 'output') continue
        const driver = reference.driverOf.get(component.inputs[0])
        if (driver === undefined) continue
        assert(
          simulation.outputOf(component.id) === reference.value.get(driver),
          `seed ${seed} vector ${v}: probe disagrees with its driver`
        )
      }
    }
  }

  console.log(`  ${CIRCUITS} combinational circuits x ${VECTORS} vectors, ${checks} port comparisons`)
}

// ---------------------------------------------------------------------------
// 3. Sequential agreement
// ---------------------------------------------------------------------------

/** Next state, restated independently of flipFlops.js. */
function refNextState(kind, q, data) {
  switch (kind) {
    case 'dff': return data[0]
    case 'tff': return data[0] === 1 ? (q ? 0 : 1) : q
    case 'jkff': {
      const [j, k] = data
      if (j === 0 && k === 0) return q
      if (j === 0) return 0
      if (k === 0) return 1
      return q ? 0 : 1
    }
    case 'srff': {
      const [s, r] = data
      if (s === 1 && r === 1) return q      // forbidden: held, never invented
      if (s === 0 && r === 0) return q
      return s === 1 ? 1 : 0
    }
    default: throw new Error(`reference has no flip-flop "${kind}"`)
  }
}

/**
 * A clock, some inputs, some flip-flops, and combinational logic feeding the
 * flip-flop data pins from both. Every pin is driven.
 */
function buildSequential(random, { inputCount, ffCount, gateCount }) {
  let doc = emptyDocument()

  doc = addComponent(doc, 'clock', 0, 0)
  const clock = doc.components[0]

  const pool = []
  for (let i = 0; i < inputCount; i += 1) {
    doc = addComponent(doc, 'input', 0, 0)
    pool.push(doc.components[doc.components.length - 1].outputs[0])
  }

  const flipFlops = []
  for (let i = 0; i < ffCount; i += 1) {
    const kind = pick(random, ['dff', 'tff', 'jkff', 'srff'])
    doc = addComponent(doc, kind, 0, 0)
    const ff = doc.components[doc.components.length - 1]
    flipFlops.push(ff)
    // Both Q and Q' join the pool: feedback through the combinational logic is
    // the normal shape of a state machine.
    pool.push(ff.outputs[0], ff.outputs[1])
  }

  const kinds = ['and', 'or', 'not', 'xor', 'nand', 'nor', 'xnor']
  for (let g = 0; g < gateCount; g += 1) {
    const kind = pick(random, kinds)
    const pins = kind === 'not' ? 1 : 2
    doc = addComponent(doc, kind, 0, 0, { pins })
    const gate = doc.components[doc.components.length - 1]
    for (const pin of gate.inputs) {
      const result = connect(doc, pick(random, pool), pin)
      if (result.ok) doc = result.doc
    }
    pool.push(gate.outputs[0])
  }

  // Drive every flip-flop: data pins from the pool, clock from the clock.
  for (const ff of flipFlops) {
    const pins = FLIP_FLOP_PINS[ff.kind]
    for (let i = 0; i < pins.length - 1; i += 1) {
      const result = connect(doc, pick(random, pool), ff.inputs[i])
      if (result.ok) doc = result.doc
    }
    const clocked = connect(doc, clock.outputs[0], ff.inputs[pins.length - 1])
    if (clocked.ok) doc = clocked.doc
  }

  return { doc, clockId: clock.id }
}

{
  const CIRCUITS = 120
  const CYCLES = 24
  let comparisons = 0
  let sawFeedback = 0

  for (let seed = 1; seed <= CIRCUITS; seed += 1) {
    const random = rng(seed * 40503 + 17)
    const { doc, clockId } = buildSequential(random, {
      inputCount: 1 + Math.floor(random() * 3),
      ffCount: 1 + Math.floor(random() * 4),
      gateCount: 2 + Math.floor(random() * 5),
    })

    const netlist = toNetlist(doc)
    const inputComponents = netlist.components.filter(c => c.kind === 'input')
    const flipFlops = netlist.components.filter(c => isFlipFlop(c.kind))
    if (flipFlops.length === 0) continue

    // Every flip-flop's data pin must actually be driven, or the circuit goes
    // unknown and there is nothing to compare.
    const driven = new Set(netlist.wires.map(w => w.to))
    const fullyDriven = netlist.components.every(c => c.inputs.every(pin => driven.has(pin)))
    if (!fullyDriven) continue

    const simulation = createSimulation(netlist)
    const state = new Map(flipFlops.map(c => [c.id, 0]))
    const assignment = new Map()
    for (const component of inputComponents) assignment.set(component.id, 0)
    // The clock's own value is driven by tick(); the reference holds it high
    // while sampling, which is the moment an edge-triggered part reads its pins.
    assignment.set(clockId, 1)

    for (let cycle = 0; cycle < CYCLES; cycle += 1) {
      // Flip an input every few cycles so the machine is actually exercised.
      if (cycle % 3 === 0 && inputComponents.length > 0) {
        const target = pick(random, inputComponents)
        const next = assignment.get(target.id) ? 0 : 1
        assignment.set(target.id, next)
        simulation.setInput(target.id, next)
      }

      // Reference: settle the combinational logic against the CURRENT state,
      // sample every flip-flop, then commit all of them at once.
      const reference = referenceEvaluate(netlist, { inputs: assignment, state })
      if (reference.unresolved > 0) break // a combinational loop; not this test's subject

      const pending = []
      for (const ff of flipFlops) {
        const pins = FLIP_FLOP_PINS[ff.kind]
        const data = []
        for (let i = 0; i < pins.length - 1; i += 1) {
          data.push(reference.value.get(reference.driverOf.get(ff.inputs[i])))
        }
        if (data.some(v => v === undefined)) { data.length = 0; break }
        pending.push({ id: ff.id, next: refNextState(ff.kind, state.get(ff.id), data) })
      }
      if (pending.length !== flipFlops.length) break

      for (const change of pending) {
        if (change.next !== state.get(change.id)) sawFeedback += 1
        state.set(change.id, change.next)
      }

      simulation.tick()

      for (const ff of flipFlops) {
        assert(
          simulation.outputOf(ff.id) === state.get(ff.id),
          `seed ${seed} cycle ${cycle}: ${ff.kind} ${ff.id} = ${simulation.outputOf(ff.id)}, reference says ${state.get(ff.id)}`
        )
        // Q' must always be the complement of Q, on every kind, every cycle.
        assert(
          simulation.portValue(ff.outputs[1]) === (state.get(ff.id) ? 0 : 1),
          `seed ${seed} cycle ${cycle}: ${ff.id} Q' is not the complement of Q`
        )
        comparisons += 1
      }
    }
  }

  assert(sawFeedback > 100, `sequential circuits barely changed state (${sawFeedback} transitions) — the test is not exercising anything`)
  console.log(`  ${CIRCUITS} sequential circuits x ${CYCLES} cycles, ${comparisons} flip-flop comparisons, ${sawFeedback} state changes`)
}

// ---------------------------------------------------------------------------
// 4. The refusals the editor depends on
// ---------------------------------------------------------------------------

{
  let doc = emptyDocument()
  doc = addComponent(doc, 'input', 0, 0)
  doc = addComponent(doc, 'and', 200, 0)
  const [input, gate] = doc.components

  const first = connect(doc, input.outputs[0], gate.inputs[0])
  assert(first.ok, '4: a valid connection is accepted')
  doc = first.doc

  assert(!connect(doc, input.outputs[0], gate.inputs[0]).ok, '4: a second driver on one pin is refused')
  assert(!connect(doc, gate.inputs[0], input.outputs[0]).ok, '4: input-to-output is refused')
  assert(!connect(doc, gate.outputs[0], gate.inputs[1]).ok, '4: a component driving itself is refused')
  assert(!connect(doc, 'nope.out', gate.inputs[1]).ok, '4: a port that does not exist is refused')

  // Deleting a component takes its wires with it, or the document is left with
  // a wire to nowhere and the canvas throws on the next paint.
  const pruned = removeComponent(doc, input.id)
  assert(pruned.wires.length === 0, '4: deleting a component removes its wires')
  checkInvariants(pruned, '4: after deletion')

  // A hand-edited file that shorts two outputs together is rejected, not
  // loaded and then simulated into nonsense.
  const shorted = JSON.parse(serialize(doc))
  shorted.components.push({
    id: 'input_9', kind: 'input', label: 'Z', inputs: [], outputs: ['input_9.out'], x: 0, y: 0,
  })
  shorted.wires.push({ id: 'w_9', from: 'input_9.out', to: gate.inputs[0] })
  assert(!deserialize(JSON.stringify(shorted)).ok, '4: a shorted file is refused')

  assert(!deserialize('not json').ok, '4: junk is refused')
  assert(!deserialize('{"components":[],"wires":[]}').ok, '4: a version-less file is refused')
}

// ---------------------------------------------------------------------------
// 5. A circuit that cannot settle is reported, not hung
// ---------------------------------------------------------------------------

{
  // Two things have to be right for this fixture to mean anything, and both are
  // easy to get wrong:
  //
  //   * The loop needs an ODD number of inversions. NAND + one NOT is a latch,
  //     not an oscillator — two inversions compose to the identity.
  //   * The loop has to be *forced* to definite values first. Under
  //     three-valued semantics NOT(x) is x, so an untouched ring settles at
  //     all-unknown quite legitimately. Holding the enable low makes the NAND
  //     emit 1 regardless of the unknown, which fills the loop; raising it
  //     turns the NAND into the third inverter of a ring that cannot settle.
  let doc = emptyDocument()
  doc = addComponent(doc, 'input', 0, 0)
  doc = addComponent(doc, 'nand', 200, 0)
  doc = addComponent(doc, 'not', 400, 0)
  doc = addComponent(doc, 'not', 600, 0)
  const [enable, nand, first, second] = doc.components

  doc = connect(doc, enable.outputs[0], nand.inputs[0]).doc
  doc = connect(doc, second.outputs[0], nand.inputs[1]).doc
  doc = connect(doc, nand.outputs[0], first.inputs[0]).doc
  doc = connect(doc, first.outputs[0], second.inputs[0]).doc

  const simulation = createSimulation(toNetlist(doc))
  assert(simulation.settle().stable, '5: held low, the ring settles')

  const started = Date.now()
  simulation.inputs.set(enable.id, 1)
  const result = simulation.settle()
  assert(Date.now() - started < 2000, '5: an oscillator does not hang')
  assert(!result.stable, '5: released, the odd ring is reported unstable')
  assert(result.unstable.length > 0, '5: and names the gates still moving')

  // The editor must still be able to work on it.
  checkInvariants(doc, '5: oscillator document')
}

if (failures > 0) {
  console.error(`sandboxRobustness: ${failures} failure(s)`)
  process.exit(1)
}
console.log('sandboxRobustness: all tests passed')
