// The stacked history of every look the algorithm took at the array (T-105).
//
// The lecture diagram's shape: the input at the top, then one row per
// comparison showing the pair that was looked at and the arrangement that look
// left behind, grouped under the pass it belongs to, all the way down to the
// result. Nothing is overwritten, because "what did the array look like three
// comparisons ago" is the question the diagram exists to answer — and a single
// row that mutates in place cannot answer it.
//
// Quicksort does not come through here; its recursion tree is its history.
import { memo } from 'react'
import { CELL_HEIGHT, PASS_LABEL_LANE, PASS_RULE_INSET } from '../../../../lib/algo/sorting/sortLayout'
import SortRow from '../SortRow/SortRow'
import styles from './SortHistory.module.css'

/**
 * A finished row never changes again, so it should never re-render again
 * either. A long bubble run is several hundred rows and the live one moves on
 * every frame; without this the whole stack re-renders each step and the
 * animation stutters as the history grows.
 */
const HistoryRow = memo(
  function HistoryRow({ row }) {
    return (
      <g className={styles.row} data-live={row.live ? '' : undefined}>
        <SortRow
          values={row.values}
          y={row.y}
          marks={row.marks}
          showIndex={row.live}
          tone={row.live ? 'live' : 'history'}
        />
      </g>
    )
  },
  (prev, next) => prev.row.signature === next.row.signature && prev.row.y === next.row.y
)

function PassGroup({ group, window: win }) {
  const top = group.y
  const bottom = group.y + group.height
  // The rule and the label are cheap and anchor the group, so they are drawn
  // whenever any part of the group is near the viewport; only the rows inside
  // it are filtered.
  const rows = win
    ? group.rows.filter((row) => row.y + CELL_HEIGHT >= win.fromY && row.y <= win.toY)
    : group.rows
  return (
    <g className={styles.group}>
      {/* Above the group's first row rather than to its left. A merge label is
          "Merge [1, 4, 5] + [1, 2, 3]" and there is no left margin wide enough
          for that; above, any length fits and still reads as the group's name. */}
      <text className={styles.passLabel} x={0} y={top - PASS_LABEL_LANE + 4}>
        {group.label}
      </text>
      {/* A rule down the left rather than a box around the rows: the rows are
          already boxes, and a box around boxes reads as a selection. */}
      <line
        className={styles.passRule}
        x1={-PASS_RULE_INSET}
        x2={-PASS_RULE_INSET}
        y1={top}
        y2={bottom - CELL_HEIGHT / 4}
      />
      {rows.map((row) => (
        <HistoryRow key={row.rowIndex} row={row} />
      ))}
    </g>
  )
}

export default function SortHistory({ layout, liveRef, width, window: win }) {
  const groups = win
    ? layout.groups.filter((g) => g.y + g.height >= win.fromY && g.y <= win.toY)
    : layout.groups

  return (
    <g className={styles.history}>
      {groups.map((group, index) => (
        <PassGroup key={`${group.pass}-${index}`} group={group} window={win} />
      ))}

      {/* A bare anchor for scrollIntoView rather than a ref threaded through
          the memoised row: attaching one would defeat the memo, and the only
          thing the scroll needs is a rectangle at the right height. */}
      {layout.liveRow && (
        <rect
          ref={liveRef}
          className={styles.liveAnchor}
          x={0}
          y={layout.liveRow.y}
          width={Math.max(width, 1)}
          height={layout.liveBlockHeight}
        />
      )}
    </g>
  )
}
