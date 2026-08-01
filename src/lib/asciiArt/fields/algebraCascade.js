// Rows of terms breathing in and out, some collapsing toward the centre —
// Boolean Algebra card: each row is a product term in a sum, and a term
// shrinking away is the simplification search finding it can be absorbed.

const ROWS = [
  { y: -0.55, phase: 0.0, base: 0.55 },
  { y: -0.18, phase: 1.3, base: 0.75 },
  { y: 0.18, phase: 2.6, base: 0.4 },
  { y: 0.55, phase: 4.2, base: 0.65 },
]

const HALF_HEIGHT = 0.11

export default function algebraCascade(nx, ny, t) {
  let density = 0

  for (const row of ROWS) {
    const dy = Math.abs(ny - row.y)
    if (dy > HALF_HEIGHT) continue

    // Width breathes between roughly two fifths and the row's full extent —
    // a term that shrinks all the way toward the centre reads as cancelled.
    const width = row.base * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.55 + row.phase)))
    if (Math.abs(nx) > width) continue

    const edge = Math.min(1, (1 - Math.abs(nx) / width) * 2.2)
    const band = 1 - dy / HALF_HEIGHT
    density = Math.max(density, edge * band)
  }

  return density
}
