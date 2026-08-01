/**
 * Gate-level synthesis from a minimised cover (T-089).
 *
 * Produces the same netlist shape the sandbox edits and serialises, so "Open in
 * sandbox" is a handoff with no conversion layer. Nothing here knows about
 * geometry: circuitLayout.js places it, and the sandbox will place it its own
 * way once the student starts dragging.
 *
 * Port ids are `<componentId>.in<n>` / `<componentId>.out`, which keeps a wire
 * self-describing and means the netlist survives a JSON round trip without a
 * separate port table.
 */

/**
 * @typedef {Object} Component
 * @property {string} id
 * @property {'input'|'output'|'const'|'and'|'or'|'not'|'nand'|'nor'|'xor'|'xnor'} kind
 * @property {string|null} label
 * @property {string[]} inputs   port ids
 * @property {string[]} outputs  port ids
 * @property {0|1} [value]       const only
 */

/**
 * @typedef {Object} Netlist
 * @property {Component[]} components
 * @property {Array<{id: string, from: string, to: string}>} wires
 * @property {string[]} inputNames
 * @property {string[]} outputNames
 */

const GATE_KINDS = new Set(['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor'])

export const isGate = (component) => GATE_KINDS.has(component.kind)

class Builder {
  constructor() {
    this.components = []
    this.wires = []
    this.counters = {}
  }

  add(kind, { label = null, inputCount = 0, id, value } = {}) {
    const nextId = id ?? this.nextId(kind)
    const component = {
      id: nextId,
      kind,
      label,
      inputs: Array.from({ length: inputCount }, (_, i) => `${nextId}.in${i}`),
      outputs: kind === 'output' ? [] : [`${nextId}.out`],
    }
    if (value !== undefined) component.value = value
    this.components.push(component)
    return component
  }

  nextId(kind) {
    this.counters[kind] = (this.counters[kind] ?? 0) + 1
    return `${kind}${this.counters[kind]}`
  }

  connect(fromPort, toPort) {
    this.wires.push({ id: `w${this.wires.length}`, from: fromPort, to: toPort })
  }

  build(inputNames, outputNames) {
    return { components: this.components, wires: this.wires, inputNames, outputNames }
  }
}

/**
 * Builds a two-level circuit from a minimised cover.
 *
 * @param {import('./quineMcCluskey.js').Solution} solution
 * @param {{coverIndex?: number, style?: 'basic'|'universal', outputName?: string}} [options]
 *   style 'universal' means NAND-only for SOP and NOR-only for POS, which is the
 *   standard "implement using only NAND gates" exam instruction.
 * @returns {Netlist}
 */
export function synthesize(solution, { coverIndex = 0, style = 'basic', outputName = 'F' } = {}) {
  const { vars, form } = solution
  const cover = solution.covers[coverIndex] ?? solution.covers[0]
  const builder = new Builder()

  const outputPin = { id: `out_${outputName}`, kind: 'output' }
  const out = builder.add('output', { label: outputName, inputCount: 1, id: outputPin.id })

  // A constant function has no inputs to speak of, but the variables still
  // belong on the diagram: the student asked about F(A,B,C), and drawing a bare
  // "0" with no pins looks like the tool lost their question.
  const inputs = new Map()
  for (const name of vars) {
    inputs.set(name, builder.add('input', { label: name, id: `in_${name}` }))
  }

  const constantValue = constantOf(solution, cover)
  if (constantValue !== null) {
    const konst = builder.add('const', { label: String(constantValue), value: constantValue })
    builder.connect(konst.outputs[0], out.inputs[0])
    return builder.build(vars, [outputName])
  }

  // One inverter per complemented variable, shared by every term that needs it.
  // Emitting one per literal is the other obvious choice and it inflates the
  // gate count students are asked to report.
  const inverters = new Map()
  const literalPort = (literal) => {
    const source = inputs.get(literal.name)
    if (!literal.negated) return source.outputs[0]
    if (!inverters.has(literal.name)) {
      const inv = builder.add('not', { inputCount: 1, id: `not_${literal.name}` })
      builder.connect(source.outputs[0], inv.inputs[0])
      inverters.set(literal.name, inv)
    }
    return inverters.get(literal.name).outputs[0]
  }

  const universal = style === 'universal'
  // SOP is AND-then-OR and its universal form is NAND-NAND. POS is OR-then-AND
  // and its universal form is NOR-NOR. Both work because the two inversions
  // introduced by the substitution cancel.
  const termKind = universal ? (form === 'pos' ? 'nor' : 'nand') : (form === 'pos' ? 'or' : 'and')
  const joinKind = universal ? (form === 'pos' ? 'nor' : 'nand') : (form === 'pos' ? 'and' : 'or')

  const termOutputs = []
  for (const implicant of cover.implicants) {
    const literals = literalsOf(implicant, vars, form)
    const ports = literals.map(literalPort)

    // In basic style a single-literal term needs no gate: wire it straight to
    // the second level. In universal style it still needs its own NAND, because
    // the inversion that gate contributes is what the final NAND cancels. Skip
    // it and the output comes out complemented.
    if (ports.length === 1 && !universal) {
      termOutputs.push(ports[0])
      continue
    }

    const gate = builder.add(termKind, { label: termText(literals, form), inputCount: ports.length })
    ports.forEach((port, i) => builder.connect(port, gate.inputs[i]))
    termOutputs.push(gate.outputs[0])
  }

  // A lone term needs no second level in basic style. In universal style it
  // still does: the first NAND inverted the product, and only the second NAND
  // cancels that. Dropping it because "there is nothing to OR together" yields
  // the complement of the function.
  if (termOutputs.length === 1 && !universal) {
    builder.connect(termOutputs[0], out.inputs[0])
    return builder.build(vars, [outputName])
  }

  const join = builder.add(joinKind, { inputCount: termOutputs.length })
  termOutputs.forEach((port, i) => builder.connect(port, join.inputs[i]))
  builder.connect(join.outputs[0], out.inputs[0])

  return builder.build(vars, [outputName])
}

