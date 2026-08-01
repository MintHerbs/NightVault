// One segmented up / score / down control, shared by posts and comments.
// Both used to implement the same semantics in different shapes: a bordered
// pill with a divider on posts, two loose text buttons on comments. T-087
// folded them onto this so a vote looks like a vote everywhere.
//
// Green/red are deliberately hue-fixed literals rather than accent tokens:
// vote direction has to mean the same thing in all 9 themes, and T-070
// lists these two values as an explicit exemption from the token sweep.
import { ArrowDown, ArrowUp } from 'lucide-react'
import { motion } from 'motion/react'
import styles from './VoteControl.module.css'

export default function VoteControl({
  score = 0,
  userVote = null,
  onVote,
  size = 'md',
  disabled = false,
  labelUp = 'Upvote',
  labelDown = 'Downvote',
}) {
  const isUp = userVote === 'up'
  const isDown = userVote === 'down'

  const handle = (type) => {
    if (disabled) return
    onVote?.(type)
  }

  return (
    <div className={`${styles.control} ${size === 'sm' ? styles.sm : ''}`}>
      <button
        type="button"
        className={`${styles.btn} ${isUp ? styles.up : ''}`}
        onClick={() => handle('up')}
        disabled={disabled}
        aria-label={labelUp}
        aria-pressed={isUp}
      >
        <ArrowUp size={size === 'sm' ? 14 : 16} strokeWidth={2.5} aria-hidden="true" />
      </button>

      {/* Keyed on the score so a changed count re-mounts and plays the tick;
          the colour is left to CSS so the animation cannot strand an inline
          style that outlives the theme. */}
      <motion.span
        key={score}
        className={styles.score}
        initial={{ y: -3, opacity: 0.4 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      >
        {score}
      </motion.span>

      <button
        type="button"
        className={`${styles.btn} ${isDown ? styles.down : ''}`}
        onClick={() => handle('down')}
        disabled={disabled}
        aria-label={labelDown}
        aria-pressed={isDown}
      >
        <ArrowDown size={size === 'sm' ? 14 : 16} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}
