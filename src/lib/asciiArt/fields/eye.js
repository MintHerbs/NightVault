// An almond-shaped eye whose pupil drifts left/right — Data Science course
// card (T-077): "watching the data," scanning back and forth over time.

export default function eye(nx, ny, t) {
  const lidHeight = 0.6 * Math.sqrt(Math.max(0, 1 - nx * nx))
  if (Math.abs(ny) > lidHeight) return 0

  const pupilX = Math.sin(t * 0.8) * 0.45
  const d = Math.hypot(nx - pupilX, ny * 1.3)

  if (d < 0.16) return 1 // pupil
  if (d < 0.34) return 0.55 // iris
  return 0.12 // sclera — faint, so the eyelid outline still reads
}