/** 0, 1, or null when the function is not constant. */
function constantOf(solution, cover) {
  const { form } = solution
  if (!cover || cover.implicants.length === 0) return form === 'pos' ? 1 : 0
  if (cover.implicants.some(pi => pi.literals === 0)) return form === 'pos' ? 0 : 1
  return null
}

/**
 * Literals of one implicant, with the POS sense inversion applied.
 * Kept here rather than imported from quineMcCluskey so the netlist does not
 * depend on that module's display formatting.
 */
function literalsOf(implicant, vars, form) {
  const width = vars.length
  const out = []
  for (let k = 0; k < width; k += 1) {
    const bit = width - 1 - k
    if (implicant.mask & (1 << bit)) continue
    const isOne = ((implicant.value >> bit) & 1) === 1
    out.push({ name: vars[k], negated: form === 'pos' ? isOne : !isOne })
  }
  return out
}

function termText(literals, form) {
  const parts = literals.map(l => l.name + (l.negated ? "'" : ''))
  return form === 'pos' ? parts.join(' + ') : parts.join('')
}

/**
 * Gate tally for the summary line, since "how many gates" is usually part of
 * the marked answer.
 *
 * `inputs` counts gate input pins, which is the other figure courses ask for
 * (gate-input cost). Inverters are reported separately because most mark
 * schemes treat them as free or as a separate column.
 *
 * @param {Netlist} netlist
 */
export function gateSummary(netlist) {
  const counts = {}
  let gates = 0
  let inverters = 0
  let pins = 0

  for (const component of netlist.components) {
    if (!isGate(component)) continue
    counts[component.kind] = (counts[component.kind] ?? 0) + 1
    pins += component.inputs.length
    if (component.kind === 'not') inverters += 1
    else gates += 1
  }

  return { counts, gates, inverters, pins, total: gates + inverters }
}

/**
 * Depth of each component in gate levels, inputs at 0. Used by the layout and
 * worth exposing on its own: propagation depth is a marked quantity.
 *
 * @param {Netlist} netlist
 * @returns {Map<string, number>}
 */
export function componentLevels(netlist) {
  const byId = new Map(netlist.components.map(c => [c.id, c]))
  const ownerOf = new Map()
  for (const component of netlist.components) {
    for (const port of [...component.inputs, ...component.outputs]) ownerOf.set(port, component.id)
  }

  const feeders = new Map(netlist.components.map(c => [c.id, []]))
  for (const wire of netlist.wires) {
    const from = ownerOf.get(wire.from)
    const to = ownerOf.get(wire.to)
    if (from && to) feeders.get(to).push(from)
  }

  const levels = new Map()
  const visiting = new Set()

  const levelOf = (id) => {
    if (levels.has(id)) return levels.get(id)
    // Synthesised circuits are acyclic, but the same function runs over
    // sandbox-edited netlists later, and a feedback loop there must not recurse
    // forever.
    if (visiting.has(id)) return 0
    visiting.add(id)

    const component = byId.get(id)
    const sources = feeders.get(id) ?? []
    const base = sources.length === 0 ? 0 : Math.max(...sources.map(levelOf)) + 1
    const level = component && component.kind === 'input' ? 0 : base

    visiting.delete(id)
    levels.set(id, level)
    return level
  }

  for (const component of netlist.components) levelOf(component.id)
  return levels
}

/** Maps every port id to the component that owns it. */
export function portOwners(netlist) {
  const owners = new Map()
  for (const component of netlist.components) {
    for (const port of [...component.inputs, ...component.outputs]) owners.set(port, component)
  }
  return owners
}
