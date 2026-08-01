/**
 * Validates and normalises FSM JSON (T-089 phase 3).
 *
 * The model is asked for the state machine and nothing else. Everything after
 * this file is deterministic: state assignment, excitation tables, K-maps and
 * the circuit are all derivable, and code that can be tested beats a model that
 * can be plausible.
 *
 * Which means this is the only place a model's mistake can enter, so it checks
 * the things that make an FSM unusable rather than merely odd:
 * reachability, determinism and completeness. The first is a warning; the other
 * two stop synthesis, because a non-deterministic or incomplete machine has no
 * well-defined next-state function to build.
 */

export const MACHINE_TYPES = ['moore', 'mealy']

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/

/**
 * @typedef {Object} FSM
 * @property {string} title
 * @property {'moore'|'mealy'} machineType
 * @property {Array<{name: string, description: string}>} inputs
 * @property {Array<{name: string, description: string}>} outputs
 * @property {string} reset
 * @property {Array<{id: string, label: string, output: Record<string, 0|1>}>} states
 * @property {Array<{from: string, to: string, input: Record<string, 0|1>, output: Record<string, 0|1>}>} transitions
 */

/**
 * @param {string|Object} input - JSON text or an already-parsed object
 * @returns {{valid: true, fsm: FSM, warnings: string[]} | {valid: false, error: string, detail?: Object}}
 */
export function parseFSM(input) {
  let data
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch {
      return { valid: false, error: 'The state machine was not valid JSON.' }
    }
  } else {
    data = input
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'The state machine must be a JSON object.' }
  }

  const machineType = String(data.machineType ?? 'moore').toLowerCase()
  if (!MACHINE_TYPES.includes(machineType)) {
    return { valid: false, error: `"${data.machineType}" is not a machine type. Use moore or mealy.` }
  }

  const inputs = normaliseSignals(data.inputs, 'input')
  if (inputs.error) return { valid: false, error: inputs.error }
  const outputs = normaliseSignals(data.outputs, 'output')
  if (outputs.error) return { valid: false, error: outputs.error }

  if (inputs.list.length === 0) {
    return { valid: false, error: 'The machine has no input signals, so nothing can make it change state.' }
  }
  if (outputs.list.length === 0) {
    return { valid: false, error: 'The machine has no output signals, so there is nothing to detect.' }
  }
  // 2^inputs rows per state; past this the tables stop being readable and the
  // model has almost certainly misread the question.
  if (inputs.list.length > 4) {
    return { valid: false, error: `${inputs.list.length} input signals is more than this tool handles. The limit is 4.` }
  }

  if (!Array.isArray(data.states) || data.states.length === 0) {
    return { valid: false, error: 'The machine has no states.' }
  }
  if (data.states.length > 32) {
    return { valid: false, error: `${data.states.length} states is more than this tool handles. The limit is 32.` }
  }

  const states = []
  const seen = new Set()
  for (const [i, raw] of data.states.entries()) {
    const id = typeof raw?.id === 'string' ? raw.id.trim() : ''
    if (!NAME.test(id)) {
      return { valid: false, error: `State ${i} has no usable id.` }
    }
    if (seen.has(id)) return { valid: false, error: `State "${id}" is listed twice.` }
    seen.add(id)

    const output = {}
    if (machineType === 'moore') {
      for (const signal of outputs.list) {
        const value = bit(raw?.output?.[signal.name])
        if (value === null) {
          return { valid: false, error: `Moore state "${id}" has no value for output ${signal.name}.` }
        }
        output[signal.name] = value
      }
    }

    states.push({ id, label: typeof raw?.label === 'string' && raw.label.trim() ? raw.label.trim() : id, output })
  }

  const reset = typeof data.reset === 'string' ? data.reset.trim() : ''
  if (!seen.has(reset)) {
    return { valid: false, error: `The reset state "${data.reset ?? ''}" is not one of the states.` }
  }

  if (!Array.isArray(data.transitions)) {
    return { valid: false, error: 'The machine has no transitions.' }
  }

  const transitions = []
  for (const [i, raw] of data.transitions.entries()) {
    const from = typeof raw?.from === 'string' ? raw.from.trim() : ''
    const to = typeof raw?.to === 'string' ? raw.to.trim() : ''
    if (!seen.has(from)) return { valid: false, error: `Transition ${i} starts at unknown state "${from}".` }
    if (!seen.has(to)) return { valid: false, error: `Transition ${i} ends at unknown state "${to}".` }

    const inputValues = {}
    for (const signal of inputs.list) {
      const value = bit(raw?.input?.[signal.name])
      if (value === null) {
        return { valid: false, error: `Transition ${from} to ${to} has no value for input ${signal.name}.` }
      }
      inputValues[signal.name] = value
    }

    const outputValues = {}
    if (machineType === 'mealy') {
      for (const signal of outputs.list) {
        const value = bit(raw?.output?.[signal.name])
        if (value === null) {
          return { valid: false, error: `Mealy transition ${from} to ${to} has no value for output ${signal.name}.` }
        }
        outputValues[signal.name] = value
      }
    }

    transitions.push({ from, to, input: inputValues, output: outputValues })
  }

  const fsm = {
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'State machine',
    machineType,
    inputs: inputs.list,
    outputs: outputs.list,
    reset,
    states,
    transitions,
  }

  const structure = checkStructure(fsm)
  if (structure.error) return { valid: false, error: structure.error, detail: structure.detail }

  return { valid: true, fsm, warnings: structure.warnings }
}

