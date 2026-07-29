// A scatter cloud with a regression line sweeping through it — Data Science
// course card (T-077). The eye motif this replaced moved to Socials.
//
// Point positions come from a deterministic hash, not Math.random, so the
// cloud is identical on every mount (and in the reduced-motion still frame)
// instead of reshuffling on each visit.

const POINT_COUNT = 46
const SLOPE = 0.62
const RADIUS = 0.06 // half-width of one plotted point, in field units

function hash(i) {
  const n = Math.sin(i * 127.1 + 13.7) * 43758.5453
  return n - Math.floor(n)
}

// Precomputed so the field stays cheap — it runs once per grid cell per frame.
const POINTS = Array.from({ length: POINT_COUNT }, (_, i) => {
  const x = hash(i) * 1.7 - 0.85
  // Scatter about the trend line, with the spread widening toward the edges.
  const spread = 0.16 + 0.2 * Math.abs(x)
  return { x, y: -SLOPE * x + (hash(i + 500) - 0.5) * 2 * spread, phase: hash(i + 900) }
})

export default function dataScatter(nx, ny, t) {
  let density = 0

  // The trend line, drawn as a soft band; it rocks slightly so the fit reads
  // as being continuously re-estimated.
  const slope = SLOPE + 0.07 * Math.sin(t * 0.7)
  const lineDist = Math.abs(ny + slope * nx) / Math.sqrt(1 + slope * slope)
  if (lineDist < 0.045) density = 0.55 * (1 - lineDist / 0.045)

  for (let i = 0; i < POINTS.length; i++) {
    const p = POINTS[i]
    // Reject on the bounding box before doing the distance: this runs for
    // every point at every grid cell every frame, and almost every pair is
    // far apart, so the cheap test skips the hypot in the common case.
    const dx = nx - p.x
    if (dx < -RADIUS || dx > RADIUS) continue
    const dy = ny - p.y
    if (dy < -RADIUS || dy > RADIUS) continue

    // Each point pulses on its own phase, so the cloud shimmers rather than
    // blinking in unison.
    const pulse = 0.55 + 0.45 * Math.sin(t * 1.3 + p.phase * 6.283)
    const point = Math.max(0, 1 - Math.hypot(dx, dy) / RADIUS) * pulse
    if (point > density) density = point
  }

  return density
}
