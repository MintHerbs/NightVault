// Right-angle traces with current visibly travelling along them — Circuit
// Sandbox card: the same "a pulse travels the wire, the settled value stays
// lit underneath" language as CircuitSandbox.module.css's own .pulse
// animation, looped here as a cover instead of drawn once per click.

const TRACES = [
  { speed: 0.5, points: [[-0.8, -0.5], [-0.1, -0.5], [-0.1, 0.15], [0.8, 0.15]] },
  { speed: 0.35, points: [[-0.7, 0.55], [0.2, 0.55], [0.2, -0.3], [0.75, -0.3]] },
]

function traceLength(points) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  return total
}

const LENGTHS = TRACES.map((trace) => traceLength(trace.points))

/** Where a distance travelled along a polyline lands, wrapping past its end. */
function pointAt(points, length, distance) {
  let remaining = ((distance % length) + length) % length
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]
    const [bx, by] = points[i]
    const segLen = Math.hypot(bx - ax, by - ay)
    if (remaining <= segLen) {
      const f = segLen === 0 ? 0 : remaining / segLen
      return [ax + (bx - ax) * f, ay + (by - ay) * f]
    }
    remaining -= segLen
  }
  return points[points.length - 1]
}

export default function circuitPulse(nx, ny, t) {
  let density = 0

  TRACES.forEach((trace, i) => {
    const length = LENGTHS[i]

    // The trace itself, faint and constant — nearest point on each segment.
    for (let s = 0; s < trace.points.length - 1; s++) {
      const [ax, ay] = trace.points[s]
      const [bx, by] = trace.points[s + 1]
      const segLen2 = (bx - ax) ** 2 + (by - ay) ** 2
      const f = segLen2 === 0 ? 0 : Math.max(0, Math.min(1,
        ((nx - ax) * (bx - ax) + (ny - ay) * (by - ay)) / segLen2))
      const px = ax + (bx - ax) * f
      const py = ay + (by - ay) * f
      const dist = Math.hypot(nx - px, ny - py)
      if (dist < 0.045) density = Math.max(density, 0.18 * (1 - dist / 0.045))
    }

    // The travelling pulse, brighter and narrower, offset per trace so the
    // two never fire in step.
    const travel = (((t * trace.speed) % 1) + 1) % 1 * length
    const [px, py] = pointAt(trace.points, length, travel)
    const dist = Math.hypot(nx - px, ny - py)
    if (dist < 0.09) density = Math.max(density, 1 - dist / 0.09)
  })

  return density
}
