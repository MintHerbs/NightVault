/**
 * FSM to circuit (T-089 phase 3).
 *
 * Everything here is derivable from the FSM the model returned, which is why
 * the model is only asked for the FSM. The chain is:
 *
 *   state assignment -> state table -> excitation table -> one K-map per
 *   flip-flop input and per output -> netlist
 *
 * The excitation step is where JK and SR earn their keep: they produce
 * don't-cares, those don't-cares go straight into the same Quine-McCluskey
 * engine mode 2 uses, and the resulting logic is cheaper than the D version.
 * That is also why the K-map engine's don't-care handling was never optional.
 */

import { tableFromMinterms } from './truthTable.js'
import { minimize, implicantToTerm } from './quineMcCluskey.js'
import { dataPins, excitation, FLIP_FLOP_PINS, nextState } from './flipFlops.js'
import { comboKey, inputCombinations, transitionLookup } from './fsmParser.js'

export const ENCODINGS = ['binary', 'gray', 'onehot']
export const ENCODING_LABELS = { binary: 'Binary', gray: 'Gray', onehot: 'One-hot' }

/**
 * Assigns a bit pattern to each state.
 *
 * Gray coding is offered because a single-bit change between adjacent states
 * often simplifies the next-state logic; one-hot because it trades flip-flops
 * for much simpler logic and is what an FPGA course asks for.
 *
 * @returns {{bits: number, codes: Map<string, number[]>, names: string[]}}
 */
export function assignStates(fsm, encoding = 'binary') {
  const count = fsm.states.length
  const bits = encoding === 'onehot' ? count : Math.max(1, Math.ceil(Math.log2(count)))
  const names = Array.from({ length: bits }, (_, i) => `Q${bits - 1 - i}`)

  const codes = new Map()
  fsm.states.forEach((state, index) => {
    let value
    if (encoding === 'onehot') value = 1 << index
    else if (encoding === 'gray') value = index ^ (index >> 1)
    else value = index

    // MSB first, matching `names`.
    codes.set(state.id, Array.from({ length: bits }, (_, i) => (value >> (bits - 1 - i)) & 1))
  })

  return { bits, codes, names, encoding }
}

/**
 * The state table: one row per (state, input combination).
 *
 * @returns {Array<{state, code, input, next, nextCode, output}>}
 */
export function stateTable(fsm, assignment) {
  const lookup = transitionLookup(fsm)
  const combos = inputCombinations(fsm.inputs)
  const outputOf = new Map(fsm.states.map(s => [s.id, s.output]))
  const rows = []

  for (const state of fsm.states) {
    for (const combo of combos) {
      const transition = lookup.get(`${state.id}|${comboKey(combo, fsm.inputs)}`)
      if (!transition) continue
      rows.push({
        state: state.id,
        code: assignment.codes.get(state.id),
        input: combo,
        next: transition.to,
        nextCode: assignment.codes.get(transition.to),
        output: fsm.machineType === 'moore' ? outputOf.get(state.id) : transition.output,
      })
    }
  }

  return rows
}

/**
 * Variable order for every K-map in the design: state bits above inputs.
 *
 * Fixed and shared so the flip-flop maps and the output maps are read the same
 * way round. tableFromMinterms is told this order is deliberate (`presorted`),
 * because its usual alphabetical sort would renumber the state bits.
 */
export function synthesisVariables(fsm, assignment) {
  return [...assignment.names, ...fsm.inputs.map(s => s.name)]
}

/**
 * The excitation table plus the minimised logic for every flip-flop input and
 * every output.
 *
 * @param {import('./fsmParser.js').FSM} fsm
 * @param {{encoding?: string, flipFlop?: string}} [options]
 */
