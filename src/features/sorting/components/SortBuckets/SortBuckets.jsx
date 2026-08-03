// The ten digit buckets of a radix pass (T-105).
//
// Ten rows rather than ten columns: a bucket can hold every value in the array,
// and a column that grows downward would push the rest of the canvas off screen
// on exactly the inputs where the buckets matter most.
import {
  BUCKET_LABEL_WIDTH,
  BUCKET_ROW_HEIGHT,
} from '../../../../lib/algo/sorting/sortLayout'
import styles from './SortBuckets.module.css'

const CHIP_WIDTH = 38
const CHIP_HEIGHT = 24
const CHIP_GAP = 5

export default function SortBuckets({ buckets, y, width }) {
  if (!buckets) return null

  return (
    <g className={styles.buckets} data-phase={buckets.phase}>
      {buckets.rows.map((row, digit) => {
        const rowY = y + digit * BUCKET_ROW_HEIGHT
        return (
          <g key={digit} className={styles.row} data-filled={row.length > 0 ? '' : undefined}>
            <line
              className={styles.rule}
              x1={BUCKET_LABEL_WIDTH}
              x2={width}
              y1={rowY + BUCKET_ROW_HEIGHT - 3}
              y2={rowY + BUCKET_ROW_HEIGHT - 3}
            />
            <text className={styles.digit} x={BUCKET_LABEL_WIDTH - 12} y={rowY + BUCKET_ROW_HEIGHT / 2}>
              {digit}
            </text>
            {row.map((value, index) => (
              <g key={`${index}-${value}`} className={styles.chip}>
                <rect
                  x={BUCKET_LABEL_WIDTH + index * (CHIP_WIDTH + CHIP_GAP)}
                  y={rowY + (BUCKET_ROW_HEIGHT - CHIP_HEIGHT) / 2 - 2}
                  width={CHIP_WIDTH}
                  height={CHIP_HEIGHT}
                  rx={6}
                />
                <text
                  x={BUCKET_LABEL_WIDTH + index * (CHIP_WIDTH + CHIP_GAP) + CHIP_WIDTH / 2}
                  y={rowY + BUCKET_ROW_HEIGHT / 2 - 2}
                >
                  {value}
                </text>
              </g>
            ))}
          </g>
        )
      })}
    </g>
  )
}
