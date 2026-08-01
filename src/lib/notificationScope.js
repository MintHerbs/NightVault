/**
 * Where the Dynamic Island is allowed to interrupt.
 *
 * Browsing is interruptible; working is not. Someone on the home page or
 * walking a course's folders can afford a pill. Someone inside a tool or
 * reading a note is mid-task, and a chat popup there costs them their place.
 *
 * Deliberately an allowlist. A blocklist of "tools and notes" would fail open:
 * every visualiser added later would start out interrupting people until
 * somebody remembered to add it here. This way a new route is quiet until it
 * is explicitly judged safe to interrupt on.
 *
 * The sidebar badge is unaffected everywhere. This governs the pill only.
 */

const INTERRUPTIBLE = [
  '/home',
  // A course landing page and the Drive-style folder browser: both are
  // "which notes do I want", not reading one.
  '/courses',
  '/notes-browser',
  // Social is the feed these notifications are about, so it is always fair
  // game. Chat's own panel suppresses per-kind separately.
  '/social',
]

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function allowsIslandNotifications(pathname) {
  if (!pathname) return false
  // '/' only ever exists for the tick before it redirects to /home; treating
  // it as quiet would flash the pill off and back on.
  if (pathname === '/') return true

  return INTERRUPTIBLE.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
