// The recursion ladder: one row per live call, deepest last (T-105).
//
// This is the lecture's nested `quickSort( … )` drawing. Each row is bracketed
// and sits horizontally under exactly the cells its range covers, so the split
// is read off the geometry rather than off the numbers in the brackets.
import styles from './CallFrames.module.css'

export default function CallFrames({ frames, array, label, rowHeight }) {
  if (!frames || frames.length === 0) return null

  return (
    <g className={styles.frames}>
      {frames.map((frame) => {
        const values = array.slice(frame.low, frame.high + 1).join(', ')
        const centerY = frame.y + rowHeight / 2
        return (
          <g
            key={`${frame.depth}-${frame.low}-${frame.high}`}
            className={styles.frame}
            data-state={frame.state}
          >
            <text className={styles.label} x={frame.x - 12} y={centerY}>
              {label}
            </text>
            {/* Chalk-style brackets rather than a box: a box around a range
                reads as a selection, and these are calls. */}
            <text className={styles.bracket} x={frame.x - 4} y={centerY}>
              (
            </text>
            <text className={styles.values} x={frame.x + frame.width / 2} y={centerY}>
              {values}
            </text>
            <text className={styles.bracket} x={frame.x + frame.width + 4} y={centerY}>
              )
            </text>
          </g>
        )
      })}
    </g>
  )
}
