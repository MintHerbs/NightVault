// Visitors per day. One series, so no legend — the panel title names it.
//
// Bars rather than a line: the underlying value is a count of distinct sessions
// on a discrete day, and a line's interpolated slope between two days implies a
// continuous quantity that does not exist.
import { formatCount, formatDay } from './format'
import styles from './TrendChart.module.css'

export default function TrendChart({ daily }) {
  const rows = Array.isArray(daily) ? daily : []
  const peak = rows.reduce((max, row) => Math.max(max, Number(row.sessions) || 0), 0)

  if (!rows.length || peak === 0) {
    return <p className={styles.empty}>No visits recorded in this range yet.</p>
  }

  const first = rows[0]
  const last = rows[rows.length - 1]
  const peakRow = rows.find(row => Number(row.sessions) === peak)

  return (
    <div className={styles.chart}>
      <div
        className={styles.plot}
        role="img"
        aria-label={`Visitors per day from ${formatDay(first.day)} to ${formatDay(last.day)}. Peak ${peak} on ${formatDay(peakRow?.day)}.`}
      >
        {rows.map(row => {
          const sessions = Number(row.sessions) || 0
          // Percentage of the tallest bar. A zero-visit day keeps a 2px stub so
          // the gap in the series is visible as a gap rather than as missing
          // markup.
          const height = sessions === 0 ? 0 : Math.max((sessions / peak) * 100, 4)
          return (
            <div key={row.day} className={styles.column} tabIndex={0}>
              <div className={styles.barTrack}>
                <div
                  className={styles.bar}
                  style={{ height: `${height}%` }}
                  data-zero={sessions === 0 ? 'true' : undefined}
                />
              </div>
              <span className={styles.tooltip} role="tooltip">
                {formatDay(row.day)}: {formatCount(sessions)} {sessions === 1 ? 'visitor' : 'visitors'}
                {', '}{formatCount(row.hits)} views
              </span>
            </div>
          )
        })}
      </div>

      {/* Direct labels, applied selectively: the ends of the axis and the peak.
          A number on every bar would be noise at 90 days. */}
      <div className={styles.axis}>
        <span>{formatDay(first.day)}</span>
        <span className={styles.peakLabel}>peak {formatCount(peak)}</span>
        <span>{formatDay(last.day)}</span>
      </div>
    </div>
  )
}
