// Overlapping avatars of whoever is typing, plus a pill of bouncing dots.
import ChatAvatar from '../ChatAvatar/ChatAvatar'
import styles from './TypingIndicator.module.css'

const MAX_AVATARS = 3

export default function TypingIndicator({ sessionIds = [] }) {
  if (!sessionIds.length) return null

  // Cap the stack: past three the overlap stops being legible and the row
  // starts pushing the input around.
  const shown = sessionIds.slice(0, MAX_AVATARS)

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.srOnly}>
        {sessionIds.length === 1 ? 'Someone is typing' : `${sessionIds.length} people are typing`}
      </span>

      <div className={styles.avatars} aria-hidden="true">
        {shown.map((id, index) => (
          <div
            key={id}
            className={styles.avatar}
            // Earlier avatars sit on top so the stack reads left-to-right.
            style={{ zIndex: shown.length - index }}
          >
            <ChatAvatar sessionId={id} size={24} />
          </div>
        ))}
      </div>

      <div className={styles.pill} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  )
}
