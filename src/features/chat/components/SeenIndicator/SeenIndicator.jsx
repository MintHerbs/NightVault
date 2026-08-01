// Who has read up to the newest message, shown under the last bubble in the
// thread. Shares ui/AvatarStack with TypingIndicator so the two read as the
// same affordance — they previously duplicated the overlap treatment.
import AvatarStack from '../../../../components/ui/AvatarStack/AvatarStack'
import styles from './SeenIndicator.module.css'

const MAX_AVATARS = 3

export default function SeenIndicator({ sessionIds = [] }) {
  if (!sessionIds.length) return null

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.srOnly}>
        Seen by {sessionIds.length === 1 ? '1 person' : `${sessionIds.length} people`}
      </span>

      <span className={styles.label} aria-hidden="true">
        Seen by
      </span>

      <div aria-hidden="true">
        <AvatarStack seeds={sessionIds} size={16} max={MAX_AVATARS} />
      </div>
    </div>
  )
}
