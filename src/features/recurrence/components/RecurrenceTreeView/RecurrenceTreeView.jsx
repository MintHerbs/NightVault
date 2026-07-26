/**
 * RecurrenceTreeView - zoomable, pannable SVG recursion tree.
 *
 * All geometry arrives pre-computed from the solver (node boxes, the
 * annotation column, the tail and the derived formula), so this component
 * only draws. The viewBox comes from the solver's content bounds rather than
 * a fixed canvas size, which is what keeps wide trees from being clipped.
 */
import { useState, useRef } from 'react'
import styles from './RecurrenceTreeView.module.css'

const COLORS = {
  recursive: { fill: 'rgba(139,92,246,0.15)', stroke: '#8B5CF6', text: '#c4b5fd' },
  base: { fill: 'rgba(107,114,128,0.15)', stroke: '#6b7280', text: '#9ca3af' },
  ellipsis: { fill: 'transparent', stroke: 'transparent', text: '#6b7280' },
}

const ZOOM_MIN = 0.35
const ZOOM_MAX = 2.5

function RecurrenceTreeView({ tree, formula }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  if (!tree || !tree.nodes || tree.nodes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>No tree to draw</div>
      </div>
    )
  }

  const { nodes, edges, annotations = [], tail, derivation, viewBox } = tree
  const byId = new Map(nodes.map(n => [n.id, n]))

  // Zoom about the middle of the content, so the tree stays put as it scales.
  const cx = viewBox.x + viewBox.width / 2
  const cy = viewBox.y + viewBox.height / 2
  const transform = `translate(${cx + pan.x}, ${cy + pan.y}) scale(${zoom}) translate(${-cx}, ${-cy})`

  const zoomBy = delta => setZoom(z => clamp(z + delta, ZOOM_MIN, ZOOM_MAX))

  const handleWheel = e => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    zoomBy(e.deltaY > 0 ? -0.12 : 0.12)
  }

  const handleMouseDown = e => {
    setIsPanning(true)
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = e => {
    if (!isPanning) return
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }

  const stopPanning = () => setIsPanning(false)

  const reset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const renderEdge = (edge, i) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (!from || !to) return null
    return (
      <line
        key={`e${i}`}
        x1={from.x}
        y1={from.y + from.h / 2}
        x2={to.x}
        y2={to.y - to.h / 2}
        stroke="#4b5563"
        strokeWidth={1.4}
        strokeDasharray={edge.kind === 'dashed' ? '4 4' : undefined}
      />
    )
  }

  const renderNode = node => {
    if (node.kind === 'ellipsis') {
      return (
        <text
          key={node.id}
          x={node.x}
          y={node.y + 6}
          textAnchor="middle"
          fill={COLORS.ellipsis.text}
          fontSize="18"
          fontFamily="JetBrains Mono, monospace"
        >
          …
        </text>
      )
    }
    const c = COLORS[node.kind] ?? COLORS.recursive
    return (
      <g key={node.id}>
        <rect
          x={node.x - node.w / 2}
          y={node.y - node.h / 2}
          width={node.w}
          height={node.h}
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={1.5}
          rx={7}
        />
        <text
          x={node.x}
          y={node.y + 4}
          textAnchor="middle"
          fill={c.text}
          fontSize="13"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
        >
          {node.label}
        </text>
      </g>
    )
  }

  const renderAnnotation = (a, i) => (
    <g key={`a${i}`}>
      {a.countText && (
        <text
          x={a.x}
          y={a.y + 4}
          fill="#6b7280"
          fontSize="11.5"
          fontFamily="JetBrains Mono, monospace"
        >
          {a.countText}
        </text>
      )}
      <rect
        x={a.x + a.countWidth + 12}
        y={a.y - 13}
        width={a.costWidth}
        height={26}
        rx={6}
        fill="rgba(34,197,94,0.14)"
        stroke="#22c55e"
        strokeWidth={0.9}
      />
      <text
        x={a.x + a.countWidth + 12 + a.costWidth / 2}
        y={a.y + 4}
        textAnchor="middle"
        fill="#86efac"
        fontSize="12"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="700"
      >
        {a.costText}
      </text>
    </g>
  )

  return (
    <div className={styles.container}>
      <div className={styles.zoomControls}>
        <button className={styles.zoomButton} onClick={() => zoomBy(0.2)} title="Zoom in" aria-label="Zoom in">
          +
        </button>
        <button className={styles.zoomButton} onClick={() => zoomBy(-0.2)} title="Zoom out" aria-label="Zoom out">
          −
        </button>
      </div>

      <div
        className={`${styles.svgWrapper} ${isPanning ? styles.grabbing : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopPanning}
        onMouseLeave={stopPanning}
        onDoubleClick={reset}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={transform}>
            {edges.map(renderEdge)}

            {/* The tail: the tree continues, then reaches its base case. */}
            {tail && (
              <g>
                {tail.from.map((p, i) => (
                  <line
                    key={`t${i}`}
                    x1={p.x}
                    y1={p.y}
                    x2={tail.x}
                    y2={tail.dotsY - 16}
                    stroke="#4b5563"
                    strokeWidth={1.4}
                    strokeDasharray="4 4"
                  />
                ))}
                <circle cx={tail.x} cy={tail.dotsY - 8} r={2.4} fill="#6b7280" />
                <circle cx={tail.x} cy={tail.dotsY} r={2.4} fill="#6b7280" />
                <circle cx={tail.x} cy={tail.dotsY + 8} r={2.4} fill="#6b7280" />
                <line
                  x1={tail.x}
                  y1={tail.dotsY + 16}
                  x2={tail.x}
                  y2={tail.toY}
                  stroke="#4b5563"
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                />
              </g>
            )}

            {nodes.map(renderNode)}
            {annotations.map(renderAnnotation)}

            {/* The formula the tree derives. */}
            {derivation && (
              <g>
                <line
                  x1={derivation.x - derivation.width / 2}
                  y1={derivation.y - 22}
                  x2={derivation.x + derivation.width / 2}
                  y2={derivation.y - 22}
                  stroke="#1f2937"
                  strokeWidth={1}
                />
                {derivation.lines.map((line, i) => (
                  <text
                    key={`d${i}`}
                    x={derivation.x}
                    y={derivation.y + i * 24}
                    textAnchor="middle"
                    fill={i === derivation.lines.length - 1 ? '#c4b5fd' : '#9ca3af'}
                    fontSize={i === derivation.lines.length - 1 ? '15' : '13'}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={i === derivation.lines.length - 1 ? '700' : '400'}
                  >
                    {line}
                  </text>
                ))}
              </g>
            )}
          </g>
        </svg>
      </div>

      {formula && <div className={styles.formulaDisplay}>{formula}</div>}
    </div>
  )
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export default RecurrenceTreeView
