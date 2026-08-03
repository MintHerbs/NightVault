// Quicksort's recursion tree, drawn downward (T-105).
//
// The lecture's shape: the whole array partitions in place, then moves up and
// splits into two rows beneath it, then the left row works, then the right,
// with every finished row still on screen above. Each row keeps the arrangement
// its own partition produced, so the tree reads top to bottom as a history of
// how the array came apart, and the combined result lands underneath at the end.
//
// Only the active row carries i, j and temp — the rows above are finished and
// the rows below have not started, so pointers on them would mean nothing.
import { CELL_HEIGHT, CELL_WIDTH, cellX } from '../../../../lib/algo/sorting/sortLayout'
import SortRow from '../SortRow/SortRow'
import styles from './SortLevels.module.css'

const TONE = { active: 'live', split: 'history', done: 'history', pending: 'pending' }

/**
 * What each cell of a non-active segment should be marked as.
 *
 * A split row's pivot keeps the pivot colour rather than becoming a generic
 * "sorted" cell: the chain of pivots down the tree is the record of how the
 * array was divided, which is the thing this view exists to show.
 */
function marksForSegment(segment) {
  if (segment.state === 'split' && segment.pivotIndex !== null) {
    return { [segment.pivotIndex]: 'pivot' }
  }
  if (segment.state === 'done') {
    const marks = {}
    for (let i = segment.low; i <= segment.high; i++) marks[i] = 'sorted'
    return marks
  }
  return {}
}

export default function SortLevels({ layout, marks, activeRef, resultRef }) {
  return (
    <g className={styles.levels}>
      {layout.levels.map((level) => (
        <g key={level.depth} className={styles.level} data-active={level.isActive ? '' : undefined}>
          {level.segments.map((segment) => (
            <g
              key={segment.id}
              className={styles.segment}
              data-state={segment.state}
              ref={segment.state === 'active' ? activeRef : null}
            >
              {/* Label on whichever side has room, left preferred — the same
                  arrangement as the lecture slide, where the right half reads
                  `( … )quickSort`. */}
              {segment.labelSide && (
                <text
                  className={styles.label}
                  data-side={segment.labelSide}
                  x={
                    segment.labelSide === 'left'
                      ? segment.x - 16
                      : segment.x + segment.width + 16
                  }
                  y={level.y + CELL_HEIGHT / 2}
                >
                  quickSort
                </text>
              )}
              {/* Chalk brackets rather than a box: a box around a range reads
                  as a selection, and these are calls. */}
              <text className={styles.bracket} x={segment.x - 7} y={level.y + CELL_HEIGHT / 2}>
                (
              </text>
              <SortRow
                values={segment.values}
                y={level.y}
                offset={segment.low}
                marks={segment.state === 'active' ? marks : marksForSegment(segment)}
                showIndex={segment.state === 'active'}
                tone={TONE[segment.state] || 'live'}
              />
              <text
                className={styles.bracket}
                x={segment.x + segment.width + 7}
                y={level.y + CELL_HEIGHT / 2}
              >
                )
              </text>
            </g>
          ))}
        </g>
      ))}

      {layout.result && (
        <g className={styles.result} ref={resultRef}>
          <text className={styles.resultLabel} x={cellX(0) - 16} y={layout.result.y + CELL_HEIGHT / 2}>
            Sorted
          </text>
          <rect
            className={styles.resultBand}
            x={cellX(0) - 8}
            y={layout.result.y - 8}
            width={layout.width + 16}
            height={CELL_HEIGHT + 16}
            rx={14}
          />
          {layout.result.values.map((value, index) => (
            <g key={index} className={styles.resultCell} style={{ transform: `translateX(${cellX(index)}px)` }}>
              <rect x={0} y={layout.result.y} width={CELL_WIDTH} height={CELL_HEIGHT} rx={10} />
              <text x={CELL_WIDTH / 2} y={layout.result.y + CELL_HEIGHT / 2}>
                {value}
              </text>
            </g>
          ))}
        </g>
      )}
    </g>
  )
}
