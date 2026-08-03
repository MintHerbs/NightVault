// Shared transport bar for step-by-step animations.
//
// Playback starts on its own, so the middle button is a pause (and a replay once
// the run has finished) rather than a gate the visitor has to open first.
//
// Promoted out of src/features/tree/ for T-105: the B+ tree and the sorting
// visualiser both drive a `useAnimationPlayer` of exactly this shape, and a
// third hand-written copy of the same eight buttons is what docs/rules.md §16.2
// names as a refactoring trigger. Every control here goes through the player,
// which is where the Sentinel acks are fired (docs/rules.md §15.5), so a tool
// gets its island responses by using this bar at all.
//
// src/features/logic/components/LogicStepControls.jsx is still a separate copy.
// It carries a verdict badge and is styled against the M3 token set rather than
// this one, so folding it in is a visual change to a shipped tool and belongs in
// its own ticket. The `note` slot below is the seam it would use.
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import styles from './StepControls.module.css'

const SPEEDS = [0.5, 1, 2, 4]

/**
 * @param {object}   props.player      - a useAnimationPlayer result
 * @param {string}   [props.variant]   - 'inline' (inside a positioned canvas) or 'fixed' (pinned to the viewport)
 * @param {string}   [props.accent]    - CSS colour for the active controls
 * @param {string}   [props.onAccent]  - CSS colour for text on the primary button
 * @param {node}     [props.note]      - optional badge shown before the description
 * @param {string}   [props.skipLabel] - what the skip button says it skips to
 */
function StepControls({
  player,
  variant = 'inline',
  accent = 'var(--accent-green)',
  onAccent = 'var(--on-accent-green)',
  note = null,
  skipLabel = 'Skip to the finished result',
}) {
  const {
    currentStepIndex,
    currentStep,
    isPlaying,
    speed,
    isAtStart,
    isAtEnd,
    hasSteps,
    totalSteps,
    togglePlayPause,
    next,
    prev,
    goToStep,
    skipToEnd,
    updateSpeed,
  } = player

  const description = currentStep?.description || 'Ready'
  const stepNumber = hasSteps ? currentStepIndex + 1 : 0
  const finished = isAtEnd && !isPlaying

  const PlayIcon = finished ? RotateCcw : isPlaying ? Pause : Play
  const playLabel = finished ? 'Replay' : isPlaying ? 'Pause' : 'Play'

  return (
    <div
      className={`${styles.controls} ${variant === 'fixed' ? styles.fixed : styles.inline}`}
      style={{ '--transport-accent': accent, '--transport-on-accent': onAccent }}
    >
      <div className={styles.transport}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={prev}
          disabled={isAtStart || !hasSteps}
          aria-label="Previous step"
          title="Previous step"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`${styles.iconButton} ${styles.primaryButton}`}
          onClick={togglePlayPause}
          disabled={!hasSteps}
          aria-label={playLabel}
          title={playLabel}
        >
          <PlayIcon size={20} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={next}
          disabled={isAtEnd || !hasSteps}
          aria-label="Next step"
          title="Next step"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={skipToEnd}
          disabled={isAtEnd || !hasSteps}
          aria-label={skipLabel}
          title={skipLabel}
        >
          <SkipForward size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.progress}>
        <div className={styles.descriptionRow}>
          {note}
          <p className={styles.description} aria-live="polite">{description}</p>
        </div>
        <div className={styles.trackRow}>
          <input
            type="range"
            className={styles.scrubber}
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={currentStepIndex}
            onChange={(e) => goToStep(Number(e.target.value))}
            disabled={!hasSteps}
            aria-label={`Step ${stepNumber} of ${totalSteps}`}
          />
          <span className={styles.stepCounter}>{stepNumber} / {totalSteps}</span>
        </div>
      </div>

      <div className={styles.speed} role="group" aria-label="Playback speed">
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            className={`${styles.speedOption} ${speed === option ? styles.speedActive : ''}`}
            onClick={() => updateSpeed(option)}
            disabled={!hasSteps}
            aria-pressed={speed === option}
          >
            {option}&times;
          </button>
        ))}
      </div>
    </div>
  )
}

export default StepControls
