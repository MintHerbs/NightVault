// The sorting canvas (T-105).
//
// Two shapes, one coordinate system, both of them a history rather than a
// single mutating row. Quicksort draws a recursion tree, because what it
// teaches is how the array comes apart; the other five draw a stack of rows,
// one per look at the array, grouped by pass. Both share SortRow, so a cell
// looks and animates identically either way, and both get their geometry from
// sortLayout.
//
// The SVG is sized to its content and the wrapper scrolls, rather than being
// squeezed to fit: a long bubble run is hundreds of rows and 24 already-sorted
// values recurse 23 levels, and shrinking either to a panel makes every cell
// unreadable. The live row is scrolled into view instead.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BUCKET_ROW_HEIGHT,
  CELL_HEIGHT,
  CELL_WIDTH,
  POINTER_LANE,
  RUN_ROW_HEIGHT,
  buildHistory,
  cellCenterX,
  cellX,
  layoutHistory,
  layoutTree,
  pointerX,
} from '../../../../lib/algo/sorting/sortLayout'
import SortBuckets from '../SortBuckets/SortBuckets'
import SortHistory from '../SortHistory/SortHistory'
import SortLevels from '../SortLevels/SortLevels'
import SortRuns from '../SortRuns/SortRuns'
import styles from './SortCanvas.module.css'

/** Pointer markers, in the order they should stack if two land on one cell. */
const POINTER_ORDER = ['i', 'j', 'min', 'k', 'pivot']

export default function SortCanvas({ steps, index, values }) {
  const step = steps?.[index] ?? null
  const array = step?.array || values
  const count = array.length
  const pointers = step?.pointers || {}
  const isTree = Boolean(step?.segments)

  // Height the live row has to leave for whatever hangs off it.
  const auxHeight = step?.runs
    ? RUN_ROW_HEIGHT * 2 + 28
    : step?.buckets
      ? BUCKET_ROW_HEIGHT * 10 + 16
      : 0

  // Rebuilt only when the frame actually changes. A long bubble run is ~290
  // rows, and folding the step prefix plus laying it out on every render — including
  // the ones a hover or a resize causes — was a measurable part of the per-step cost.
  const layout = useMemo(
    () =>
      isTree
        ? layoutTree(step, count)
        : layoutHistory(buildHistory(steps, index), count, {
            hasTemp: Boolean(step?.temp),
            auxHeight,
          }),
    [isTree, step, steps, index, count, auxHeight]
  )

  const activeRef = useRef(null)
  const resultRef = useRef(null)
  const liveRef = useRef(null)
  const wrapperRef = useRef(null)
  const svgRef = useRef(null)

  // Which slice of the history is worth drawing. A long bubble run is ~290 rows
  // and ten thousand pixels of SVG; rendering all of it put twenty thousand
  // nodes in the document and every step then cost a relayout of the lot, which
  // measured at 300-500ms per frame — far slower than the transport's own tick.
  // The rows still all exist in the layout, so the scrollbar and every position
  // in the history stay exactly as they were; only the ones nowhere near the
  // viewport are left undrawn.
  const [window_, setWindow] = useState(null)

  const measure = useCallback(() => {
    const wrap = wrapperRef.current
    const svg = svgRef.current
    if (!wrap || !svg || layout.mode !== 'history' || !layout.height) return
    const wrapRect = wrap.getBoundingClientRect()
    const svgRect = svg.getBoundingClientRect()
    if (!svgRect.height) return
    const scale = svgRect.height / layout.height
    const topInSvg = (wrapRect.top - svgRect.top) / scale
    const visible = wrapRect.height / scale
    // A viewport of slack either side, so a scroll flick never outruns the
    // window and shows blank rows before the next measure lands.
    setWindow({ fromY: topInSvg - visible, toY: topInSvg + visible * 2 })
  }, [layout.mode, layout.height])

  useEffect(() => {
    const wrap = wrapperRef.current
    if (!wrap || layout.mode !== 'history') return undefined
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    wrap.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      wrap.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [measure, layout.mode])
  const activeDepth = layout.activeLevel?.depth
  const hasResult = Boolean(layout.result)
  const liveRowIndex = layout.liveRow?.rowIndex

  // Follow the working row down the tree. Without this a deep recursion walks
  // off the bottom of the panel and the visitor watches an empty box.
  //
  // On the last step there is no working row, so the target becomes the result.
  // 24 already-sorted values recurse 23 levels; without this the run ends with
  // the payoff scrolled a full panel-height out of sight, which is the one frame
  // that has to land.
  useEffect(() => {
    if (isTree) {
      const target = hasResult ? resultRef.current : activeRef.current
      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }
    // History grows downward forever, so the live row has to be followed or the
    // visitor ends up watching blank space above a stack they cannot see.
    //
    // Instant, not smooth. The stack runs to ten thousand pixels, and a smooth
    // scroll of that length cannot finish before the next step arrives — the
    // animations queue up, each one forcing a synchronous layout of the whole
    // SVG, and the transport falls behind. One row's travel per step is small
    // enough that instant reads as continuous anyway.
    liveRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    // Re-window here rather than in a layout effect of its own: the scroll has
    // just happened, so this reads the geometry the browser has already been
    // forced to compute instead of forcing a second pass every step.
    measure()
  }, [isTree, activeDepth, hasResult, liveRowIndex, measure])

  // Where the pointer lane, the temp box and the auxiliary displays sit: in the
  // tree they hang off the active level, in the history off the live row.
  const anchorY = isTree ? layout.activeLevel?.y ?? POINTER_LANE : layout.liveRow?.y ?? POINTER_LANE
  const tempY = layout.tempY
  const tempLabelY = layout.tempY === null ? null : layout.tempY - 11
  const auxY = isTree ? null : layout.auxY
  const showPointers = isTree ? Boolean(layout.activeLevel) : Boolean(layout.liveRow)

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {/* An inner stage rather than centring on the scroll container itself.
          A flex item taller than its container and cross-axis centred pushes its
          overflow past the scroll origin, where it cannot be reached; giving the
          stage min-height:100% means the centring only ever applies when the
          content actually fits. */}
      <div className={styles.stage}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={layout.viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ aspectRatio: `${layout.width + 256} / ${layout.height}` }}
          role="img"
          aria-label={step?.description || 'The array, waiting to be sorted'}
        >
          {isTree ? (
            <SortLevels
              layout={layout}
              marks={step?.marks || {}}
              activeRef={activeRef}
              resultRef={resultRef}
            />
          ) : (
            <SortHistory
              layout={layout}
              liveRef={liveRef}
              width={layout.width}
              window={window_}
            />
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
                      y={anchorY - 14 - lane * 16}
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

          {step?.runs && auxY !== null && <SortRuns runs={step.runs} y={auxY} />}

          {step?.buckets && auxY !== null && (
            <SortBuckets buckets={step.buckets} y={auxY} width={layout.width} />
          )}
        </svg>
      </div>
    </div>
  )
}
