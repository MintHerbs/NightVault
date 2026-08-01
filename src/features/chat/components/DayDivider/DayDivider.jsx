// "Today" / "Yesterday" / a date, between two messages that fall on different
// calendar days. Without it a thread read as one continuous conversation no
// matter how many days separated two adjacent bubbles.
import { formatDayLabel } from '../../../../lib/social/relativeTime'
import styles from './DayDivider.module.css'

export default function DayDivider({ iso }) {
  const label = formatDayLabel(iso)
  if (!label) return null

  return (
    <div className={styles.divider} role="separator" aria-label={label}>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
