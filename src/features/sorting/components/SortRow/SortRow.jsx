// One row of array cells (T-105).
//
// Shared by the single-row methods and by every level of quicksort's recursion
// tree, so a cell looks and animates the same whether it is the whole array or
// one branch four levels down. Positioning is by CSS transform with a
// transition, the same trick TreeNode uses, so a swap is a value visibly moving
// past another rather than two cells cutting to new contents.
import { CELL_HEIGHT, CELL_WIDTH, cellX } from '../../../../lib/algo/sorting/sortLayout'
import styles from './SortRow.module.css'

/**
 * @param {number[]} props.values      the cells to draw
 * @param {number}   props.y           top edge in viewBox units
 * @param {number}   [props.offset]    array index the first cell sits at
 * @param {object}   [props.marks]     absolute index -> role
 * @param {boolean}  [props.showIndex] draw the position number under each cell
 * @param {string}   [props.tone]      dims history and pending rows
 */
export default function SortRow({
  values,
  y,
  offset = 0,
  marks = {},
  showIndex = true,
  tone = 'live',
}) {
  return (
    <g className={styles.row} data-tone={tone}>
      {values.map((value, index) => {
        const absolute = offset + index
        return (
          <g
            key={absolute}
            className={styles.cell}
            data-role={marks[absolute] || undefined}
            style={{ transform: `translateX(${cellX(absolute)}px)` }}
          >
            <rect
              className={styles.cellBox}
              x={0}
              y={y}
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              rx={10}
            />
            <text className={styles.cellValue} x={CELL_WIDTH / 2} y={y + CELL_HEIGHT / 2}>
              {value}
            </text>
            {showIndex && (
              <text className={styles.cellIndex} x={CELL_WIDTH / 2} y={y + CELL_HEIGHT + 13}>
                {absolute}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
