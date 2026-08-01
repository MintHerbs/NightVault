/**
 * Flip-flop semantics and excitation tables (T-089).
 *
 * Shared by the sandbox simulator (phase 2) and FSM synthesis (phase 3), which
 * is the point: the excitation table used to *build* a circuit and the
 * next-state function used to *run* it are two readings of one truth table, and
 * if they disagree the synthesised circuit is wrong in a way no amount of
 * staring at the K-map reveals.
 *
 * `flipFlops.test.js` asserts they agree by construction: for every type and
 * every Q -> Q+ transition, feeding the excitation values back through
 * nextState must reproduce Q+.
 */

/** Pin order per flip-flop kind. The clock is always last. */
export const FLIP_FLOP_PINS = {
  dff: ['D', 'CLK'],
  tff: ['T', 'CLK'],
  jkff: ['J', 'K', 'CLK'],
  srff: ['S', 'R', 'CLK'],
}

export const FLIP_FLOP_KINDS = Object.keys(FLIP_FLOP_PINS)
export const isFlipFlop = (kind) => Object.prototype.hasOwnProperty.call(FLIP_FLOP_PINS, kind)

/** Data pins only, i.e. everything the clock is not. */
export const dataPins = (kind) => FLIP_FLOP_PINS[kind].slice(0, -1)

export const FLIP_FLOP_LABELS = {
  dff: 'D flip-flop',
  tff: 'T flip-flop',
  jkff: 'JK flip-flop',
  srff: 'SR flip-flop',
}

/**
 * Next state on a clock edge.
 *
 * @param {string} kind
 * @param {0|1} q - current state
 * @param {Record<string, 0|1|'x'>} inputs - keyed by data pin name
 * @returns {{next: 0|1|'x', invalid: boolean}}
 *
 * `invalid` is only ever true for SR with S = R = 1. That case is deliberately
 * NOT given a next state: it is the forbidden input, and quietly picking a
 * value teaches the student that it is fine, which is the opposite of the
 * lesson. The state is held and the flip-flop is flagged.
 */
export function nextState(kind, q, inputs) {
  const unknown = Object.values(inputs).some(v => v === 'x')

  switch (kind) {
    case 'dff':
      if (unknown) return { next: 'x', invalid: false }
      return { next: inputs.D ? 1 : 0, invalid: false }

    case 'tff':
      if (unknown) return { next: 'x', invalid: false }
      return { next: inputs.T ? (q ? 0 : 1) : q, invalid: false }

    case 'jkff': {
      if (unknown) return { next: 'x', invalid: false }
      const { J, K } = inputs
      if (!J && !K) return { next: q, invalid: false }          // hold
      if (!J && K) return { next: 0, invalid: false }           // reset
      if (J && !K) return { next: 1, invalid: false }           // set
      return { next: q ? 0 : 1, invalid: false }                // toggle
    }

    case 'srff': {
      const { S, R } = inputs
      if (S === 1 && R === 1) return { next: q, invalid: true }
      if (unknown) return { next: 'x', invalid: false }
      if (!S && !R) return { next: q, invalid: false }          // hold
      if (!S && R) return { next: 0, invalid: false }           // reset
      return { next: 1, invalid: false }                        // set
    }

    default:
      throw new Error(`Unknown flip-flop kind "${kind}"`)
  }
}

/**
 * Excitation table: what the data inputs must be to move Q to Q+.
 *
 * `null` means don't-care, and that is the whole reason JK and SR designs come
 * out cheaper than D designs. Those don't-cares flow straight into the K-map
 * engine, which is why its don't-care handling is not optional.
 *
 *   Q -> Q+ | D | T | J K | S R
 *   0 -> 0  | 0 | 0 | 0 X | 0 X
 *   0 -> 1  | 1 | 1 | 1 X | 1 0
 *   1 -> 0  | 0 | 1 | X 1 | 0 1
 *   1 -> 1  | 1 | 0 | X 0 | X 0
 *
 * @param {string} kind
 * @param {0|1} from
 * @param {0|1} to
 * @returns {Record<string, 0|1|null>} keyed by data pin name
 */
export function excitation(kind, from, to) {
  switch (kind) {
    case 'dff':
      return { D: to }

    case 'tff':
      return { T: from === to ? 0 : 1 }

    case 'jkff':
      if (from === 0 && to === 0) return { J: 0, K: null }
      if (from === 0 && to === 1) return { J: 1, K: null }
      if (from === 1 && to === 0) return { J: null, K: 1 }
      return { J: null, K: 0 }

    case 'srff':
      if (from === 0 && to === 0) return { S: 0, R: null }
      if (from === 0 && to === 1) return { S: 1, R: 0 }
      if (from === 1 && to === 0) return { S: 0, R: 1 }
      return { S: null, R: 0 }

    default:
      throw new Error(`Unknown flip-flop kind "${kind}"`)
  }
}

/** Human-readable rows for the reference panel. */
export function excitationRows(kind) {
  const pins = dataPins(kind)
  const rows = []
  for (const [from, to] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    const values = excitation(kind, from, to)
    rows.push({
      from,
      to,
      values: pins.map(pin => ({ pin, value: values[pin] === null ? 'X' : values[pin] })),
    })
  }
  return rows
}

/** Characteristic table rows, i.e. the same information read forwards. */
export function characteristicRows(kind) {
  const pins = dataPins(kind)
  const rows = []
  const combos = 2 ** pins.length

  for (let i = 0; i < combos; i += 1) {
    const inputs = {}
    pins.forEach((pin, k) => { inputs[pin] = (i >> (pins.length - 1 - k)) & 1 })
    for (const q of [0, 1]) {
      const { next, invalid } = nextState(kind, q, inputs)
      rows.push({ inputs: { ...inputs }, q, next: invalid ? '!' : next, invalid })
    }
  }
  return rows
}
