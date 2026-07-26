// Shared floating back affordance — fixed top-left, used on tool/notes pages
// that need a way out besides the sidebar or browser history.
import { ArrowLeft } from '@phosphor-icons/react'
import styles from './BackButton.module.css'

export default function BackButton({ onClick, label = 'Back' }) {
  return (
    <button className={styles.backButton} onClick={onClick} aria-label={label}>
      <ArrowLeft size={20} weight="bold" />
    </button>
  )
}
