// Ranked horizontal bars — the form for "compare magnitudes across identities".
//
// Horizontal rather than vertical because the labels are route paths and note
// titles: text of unpredictable length reads straight across, where a vertical
// bar chart would need it rotated or truncated to a stub.
//
// Bars are scaled against the largest row, not against a total, because the
// question is rank and relative size, not share of a whole.
import { formatCount } from './format'
import styles from './RankBars.module.css'

export default function RankBars({ rows, emptyText = 'Nothing recorded yet.', valueSuffix = '' }) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return <p className={styles.empty}>{emptyText}</p>

  const max = list.reduce((top, row) => Math.max(top, Number(row.value) || 0), 0)

  return (
    <ol className={styles.list}>
      {list.map(row => {
        const value = Number(row.value) || 0
        // A visible stub for a nonzero-but-tiny row: a bar rounded to 0% would
        // report a real datapoint as absent.
        const width = max === 0 ? 0 : Math.max((value / max) * 100, 1.5)
        return (
          <li key={row.key} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.label} title={row.title ?? row.label}>
                {row.label}
              </span>
              <span className={styles.value}>
                {formatCount(value)}{valueSuffix && <span className={styles.suffix}> {valueSuffix}</span>}
              </span>
            </div>
            <div className={styles.track}>
              <div className={styles.bar} style={{ width: `${width}%` }} />
            </div>
            {row.meta && <span className={styles.meta}>{row.meta}</span>}
          </li>
        )
      })}
    </ol>
  )
}
