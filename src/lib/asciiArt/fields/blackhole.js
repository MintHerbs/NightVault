// Spinning accretion-disk vortex — Computer Science course card (T-077).
// Density comes from a swirl angle (polar angle + log-radius, both rotating
// against t) so the arms wind inward like a spiral galaxy, with a dark,
// silent "event horizon" at the center and a soft falloff at the rim.

export default function blackhole(nx, ny, t) {
  const r = Math.hypot(nx, ny)
  if (r < 0.14) return 0 // event horizon: nothing escapes, so nothing renders

  const angle = Math.atan2(ny, nx)
  const swirl = angle * 3 + Math.log(r + 0.2) * 4.5 - t * 1.1
  const arms = (Math.sin(swirl) + 1) / 2
  const rim = Math.max(0, 1 - r * 0.85)
  return arms * rim
}
