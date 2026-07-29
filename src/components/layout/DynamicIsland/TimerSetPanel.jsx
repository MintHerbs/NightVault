import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { MAX_HOURS, splitDuration } from '../../../hooks/useStudyTimer'
import styles from './DynamicIsland.module.css'

// The island expands properly for this rather than trying to fit a picker into
// a pill, which is how the real Dynamic Island behaves too (owner direction,
// T-081).

const MINUTE_STEP = 5

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max))
}

// Accepts a partially typed field: '' and '0' both have to survive editing.
function parseField(raw, max) {
  const digits = raw.replace(/\D/g, '')
  if (digits === '') return 0
  return clamp(parseInt(digits, 10), 0, max)
}

function contain(handler) {
  return (e) => {
    e.stopPropagation()
    handler()
  }
}

export default function TimerSetPanel({ durationMs, onStart, onCancel }) {
  const initial = splitDuration(durationMs)
  const [hours, setHours] = useState(initial.hours)
  const [minutes, setMinutes] = useState(initial.minutes)

  const totalMs = (hours * 60 + minutes) * 60 * 1000
  const canStart = totalMs > 0

  const stepHours = (delta) => setHours((h) => clamp(h + delta, 0, MAX_HOURS))
  const stepMinutes = (delta) => setMinutes((m) => clamp(m + delta, 0, 59))

  return (
    <div className={styles.timerSetPanel} onClick={(e) => e.stopPropagation()}>
      <div className={styles.timerSetHeader}>Set a timer</div>

      <div className={styles.timerSetFields}>
        <div className={styles.timerSetField}>
          <button
            type="button"
            className={styles.timerStepper}
            onClick={contain(() => stepHours(-1))}
            aria-label="One hour fewer"
            disabled={hours === 0}
          >
            <Minus size={13} />
          </button>
          <label className={styles.timerSetLabelled}>
            <input
              className={styles.timerSetInput}
              value={String(hours)}
              inputMode="numeric"
              onChange={(e) => setHours(parseField(e.target.value, MAX_HOURS))}
              aria-label="Hours"
            />
            <span className={styles.timerSetUnit}>h</span>
          </label>
          <button
            type="button"
            className={styles.timerStepper}
            onClick={contain(() => stepHours(1))}
            aria-label="One hour more"
            disabled={hours >= MAX_HOURS}
          >
            <Plus size={13} />
          </button>
        </div>

        <div className={styles.timerSetField}>
          <button
            type="button"
            className={styles.timerStepper}
            onClick={contain(() => stepMinutes(-MINUTE_STEP))}
            aria-label={`${MINUTE_STEP} minutes fewer`}
            disabled={minutes === 0}
          >
            <Minus size={13} />
          </button>
          <label className={styles.timerSetLabelled}>
            <input
              className={styles.timerSetInput}
              value={String(minutes)}
              inputMode="numeric"
              onChange={(e) => setMinutes(parseField(e.target.value, 59))}
              aria-label="Minutes"
            />
            <span className={styles.timerSetUnit}>m</span>
          </label>
          <button
            type="button"
            className={styles.timerStepper}
            onClick={contain(() => stepMinutes(MINUTE_STEP))}
            aria-label={`${MINUTE_STEP} minutes more`}
            disabled={minutes >= 59}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      <div className={styles.timerSetActions}>
        <button
          type="button"
          className={styles.timerSetGhost}
          onClick={contain(onCancel)}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.timerSetPrimary}
          onClick={contain(() => onStart(totalMs))}
          disabled={!canStart}
        >
          Start
        </button>
      </div>
    </div>
  )
}
