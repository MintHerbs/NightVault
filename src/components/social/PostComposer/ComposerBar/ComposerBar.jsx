// Attachment chips on the left, the primary action on the right. Revealed
// only once the composer is open, which is why it lives inside its own
// height-animating shell.
import { motion } from 'motion/react'
import { Loader2, Send } from 'lucide-react'
import styles from './ComposerBar.module.css'

export default function ComposerBar({
  features,
  charCount,
  maxChars,
  showCounter,
  warnCount,
  hasContent,
  isPosting,
  onPost,
}) {
  return (
    <motion.div
      className={styles.bar}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
    >
      <div className={styles.chips}>
        {features.map(({ key, icon: Icon, label, hint, active, onClick }) => (
          <button
            key={key}
            type="button"
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            onClick={onClick}
            title={hint}
            aria-label={hint}
            aria-pressed={active}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            <span className={styles.chipLabel}>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.submit}>
        {showCounter && (
          <span className={`${styles.count} ${warnCount ? styles.countWarn : ''}`}>
            {charCount}/{maxChars}
          </span>
        )}

        <button
          type="button"
          className={`${styles.post} ${hasContent ? '' : styles.postIdle}`}
          onClick={onPost}
          disabled={isPosting}
          aria-label="Publish post"
        >
          {isPosting ? (
            <Loader2 size={16} className={styles.spinner} strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Send size={16} strokeWidth={2.5} aria-hidden="true" />
          )}
          <span>{isPosting ? 'Posting' : 'Post'}</span>
        </button>
      </div>
    </motion.div>
  )
}
