// Overlapping avatars of whoever has read up to the newest message, shown
// under the last bubble in the thread — the read-receipt counterpart to
// TypingIndicator's overlapping-avatar treatment.
import ChatAvatar from '../ChatAvatar/ChatAvatar'
import styles from './SeenIndicator.module.css'

const MAX_AVATARS = 3

export default function SeenIndicator({ sessionIds = [] }) {
  if (!sessionIds.length) return null

  const shown = sessionIds.slice(0, MAX_AVATARS)
  const extra = sessionIds.length - shown.length

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.srOnly}>
        Seen by {sessionIds.length === 1 ? '1 person' : `${sessionIds.length} people`}
      </span>

      <div className={styles.avatars} aria-hidden="true">
        {shown.map((id, index) => (
          <div
            key={id}
            className={styles.avatar}
            style={{ zIndex: shown.length - index }}
          >
            <ChatAvatar sessionId={id} size={16} />
          </div>
        ))}
      </div>

      <span className={styles.label} aria-hidden="true">
        Seen{extra > 0 ? ` +${extra}` : ''}
      </span>
    </div>
  )
}
