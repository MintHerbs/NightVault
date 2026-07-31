// TableauxCanvas - SVG renderer for a semantic tableau.
//
// The tree is laid out once, from the finished tableau, and revealed progressively as
// the animation advances. Laying out each step's snapshot separately (the old approach)
// meant every node jumped sideways whenever a branch was added below it (T-084).
import { memo, useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { getTouchDistance } from '../../../../lib/touchGestures'
import { calculateLayout, flattenTree, NODE_HEIGHT } from '../../../../lib/logic/tableauxLayout'
import styles from './TableauxCanvas.module.css'

const FIT_PADDING = 64
const MIN_ZOOM = 0.15
const MAX_ZOOM = 3

// Memoised on primitive props: a big tableau is several hundred nodes and only a couple
// of them change between one step and the next.
const TableauNode = memo(function TableauNode({ node, position, highlighted, contradicting, marked }) {
  const { x, y, width } = position

  const classes = []
  if (highlighted) classes.push(styles.highlighted)
  if (contradicting) classes.push(styles.contradicting)
  if (marked && node.isClosed) classes.push(styles.closed)
  if (marked && node.isOpen) classes.push(styles.open)

  // The positioning transform lives on the outer <g> and the entrance animation on an
  // inner one: a CSS `transform` on the outer group would override its transform
  // attribute and drop every node onto the origin.
  return (
    <g className={classes.join(' ')} transform={`translate(${x}, ${y})`}>
      <g className={styles.nodeGroup}>
        <rect
          className={styles.nodeBox}
          x={-width / 2}
          y={0}
          width={width}
          height={NODE_HEIGHT}
          rx={10}
        />
        <text className={styles.formulaText} x={0} y={NODE_HEIGHT / 2 + 1} textAnchor="middle" dominantBaseline="middle">
          {node.formula}
        </text>
      </g>
      {marked && (
        <text className={styles.marker} x={0} y={NODE_HEIGHT + 20} textAnchor="middle" dominantBaseline="middle">
          {node.isClosed ? '✗' : '○'}
        </text>
      )}
    </g>
  )
})

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * @param {Object} props
 * @param {Object} [props.insets] - screen-space padding taken up by chrome floating over
 *   the canvas. Used only to frame the tree on load; the canvas itself always paints
 *   edge to edge, so panning is never cut off anywhere but the window border.
 */
export default function TableauxCanvas({
  tree,
  stepIndex = 0,
  highlightNodeId = null,
  contradictionIds = null,
  insets = NO_INSETS
}) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 })
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      })
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const layout = useMemo(() => (tree ? calculateLayout(tree) : null), [tree])
  const graph = useMemo(() => (tree ? flattenTree(tree) : null), [tree])

  const { top: insetTop, right: insetRight, bottom: insetBottom, left: insetLeft } = {
    ...NO_INSETS,
    ...insets
  }

  // Fit the whole tableau into the part of the window the chrome does not cover. The
  // tree is laid out at its final size from the first frame, so this never has to be
  // recomputed mid-run.
  useEffect(() => {
    if (!layout || !dimensions.width || !dimensions.height) return
    const { bounds } = layout

    const usableWidth = dimensions.width - insetLeft - insetRight
    const usableHeight = dimensions.height - insetTop - insetBottom
    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(
        MAX_ZOOM,
        Math.min(
          (usableWidth - FIT_PADDING * 2) / Math.max(bounds.width, 1),
          (usableHeight - FIT_PADDING * 2) / Math.max(bounds.height, 1),
          1
        )
      )
    )

    // A world point wx lands at screen (wx - view.x) * zoom, so solve for the view that
    // puts the tree's centre in the middle of the usable rect and its top just below it.
    setView({
      x: bounds.x + bounds.width / 2 - (insetLeft + usableWidth / 2) / zoom,
      y: bounds.y - (insetTop + FIT_PADDING) / zoom,
      zoom
    })
  }, [layout, dimensions.width, dimensions.height, insetTop, insetRight, insetBottom, insetLeft])

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    setIsPanning(true)
    panStartRef.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }

  const handleMouseMove = (e) => {
    if (!isPanning) return
    const { x: startX, y: startY } = panStartRef.current
    panStartRef.current = { x: e.clientX, y: e.clientY }
    setView((prev) => ({
      ...prev,
      x: prev.x - (e.clientX - startX) / prev.zoom,
      y: prev.y - (e.clientY - startY) / prev.zoom
    }))
  }

  const stopPanning = () => setIsPanning(false)

  // Wheel and touchmove are registered manually: React attaches both passively, so
  // preventDefault inside a JSX handler would not stop the page from scrolling.
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    setView((prev) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * (e.deltaY > 0 ? 0.9 : 1.1)))
      // Keep the point under the cursor fixed while zooming.
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      return {
        zoom,
        x: prev.x + px / prev.zoom - px / zoom,
        y: prev.y + py / prev.zoom - py / zoom
      }
    })
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const touchStateRef = useRef(null)

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStateRef.current = { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      touchStateRef.current = { mode: 'pinch', distance: getTouchDistance(e.touches) }
    }
  }

  const handleTouchEnd = () => { touchStateRef.current = null }

  const handleTouchMove = useCallback((e) => {
    const state = touchStateRef.current
    if (!state) return

    if (state.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault()
      const distance = getTouchDistance(e.touches)
      const factor = distance / state.distance
      touchStateRef.current = { ...state, distance }
      setView((prev) => ({ ...prev, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor)) }))
      return
    }

    if (state.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault()
      const touch = e.touches[0]
      const dx = touch.clientX - state.x
      const dy = touch.clientY - state.y
      touchStateRef.current = { ...state, x: touch.clientX, y: touch.clientY }
      setView((prev) => ({ ...prev, x: prev.x - dx / prev.zoom, y: prev.y - dy / prev.zoom }))
    }
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => svg.removeEventListener('touchmove', handleTouchMove)
  }, [handleTouchMove])

  if (!tree || !layout || !graph) {
    return (
      <div ref={containerRef} className={styles.container}>
        <p className={styles.emptyState}>Enter a formula to build a tableau</p>
      </div>
    )
  }

  const contradicting = contradictionIds ? new Set(contradictionIds) : null
  const visible = (node) => node.revealAt <= stepIndex
  const viewBox = `${view.x} ${view.y} ${dimensions.width / view.zoom} ${dimensions.height / view.zoom}`

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        ref={svgRef}
        className={`${styles.svg} ${isPanning ? styles.grabbing : ''}`}
        width="100%"
        height="100%"
        viewBox={viewBox}
        role="img"
        aria-label={`Semantic tableau for ${tree.formula}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopPanning}
        onMouseLeave={stopPanning}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <g className={styles.edges}>
          {graph.edges.map(({ id, from, to }) => {
            if (!visible(to)) return null
            const a = layout.positions.get(from.id)
            const b = layout.positions.get(to.id)
            return (
              <line
                key={id}
                className={styles.edge}
                x1={a.x}
                y1={a.y + NODE_HEIGHT}
                x2={b.x}
                y2={b.y}
              />
            )
          })}
        </g>

        {graph.nodes.map((node) => {
          if (!visible(node)) return null
          return (
            <TableauNode
              key={node.id}
              node={node}
              position={layout.positions.get(node.id)}
              highlighted={node.id === highlightNodeId}
              contradicting={contradicting?.has(node.id) ?? false}
              marked={node.markAt !== null && node.markAt <= stepIndex}
            />
          )
        })}
      </svg>
    </div>
  )
}
