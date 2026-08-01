/**
 * Gate silhouettes (T-092).
 *
 * Pure geometry, no React. Both circuit surfaces draw from here — the read-only
 * CircuitCanvas and the editable CircuitSandbox — so a gate cannot look like an
 * AND in one and a rounded box in the other. T-089 had these paths private to
 * CircuitCanvas, which is why the sandbox shipped drawing every component as the
 * same `<rect rx="10">`.
 *
 * The silhouette is the whole point. A student reading a schematic is
 * pattern-matching on the outline; a row of identical rectangles labelled
 * "AND" / "OR" makes them read text instead, which is the slow path and the one
 * that does not transfer to an exam paper.
 *
 * Every function takes an explicit box and returns path data for it, so the
 * caller owns layout and this file owns shape.
 */

/** Radius of the inversion bubble on NAND / NOR / XNOR / NOT. */
export const BUBBLE_R = 4.5

/** How much of the box the bubble reserves on an inverting gate. */
export const BUBBLE_SPACE = 10

/** Kinds this module can draw. Everything else is the caller's business. */
export const GATE_KINDS = ['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor']

const INVERTING = new Set(['nand', 'nor', 'xnor'])
const CURVED = new Set(['or', 'nor', 'xor', 'xnor'])
const TAILED = new Set(['xor', 'xnor'])

/**
 * @typedef {Object} Silhouette
 * @property {string} body - path data for the filled outline
 * @property {string|null} tail - the second back arc on XOR / XNOR, or null
 * @property {{cx: number, cy: number, r: number}|null} bubble - inversion bubble, or null
 * @property {number} noseX - where the output leaves the body, for a wire stub
 */

/**
 * The outline for one gate inside `box`.
 *
 * @param {string} kind
 * @param {{x: number, y: number, width: number, height: number}} box
 * @returns {Silhouette|null} null for anything that is not a gate
 */
export function gateSilhouette(kind, box) {
  const { x, y, width, height } = box
  const cy = y + height / 2

  // Triangle plus bubble, the standard inverter. Its own case because the
  // bubble is part of the symbol rather than an inversion bolted onto a body.
  if (kind === 'not') {
    const tipX = x + width - BUBBLE_SPACE + 1
    return {
      body: `M${x},${y} L${tipX},${cy} L${x},${y + height} Z`,
      tail: null,
      bubble: { cx: x + width - BUBBLE_R - 0.5, cy, r: BUBBLE_R },
      noseX: x + width,
    }
  }

  if (!GATE_KINDS.includes(kind)) return null

  const inverted = INVERTING.has(kind)
  const bodyWidth = inverted ? width - BUBBLE_SPACE : width

  return {
    body: CURVED.has(kind)
      ? orBody(x, y, bodyWidth, height)
      : andBody(x, y, bodyWidth, height),
    tail: TAILED.has(kind) ? orTail(x - 7, y, height) : null,
    bubble: inverted ? { cx: x + bodyWidth + BUBBLE_R + 0.5, cy, r: BUBBLE_R } : null,
    noseX: x + width,
  }
}

/** Flat back, semicircular front. */
export function andBody(x, y, w, h) {
  const r = h / 2
  const straight = Math.max(4, w - r)
  return `M${x},${y} L${x + straight},${y} A${r},${r} 0 0 1 ${x + straight},${y + h} L${x},${y + h} Z`
}

/** Concave back, pointed nose. */
export function orBody(x, y, w, h) {
  const back = h * 0.28
  return `M${x},${y} Q${x + back},${y + h / 2} ${x},${y + h} Q${x + w * 0.62},${y + h} ${x + w},${y + h / 2} Q${x + w * 0.62},${y} ${x},${y} Z`
}

/** The extra back arc that distinguishes XOR from OR. */
export function orTail(x, y, h) {
  const back = h * 0.28
  return `M${x},${y} Q${x + back},${y + h / 2} ${x},${y + h}`
}

/**
 * Where a gate's input pins meet its body.
 *
 * An OR's concave back means the outermost pins sit well to the right of the
 * box edge, so a stub drawn to a fixed x would float in mid-air on the top and
 * bottom pins and overshoot on the middle one. This returns the actual back
 * curve at that height.
 *
 * @param {string} kind
 * @param {{x: number, y: number, height: number}} box
 * @param {number} pinY - absolute y of the pin
 * @returns {number} absolute x where the stub should stop
 */
export function backEdgeAt(kind, box, pinY) {
  const { x, y, height } = box
  if (!CURVED.has(kind)) return x

  // The back is the quadratic Q(x + back, y + h/2) → (x, y + h), which at
  // parameter t has x-offset back * 2t(1 - t). Solve for t from the y we want.
  const back = height * 0.28
  const t = height === 0 ? 0 : Math.min(1, Math.max(0, (pinY - y) / height))
  return x + back * 2 * t * (1 - t)
}

/**
 * The clock notch on a flip-flop: the small triangle beside its CLK pin.
 *
 * @param {number} x - left edge of the flip-flop body
 * @param {number} y - absolute y of the clock pin
 * @param {number} size
 */
export function clockNotch(x, y, size = 7) {
  return `M${x},${y - size} L${x + size},${y} L${x},${y + size}`
}
