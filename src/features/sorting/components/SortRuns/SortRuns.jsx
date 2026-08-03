// The two runs a merge is consuming, drawn under the row they feed (T-105).
//
// Merge sort's `i` and `j` do not index the array, they index these two runs,
// so putting them on the main row would point at cells that have nothing to do
// with the comparison being made. Consumed values stay visible but dimmed: what
// has already been taken is as much a part of the picture as what is left.
import { cellX } from '../../../../lib/algo/sorting/sortLayout'
import styles from './SortRuns.module.css'

const CHIP_WIDTH = 40
const CHIP_HEIGHT = 30

function Run({ label, pointer, values, consumed, y, x }) {
  return (
    <g className={styles.run} data-side={label}>
      <text className={styles.label} x={x - 12} y={y + CHIP_HEIGHT / 2}>
        {label}
      </text>
      {/* The run's own cursor, labelled on the run it indexes. This is the only
          place i and j are drawn for a merge: on the main row they would sit on
          array cells they have nothing to do with. */}
      {consumed < values.length && (
        <text
          className={styles.cursor}
          x={x + consumed * (CHIP_WIDTH + 6) + CHIP_WIDTH / 2}
          y={y - 6}
        >
          {pointer}
        </text>
      )}
      {values.map((value, index) => (
        <g
          key={`${index}-${value}`}
          className={styles.chip}
          data-state={index < consumed ? 'taken' : index === consumed ? 'head' : 'waiting'}
        >
          <rect
            x={x + index * (CHIP_WIDTH + 6)}
            y={y}
            width={CHIP_WIDTH}
            height={CHIP_HEIGHT}
            rx={7}
          />
          <text
            x={x + index * (CHIP_WIDTH + 6) + CHIP_WIDTH / 2}
            y={y + CHIP_HEIGHT / 2}
          >
            {value}
          </text>
        </g>
      ))}
    </g>
  )
}

export default function SortRuns({ runs, y }) {
  if (!runs) return null

  // Anchored to the range being merged, so the runs sit under the cells they
  // are about to be written into rather than floating at the canvas origin.
  const x = cellX(runs.low)

  return (
    <g className={styles.runs}>
      <Run label="L" pointer="i" values={runs.left} consumed={runs.i} x={x} y={y} />
      <Run label="R" pointer="j" values={runs.right} consumed={runs.j} x={x} y={y + CHIP_HEIGHT + 24} />
    </g>
  )
}
