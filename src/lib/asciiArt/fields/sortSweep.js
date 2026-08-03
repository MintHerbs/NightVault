// A scanner sweeping a scrambled row of bars into a sorted staircase, holding
// on the finished order, then scrambling again — Sorting Algo card (T-105).
//
// Deliberately not barMeter (Grade Toolkit), which is also bars: that one
// oscillates every column independently and never resolves, because a grade
// meter has no finished state. This one does, and the whole point of the card
// is that the row *ends* ordered. The bright column crossing the row is the `j`
// pointer of the tool the card opens.

const BAR_COUNT = 9 // the lecture example's array length
const BAR_WIDTH = (2 / BAR_COUNT) * 0.62 // fraction of the [-1,1] span
const CYCLE = 7 // seconds for one scramble → sweep → hold
const SWEEP_SPAN = 0.72 // fraction of the cycle spent sweeping; the rest holds
const SETTLE_RAMP = 0.7 // columns' worth of travel a bar takes to reach its slot

/**
 * Deterministic bar height for one column on one pass.
 *
 * A field is re-sampled for every cell on every frame, so it cannot hold state
 * or call Math.random: the same `t` has to produce the same picture or the bars
 * strobe instead of standing still. Hashing (column, pass) gives a fresh-looking
 * scramble each cycle that is nonetheless stable within it.
 */
function scrambledHeight(col, pass) {
  const s = Math.sin((col + 1) * 12.9898 + pass * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function smoothstep(x) {
  return x * x * (3 - 2 * x)
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export default function sortSweep(nx, ny, t) {
  const col = Math.min(BAR_COUNT - 1, Math.floor(((nx + 1) / 2) * BAR_COUNT))
  const colCenter = ((col + 0.5) / BAR_COUNT) * 2 - 1

  const pass = Math.floor(t / CYCLE)
  const sweep = (((t % CYCLE) / CYCLE) / SWEEP_SPAN) * BAR_COUNT

  // Ramped rather than switched, so a bar visibly rises or drops into its slot
  // instead of teleporting between two frames. Past the sweep's last column
  // this pins at 1 for every bar, which is the held sorted staircase.
  const settled = smoothstep(clamp01((sweep - col) / SETTLE_RAMP))
  const messy = 0.3 + 0.62 * scrambledHeight(col, pass)
  const sorted = 0.3 + 0.62 * ((col + 1) / BAR_COUNT)
  const height = messy + (sorted - messy) * settled

  const barTop = 1 - height * 2
  if (ny < barTop) return 0
  if (Math.abs(nx - colCenter) > BAR_WIDTH / 2) return 0

  // Denser towards the base, so the row reads as standing on a floor rather
  // than floating.
  const body = 0.38 + 0.42 * ((ny - barTop) / (1 - barTop + 0.0001))

  // The scanner, brightest on the column it is crossing and gone by the time
  // the staircase is being held.
  const scanner = Math.max(0, 1 - Math.abs(sweep - col - 0.5) * 1.8)

  return clamp01(body + scanner * 0.5)
}
