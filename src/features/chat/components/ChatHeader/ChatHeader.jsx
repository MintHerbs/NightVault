// The panel had no chrome at all before T-087: no room name, no online count,
// and no close control — `onClose` was accepted as a prop and never wired to
// anything, so the only way out was the sidebar or the Dynamic Island.
import { X } from 'lucide-react'
import styles from './ChatHeader.module.css'

export default function ChatHeader({ onClose, onlineCount = 0, presenceSynced = false }) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <h2 className={styles.title}>Community chat</h2>

        {/* Until presence has synced the count is 0, which would read as
            "nobody here" rather than "not known yet". */}
        {presenceSynced && (
          <p className={styles.status}>
            <span className={styles.dot} aria-hidden="true" />
            {onlineCount} {onlineCount === 1 ? 'person' : 'people'} online
          </p>
        )}
      </div>

      <button type="button" className={styles.close} onClick={onClose} aria-label="Close chat">
        <X size={18} aria-hidden="true" />
      </button>
    </header>
  )
}
