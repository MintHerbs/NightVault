// One headline number. A stat tile rather than a chart on purpose: a single
// magnitude with no comparison and no time axis has nothing for a plot to show.
import { formatCount } from './format'
import styles from './StatTile.module.css'

export default function StatTile({ label, value, hint, emphasis = false }) {
  return (
    <div className={`${styles.tile} ${emphasis ? styles.emphasis : ''}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{formatCount(value)}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
