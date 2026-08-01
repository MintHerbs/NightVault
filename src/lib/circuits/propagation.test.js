/**
 * Propagation-plan tests (T-095).
 * Run with: npm run test:circuits
 *
 * The load-bearing claim is that this is *display only*: the animation must not
 * be able to change what the simulator reports. Test 5 asserts that directly by
 * settling the same netlist before and after building a plan.
 */

import { propagationPlan, sweepTiming, STEP_MS, MAX_SWEEP_MS } from './propagation.js'
import { createSimulation } from './simulator.js'
import { emptyDocument, addComponent, connect, toNetlist } from './sandboxModel.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

/** A -> NOT -> AND <- B, with a probe on the AND. */
function buildChain() {
  let doc = emptyDocument()
  doc = addComponent(doc, 'input', 20, 20)
  doc = addComponent(doc, 'input', 20, 120)
  doc = addComponent(doc, 'not', 140, 20)
  doc = addComponent(doc, 'and', 260, 60)
  doc = addComponent(doc, 'output', 400, 60)

  const [a, b, not, and, probe] = doc.components
  for (const [from, to] of [
    [a.outputs[0], not.inputs[0]],
    [not.outputs[0], and.inputs[0]],
    [b.outputs[0], and.inputs[1]],
    [and.outputs[0], probe.inputs[0]],
  ]) {
    const result = connect(doc, from, to)
    if (!result.ok) throw new Error(result.reason)
    doc = result.doc
  }
  return { doc, ids: { a, b, not, and, probe } }
}

// --- 1. Levels increase along the signal path -------------------------------

{
  const { doc, ids } = buildChain()
  const plan = propagationPlan(toNetlist(doc))
  const level = id => plan.componentLevel.get(id)

  assert(level(ids.a.id) === 0, '1: an input is level 0')
  assert(level(ids.b.id) === 0, '1: both inputs are level 0')
  assert(level(ids.not.id) === 1, '1: the inverter is one deeper than its source')
  assert(level(ids.and.id) === 2, '1: the AND takes the deeper of its two feeds')
  assert(level(ids.probe.id) === 3, '1: the probe is last')
  assert(plan.depth === 3, '1: depth is the deepest level')
}

// --- 2. Every wire inherits its driver's level ------------------------------

{
  const { doc } = buildChain()
  const netlist = toNetlist(doc)
  const plan = propagationPlan(netlist)

  assert(plan.wireLevel.size === netlist.wires.length, '2: every wire is in the plan')

  const ownerOf = new Map()
  for (const component of netlist.components) {
    for (const port of component.outputs) ownerOf.set(port, component.id)
  }
  for (const wire of netlist.wires) {
    const driverLevel = plan.componentLevel.get(ownerOf.get(wire.from))
    assert(plan.wireLevel.get(wire.id) === driverLevel, `2: ${wire.id} matches its driver`)
  }
}

// --- 3. A feedback loop terminates ------------------------------------------

{
  // Two NOTs wired head to tail. componentLevels breaks the cycle rather than
  // recursing forever; the plan must inherit that, or the sandbox hangs the tab
  // the moment a student draws a latch.
  let doc = emptyDocument()
  doc = addComponent(doc, 'not', 20, 20)
  doc = addComponent(doc, 'not', 160, 20)
  const [first, second] = doc.components
  doc = connect(doc, first.outputs[0], second.inputs[0]).doc
  doc = connect(doc, second.outputs[0], first.inputs[0]).doc

  const plan = propagationPlan(toNetlist(doc))
  assert(Number.isFinite(plan.depth), '3: a feedback loop yields a finite depth')
  assert(plan.wireLevel.size === 2, '3: both wires are still planned')
}

// --- 4. An empty document is not a special case -----------------------------

{
  const plan = propagationPlan(toNetlist(emptyDocument()))
  assert(plan.depth === 0, '4: an empty document has depth 0')
  assert(plan.wireLevel.size === 0, '4: and no wires')
}

// --- 5. The plan is display-only --------------------------------------------

{
  const { doc } = buildChain()
  const netlist = toNetlist(doc)

  const before = createSimulation(netlist)
  before.setInput(netlist.components[0].id, 1)
  const settledBefore = netlist.components.map(c => before.outputOf(c.id))

  propagationPlan(netlist)

  const after = createSimulation(netlist)
  after.setInput(netlist.components[0].id, 1)
  const settledAfter = netlist.components.map(c => after.outputOf(c.id))

  assert(
    JSON.stringify(settledBefore) === JSON.stringify(settledAfter),
    '5: building a plan does not change any settled value'
  )

  // And it does not mutate the netlist it was handed.
  const plan = propagationPlan(netlist)
  assert(plan.componentLevel.size === netlist.components.length, '5: every component planned')
  assert(
    netlist.components.every(c => Array.isArray(c.inputs) && Array.isArray(c.outputs)),
    '5: the netlist is intact afterwards'
  )
}

// --- 6. Deep circuits compress rather than crawl ----------------------------

{
  const shallow = sweepTiming(4)
  assert(shallow.stepMs === STEP_MS, '6: a shallow circuit uses the full step')
  assert(shallow.levelsPerStep === 1, '6: and advances one level at a time')
  assert(shallow.totalMs === 4 * STEP_MS, '6: running for depth * step')

  // The cap and the per-step floor conflict here. The sweep must honour both by
  // taking several levels per tick, not by shrinking the tick to a flicker.
  const deep = sweepTiming(400)
  assert(deep.totalMs <= MAX_SWEEP_MS, '6: a deep circuit stays under the cap')
  assert(deep.stepMs >= 30, '6: without dropping below a perceptible step')
  assert(deep.levelsPerStep > 1, '6: by advancing several levels per tick')
  assert(
    Math.ceil(400 / deep.levelsPerStep) * deep.stepMs === deep.totalMs,
    '6: and the reported total matches what it will actually take'
  )

  // Every depth from 1 to 1000 must satisfy both constraints, not just the two
  // sampled above.
  for (let depth = 1; depth <= 1000; depth += 1) {
    const timing = sweepTiming(depth)
    assert(timing.totalMs <= MAX_SWEEP_MS, `6: depth ${depth} stays under the cap`)
    assert(timing.stepMs >= 30, `6: depth ${depth} keeps a perceptible step`)
    assert(
      timing.levelsPerStep * Math.ceil(depth / timing.levelsPerStep) >= depth,
      `6: depth ${depth} is fully covered by its steps`
    )
  }

  const flat = sweepTiming(0)
  assert(flat.totalMs > 0, '6: a depth-0 circuit still has a duration')
  assert(Number.isFinite(flat.stepMs), '6: with a finite step')
}

if (failures > 0) {
  console.error(`propagation: ${failures} failure(s)`)
  process.exit(1)
}
console.log('propagation: all tests passed')
