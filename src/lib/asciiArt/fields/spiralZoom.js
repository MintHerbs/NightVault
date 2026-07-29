// Nested square rings zooming inward — Recurrence Relation tool card
// (T-077): each ring is the same shape as the last, one level down, the
// way a recurrence unfolds into smaller copies of itself.

export default function spiralZoom(nx, ny, t) {
  const chebyshev = Math.max(Math.abs(nx), Math.abs(ny))
  const zoom = (chebyshev - t * 0.25) % 0.28
  const ringWidth = 0.05
  const onRing = Math.abs(zoom) < ringWidth || Math.abs(zoom - 0.28) < ringWidth
  if (!onRing) return 0

  const rim = Math.max(0, 1 - chebyshev * 0.9)
  return 0.5 * rim + 0.5
}
