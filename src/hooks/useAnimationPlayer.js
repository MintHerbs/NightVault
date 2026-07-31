// React hook for playing through animation steps with timing control.
// Manages: current step index, play/pause state, speed, navigation.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

const DEFAULTS = {
  // Start playing as soon as a new run arrives, rather than waiting for a click.
  autoPlay: false,
  initialSpeed: 1,
  minSpeed: 0.5,
  maxSpeed: 2,
  // Milliseconds per step at 1x for a short run.
  baseDelay: 1000,
  // Ceiling on the whole run at 1x. A tableau for a hairy formula can be a thousand
  // steps long; at a flat 1s each that is a twenty-minute animation nobody watches.
  // Long runs get proportionally quicker steps instead.
  maxTotalMs: Infinity
}

/**
 * Custom hook for managing animation playback.
 *
 * @param {Array} steps - Array of animation step objects
 * @param {Object} [options] - see DEFAULTS
 * @returns {Object} - Playback state and controls
 */
export function useAnimationPlayer(steps = [], options = {}) {
  const { autoPlay, initialSpeed, minSpeed, maxSpeed, baseDelay, maxTotalMs } = {
    ...DEFAULTS,
    ...options
  }

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(initialSpeed)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const intervalRef = useRef(null)

  const totalSteps = steps.length

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(query.matches)

    const handleChange = (e) => setPrefersReducedMotion(e.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  // Per-step delay at 1x. Short runs get the full baseDelay; long ones are compressed so
  // the whole animation still fits inside maxTotalMs.
  const stepDelay = useMemo(() => {
    if (totalSteps === 0) return baseDelay
    return Math.max(16, Math.min(baseDelay, maxTotalMs / totalSteps))
  }, [totalSteps, baseDelay, maxTotalMs])

  // Reset when a genuinely different run arrives. Comparing the array identity alone
  // would re-fire on every render for callers that pass a fresh `steps || []`.
  const stepsRef = useRef(null)
  useEffect(() => {
    if (stepsRef.current === steps) return
    stepsRef.current = steps

    if (totalSteps === 0) {
      setCurrentStepIndex(0)
      setIsPlaying(false)
      return
    }

    // Someone who has asked for reduced motion gets the finished result, not a
    // step-by-step build (docs/rules.md §10.3).
    if (autoPlay && prefersReducedMotion) {
      setCurrentStepIndex(totalSteps - 1)
      setIsPlaying(false)
      return
    }

    setCurrentStepIndex(0)
    setIsPlaying(autoPlay)
  }, [steps, totalSteps, autoPlay, prefersReducedMotion])

  const play = useCallback(() => {
    if (totalSteps === 0) return
    // Replay from the start rather than sitting on the last frame doing nothing.
    setCurrentStepIndex((prev) => (prev >= totalSteps - 1 ? 0 : prev))
    setIsPlaying(true)
  }, [totalSteps])

  const pause = useCallback(() => setIsPlaying(false), [])

  const togglePlayPause = useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, play, pause])

  const next = useCallback(() => {
    setIsPlaying(false)
    setCurrentStepIndex((prev) => Math.min(totalSteps - 1, prev + 1))
  }, [totalSteps])

  const prev = useCallback(() => {
    setIsPlaying(false)
    setCurrentStepIndex((p) => Math.max(0, p - 1))
  }, [])

  const goToStep = useCallback((index) => {
    setIsPlaying(false)
    setCurrentStepIndex(Math.max(0, Math.min(totalSteps - 1, index)))
  }, [totalSteps])

  const skipToEnd = useCallback(() => {
    setIsPlaying(false)
    setCurrentStepIndex(Math.max(0, totalSteps - 1))
  }, [totalSteps])

  const updateSpeed = useCallback((newSpeed) => {
    setSpeed(Math.max(minSpeed, Math.min(maxSpeed, newSpeed)))
  }, [minSpeed, maxSpeed])

  const reset = useCallback(() => {
    setCurrentStepIndex(0)
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    if (!isPlaying || totalSteps === 0) return

    intervalRef.current = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= totalSteps - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, stepDelay / speed)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, speed, stepDelay, totalSteps])

  const currentStep = steps[currentStepIndex] || null

  return {
    // State
    currentStepIndex,
    currentStep,
    isPlaying,
    speed,
    minSpeed,
    maxSpeed,
    isAtStart: currentStepIndex === 0,
    isAtEnd: totalSteps === 0 || currentStepIndex >= totalSteps - 1,
    hasSteps: totalSteps > 0,
    totalSteps,
    prefersReducedMotion,

    // Controls
    play,
    pause,
    togglePlayPause,
    next,
    prev,
    goToStep,
    skipToEnd,
    updateSpeed,
    reset
  }
}
