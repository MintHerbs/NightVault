/**
 * useSentinelIdle - the pill's resting face when nobody is doing anything.
 *
 * Not a quip. A quip is a 2.6s remark about something that just happened; this
 * is a persistent change to what `idle` looks like, so it lives outside the
 * emitter and is read directly by DynamicIsland.
 *
 *   awake    the ordinary green dot, unchanged
 *   drowsy   a half-lidded face, after a couple of minutes untouched
 *   asleep   eyes closed, after ten
 *
 * Waking fires the one quip this hook owns: a wordless startle, so coming back
 * to the tab gets a reaction rather than a silent swap back to the dot.
 *
 * The late-hour shortening is the whole of the "mood" idea in practice. Rather
 * than a mood variable nothing reads, Sentinel simply gets tired sooner after
 * midnight, which is the only place a mood would have been visible anyway.
 */
import { useEffect, useRef, useState } from 'react'
import { fireQuip } from './useSentinelQuip'
import { isLateHour } from '../lib/sentinel/session'

export const DROWSY_MS = 2 * 60 * 1000
export const ASLEEP_MS = 10 * 60 * 1000

/** After midnight the same stillness reads as tired sooner. */
export const LATE_HOUR_FACTOR = 0.5

/**
 * Activity worth counting. Deliberately not 'mousemove': a mouse drifting over
 * a trackpad without intent would hold Sentinel awake indefinitely, and
 * 'pointerdown' plus keys plus scroll is what actually says someone is there.
 *
 * All passive, all on window, so none of them can delay a scroll or a tap.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart']

export default function useSentinelIdle({ enabled = true } = {}) {
  const [state, setState] = useState('awake')
  const stateRef = useRef('awake')

  useEffect(() => {
    if (!enabled) {
      setState('awake')
      stateRef.current = 'awake'
      return undefined
    }

    let drowsyTimer = null
    let asleepTimer = null

    const clear = () => {
      clearTimeout(drowsyTimer)
      clearTimeout(asleepTimer)
    }

    const arm = () => {
      clear()
      const factor = isLateHour(Date.now()) ? LATE_HOUR_FACTOR : 1
      drowsyTimer = setTimeout(() => {
        stateRef.current = 'drowsy'
        setState('drowsy')
      }, DROWSY_MS * factor)
      asleepTimer = setTimeout(() => {
        stateRef.current = 'asleep'
        setState('asleep')
      }, ASLEEP_MS * factor)
    }

    const wake = () => {
      const was = stateRef.current
      if (was !== 'awake') {
        stateRef.current = 'awake'
        setState('awake')
        // Only a full sleep earns the startle. Surfacing one every time the
        // pill had merely gone drowsy would put a flash on the pill several
        // times an hour, which is the opposite of restful.
        if (was === 'asleep') fireQuip({ kind: 'moment', id: 'startle' })
      }
      arm()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, wake, { passive: true })
    }
    // Coming back to the tab counts as activity: the timers kept running while
    // it was hidden, so without this the pill would be asleep on return and
    // only wake on the first click.
    document.addEventListener('visibilitychange', wake)

    arm()

    return () => {
      clear()
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [enabled])

  return state
}
