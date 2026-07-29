// Oscillating bar chart / GPA meter — Grade Toolkit card (T-077). Each of
// a handful of columns grows and shrinks independently, like grades
// updating across modules.

const BAR_COUNT = 7
const BAR_WIDTH = (2 / BAR_COUNT) * 0.7 // fraction of a column's slot

export default function barMeter(nx, ny, t) {
  const col = Math.min(BAR_COUNT - 1, Math.floor(((nx + 1) / 2) * BAR_COUNT))
  const colCenter = ((col + 0.5) / BAR_COUNT) * 2 - 1
  if (Math.abs(nx - colCenter) > BAR_WIDTH / 2) return 0

  const heightFrac = 0.35 + 0.55 * ((Math.sin(t * 1.4 + col * 1.7) + 1) / 2) // 0..1 of the vertical span
  const barTop = 1 - heightFrac * 2 // ny where the bar starts (bars grow up from ny = 1)
  if (ny < barTop) return 0

  return 0.4 + 0.5 * ((ny - barTop) / (1 - barTop + 0.0001))
}