export function synthesizeFSM(fsm, { encoding = 'binary', flipFlop = 'dff' } = {}) {
  const assignment = assignStates(fsm, encoding)
  const rows = stateTable(fsm, assignment)
  const vars = synthesisVariables(fsm, assignment)
  const width = vars.length

  // Row index for a (state code, input combo) pair, MSB first.
  const indexOf = (code, input) => {
    let index = 0
    code.forEach((bit) => { index = (index << 1) | bit })
    fsm.inputs.forEach((signal) => { index = (index << 1) | input[signal.name] })
    return index
  }

  const pins = dataPins(flipFlop)
  // One function per (flip-flop, data pin), plus one per output signal.
  const functions = []
  for (let bit = 0; bit < assignment.bits; bit += 1) {
    for (const pin of pins) {
      functions.push({ kind: 'excitation', bit, pin, name: `${pin}${assignment.bits - 1 - bit}`, ones: [], dontCares: [] })
    }
  }
  for (const signal of fsm.outputs) {
    functions.push({ kind: 'output', name: signal.name, ones: [], dontCares: [] })
  }

  const covered = new Set()
  const excitationRows = []

  for (const row of rows) {
    const index = indexOf(row.code, row.input)
    covered.add(index)

    const cells = []
    for (let bit = 0; bit < assignment.bits; bit += 1) {
      const values = excitation(flipFlop, row.code[bit], row.nextCode[bit])
      for (const pin of pins) {
        const fn = functions.find(f => f.kind === 'excitation' && f.bit === bit && f.pin === pin)
        // null is a genuine don't-care from the excitation table, and feeding it
        // to the minimiser as a don't-care rather than a 0 is the whole reason
        // JK and SR designs come out smaller.
        if (values[pin] === null) fn.dontCares.push(index)
        else if (values[pin] === 1) fn.ones.push(index)
        cells.push({ bit, pin, value: values[pin] })
      }
    }

    for (const signal of fsm.outputs) {
      const fn = functions.find(f => f.kind === 'output' && f.name === signal.name)
      if (row.output[signal.name] === 1) fn.ones.push(index)
    }

    excitationRows.push({ ...row, index, cells })
  }

  // Any (code, input) pair no state uses is an unused encoding, and its
  // next-state logic is free to be anything. Marking those don't-care is what
  // lets a 5-state machine in 3 bits produce sane logic instead of paying for
  // three impossible states.
  const unused = []
  for (let index = 0; index < 2 ** width; index += 1) {
    if (!covered.has(index)) unused.push(index)
  }
  for (const fn of functions) fn.dontCares.push(...unused)

  for (const fn of functions) {
    const table = tableFromMinterms({
      vars,
      minterms: fn.ones,
      dontCares: fn.dontCares.filter(i => !fn.ones.includes(i)),
      presorted: true,
    })
    fn.table = table
    fn.solution = minimize(table)
    fn.expression = fn.solution.covers[0].implicants.length === 0
      ? '0'
      : fn.solution.covers[0].implicants.map(pi => implicantToTerm(pi, vars, 'sop').text).join(' + ')
    fn.terms = fn.solution.covers[0].implicants.map(pi => ({
      implicant: pi,
      literals: implicantToTerm(pi, vars, 'sop').literals,
    }))
  }

  return {
    fsm,
    assignment,
    flipFlop,
    vars,
    rows: excitationRows,
    functions,
    unusedCodes: unused,
    netlist: buildNetlist(fsm, assignment, flipFlop, vars, functions),
  }
}

/**
 * Builds the circuit: one flip-flop per state bit, a shared inverter bank, and
 * a two-level AND/OR block per function.
 *
 * Written here rather than reusing circuitSynthesis.synthesize() because this
 * is a multi-output design over shared inputs: calling the single-output
 * builder once per function would emit a separate copy of every input pin and
 * every inverter, and the gate count is a marked quantity.
 */
function buildNetlist(fsm, assignment, flipFlop, vars, functions) {
  const components = []
  const wires = []
  let seq = 0

  const add = (kind, opts = {}) => {
    const id = opts.id ?? `${kind}${seq++}`
    const pinCount = opts.pins ?? 0
    const component = {
      id,
      kind,
      label: opts.label ?? null,
      inputs: Array.from({ length: pinCount }, (_, i) => `${id}.in${i}`),
      outputs: kind === 'output' ? [] : opts.outputs ?? [`${id}.out`],
    }
    if (opts.value !== undefined) component.value = opts.value
    components.push(component)
    return component
  }
  const wire = (from, to) => wires.push({ id: `w${wires.length}`, from, to })

  const clock = add('clock', { id: 'clk', label: 'CLK' })
  const inputPins = new Map()
  for (const signal of fsm.inputs) {
    inputPins.set(signal.name, add('input', { id: `in_${signal.name}`, label: signal.name }))
  }

  const flops = []
  for (let bit = 0; bit < assignment.bits; bit += 1) {
    const name = assignment.names[bit]
    const ff = add(flipFlop, {
      id: `ff_${name}`,
      label: name,
      pins: FLIP_FLOP_PINS[flipFlop].length,
      outputs: [`ff_${name}.out`, `ff_${name}.outn`],
    })
    wire(clock.outputs[0], ff.inputs[ff.inputs.length - 1])
    flops.push(ff)
  }

  // Where each variable's true and complemented forms come from. Q' is taken
  // from the flip-flop's own inverted output rather than a new inverter, which
  // is what a hand-drawn answer does too.
  const sourceOf = new Map()
  vars.forEach((name) => {
    const bit = assignment.names.indexOf(name)
    if (bit >= 0) sourceOf.set(name, { true: flops[bit].outputs[0], false: flops[bit].outputs[1] })
    else sourceOf.set(name, { true: inputPins.get(name).outputs[0], false: null })
  })

  const inverterFor = (name) => {
    const source = sourceOf.get(name)
    if (source.false) return source.false
    const inverter = add('not', { id: `not_${name}`, pins: 1 })
    wire(source.true, inverter.inputs[0])
    source.false = inverter.outputs[0]
    return source.false
  }

  const literalPort = (literal) => (
    literal.negated ? inverterFor(literal.name) : sourceOf.get(literal.name).true
  )

  /** Two-level AND/OR for one function; returns the port carrying its value. */
  const buildFunction = (fn) => {
    const cover = fn.solution.covers[0]
    if (cover.implicants.length === 0) return add('const', { value: 0, label: '0' }).outputs[0]
    if (cover.implicants.some(pi => pi.literals === 0)) return add('const', { value: 1, label: '1' }).outputs[0]

    const termPorts = cover.implicants.map((implicant) => {
      const { literals } = implicantToTerm(implicant, fn.table.vars, 'sop')
      const ports = literals.map(literalPort)
      if (ports.length === 1) return ports[0]
      const gate = add('and', { pins: ports.length })
      ports.forEach((port, i) => wire(port, gate.inputs[i]))
      return gate.outputs[0]
    })

    if (termPorts.length === 1) return termPorts[0]
    const or = add('or', { pins: termPorts.length })
    termPorts.forEach((port, i) => wire(port, or.inputs[i]))
    return or.outputs[0]
  }

  const pins = dataPins(flipFlop)
  for (const fn of functions) {
    const port = buildFunction(fn)
    if (fn.kind === 'excitation') {
      const ff = flops[fn.bit]
      wire(port, ff.inputs[pins.indexOf(fn.pin)])
    } else {
      const probe = add('output', { id: `out_${fn.name}`, label: fn.name, pins: 1 })
      wire(port, probe.inputs[0])
    }
  }

  return {
    components,
    wires,
    inputNames: fsm.inputs.map(s => s.name),
    outputNames: fsm.outputs.map(s => s.name),
  }
}

