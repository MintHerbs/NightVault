/**
 * useAIState - the page-side half of the dynamic island contract (docs/rules.md §15).
 *
 * Two things every tool page needs and every tool page was re-deriving:
 *
 * 1. **A stable setter.** `App` recreates its `onAIStateChange` handler on every
 *    render, so a page that depends on the prop directly re-fires its island
 *    effects on unrelated re-renders. The handler lives in a ref and callers get
 *    an identity-stable wrapper.
 *
 * 2. **A minimum dwell.** Work that finishes synchronously — parsing an
 *    expression, minimising a K-map — sets a state and clears it inside the same
 *    frame, so the island paints nothing at all. `hold()` records when the state
 *    started and `release()` waits out the remainder before going idle.
 *
 * The dwell belongs here rather than in the island: the island's job is to show
 * the state it is given, not to guess how long that state should have lasted.
 */
import { useCallback, useEffect, useRef } from 'react'

/** Long enough to register as a state rather than a flicker. */
export const MINIMUM_DWELL_MS = 700

/**
 * How much longer a state must stay on screen before it may be cleared.
 *
 * Split out and exported so the rule can be tested without a renderer — this
 * project has no React test framework by decision (T-039), and the arithmetic
 * is the part that can be wrong.
 *
 * @param {number|null} startedAt - epoch ms the state was set, or null if none
 * @param {number} now
 * @param {number} minimumDwellMs
 * @returns {number} milliseconds still owed, never negative
 */
export function dwellRemaining(startedAt, now, minimumDwellMs) {
  if (startedAt === null || startedAt === undefined) return 0
  // A clock that jumped backwards must not owe a negative wait, which would
  // schedule a timeout that never fires the way the caller expects.
  return Math.max(0, minimumDwellMs - (now - startedAt))
}

export default function useAIState(onAIStateChange, { minimumDwellMs = MINIMUM_DWELL_MS } = {}) {
  const notifyRef = useRef(onAIStateChange)
  const heldSinceRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => { notifyRef.current = onAIStateChange }, [onAIStateChange])

  const emit = useCallback((state) => {
    if (typeof notifyRef.current === 'function') notifyRef.current(state)
  }, [])

  const clearPending = useCallback(() => {
    if (timeoutRef.current === null) return
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  /** Set a state now, cancelling any pending release. */
  const setAIState = useCallback((state) => {
    clearPending()
    heldSinceRef.current = state === 'idle' ? null : Date.now()
    emit(state)
  }, [clearPending, emit])

  /** Set a state and guarantee it stays visible for the dwell. */
  const hold = useCallback((state) => {
    clearPending()
    heldSinceRef.current = Date.now()
    emit(state)
  }, [clearPending, emit])

  /**
   * Back to idle, no sooner than the dwell allows.
   *
   * @param {string} [state] - what to settle on instead of idle, e.g. 'error'
   */
  const release = useCallback((state = 'idle') => {
    const remaining = dwellRemaining(heldSinceRef.current, Date.now(), minimumDwellMs)

    clearPending()
    if (remaining <= 0) {
      heldSinceRef.current = null
      emit(state)
      return
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      heldSinceRef.current = null
      emit(state)
    }, remaining)
  }, [clearPending, emit, minimumDwellMs])

  // Leaving the page must never strand the pill mid-animation, and a pending
  // release firing after unmount would set a state for a page that is gone.
  useEffect(() => () => {
    clearPending()
    emit('idle')
  }, [clearPending, emit])

  return { setAIState, hold, release }
}
