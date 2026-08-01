// Poll and binary-vote attachment, in two states: unvoted options, and
// results. The result rows used to be 40px tracks with the label and the
// percentage absolutely positioned on top of a gradient fill, which is why
// the label needed its own hardcoded cyan to stay readable. The bar is now a
// track under the row, so both texts sit on the card surface and inherit it.
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import styles from './PostPoll.module.css'

function toPercent(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export default function PostPoll({ poll, hasVoted, userOptionIndex, isVoting, onVote }) {
  if (!poll || !poll.options?.length) return null

  if (!hasVoted) {
    return (
      <div className={styles.poll} role="group" aria-label="Poll options">
        {poll.options.map((option, idx) => (
          <button
            key={idx}
            type="button"
            className={styles.option}
            onClick={() => onVote?.(idx)}
            disabled={isVoting}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.poll}>
      {poll.options.map((option, idx) => {
        const count = poll.counts?.[idx] || 0
        const pct = toPercent(count, poll.total)
        const isChosen = userOptionIndex === idx

        return (
          <div key={idx} className={`${styles.result} ${isChosen ? styles.chosen : ''}`}>
            <div className={styles.resultRow}>
              <span className={styles.resultLabel}>
                {isChosen && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                {option}
              </span>
              <span className={styles.resultPercent}>{pct}%</span>
            </div>

            <div className={styles.track}>
              <motion.div
                className={styles.fill}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: [0.2, 0, 0, 1], delay: idx * 0.04 }}
              />
            </div>

            <span className={styles.srOnly}>
              {option}: {count} {count === 1 ? 'vote' : 'votes'}, {pct} percent
              {isChosen ? ', your choice' : ''}
            </span>
          </div>
        )
      })}

      <p className={styles.total}>
        {poll.total.toLocaleString()} {poll.total === 1 ? 'vote' : 'votes'}
      </p>
    </div>
  )
}
