import { useCallback, useEffect, useRef, useState } from 'react'

// Study timer for the Dynamic Island (T-081).
//
// Deadline-based rather than decrement-based: a background tab throttles
// setInterval to roughly once a second, so counting down by a fixed step per
// tick would drift badly over a long sit. Storing the deadline and subtracting
// from Date.now() means a throttled tick just renders a coarser countdown,
// never a wrong one.
//
// Duration is held in milliseconds, not minutes, so an arbitrary hours +
// minutes selection is representable alongside the quick presets.

export const TIMER_PRESETS = [5, 15, 25, 50]
export const MAX_HOURS = 12

const DEFAULT_MS = 25 * 60 * 1000
const MAX_MS = MAX_HOURS * 60 * 60 * 1000
const TICK_MS = 250

function formatDuration(ms) {
  const total = Math.ceil(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  // Hours only appear once they exist, so a 25 minute sit still reads 25:00
  // rather than 0:25:00.
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function splitDuration(ms) {
  const totalMinutes = Math.round(ms / 60000)
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  }
}

export default function useStudyTimer() {
  const [durationMs, setDurationMs] = useState(DEFAULT_MS)
  // null means the timer isn't armed at all.
  const [remainingMs, setRemainingMs] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [hasFinished, setHasFinished] = useState(false)
  const deadlineRef = useRef(null)

  useEffect(() => {
    if (!isRunning) return undefined

    const tick = () => {
      const left = Math.max(deadlineRef.current - Date.now(), 0)
      setRemainingMs(left)
      if (left === 0) {
        setIsRunning(false)
        setHasFinished(true)
      }
    }

    tick()
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [isRunning])

  const selectDuration = useCallback((ms) => {
    const safe = Math.max(0, Math.min(ms, MAX_MS))
    setDurationMs(safe)
    setRemainingMs(safe)
    setIsRunning(false)
    setHasFinished(false)
    deadlineRef.current = null
  }, [])

  const selectMinutes = useCallback(
    (minutes) => selectDuration(minutes * 60 * 1000),
    [selectDuration]
  )

  // Set and run in one step, for the custom panel's Start button.
  const start = useCallback((ms) => {
    const safe = Math.max(0, Math.min(ms, MAX_MS))
    if (safe === 0) return
    setDurationMs(safe)
    setRemainingMs(safe)
    setHasFinished(false)
    deadlineRef.current = Date.now() + safe
    setIsRunning(true)
  }, [])

  const toggle = useCallback(() => {
    setHasFinished(false)
    setIsRunning((running) => {
      if (running) return false
      // Resume from whatever is left, or arm a fresh run from the duration.
      // A *finished* timer counts as the latter: remainingMs is 0 at that
      // point, and treating 0 as "nothing to run" left the play button
      // silently doing nothing after a timer completed, with no way back
      // other than re-picking a preset.
      const left = remainingMs === null || remainingMs === 0 ? durationMs : remainingMs
      if (left === 0) return false
      deadlineRef.current = Date.now() + left
      return true
    })
  }, [durationMs, remainingMs])

  const reset = useCallback(() => {
    setIsRunning(false)
    setHasFinished(false)
    setRemainingMs(null)
    deadlineRef.current = null
  }, [])

  const acknowledgeFinish = useCallback(() => setHasFinished(false), [])

  // Only a duration that exactly matches a preset lights one up; a custom
  // 1h 20m must not leave "50" looking selected.
  const activePreset = TIMER_PRESETS.find((m) => m * 60 * 1000 === durationMs) ?? null

  return {
    presets: TIMER_PRESETS,
    activePreset,
    durationMs,
    durationLabel: formatDuration(durationMs),
    remainingMs,
    remainingLabel: remainingMs === null ? null : formatDuration(remainingMs),
    isRunning,
    isArmed: remainingMs !== null,
    hasFinished,
    selectDuration,
    selectMinutes,
    start,
    toggle,
    reset,
    acknowledgeFinish
  }
}
