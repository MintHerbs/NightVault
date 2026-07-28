import { useMemo } from 'react'
import { Plus, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import styles from './PollBuilder.module.css'

const MAX_OPTIONS = 4
const MIN_OPTIONS = 2

function normalizePoll(poll) {
  if (poll?.type === 'binary') {
    return { type: 'binary', options: ['Yes', 'No'] }
  }

  const options = Array.isArray(poll?.options) ? poll.options : []
  const padded = [...options]
  while (padded.length < MIN_OPTIONS) padded.push('')
  return { type: 'poll', options: padded.slice(0, MAX_OPTIONS) }
}

export default function PollBuilder({ poll, onChange }) {
  const normalized = useMemo(() => normalizePoll(poll), [poll])
  const options = normalized.options

  if (normalized.type === 'binary') {
    return (
      <div className={styles.card}>
        <div className={styles.binaryRow}>
          <div className={`${styles.binaryTile} ${styles.binaryYes}`}>
            <ThumbsUp size={18} strokeWidth={2.25} />
            <span>Yes</span>
          </div>
          <div className={`${styles.binaryTile} ${styles.binaryNo}`}>
            <ThumbsDown size={18} strokeWidth={2.25} />
            <span>No</span>
          </div>
        </div>
        <p className={styles.hint}>Readers cast a single Yes / No vote.</p>
      </div>
    )
  }

  const updateOption = (index, value) => {
    const next = { ...normalized, options: [...options] }
    next.options[index] = value.slice(0, 100)
    onChange(next)
  }

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return
    onChange({ ...normalized, options: [...options, ''] })
  }

  const removeOption = (index) => {
    if (options.length <= MIN_OPTIONS) return
    onChange({ ...normalized, options: options.filter((_, i) => i !== index) })
  }

  return (
    <div className={styles.card}>
      <div className={styles.options}>
        {options.map((value, idx) => (
          <div key={idx} className={styles.optionRow}>
            <span className={styles.optionBadge}>{idx + 1}</span>
            <input
              className={styles.optionInput}
              value={value}
              maxLength={100}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
              aria-label={`Option ${idx + 1}`}
            />
            {idx >= MIN_OPTIONS && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeOption(idx)}
                aria-label={`Remove option ${idx + 1}`}
                title="Remove option"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button type="button" className={styles.addBtn} onClick={addOption} disabled={options.length >= MAX_OPTIONS}>
        <Plus size={14} strokeWidth={2.5} />
        Add option
        <span className={styles.optionCount}>
          {options.length}/{MAX_OPTIONS}
        </span>
      </button>
    </div>
  )
}
