import { motion } from 'motion/react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import styles from './DynamicIsland.module.css'

// Stops the pill's own click handler from treating a control press as
// "open the music player".
function contain(handler) {
  return (e) => {
    e.stopPropagation()
    handler()
  }
}

export default function TimerPanel({
  presets,
  activePreset,
  durationLabel,
  remainingLabel,
  isRunning,
  isArmed,
  onSelectMinutes,
  onOpenCustom,
  onToggle,
  onReset
}) {
  return (
    <div className={styles.timerPanel}>
      {/* The time itself is the way into the custom picker. No separate icon:
          the readout is the biggest, most obvious target in the panel, and
          tapping the time to edit it is the expected gesture (T-081). */}
      <button
        type="button"
        className={styles.timerReadout}
        onClick={contain(onOpenCustom)}
        aria-label="Set a custom time in hours and minutes"
      >
        {remainingLabel ?? durationLabel}
      </button>

      <div className={styles.timerPresets}>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={styles.timerPreset}
            data-selected={preset === activePreset ? 'true' : undefined}
            onClick={contain(() => onSelectMinutes(preset))}
            aria-label={`Set timer to ${preset} minutes`}
            aria-pressed={preset === activePreset}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className={styles.timerControls}>
        <motion.button
          type="button"
          className={styles.controlButton}
          onClick={contain(onToggle)}
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
        </motion.button>

        <motion.button
          type="button"
          className={styles.controlButton}
          onClick={contain(onReset)}
          aria-label="Reset timer"
          disabled={!isArmed && !isRunning}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <RotateCcw size={16} />
        </motion.button>
      </div>
    </div>
  )
}
