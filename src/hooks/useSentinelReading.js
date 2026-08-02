/**
 * useSentinelReading - what Sentinel makes of how you read a note.
 *
 * Three observations, all from the scroll position of a single document:
 *
 *   finished  reached the bottom of something actually long
 *   skimming  covered a lot of it faster than anyone reads
 *   again     opened the same note for the third time this session
 *
 * Kept out of NotesPage itself because none of it is the reader's concern, and
 * because the throttling matters: a scroll handler is the one place in this app
 * where doing work per event is genuinely expensive.
 *
 * @param {object} args
 * @param {string} args.noteKey - stable id for the note being read
 * @param {boolean} args.ready - whether the note has actually loaded
 * @param {boolean} [args.enabled]
 */
import { useEffect, useRef } from 'react'
import { fireQuip } from './useSentinelQuip'

/** Below this the document is not long enough for finishing it to mean much. */
export const LONG_NOTE_PX = 2000

/** How close to the end counts as the end. */
export const BOTTOM_SLACK_PX = 80

/** Pixels per second past which nobody is reading the words. */
export const SKIM_SPEED_PX_S = 2200

/** Sustained for this long before it counts as skimming rather than a flick. */
export const SKIM_SUSTAIN_MS = 1200

/** Opens of the same note, this session, before it is worth mentioning. */
export const REPEAT_OPENS = 3

// Session-scoped and in memory: this is about one sitting, and a count that
// survived a reload would say "this one again" to someone opening it fresh
// tomorrow.
const opensThisSession = new Map()

export default function useSentinelReading({ noteKey, ready, enabled = true }) {
  const saidFinished = useRef(false)

  // Reopening. Counted on the note becoming ready rather than on mount, so a
  // note that failed to load is not counted as read.
  useEffect(() => {
    if (!enabled || !ready || !noteKey) return
    const opens = (opensThisSession.get(noteKey) ?? 0) + 1
    opensThisSession.set(noteKey, opens)
    if (opens === REPEAT_OPENS) fireQuip({ kind: 'moment', id: 'note-again' })
  }, [enabled, ready, noteKey])

  // Reset per note, so finishing one does not silence finishing the next.
  useEffect(() => { saidFinished.current = false }, [noteKey])

  useEffect(() => {
    if (!enabled || !ready) return undefined

    let lastY = window.scrollY
    let lastAt = performance.now()
    let fastSince = null
    let ticking = false

    const measure = () => {
      ticking = false
      const now = performance.now()
      const y = window.scrollY
      const dt = now - lastAt
      // A frame with no elapsed time cannot produce a speed; skip rather than
      // divide by zero into Infinity and call it skimming.
      if (dt <= 0) return

      const speed = (Math.abs(y - lastY) / dt) * 1000
      lastY = y
      lastAt = now

      const docHeight = document.documentElement.scrollHeight
      const viewport = window.innerHeight

      if (speed >= SKIM_SPEED_PX_S) {
        if (fastSince === null) fastSince = now
        else if (now - fastSince >= SKIM_SUSTAIN_MS) {
          fastSince = null
          fireQuip({ kind: 'moment', id: 'skimming' })
        }
      } else {
        fastSince = null
      }

      if (
        !saidFinished.current &&
        docHeight >= LONG_NOTE_PX &&
        y + viewport >= docHeight - BOTTOM_SLACK_PX
      ) {
        saidFinished.current = true
        fireQuip({ kind: 'moment', id: 'finished-note' })
      }
    }

    // rAF-throttled: scroll fires far faster than the screen repaints, and the
    // measurement reads layout properties that would otherwise force one sync
    // reflow per event.
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(measure)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enabled, ready, noteKey])
}
