// The sorting canvas (T-105).
//
// Two shapes, one coordinate system. Quicksort draws a recursion tree, because
// what it teaches is how the array comes apart; the other five draw one row,
// because they sort the array where it stands. Both share SortRow, so a cell
// looks and animates identically either way, and both get their geometry from
// sortLayout.
//
// The SVG is sized to its content and the wrapper scrolls, rather than the
// whole tree being squeezed to fit: a 24-value already-sorted input recurses 23
// levels deep, and shrinking that to fit a panel makes every cell unreadable.
// The active row is scrolled into view instead.
import { useEffect, useRef } from 'react'
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
import SortLevels from '../SortLevels/SortLevels'
import SortRow from '../SortRow/SortRow'
import SortRuns from '../SortRuns/SortRuns'
import styles from './SortCanvas.module.css'

/** Pointer markers, in the order they should stack if two land on one cell. */
const POINTER_ORDER = ['i', 'j', 'min', 'k', 'pivot']

const FRAME_LABEL = { merge: 'mergeSort' }

export default function SortCanvas({ step, values }) {
  const array = step?.array || values
  const count = array.length
  const layout = layoutForStep(step, count)
  const marks = step?.marks || {}
  const pointers = step?.pointers || {}
  const isTree = layout.mode === 'tree'

  const activeRef = useRef(null)
  const activeDepth = layout.activeLevel?.depth

  // Follow the working row down the tree. Without this a deep recursion walks
  // off the bottom of the panel and the visitor watches an empty box.
  useEffect(() => {
    if (!isTree) return
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isTree, activeDepth])

  const bandFor = (kind) => (layout.bands || []).find((b) => b.kind === kind)
  const tempBand = bandFor('temp')
  const runsBand = bandFor('runs')
  const bucketsBand = bandFor('buckets')
  const framesBand = bandFor('frames')

  // Where the pointer lane and the temp box sit. In the tree they hang off the
  // active row wherever that has reached; in a single-row layout they are fixed.
  const rowY = isTree ? layout.activeLevel?.y ?? POINTER_LANE : layout.arrayY
  const tempY = isTree ? layout.tempY : tempBand ? tempBand.y + 22 : null
  const tempLabelY = isTree ? layout.tempY - 10 : tempBand ? tempBand.y + 12 : null
  const showPointers = !isTree || Boolean(layout.activeLevel)

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.canvas}
        viewBox={layout.viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={isTree ? { aspectRatio: `${layout.width + 256} / ${layout.height}` } : undefined}
        role="img"
        aria-label={step?.description || 'The array, waiting to be sorted'}
      >
        {/* Partition bands sit behind the cells so the outline reads as a
            region the cells are in, not a box drawn over them. */}
        {!isTree &&
          (step?.ranges || []).map((range) => {
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

        {isTree ? (
          <SortLevels layout={layout} marks={marks} activeRef={activeRef} />
        ) : (
          <SortRow values={array} y={layout.arrayY} marks={marks} />
        )}

        {/* Pointer markers. Driven off `pointers` rather than off `marks`,
            because a pointer can legitimately sit outside the array (i at
            low - 1) where no cell exists to mark.

            Stacked when two land on the same cell, which is not an edge case:
            quicksort's "scan finished" step puts j on the pivot every single
            time, and two labels at one coordinate is just a smudge. */}
        {showPointers &&
          (() => {
            const lanes = new Map()
            // During a merge, `i` and `j` index the two runs, not the array, so
            // drawing them here would point at cells that have nothing to do
            // with the comparison being made. SortRuns labels them on the runs
            // themselves. `k` stays, because k really is an array position.
            const drawable = step?.runs
              ? POINTER_ORDER.filter((name) => name !== 'i' && name !== 'j')
              : POINTER_ORDER
            return drawable
              .filter((name) => Number.isInteger(pointers[name]))
              .map((name) => {
                const x = pointerX(pointers[name], count)
                const lane = lanes.get(x) || 0
                lanes.set(x, lane + 1)
                return (
                  <text
                    key={name}
                    className={styles.pointer}
                    data-role={name}
                    x={x}
                    y={rowY - 14 - lane * 16}
                  >
                    {name}
                  </text>
                )
              })
          })()}

        {/* temp, directly under the working row, where the lecture draws it. */}
        {step?.temp && tempY !== null && (
          <g className={styles.temp}>
            <text className={styles.tempLabel} x={cellCenterX(step.temp.from)} y={tempLabelY}>
              temp
            </text>
            <rect
              className={styles.tempBox}
              x={cellX(step.temp.from)}
              y={tempY}
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              rx={10}
            />
            <text
              className={styles.tempValue}
              x={cellCenterX(step.temp.from)}
              y={tempY + CELL_HEIGHT / 2}
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
