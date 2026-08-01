// The panel had no chrome at all before T-087: no room name and no close
// control — `onClose` was accepted as a prop and never wired to anything, so
// the only way out was the sidebar or the Dynamic Island. The online count
// deliberately isn't repeated here: the Dynamic Island already owns that.
import { X } from 'lucide-react'
import styles from './ChatHeader.module.css'

export default function ChatHeader({ onClose }) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close chat">
        <X size={18} aria-hidden="true" />
      </button>
    </header>
  )
}
