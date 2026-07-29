import { useCallback, useEffect, useRef, useState } from 'react'

// Hourly "take a break" reminder for the Dynamic Island (T-080).
//
// Counts *active* time, not wall clock: the accumulator only advances while
// the document is visible. A tab left open overnight would otherwise bank a
// pile of reminders and fire them at a page nobody is looking at.
//
// Note the deliberate asymmetry with useChatNotification, which drops
// anything it can't show immediately. This one stays due until it has
// actually been displayed, because it is hourly and intentional — a minute
// late is fine, silently lost is not.

export const BREAK_INTERVAL_MS = 60 * 60 * 1000
const SAMPLE_MS = 5000

export default function useBreakReminder(intervalMs = BREAK_INTERVAL_MS) {
  const [isDue, setIsDue] = useState(false)
  const activeMsRef = useRef(0)
  const lastSampleRef = useRef(Date.now())

  useEffect(() => {
    const sample = () => {
      const now = Date.now()
      const elapsed = now - lastSampleRef.current
      lastSampleRef.current = now

      // Time spent hidden is discarded, not banked.
      if (document.hidden) return

      activeMsRef.current += elapsed
      if (activeMsRef.current >= intervalMs) {
        activeMsRef.current = 0
        setIsDue(true)
      }
    }

    // Re-baseline on the way back so the hidden stretch isn't counted as
    // one huge active sample.
    const onVisibilityChange = () => {
      lastSampleRef.current = Date.now()
    }

    const id = setInterval(sample, SAMPLE_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs])

  const dismiss = useCallback(() => setIsDue(false), [])

  return { isDue, dismiss }
}
