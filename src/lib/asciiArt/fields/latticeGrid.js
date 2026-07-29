// A slowly rotating lattice whose grid lines pulse between two densities —
// Math with Computer Science course card (T-077): a coordinate grid (the
// math) traced out like a circuit (the CS), spinning as one shape.

export default function latticeGrid(nx, ny, t) {
  const spin = t * 0.35
  const cos = Math.cos(spin)
  const sin = Math.sin(spin)
  const rx = nx * cos - ny * sin
  const ry = nx * sin + ny * cos

  const r = Math.hypot(nx, ny)
  const rim = Math.max(0, 1 - r * 0.85)
  if (rim <= 0) return 0

  // Line width is tuned wider than the character grid's cell pitch (26x15,
  // T-077) so a line always lands on at least one cell instead of being
  // aliased away between samples.
  const lineX = Math.abs(Math.sin(rx * 4))
  const lineY = Math.abs(Math.sin(ry * 4))
  const onLine = Math.max(1 - lineX * 3, 0) + Math.max(1 - lineY * 3, 0)
  const pulse = 0.7 + 0.3 * Math.sin(t * 1.6 + r * 4)

  return Math.min(1, onLine * pulse) * rim
}
