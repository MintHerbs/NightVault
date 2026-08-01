// Who is typing: an avatar stack plus a pill of bouncing dots. The stack is
// the shared ui/AvatarStack primitive, so this and SeenIndicator can no
// longer drift apart the way two hand-rolled copies did.
import AvatarStack from '../../../../components/ui/AvatarStack/AvatarStack'
import styles from './TypingIndicator.module.css'

const MAX_AVATARS = 3

export default function TypingIndicator({ sessionIds = [] }) {
  if (!sessionIds.length) return null

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.srOnly}>
        {sessionIds.length === 1 ? 'Someone is typing' : `${sessionIds.length} people are typing`}
      </span>

      <div aria-hidden="true">
        {/* Capped: past three the overlap stops being legible and the row
            starts pushing the input around. */}
        <AvatarStack seeds={sessionIds} size={24} max={MAX_AVATARS} />
      </div>

      <div className={styles.pill} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  )
}
