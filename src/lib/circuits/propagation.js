/**
 * Propagation ordering for the sandbox's current animation (T-092).
 *
 * The simulator settles to a fixed point with no notion of time
 * (simulator.js:settle), which is right: its values must be correct, not
 * gradual. So this module does not touch it. It answers a purely geometric
 * question — *in what order would a signal reach each wire* — and the canvas
 * uses that to stagger a travelling pulse.
 *
 * That separation is the important part. The animation is a display overlay
 * over already-correct values; it never gates, delays or alters what the
 * simulator reports. A student who ignores the animation entirely sees exactly
 * the same numbers.
 */

import { componentLevels } from './circuitSynthesis.js'

/** Per-level delay when the circuit is shallow enough to afford it. */
export const STEP_MS = 110

/** No sweep runs longer than this, however deep the circuit. */
export const MAX_SWEEP_MS = 1400

/** Below this a sweep is imperceptible, so it is not worth staggering. */
const MIN_STEP_MS = 30

/**
 * @typedef {Object} PropagationPlan
 * @property {Map<string, number>} componentLevel - id → depth from the inputs
 * @property {Map<string, number>} wireLevel - wire id → depth of its driver
 * @property {number} depth - the deepest level present
 */

/**
 * @param {import('./circuitSynthesis.js').Netlist} netlist
 * @returns {PropagationPlan}
 */
export function propagationPlan(netlist) {
  const componentLevel = componentLevels(netlist)

  const ownerOf = new Map()
  for (const component of netlist.components) {
    for (const port of component.outputs) ownerOf.set(port, component.id)
  }

  const wireLevel = new Map()
  for (const wire of netlist.wires) {
    const driver = ownerOf.get(wire.from)
    // A wire whose driver is unknown (a half-deleted document mid-edit) is
    // treated as coming straight off an input rather than dropped, so it still
    // animates instead of silently sitting out the sweep.
    wireLevel.set(wire.id, driver === undefined ? 0 : (componentLevel.get(driver) ?? 0))
  }

  let depth = 0
  for (const level of componentLevel.values()) depth = Math.max(depth, level)

  return { componentLevel, wireLevel, depth }
}

/**
 * How fast the wavefront advances.
 *
 * A deep circuit compresses rather than running for seconds: the point is to
 * show the *order*, and past a second or so the student is waiting rather than
 * watching.
 *
 * The cap and the per-step floor pull against each other — a 400-level circuit
 * cannot have both 30ms steps and a 1.4s total if it advances one level at a
 * time. It advances several levels per tick instead, so the ticks stay
 * perceptible and the sweep still finishes on time. Shrinking the step below
 * the floor to satisfy both would have produced 3ms ticks, which is not an
 * animation, it is a flicker.
 *
 * @param {number} depth
 * @returns {{stepMs: number, levelsPerStep: number, totalMs: number}}
 */
export function sweepTiming(depth) {
  if (depth <= 0) return { stepMs: STEP_MS, levelsPerStep: 1, totalMs: STEP_MS }

  const maxSteps = Math.max(1, Math.floor(MAX_SWEEP_MS / MIN_STEP_MS))
  const levelsPerStep = Math.max(1, Math.ceil(depth / maxSteps))
  const steps = Math.ceil(depth / levelsPerStep)
  const stepMs = Math.max(MIN_STEP_MS, Math.min(STEP_MS, Math.floor(MAX_SWEEP_MS / steps)))

  return { stepMs, levelsPerStep, totalMs: steps * stepMs }
}
