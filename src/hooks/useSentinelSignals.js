/**
 * useSentinelSignals - the moments Sentinel notices without any page's help.
 *
 * Every one of these is a browser-level signal, so they are wired once here
 * rather than being sprinkled through the pages they happen on. That is the
 * point: a copy-to-clipboard quip written per code block would mean editing
 * every component that renders one, and would still miss the next.
 *
 * Mounted once, from App. Everything is a passive listener on window or
 * document and every handler ends in fireQuip, which gates itself and cannot
 * throw, so none of this can interfere with the event it observes.
 */
import { useEffect } from 'react'
import { fireQuip } from './useSentinelQuip'
import {
  nextRecord,
  readVisitRecord,
  sessionMomentFor,
  writeVisitRecord,
} from '../lib/sentinel/session'

/**
 * How long after arriving the timing remark lands.
 *
 * Long enough to clear the entrance and whatever the arrival itself said: the
 * pill greets for up to ~8s, and a route quip fires as it settles. Landing
 * inside the emitter's 20s floor would simply drop this one, so it waits until
 * the floor has passed and reads as Sentinel noticing rather than announcing.
 */
export const SESSION_MOMENT_DELAY_MS = 30000

/** Away for at least this long before coming back is worth a word. */
export const AWAY_MS = 5 * 60 * 1000

/**
 * Silence from dragover this long means the drag is over.
 *
 * There is no reliable single "drag left the window" event: dragleave fires
 * spuriously every time the pointer crosses a child element, and drop only
 * fires if something actually accepts the file. Absence of dragover is the
 * signal that does not lie.
 */
export const DRAG_END_MS = 400

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
]

export default function useSentinelSignals({ enabled = true } = {}) {
  // The timing remark, once per page load. Reads and advances the visit record
  // on mount so the streak is counted even if the remark itself never fires.
  useEffect(() => {
    if (!enabled) return undefined

    const now = Date.now()
    const previous = readVisitRecord()
    const record = nextRecord(previous, now)
    writeVisitRecord(record)

    const moment = sessionMomentFor({ now, record, wasFirstEver: previous === null })
    if (!moment) return undefined

    const timeout = setTimeout(() => fireQuip(moment), SESSION_MOMENT_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [enabled])

  // Connectivity. Both directions, because "we're back" only means anything to
  // someone who saw "no connection".
  useEffect(() => {
    if (!enabled) return undefined

    const onOffline = () => fireQuip({ kind: 'moment', id: 'offline' })
    const onOnline = () => fireQuip({ kind: 'moment', id: 'online' })

    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled])

  // Copying anything, printing anything, and dragging a file onto the window.
  // All three are document-level, so they cover every code block, every note
  // and every dropzone without those knowing Sentinel exists.
  useEffect(() => {
    if (!enabled) return undefined

    const onCopy = () => {
      // An empty selection means something copied programmatically with
      // nothing to show for it, which is not worth confirming.
      const selection = document.getSelection()?.toString() ?? ''
      if (!selection.trim()) return
      fireQuip({ kind: 'moment', id: 'copied' })
    }

    const onPrint = () => fireQuip({ kind: 'moment', id: 'print' })

    // dragover fires continuously for as long as the pointer is over the
    // window, tens of times a second. fireQuip is cheap but not free (it reads
    // and parses localStorage until something has fired), so this collapses a
    // whole drag into one attempt: the flag is raised on the first event and
    // only lowered once the events stop arriving.
    let dragging = false
    let dragIdle = null

    const onDragOver = (e) => {
      // Only a real file drag. Dragging text or an image within the page fires
      // the same event and is not Sentinel catching anything.
      if (!e.dataTransfer?.types?.includes('Files')) return

      clearTimeout(dragIdle)
      dragIdle = setTimeout(() => { dragging = false }, DRAG_END_MS)

      if (dragging) return
      dragging = true
      fireQuip({ kind: 'moment', id: 'drag' })
    }

    document.addEventListener('copy', onCopy)
    window.addEventListener('beforeprint', onPrint)
    window.addEventListener('dragover', onDragOver)
    return () => {
      clearTimeout(dragIdle)
      document.removeEventListener('copy', onCopy)
      window.removeEventListener('beforeprint', onPrint)
      window.removeEventListener('dragover', onDragOver)
    }
  }, [enabled])

  // Coming back after a real absence. The threshold is what keeps this from
  // firing on every alt-tab: glancing at another window is not going away.
  useEffect(() => {
    if (!enabled) return undefined

    let hiddenAt = null
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_MS) {
        fireQuip({ kind: 'moment', id: 'back-again' })
      }
      hiddenAt = null
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled])

  // The egg. Matched on a rolling index rather than a buffer of keys, so no
  // per-keystroke allocation and no way for a long session to accumulate one.
  useEffect(() => {
    if (!enabled) return undefined

    let index = 0
    const onKeyDown = (e) => {
      // Ignore typing: the sequence is only meant to be reachable from the
      // page itself, and matching inside a note editor would be a nuisance.
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return

      const expected = KONAMI[index]
      const matched = expected.length === 1
        ? e.key.toLowerCase() === expected
        : e.key === expected

      if (!matched) {
        // A wrong key restarts, but may itself be the first key of a new
        // attempt, which a plain reset to 0 would swallow.
        index = e.key === KONAMI[0] ? 1 : 0
        return
      }

      index += 1
      if (index === KONAMI.length) {
        index = 0
        fireQuip({ kind: 'easter', id: 'konami' })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
