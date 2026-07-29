// A handful of connected nodes with edges that pulse in sequence — ERD
// tool card (T-077), evoking entities linked by relationships.

const NODES = [
  [-0.55, -0.5], [0.5, -0.55], [-0.6, 0.5], [0.55, 0.5], [0, 0],
]
const EDGES = [[0, 4], [1, 4], [2, 4], [3, 4]]

export default function graphPulse(nx, ny, t) {
  let density = 0

  NODES.forEach(([x, y]) => {
    const d = Math.hypot(nx - x, ny - y)
    density = Math.max(density, Math.max(0, 1 - d / 0.16))
  })

  EDGES.forEach(([a, b], i) => {
    const [ax, ay] = NODES[a]
    const [bx, by] = NODES[b]
    const distToSegment = pointToSegmentDistance(nx, ny, ax, ay, bx, by)
    const pulse = 0.4 + 0.6 * ((Math.sin(t * 1.6 - i * 1.1) + 1) / 2)
    density = Math.max(density, Math.max(0, 1 - distToSegment / 0.025) * pulse)
  })

  return density
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const tRaw = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq
  const tClamped = Math.max(0, Math.min(1, tRaw))
  const closestX = ax + tClamped * dx
  const closestY = ay + tClamped * dy
  return Math.hypot(px - closestX, py - closestY)
}
