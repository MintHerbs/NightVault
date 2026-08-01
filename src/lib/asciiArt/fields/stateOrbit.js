// A ring of states with one "current state" pulse drifting between them —
// State Machine card: the same circles-on-a-ring shape StateDiagramView draws,
// animated as a cover rather than a diagram.

const STATE_COUNT = 5
const RING_R = 0.62
const NODE_R = 0.18
const RING_BAND = 0.03

export default function stateOrbit(nx, ny, t) {
  let density = 0

  // The ring itself, faint — the transitions a state machine's states sit on.
  const r = Math.hypot(nx, ny)
  const ringDist = Math.abs(r - RING_R)
  if (ringDist < RING_BAND) density = 0.22 * (1 - ringDist / RING_BAND)

  const active = (t * 0.18) % 1 // how far around the ring the lit state is, in laps

  for (let i = 0; i < STATE_COUNT; i++) {
    const angle = (i / STATE_COUNT) * Math.PI * 2 - Math.PI / 2
    const cx = Math.cos(angle) * RING_R
    const cy = Math.sin(angle) * RING_R
    const dist = Math.hypot(nx - cx, ny - cy)
    if (dist > NODE_R) continue

    // Distance from the travelling pulse to this node, wrapped at the seam
    // so the last state is as close to the first as any other neighbour.
    const target = i / STATE_COUNT
    let gap = Math.abs(active - target)
    gap = Math.min(gap, 1 - gap)
    const lit = Math.max(0, 1 - gap * STATE_COUNT * 1.6)

    const body = 1 - dist / NODE_R
    density = Math.max(density, body * (0.32 + 0.68 * lit))
  }

  return density
}
