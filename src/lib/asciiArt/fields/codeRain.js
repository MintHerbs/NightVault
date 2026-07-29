// Matrix-style falling density columns — Code Complexity tool card
// (T-077). Each column has its own speed and phase so the "rain" doesn't
// read as a single scrolling sheet.

const COLUMNS = 14

export default function codeRain(nx, ny, t) {
  const col = Math.min(COLUMNS - 1, Math.floor(((nx + 1) / 2) * COLUMNS))
  const speed = 0.6 + (col % 5) * 0.15
  const phase = (col * 0.37) % 1
  const head = ((t * speed + phase) % 1.4) - 0.2 // travels from -0.2 to 1.2 in ny space, looping

  const trail = ny - head
  if (trail < -0.05 || trail > 0.6) return 0
  return Math.max(0, 1 - trail / 0.6)
}
