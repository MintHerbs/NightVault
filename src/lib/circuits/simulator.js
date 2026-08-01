/**
 * Netlist simulator (T-089).
 *
 * Runs the same netlist shape circuitSynthesis.js produces and the sandbox
 * edits, so "Open in sandbox" needs no conversion and a synthesised circuit can
 * be simulated against the FSM it came from (phase 3's oracle test).
 *
 * Three decisions here are the ones that matter, and all three are places a
 * simpler implementation is quietly wrong:
 *
 * 1. **Values are three-valued.** An unwired input pin is `x`, not 0. Treating
 *    it as 0 makes a half-wired circuit look like it works, which is the exact
 *    bug the student is hunting.
 *
 * 2. **Flip-flops sample, then commit.** Every flip-flop reads its data pins
 *    against the settled values, and only then do all the Q outputs change
 *    together. Committing one at a time collapses a shift register to a single
 *    stage, because stage 2 sees stage 1's new value on the same edge.
 *
 * 3. **Settling is capped.** A ring oscillator or an SR latch released from
 *    S = R = 1 never reaches a fixed point. The loop stops and reports the
 *    unstable nets rather than freezing the tab.
 */

import { FLIP_FLOP_PINS, dataPins, isFlipFlop, nextState } from './flipFlops.js'
import { portOwners } from './circuitSynthesis.js'

// Enough for any circuit this tool can draw; small enough that hitting it is
// instant rather than a hang.
export const SETTLE_LIMIT = 100

export const UNKNOWN = 'x'

const COMBINATIONAL = new Set(['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor'])

/**
 * Applies a gate over three-valued inputs.
 *
 * The controlling value wins over unknown: an AND with a 0 input is 0 even if
 * every other input is floating, because no assignment to the unknowns can
 * change it. Returning `x` there would report far more of the circuit as
 * indeterminate than really is.
 */
export function applyGate(kind, args) {
  const has = (v) => args.some(a => a === v)
  const unknown = has(UNKNOWN)

  switch (kind) {
    case 'and': return has(0) ? 0 : unknown ? UNKNOWN : 1
    case 'nand': return has(0) ? 1 : unknown ? UNKNOWN : 0
    case 'or': return has(1) ? 1 : unknown ? UNKNOWN : 0
    case 'nor': return has(1) ? 0 : unknown ? UNKNOWN : 1
    case 'not': return args[0] === UNKNOWN ? UNKNOWN : (args[0] ? 0 : 1)
    case 'xor': return unknown ? UNKNOWN : (args.reduce((a, b) => a ^ b, 0) ? 1 : 0)
    case 'xnor': return unknown ? UNKNOWN : (args.reduce((a, b) => a ^ b, 0) ? 0 : 1)
    default: throw new Error(`Unknown gate "${kind}"`)
  }
}

/**
 * @param {import('./circuitSynthesis.js').Netlist} netlist
 * @returns {Simulation}
 */
export function createSimulation(netlist) {
  return new Simulation(netlist)
}

class Simulation {
  constructor(netlist) {
    this.netlist = netlist
    this.owners = portOwners(netlist)

    // Which output port drives each input pin. An input pin absent from this
    // map is unwired, and reads as unknown.
    this.driverOf = new Map()
    for (const wire of netlist.wires) this.driverOf.set(wire.to, wire.from)

    this.byId = new Map(netlist.components.map(c => [c.id, c]))
    this.flipFlops = netlist.components.filter(c => isFlipFlop(c.kind))
    this.clocks = netlist.components.filter(c => c.kind === 'clock')

    this.reset()
  }

  /** Back to power-on: every flip-flop at 0, every toggle input at 0. */
  reset() {
    this.values = new Map()
    this.state = new Map(this.flipFlops.map(c => [c.id, 0]))
    this.previousClock = new Map(this.flipFlops.map(c => [c.id, UNKNOWN]))
    this.invalid = new Set()
    this.unstable = []
    this.inputs = new Map()

    for (const component of this.netlist.components) {
      if (component.kind === 'input') this.inputs.set(component.id, 0)
      if (component.kind === 'clock') this.inputs.set(component.id, 0)
    }

    this.settle()

    // Seed the edge detector from the settled clock rather than leaving it
    // unknown. Left unknown, the first rising edge is not a 0 -> 1 transition
    // (it is x -> 1) and the whole first tick is silently swallowed: a shift
    // register stays empty for one press and then behaves, which reads as the
    // student having mis-wired something.
    for (const component of this.flipFlops) {
      const pins = FLIP_FLOP_PINS[component.kind]
      this.previousClock.set(component.id, this.pinValue(component.inputs[pins.length - 1]))
    }
  }

  setInput(componentId, value) {
    this.inputs.set(componentId, value ? 1 : 0)
    this.settle()
  }

  toggleInput(componentId) {
    this.setInput(componentId, this.inputs.get(componentId) ? 0 : 1)
  }

  getInput(componentId) {
    return this.inputs.get(componentId) ?? 0
  }

  /** Value on a port, or UNKNOWN if nothing drives it. */
  portValue(portId) {
    return this.values.get(portId) ?? UNKNOWN
  }

  /** Value a component's first output is presenting. */
  outputOf(componentId) {
    const component = this.byId.get(componentId)
    if (!component || component.outputs.length === 0) {
      // An output probe has no output port of its own; read what drives it.
      const pin = component?.inputs?.[0]
      return pin ? this.pinValue(pin) : UNKNOWN
    }
    return this.portValue(component.outputs[0])
  }

