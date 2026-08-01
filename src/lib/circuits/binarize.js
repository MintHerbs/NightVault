/**
 * Two-input gates (T-093).
 *
 * The course teaches AND, OR, NAND, NOR, XOR and XNOR as two-input gates. The
 * synthesiser does not: a product term with four literals becomes one AND with
 * four pins, because that is the direct reading of the algebra. Correct, and not
 * the picture the student is being examined on.
 *
 * This rewrites any wider gate into a cascade of two-input ones. Pure: a netlist
 * in, an equivalent netlist out, no coordinates and no React. The equivalence is
 * the whole contract, and it is checked in binarize.test.js by running both
 * netlists over the full truth table rather than by inspecting the shape.
 *
 * ## Keeping a universal circuit universal
 *
 * The naive cascade for NAND(a, b, c) is NAND(AND(a, b), c) — which puts an AND
 * gate into a circuit whose entire point was that it contains nothing but
 * NANDs. So when the netlist is already single-kind (the "NAND only" / "NOR
 * only" styles the Circuit stage offers), the cascade is built from that kind
 * alone, using the standard identities:
 *
 *   AND(a, b) = NOT(NAND(a, b)) = NAND(NAND(a, b), NAND(a, b))
 *   OR(a, b)  = NOT(NOR(a, b))  = NOR(NOR(a, b), NOR(a, b))
 *
 * Two gates instead of one per stage, which is the price of the style.
 */

/** Gates this pass can widen or narrow. Everything else passes through. */
const ASSOCIATIVE = new Set(['and', 'or', 'nand', 'nor', 'xor', 'xnor'])

/** The associative core of each gate: what the cascade stages are made of. */
const CORE = { and: 'and', nand: 'and', or: 'or', nor: 'or', xor: 'xor', xnor: 'xor' }

/** The one-kind circuits worth preserving, and how each builds its core. */
const UNIVERSAL = { nand: 'and', nor: 'or' }

/**
 * @param {import('./circuitSynthesis.js').Netlist} netlist
 * @returns {import('./circuitSynthesis.js').Netlist} an equivalent netlist in
 *   which no gate has more than two inputs
 */
export function binarize(netlist) {
  if (maxFanIn(netlist) <= 2) return netlist

  const universal = soleGateKind(netlist)
  const components = []
  const wires = netlist.wires.map(w => ({ ...w }))

  // Where each original input pin ends up. Only pins that move get an entry.
  const rerouted = new Map()
  let serial = 0

  for (const component of netlist.components) {
    if (!ASSOCIATIVE.has(component.kind) || component.inputs.length <= 2) {
      components.push({ ...component })
      continue
    }

    const source = component.inputs
    const last = source[source.length - 1]

    // Everything but the final input folds into a cascade of the core
    // operation; the original component then applies itself to that result and
    // the final input, so its id, label and **output** port survive untouched
    // and no downstream wire has to be rewritten.
    const fold = universal
      ? universalFolder(component.id, universal, () => (serial += 1))
      : plainFolder(component.id, CORE[component.kind], () => (serial += 1))

    let carried = null
    for (let i = 0; i < source.length - 1; i += 1) {
      if (carried === null) { carried = { pin: source[i] }; continue }
      carried = { port: fold(carried, source[i]) }
    }

    // Fresh pin ids for the two that survive. Reusing `in0`/`in1` would put the
    // same id on both sides of the reroute map — the original `in0` has already
    // been moved onto the first cascade gate — and the internal wire feeding the
    // narrowed gate would then be rewritten straight back out to it.
    const kept = [`${component.id}.bin0`, `${component.id}.bin1`]
    components.push({ ...component, inputs: kept })
    rerouted.set(last, kept[1])
    wires.push({ id: `${component.id}_bw`, from: carried.port, to: kept[0] })
  }

  // Apply every pin move at once, so a wire is never rewritten twice.
  for (const wire of wires) {
    const moved = rerouted.get(wire.to)
    if (moved) wire.to = moved
  }

  return { ...netlist, components, wires }

  /**
   * Builds one cascade stage of `kind` and returns its output port. Operands
   * are either an original input pin (which gets rerouted onto the new gate) or
   * an earlier stage's output port (which gets a fresh internal wire).
   */
  function stageFor(id, kind, a, b) {
    const gate = {
      id,
      kind,
      label: null,
      inputs: [`${id}.in0`, `${id}.in1`],
      outputs: [`${id}.out`],
    }
    components.push(gate)
    attach(a, gate.inputs[0])
    attach(b, gate.inputs[1])
    return gate.outputs[0]
  }

  function attach(operand, pin) {
    if (typeof operand === 'string') { rerouted.set(operand, pin); return }
    if (operand.pin !== undefined) { rerouted.set(operand.pin, pin); return }
    wires.push({ id: `${pin}_w`, from: operand.port, to: pin })
  }

  function plainFolder(baseId, kind, next) {
    return (carried, pin) => stageFor(`${baseId}_b${next()}`, kind, carried, pin)
  }

  /**
   * The universal version: one core stage costs two gates of the single kind,
   * the second of which is that kind used as an inverter.
   */
  function universalFolder(baseId, kind, next) {
    return (carried, pin) => {
      const raw = stageFor(`${baseId}_b${next()}`, kind, carried, pin)
      const inverterId = `${baseId}_b${next()}`
      return stageFor(inverterId, kind, { port: raw }, { port: raw })
    }
  }
}

/** The widest gate in a netlist. */
export function maxFanIn(netlist) {
  let widest = 0
  for (const component of netlist.components) {
    if (!ASSOCIATIVE.has(component.kind)) continue
    widest = Math.max(widest, component.inputs.length)
  }
  return widest
}

/**
 * The kind, if every gate in the netlist is the same universal one.
 *
 * Detected rather than passed in: "this is a NAND-only circuit" is a property of
 * the netlist, and threading a style flag down from the page would let the flag
 * and the netlist disagree.
 *
 * @returns {'nand'|'nor'|null}
 */
export function soleGateKind(netlist) {
  const kinds = new Set(
    netlist.components.filter(c => ASSOCIATIVE.has(c.kind)).map(c => c.kind)
  )
  if (kinds.size !== 1) return null
  const [only] = kinds
  return only in UNIVERSAL ? only : null
}
