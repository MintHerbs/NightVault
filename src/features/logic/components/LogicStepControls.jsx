// LogicStepControls - transport bar for logic animations.
//
// Playback starts on its own, so the middle button is a pause (and a replay once the
// run has finished) rather than a gate the visitor has to open first (T-084).
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import styles from './LogicStepControls.module.css'

const SPEEDS = [0.5, 1, 2, 4]

// Deliberately not colour-coded. Red/green would read backwards half the time: in
// validity mode every branch closing (all ✗, all red on the canvas) is what makes the
// formula *valid*. The verdict is a result, not a pass or a fail.
export default function LogicStepControls({ player, verdict = '' }) {
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
    updateSpeed
  } = player

  const description = currentStep?.description || 'Ready'
  const stepNumber = hasSteps ? currentStepIndex + 1 : 0
  const finished = isAtEnd && !isPlaying

  const PlayIcon = finished ? RotateCcw : isPlaying ? Pause : Play
  const playLabel = finished ? 'Replay' : isPlaying ? 'Pause' : 'Play'

  return (
    <div className={styles.controls}>
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
          aria-label="Skip to the finished tableau"
          title="Skip to the finished tableau"
        >
          <SkipForward size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.progress}>
        <div className={styles.descriptionRow}>
          {verdict && (
            <span className={styles.verdict}>
              <span className={styles.verdictLabel}>Result</span>
              {verdict}
            </span>
          )}
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
