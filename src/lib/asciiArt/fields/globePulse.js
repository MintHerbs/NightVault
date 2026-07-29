// A rotating globe of latitude rings — Socials card (T-077): a small
// stand-in for "a community," distinct from any one course's animation.

export default function globePulse(nx, ny, t) {
  const r = Math.hypot(nx, ny)
  if (r > 0.85) return 0

  const spin = t * 0.6
  const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
  const lat = Math.asin(ny)
  const lon = Math.atan2(z, nx) + spin

  const onLatLine = Math.abs(Math.sin(lat * 6)) < 0.12
  const onLonLine = Math.abs(Math.sin(lon * 5)) < 0.12
  if (!onLatLine && !onLonLine) return 0.08 // faint fill so the disc silhouette still reads

  const pulse = 0.5 + 0.5 * Math.sin(t * 1.2)
  return 0.6 + 0.4 * pulse
}
