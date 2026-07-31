// A tableau drawing itself: a trunk descends from the root formula, forks
// twice, and every leaf is stopped in turn. Semantic Tableaux's card (T-084):
// the motif is the tool's own output, a truth tree growing downward until its
// contradictory branches close.
//
// Field contract: (nx, ny, t) in [-1, 1] x [-1, 1] x seconds => density [0, 1].
// See src/lib/asciiArt/renderAsciiField.js.
//
// Sizes below are in field units, but the card's character grid is not square:
// AsciiCanvas draws 56 columns and gridForBox derives ~34 rows from that, so a
// column spans 0.036 and a row 0.059. Anything meant to read as round needs its
// vertical radius about 1.65x its horizontal one; the formula nodes are
// deliberately wider than tall instead, echoing the boxes the real tool draws.

const ROOT_Y = -0.8
const FORK_Y = -0.42
const BOTTOM = 0.46
const MARK_Y = BOTTOM + 0.16

const LEVELS = 3
const ROW = (BOTTOM - FORK_Y) / LEVELS

// First fork's half-width, halved at each level. Keeps the tree inside the
// frame and leaves the closest pair of leaves 7 columns apart.
const SPREAD = 0.5

// Grow, then hold the finished proof. Without the hold it reads as a loop that
// never resolves, which is the opposite of what a tableau does.
const CYCLE = 8
const GROW_FRACTION = 0.58

export default function truthTree(nx, ny, t) {
  const phase = (t % CYCLE) / CYCLE
  const grown = Math.min(1, phase / GROW_FRACTION)
  const frontY = ROOT_Y + (BOTTOM - ROOT_Y) * grown

  // Root formula, the first thing to land.
  let density = box(nx, ny, 0, ROOT_Y, 0.11, 0.05) * Math.min(1, phase * 16)

  // Leaves and their closures. Both are resolved before the growth guard below,
  // since the marks sit past where the branches stop.
  const tips = 1 << LEVELS
  const settled = grown >= 1 ? (phase - GROW_FRACTION) / (1 - GROW_FRACTION) : -1
  if (ny > BOTTOM - 0.1) {
    for (let k = 0; k < tips; k++) {
      const cx = tipCentre(k)
      if (frontY >= BOTTOM) {
        density = Math.max(density, box(nx, ny, cx, BOTTOM, 0.06, 0.04))
      }
      if (settled < 0) continue
      // Left to right, each mark flaring and then holding to the end of the
      // cycle. A ✗ is unreadable at 56 columns: its two arms land on separate
      // cells and read as loose dots, so a closed branch gets a solid stop.
      const flare = pulse(settled - (k / tips) * 0.5)
      if (flare > 0) {
        density = Math.max(density, box(nx, ny, cx, MARK_Y, 0.05, 0.062) * flare)
      }
    }
  }

  if (ny < ROOT_Y || ny > frontY) return density

  if (ny < FORK_Y) {
    // Trunk: one stroke straight down from the root to the first fork.
    density = Math.max(density, falloff(Math.abs(nx), 0.045))
  } else {
    const p = (ny - FORK_Y) / ROW
    const level = Math.min(LEVELS - 1, Math.floor(p))
    const frac = clamp01(p - level)

    // Greedy binary descent to the branch nearest this column. Amplitudes
    // halve, so taking the closer side at each fork lands on the true nearest.
    let x = 0
    let amp = SPREAD
    for (let i = 0; i < level; i++) {
      x += nx > x ? amp : -amp
      amp *= 0.5
    }

    // Both outgoing strokes are drawn, not just the nearer one. Drawing one
    // leaves the column directly under a fork empty, because by then each
    // stroke has already stepped aside and neither covers the centre.
    const spanned = amp * frac
    density = Math.max(
      density,
      falloff(Math.abs(nx - (x - spanned)), 0.045),
      falloff(Math.abs(nx - (x + spanned)), 0.045)
    )

    // The branch's own formula, sitting at the fork.
    density = Math.max(density, box(nx, ny, x, FORK_Y + level * ROW, 0.075, 0.042))
  }

  // The growing tip glows, so the eye follows what is being drawn.
  const front = Math.max(0, 1 - Math.abs(ny - frontY) * 6)
  if (front > 0) density = Math.min(1, density * (1 + front * 0.9))

  return clamp01(density)
}

/** x of the k-th leaf, reading its path off the bits of k. */
function tipCentre(k) {
  let x = 0
  let amp = SPREAD
  for (let i = 0; i < LEVELS; i++) {
    x += (k >> i) & 1 ? amp : -amp
    amp *= 0.5
  }
  return x
}

/** 1 at the centre, fading to 0 at `width`. */
function falloff(distance, width) {
  return Math.max(0, 1 - distance / width)
}

/** A formula node: a short horizontal bar, brightest along its middle. */
function box(nx, ny, cx, cy, rx, ry) {
  const ax = Math.abs(nx - cx) / rx
  const ay = Math.abs(ny - cy) / ry
  if (ax > 1 || ay > 1) return 0
  return 1 - 0.45 * Math.max(ax, ay)
}

/** Fast attack, then a held value: a mark that lands and stays put. */
function pulse(u) {
  if (u <= 0) return 0
  if (u < 0.05) return u / 0.05
  return Math.max(0.9, 1 - (u - 0.05) * 1.2)
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