/**
 * State reduction by partition refinement.
 *
 * Computed and reported, never applied. If the question asked for the machine
 * as specified, silently merging equivalent states changes the answer the
 * student has to defend.
 *
 * @returns {Array<string[]>} groups of two or more equivalent states
 */
export function equivalentStates(fsm) {
  const lookup = transitionLookup(fsm)
  const combos = inputCombinations(fsm.inputs)
  const outputOf = new Map(fsm.states.map(s => [s.id, s.output]))

  // Initial partition: same output behaviour.
  const signature = (id) => {
    if (fsm.machineType === 'moore') {
      return fsm.outputs.map(s => outputOf.get(id)[s.name]).join('')
    }
    return combos
      .map(combo => fsm.outputs.map(s => lookup.get(`${id}|${comboKey(combo, fsm.inputs)}`).output[s.name]).join(''))
      .join('|')
  }

  let groups = new Map()
  for (const state of fsm.states) {
    const key = signature(state.id)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(state.id)
  }

  // Refine until stable: two states stay together only while every input takes
  // them into the same group.
  for (let pass = 0; pass < fsm.states.length + 1; pass += 1) {
    const groupOf = new Map()
    ;[...groups.values()].forEach((members, i) => members.forEach(id => groupOf.set(id, i)))

    const next = new Map()
    for (const [, members] of groups) {
      for (const id of members) {
        const key = [groupOf.get(id), ...combos.map(combo => (
          groupOf.get(lookup.get(`${id}|${comboKey(combo, fsm.inputs)}`).to)
        ))].join(',')
        if (!next.has(key)) next.set(key, [])
        next.get(key).push(id)
      }
    }

    if (next.size === groups.size) { groups = next; break }
    groups = next
  }

  return [...groups.values()].filter(members => members.length > 1)
}

/** Runs the FSM directly, for checking a synthesised circuit against it. */
export function runFSM(fsm, sequence) {
  const lookup = transitionLookup(fsm)
  const outputOf = new Map(fsm.states.map(s => [s.id, s.output]))
  let state = fsm.reset
  const trace = []

  for (const input of sequence) {
    const transition = lookup.get(`${state}|${comboKey(input, fsm.inputs)}`)
    if (!transition) throw new Error(`no transition from ${state}`)
    const output = fsm.machineType === 'moore' ? outputOf.get(state) : transition.output
    trace.push({ state, input, output, next: transition.to })
    state = transition.to
  }

  return trace
}

/** Next-state function for one flip-flop, for the "how did we get here" panel. */
export function describeExcitation(flipFlop, from, to) {
  const values = excitation(flipFlop, from, to)
  const check = nextState(flipFlop, from, Object.fromEntries(
    Object.entries(values).map(([pin, value]) => [pin, value === null ? 0 : value])
  ))
  return { values, reaches: check.next }
}
