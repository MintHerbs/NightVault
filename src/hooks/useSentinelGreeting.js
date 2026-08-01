/**
 * useSentinelGreeting - what the island's one-time entrance says.
 *
 * A visitor who has never loaded the site gets introduced to the pill by
 * name; everyone else gets a short, varied welcome-back line so the same
 * entrance doesn't read identically on every visit. Decided once per hook
 * instance via lazy state, not recomputed on re-render, so the line can't
 * change mid-hold if something else re-renders DynamicIsland.
 *
 * The read and the write are deliberately split. StrictMode double-invokes
 * a lazy useState initializer on mount; a single read-then-write function
 * there would let the second invocation observe the first invocation's own
 * write and misread a first-ever visit as a returning one. Reading stays in
 * the (pure) initializer; marking the visit moves to an effect, which is
 * safe to double-fire since writing 'true' twice is a no-op.
 */
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'sentinel-visited'

const WELCOME_BACK_LINES = [
  'Welcome back',
  'Glad to see you',
  'Good to see you again',
  "Hey, you're back",
  'Missed you',
]

// Same trade-off useTheme and useIslandNotifications take: private mode and
// friends can't remember a visit, so it reads as a first visit every time
// rather than throwing.
function readVisited() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markVisited() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // Private mode and friends: the choice still holds for this page load,
    // it just won't be remembered next time.
  }
}

export default function useSentinelGreeting() {
  const [greeting] = useState(() => {
    if (!readVisited()) {
      return { isFirstVisit: true, line: "Hi, I'm Sentinel" }
    }
    const line = WELCOME_BACK_LINES[Math.floor(Math.random() * WELCOME_BACK_LINES.length)]
    return { isFirstVisit: false, line }
  })

  useEffect(() => { markVisited() }, [])

  return greeting
}