/**
 * Determinism, completeness and reachability.
 *
 * Determinism and completeness are errors: without them there is no next-state
 * function, so nothing downstream can run. Unreachable states are only a
 * warning — the machine still works, the extra states just cost flip-flops, and
 * refusing the whole answer over one stray state would be worse than saying so.
 */
export function checkStructure(fsm) {
  const combos = inputCombinations(fsm.inputs)
  const byState = new Map(fsm.states.map(s => [s.id, new Map()]))

  for (const transition of fsm.transitions) {
    const key = comboKey(transition.input, fsm.inputs)
    const table = byState.get(transition.from)
    if (table.has(key)) {
      return {
        error: `State "${transition.from}" has two different transitions for the same input, so the next state is ambiguous.`,
        detail: { kind: 'nondeterministic', state: transition.from, input: transition.input },
      }
    }
    table.set(key, transition)
  }

  const missing = []
  for (const state of fsm.states) {
    for (const combo of combos) {
      if (!byState.get(state.id).has(comboKey(combo, fsm.inputs))) {
        missing.push({ state: state.id, input: combo })
      }
    }
  }
  if (missing.length > 0) {
    const first = missing[0]
    const shown = fsm.inputs.map(s => `${s.name}=${first.input[s.name]}`).join(', ')
    return {
      error: `State "${first.state}" has no transition for ${shown}${missing.length > 1 ? `, and ${missing.length - 1} more are missing` : ''}.`,
      detail: { kind: 'incomplete', missing },
    }
  }

  // Reachability from the reset state.
  const reached = new Set([fsm.reset])
  const queue = [fsm.reset]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const transition of byState.get(current).values()) {
      if (!reached.has(transition.to)) { reached.add(transition.to); queue.push(transition.to) }
    }
  }

  const warnings = []
  const unreachable = fsm.states.filter(s => !reached.has(s.id)).map(s => s.id)
  if (unreachable.length > 0) {
    warnings.push(`${unreachable.join(', ')} cannot be reached from ${fsm.reset}. ${unreachable.length === 1 ? 'It is' : 'They are'} still encoded, which costs flip-flops.`)
  }

  return { warnings, transitionTable: byState }
}

/**
 * Fills missing transitions with self-loops.
 *
 * Offered as an explicit repair rather than applied automatically: an
 * incomplete machine is usually the model having missed a case, and silently
 * inventing "stay put" hides that from the student who has to defend the answer.
 */
export function completeWithSelfLoops(fsm) {
  const combos = inputCombinations(fsm.inputs)
  const present = new Set(fsm.transitions.map(t => `${t.from}|${comboKey(t.input, fsm.inputs)}`))
  const added = []

  for (const state of fsm.states) {
    for (const combo of combos) {
      const key = `${state.id}|${comboKey(combo, fsm.inputs)}`
      if (present.has(key)) continue
      const output = {}
      if (fsm.machineType === 'mealy') for (const signal of fsm.outputs) output[signal.name] = 0
      added.push({ from: state.id, to: state.id, input: { ...combo }, output })
    }
  }

  return { fsm: { ...fsm, transitions: [...fsm.transitions, ...added] }, added }
}

/** Every input combination, in counting order with inputs[0] as the MSB. */
export function inputCombinations(inputs) {
  const combos = []
  for (let i = 0; i < 2 ** inputs.length; i += 1) {
    const combo = {}
    inputs.forEach((signal, k) => { combo[signal.name] = (i >> (inputs.length - 1 - k)) & 1 })
    combos.push(combo)
  }
  return combos
}

export function comboKey(values, inputs) {
  return inputs.map(s => values[s.name]).join('')
}

/** Lookup for the next state and output given a state and an input combo. */
export function transitionLookup(fsm) {
  const map = new Map()
  for (const transition of fsm.transitions) {
    map.set(`${transition.from}|${comboKey(transition.input, fsm.inputs)}`, transition)
  }
  return map
}

function normaliseSignals(raw, what) {
  if (!Array.isArray(raw)) return { error: `The machine has no ${what} list.` }

  const list = []
  const seen = new Set()
  for (const [i, signal] of raw.entries()) {
    const name = typeof signal === 'string'
      ? signal.trim()
      : typeof signal?.name === 'string' ? signal.name.trim() : ''
    if (!NAME.test(name)) return { error: `${what} ${i} has no usable name.` }
    if (seen.has(name)) return { error: `${what} "${name}" is listed twice.` }
    seen.add(name)
    list.push({
      name,
      description: typeof signal?.description === 'string' ? signal.description : '',
    })
  }
  return { list }
}

/** Accepts 0/1, "0"/"1", true/false. Anything else is a refusal, not a guess. */
function bit(value) {
  if (value === 0 || value === 1) return value
  if (value === true) return 1
  if (value === false) return 0
  if (value === '0') return 0
  if (value === '1') return 1
  return null
}