  pinValue(pinId) {
    const source = this.driverOf.get(pinId)
    return source === undefined ? UNKNOWN : this.portValue(source)
  }

  /**
   * Recomputes every source-driven output until nothing changes.
   *
   * Iterate-to-fixed-point rather than an event queue: the circuits this tool
   * draws are tens of gates, the passes are cheap, and a fixed-point loop makes
   * "did not converge" a first-class result instead of a queue that silently
   * never drains.
   */
  settle() {
    this.unstable = []

    for (let pass = 0; pass < SETTLE_LIMIT; pass += 1) {
      let changed = false

      for (const component of this.netlist.components) {
        const next = this.driveValue(component)
        if (next === null) continue

        const port = component.outputs[0]
        if (this.values.get(port) !== next) {
          this.values.set(port, next)
          changed = true
        }

        // Flip-flops present the complement on their second output.
        if (component.outputs[1]) {
          const inverse = next === UNKNOWN ? UNKNOWN : (next ? 0 : 1)
          if (this.values.get(component.outputs[1]) !== inverse) {
            this.values.set(component.outputs[1], inverse)
            changed = true
          }
        }
      }

      if (!changed) return { stable: true, unstable: [] }
    }

    // Did not converge. Report the gates still moving so the UI can point at
    // the loop rather than saying "something is wrong".
    this.unstable = this.netlist.components
      .filter(c => COMBINATIONAL.has(c.kind))
      .map(c => c.id)
    return { stable: false, unstable: this.unstable }
  }

  /** The value a component presents on its output, or null if it has none. */
  driveValue(component) {
    switch (component.kind) {
      case 'input':
      case 'clock':
        return this.inputs.get(component.id) ?? 0
      case 'const':
        return component.value
      case 'output':
        return null
      default:
        break
    }

    if (isFlipFlop(component.kind)) return this.state.get(component.id)
    if (!COMBINATIONAL.has(component.kind)) return null

    const args = component.inputs.map(pin => this.pinValue(pin))
    if (args.length === 0) return UNKNOWN
    return applyGate(component.kind, args)
  }

  /**
   * One full clock cycle: rising edge, then falling.
   *
   * A cycle rather than a single edge because that is what a student means by
   * "step". Edge-triggering is still real underneath: flip-flops fire on a
   * 0 -> 1 transition of whatever drives their own CLK pin, so a clock gated
   * through a gate behaves correctly instead of being special-cased.
   */
  tick() {
    this.phase(1)
    this.phase(0)
    return { invalid: [...this.invalid], unstable: this.unstable }
  }

  phase(level) {
    for (const clock of this.clocks) this.inputs.set(clock.id, level)
    this.settle()

    // Sample every flip-flop against the settled values BEFORE committing any
    // of them. This is the shift-register correctness point.
    const pending = []
    for (const component of this.flipFlops) {
      const pins = FLIP_FLOP_PINS[component.kind]
      const clockPin = component.inputs[pins.length - 1]
      const clockNow = this.pinValue(clockPin)
      const clockBefore = this.previousClock.get(component.id)

      const rising = clockBefore === 0 && clockNow === 1
      this.previousClock.set(component.id, clockNow)
      if (!rising) continue

      const inputs = {}
      dataPins(component.kind).forEach((pin, i) => {
        inputs[pin] = this.pinValue(component.inputs[i])
      })

      const current = this.state.get(component.id)
      const result = nextState(component.kind, current === UNKNOWN ? 0 : current, inputs)
      pending.push({ id: component.id, next: result.next, invalid: result.invalid })
    }

    for (const change of pending) {
      this.state.set(change.id, change.next)
      if (change.invalid) this.invalid.add(change.id)
      else this.invalid.delete(change.id)
    }

    this.settle()
  }

  /** A snapshot for the waveform panel: every pin worth plotting. */
  sample() {
    const row = {}
    for (const component of this.netlist.components) {
      if (component.kind === 'input' || component.kind === 'clock') {
        row[component.id] = this.inputs.get(component.id) ?? 0
      } else if (component.kind === 'output' || isFlipFlop(component.kind)) {
        row[component.id] = this.outputOf(component.id)
      }
    }
    return row
  }

  /** Components a waveform should show, in reading order. */
  traceable() {
    const order = { input: 0, clock: 1, dff: 2, tff: 2, jkff: 2, srff: 2, output: 3 }
    return this.netlist.components
      .filter(c => c.kind in order)
      .sort((a, b) => order[a.kind] - order[b.kind])
  }
}

/**
 * Runs a purely combinational netlist for one input assignment.
 *
 * Used by the FSM oracle and anywhere a circuit needs checking against a truth
 * table. Throws on a netlist with state, since "the value" is not well defined
 * there without a clock history.
 *
 * @param {import('./circuitSynthesis.js').Netlist} netlist
 * @param {Record<string, 0|1>} assignment - keyed by input component label
 * @returns {Record<string, 0|1|'x'>} keyed by output component label
 */
export function evaluateCombinational(netlist, assignment) {
  const simulation = createSimulation(netlist)

  for (const component of netlist.components) {
    if (component.kind !== 'input') continue
    const value = assignment[component.label]
    if (value === undefined) continue
    simulation.inputs.set(component.id, value ? 1 : 0)
  }

  const result = simulation.settle()
  if (!result.stable) throw new Error('netlist did not settle')

  const outputs = {}
  for (const component of netlist.components) {
    if (component.kind === 'output') outputs[component.label] = simulation.outputOf(component.id)
  }
  return outputs
}
