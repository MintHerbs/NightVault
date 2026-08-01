/**
 * Gate silhouette tests (T-092).
 * Run with: npm run test:circuits
 *
 * The claim under test is the one the feature exists for: a student can tell
 * these apart with every text label hidden. That means the seven kinds must
 * differ in *shape*, not merely in the string beside them, so the distinctness
 * check compares the drawn geometry and nothing else.
 */

import {
  GATE_KINDS,
  BUBBLE_R,
  gateSilhouette,
  backEdgeAt,
  clockNotch,
} from './gateShapes.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

const BOX = { x: 100, y: 50, width: 80, height: 60 }

/** Every coordinate a path visits, walking the commands rather than guessing. */
function pathPoints(d) {
  const tokens = d.match(/[MLQAZ]|-?\d+(?:\.\d+)?/gi) ?? []
  const points = []
  let i = 0
  while (i < tokens.length) {
    const command = tokens[i]
    i += 1
    if (command === 'Z') continue
    const take = (n) => {
      const out = tokens.slice(i, i + n).map(Number)
      i += n
      return out
    }
    if (command === 'M' || command === 'L') {
      const [x, y] = take(2)
      points.push([x, y])
    } else if (command === 'Q') {
      const [cx, cy, x, y] = take(4)
      points.push([cx, cy], [x, y])
    } else if (command === 'A') {
      take(5) // rx ry rotation large-arc sweep — not coordinates
      const [x, y] = take(2)
      points.push([x, y])
    }
  }
  return points
}

// --- 1. Every gate kind draws something ------------------------------------

for (const kind of GATE_KINDS) {
  const shape = gateSilhouette(kind, BOX)
  assert(shape !== null, `1: ${kind} has a silhouette`)
  assert(typeof shape.body === 'string' && shape.body.length > 0, `1: ${kind} has a body path`)
}

// --- 2. Non-gates are refused rather than fudged ----------------------------

for (const kind of ['input', 'output', 'clock', 'const', 'dff', 'jkff', 'srff', 'tff', 'nonsense']) {
  assert(gateSilhouette(kind, BOX) === null, `2: ${kind} is not a gate shape`)
}

// --- 3. Distinguishable by silhouette alone ---------------------------------

const signatures = new Map()
for (const kind of GATE_KINDS) {
  const shape = gateSilhouette(kind, BOX)
  // Deliberately excludes the kind name: the whole point is that the drawing
  // differs, not the label.
  const signature = JSON.stringify([shape.body, shape.tail, shape.bubble])
  const clash = signatures.get(signature)
  assert(clash === undefined, `3: ${kind} and ${clash} draw identically`)
  signatures.set(signature, kind)
}
assert(signatures.size === GATE_KINDS.length, '3: all seven silhouettes are distinct')

// --- 4. Inversion bubbles are where they belong -----------------------------

const SHOULD_HAVE_BUBBLE = new Set(['nand', 'nor', 'xnor', 'not'])
for (const kind of GATE_KINDS) {
  const { bubble } = gateSilhouette(kind, BOX)
  assert(
    Boolean(bubble) === SHOULD_HAVE_BUBBLE.has(kind),
    `4: ${kind} bubble presence is ${SHOULD_HAVE_BUBBLE.has(kind)}`
  )
  if (!bubble) continue
  assert(bubble.r === BUBBLE_R, `4: ${kind} bubble has the shared radius`)
  // Inside the box, and on the output side. A bubble hanging past the right
  // edge overlaps whatever the layout put next to it.
  assert(bubble.cx + bubble.r <= BOX.x + BOX.width + 0.001, `4: ${kind} bubble fits the box`)
  assert(bubble.cx > BOX.x + BOX.width / 2, `4: ${kind} bubble is on the output side`)
  assert(Math.abs(bubble.cy - (BOX.y + BOX.height / 2)) < 0.001, `4: ${kind} bubble is centred`)
}

// --- 5. Only XOR and XNOR get the second back arc ---------------------------

for (const kind of GATE_KINDS) {
  const { tail } = gateSilhouette(kind, BOX)
  const expected = kind === 'xor' || kind === 'xnor'
  assert(Boolean(tail) === expected, `5: ${kind} tail presence is ${expected}`)
}

// --- 6. Bodies stay inside their box ----------------------------------------

for (const kind of GATE_KINDS) {
  const { body } = gateSilhouette(kind, BOX)
  for (const [px, py] of pathPoints(body)) {
    assert(px >= BOX.x - 0.001 && px <= BOX.x + BOX.width + 0.001, `6: ${kind} x=${px} within the box`)
    assert(py >= BOX.y - 0.001 && py <= BOX.y + BOX.height + 0.001, `6: ${kind} y=${py} within the box`)
  }
}

// --- 7. Where an input stub should stop -------------------------------------

const mid = BOX.y + BOX.height / 2
for (const kind of ['and', 'nand', 'not']) {
  assert(backEdgeAt(kind, BOX, mid) === BOX.x, `7: ${kind} has a flat back`)
}
for (const kind of ['or', 'nor', 'xor', 'xnor']) {
  assert(backEdgeAt(kind, BOX, mid) > BOX.x, `7: ${kind} back curves in at mid-height`)
  // The concavity vanishes at the corners, which is exactly where the outermost
  // pins sit. A stub drawn to a single fixed x would float there.
  assert(Math.abs(backEdgeAt(kind, BOX, BOX.y) - BOX.x) < 0.001, `7: ${kind} back meets the top corner`)
  assert(
    Math.abs(backEdgeAt(kind, BOX, BOX.y + BOX.height) - BOX.x) < 0.001,
    `7: ${kind} back meets the bottom corner`
  )
}

// Out-of-range y is clamped rather than extrapolated into a negative offset.
assert(backEdgeAt('or', BOX, BOX.y - 500) === BOX.x, '7: above the box clamps to the edge')
assert(backEdgeAt('or', BOX, BOX.y + 500) === BOX.x, '7: below the box clamps to the edge')

// A zero-height box must not divide by zero.
assert(
  Number.isFinite(backEdgeAt('or', { x: 0, y: 0, height: 0 }, 0)),
  '7: a degenerate box is finite'
)

// --- 8. The flip-flop clock notch -------------------------------------------

const notch = clockNotch(200, 100, 7)
const notchPoints = pathPoints(notch)
assert(notchPoints.length === 3, '8: the notch is a three-point triangle')
assert(notchPoints[1][0] > notchPoints[0][0], '8: the notch points into the body')
assert(
  Math.abs(notchPoints[1][1] - 100) < 0.001,
  '8: the notch tip is level with the clock pin'
)

if (failures > 0) {
  console.error(`gateShapes: ${failures} failure(s)`)
  process.exit(1)
}
console.log('gateShapes: all tests passed')
