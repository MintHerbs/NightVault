// The sorting canvas (T-105).
//
// One SVG in the coordinate system sortLayout defines, scaled to fit whatever
// panel it is given. The array row is always drawn; the runs, buckets, temp box
// and recursion ladder appear only for the steps that carry them, which is why
// the layout is computed per step rather than once per run.
//
// Cells are positioned with a CSS transform and transitioned, the same trick
// TreeNode uses, so a swap is a value visibly *moving* past another rather than
// two cells cutting to new contents. That is the difference between showing a
// swap and reporting one.
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  POINTER_LANE,
  RUN_ROW_HEIGHT,
  cellCenterX,
  cellX,
  layoutForStep,
  pointerX,
  rangeBox,
} from '../../../../lib/algo/sorting/sortLayout'
import CallFrames from '../CallFrames/CallFrames'
import SortBuckets from '../SortBuckets/SortBuckets'
import SortRuns from '../SortRuns/SortRuns'
import styles from './SortCanvas.module.css'

/** Pointer markers, in the order they should stack if two land on one cell. */
const POINTER_ORDER = ['i', 'j', 'min', 'k', 'pivot']

const FRAME_LABEL = { quick: 'quickSort', merge: 'mergeSort' }

export default function SortCanvas({ step, values }) {
  const array = step?.array || values
  const count = array.length
  const layout = layoutForStep(step, count)
  const marks = step?.marks || {}
  const pointers = step?.pointers || {}

  const bandFor = (kind) => layout.bands.find((b) => b.kind === kind)
  const tempBand = bandFor('temp')
  const runsBand = bandFor('runs')
  const bucketsBand = bandFor('buckets')
  const framesBand = bandFor('frames')

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.canvas}
        viewBox={layout.viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={step?.description || 'The array, waiting to be sorted'}
      >
        {/* Partition bands sit behind the cells so the outline reads as a
            region the cells are in, not a box drawn over them. */}
        {(step?.ranges || []).map((range) => {
          const box = rangeBox(range)
          return (
            <rect
              key={`${range.role}-${range.low}-${range.high}`}
              className={styles.band}
              data-role={range.role}
              x={box.x}
              y={layout.arrayY - 6}
              width={box.width}
              height={CELL_HEIGHT + 12}
              rx={12}
            />
          )
        })}

        {/* The array itself. */}
        {array.map((value, index) => (
          <g
            key={index}
            className={styles.cell}
            data-role={marks[index] || undefined}
            style={{ transform: `translateX(${cellX(index)}px)` }}
          >
            <rect
              className={styles.cellBox}
              x={0}
              y={layout.arrayY}
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              rx={10}
            />
            <text className={styles.cellValue} x={CELL_WIDTH / 2} y={layout.arrayY + CELL_HEIGHT / 2}>
              {value}
            </text>
            <text className={styles.cellIndex} x={CELL_WIDTH / 2} y={layout.arrayY + CELL_HEIGHT + 13}>
              {index}
            </text>
          </g>
        ))}

        {/* Pointer markers. Driven off `pointers` rather than off `marks`,
            because a pointer can legitimately sit outside the array (i at
            low - 1) where no cell exists to mark.

            Stacked when two land on the same cell, which is not an edge case:
            quicksort's "scan finished" step puts j on the pivot every single
            time, and two labels at one coordinate is just a smudge. */}
        {(() => {
          const lanes = new Map()
          // During a merge, `i` and `j` index the two runs, not the array, so
          // drawing them here would point at cells that have nothing to do with
          // the comparison being made. SortRuns labels them on the runs
          // themselves. `k` stays, because k really is an array position.
          const drawable = step?.runs
            ? POINTER_ORDER.filter((name) => name !== 'i' && name !== 'j')
            : POINTER_ORDER
          return drawable.filter((name) => Number.isInteger(pointers[name])).map((name) => {
            const x = pointerX(pointers[name], count)
            const lane = lanes.get(x) || 0
            lanes.set(x, lane + 1)
            return (
              <text
                key={name}
                className={styles.pointer}
                data-role={name}
                x={x}
                y={POINTER_LANE - 14 - lane * 16}
              >
                {name}
              </text>
            )
          })
        })()}

        {/* temp, directly under the row, exactly where the lecture draws it. */}
        {tempBand && step.temp && (
          <g className={styles.temp}>
            <text className={styles.tempLabel} x={cellCenterX(step.temp.from)} y={tempBand.y + 12}>
              temp
            </text>
            <rect
              className={styles.tempBox}
              x={cellX(step.temp.from)}
              y={tempBand.y + 22}
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              rx={10}
            />
            <text
              className={styles.tempValue}
              x={cellCenterX(step.temp.from)}
              y={tempBand.y + 22 + CELL_HEIGHT / 2}
            >
              {step.temp.value}
            </text>
          </g>
        )}

        {runsBand && <SortRuns runs={step.runs} y={runsBand.y + RUN_ROW_HEIGHT / 4} />}

        {bucketsBand && (
          <SortBuckets buckets={step.buckets} y={bucketsBand.y} width={layout.width} />
        )}

        {framesBand && (
          <CallFrames
            frames={layout.frames}
            array={array}
            label={FRAME_LABEL[step.algo] || 'sort'}
            rowHeight={framesBand.height / Math.max(1, layout.frames.length)}
          />
        )}
      </svg>
    </div>
  )
}
