/**
 * CircuitCanvas - read-only render of a synthesised netlist (T-089).
 *
 * Pan and zoom behaviour is copied from ERDCanvas rather than imported: that
 * component is bound to ERD's own data shape, and the alternative is a shared
 * abstraction neither tool asked for. Same call made in logic-tools.md.
 *
 * Gate bodies are drawn as distinctive shapes, not labelled boxes. A student
 * reading a circuit is pattern-matching on the silhouette, and a row of
 * identical rectangles reading "AND"/"OR" defeats that.
 *
 * @param {Object} props
 * @param {import('../../../../lib/circuits/circuitSynthesis.js').Netlist} props.netlist
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { layoutCircuit, wirePath } from '../../../../lib/circuits/circuitLayout'
import { gateSummary } from '../../../../lib/circuits/circuitSynthesis'
import { gateSilhouette } from '../../../../lib/circuits/gateShapes'
import { md } from '../md'
import styles from './CircuitCanvas.module.css'

const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.6

export default function CircuitCanvas({ netlist }) {
  const layout = layoutCircuit(netlist)
  const summary = gateSummary(netlist)

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const dragRef = useRef(null)
  const frameRef = useRef(null)

  // Fit on first paint and whenever the circuit changes shape, so a wide
  // circuit is not half off-screen before the visitor has touched anything.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const { width, height } = frame.getBoundingClientRect()
    if (width === 0 || height === 0) return

    const zoom = Math.min(1, Math.min(width / (layout.width + 40), height / (layout.height + 40)))
    setView({
      x: (width - layout.width * zoom) / 2,
      y: (height - layout.height * zoom) / 2,
      zoom,
    })
  }, [layout.width, layout.height])

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0) return
    dragRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    dragRef.current = { x: event.clientX, y: event.clientY }
    setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }, [])

  const onPointerUp = useCallback((event) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const onWheel = useCallback((event) => {
    // Zoom toward the cursor, not the origin, so zooming in on a gate keeps
    // that gate under the pointer.
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top

    setView((v) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)))
      const ratio = next / v.zoom
      return { zoom: next, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio }
    })
  }, [])

  return (
    <div className={styles.wrap}>
      <div
        ref={frameRef}
        className={styles.frame}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <svg className={styles.svg} role="img" aria-label="Synthesised logic circuit">
          <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
            {layout.wires.map(wire => (
              <path key={wire.id} d={wirePath(wire)} className={styles.wire} />
            ))}
            {layout.wires.map(wire => {
              const point = layout.ports.get(wire.to)
              return point ? <circle key={`${wire.id}-j`} cx={point.x} cy={point.y} r={2.6} className={styles.pin} /> : null
            })}
            {layout.components.map(component => (
              <GateSymbol key={component.id} component={component} />
            ))}
          </g>
        </svg>
      </div>

      <div className={styles.summary}>
        <span className={styles.stat}>
          <span className={styles.statValue}>{summary.total}</span> gates
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{summary.gates}</span> logic
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{summary.inverters}</span>
          inverter{summary.inverters === 1 ? '' : 's'}
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{summary.pins}</span> gate inputs
        </span>
        <span className={`${styles.hint} ${md.bodySmall}`}>Drag to pan, scroll to zoom</span>
      </div>
    </div>
  )
}

function GateSymbol({ component }) {
  const { x, y, width, height, kind, label } = component
  const cx = x + width / 2
  const cy = y + height / 2

  if (kind === 'input' || kind === 'output') {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={height / 2} className={styles.pinBox} />
        <text x={cx} y={cy + 5} className={styles.pinLabel}>{label}</text>
      </g>
    )
  }

  if (kind === 'const') {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={6} className={styles.constBox} />
        <text x={cx} y={cy + 5} className={styles.constLabel}>{label}</text>
      </g>
    )
  }

  // Shapes come from lib/circuits/gateShapes.js so this canvas and the editable
  // sandbox draw the same silhouettes.
  const shape = gateSilhouette(kind, { x, y, width, height })
  if (!shape) return null

  return (
    <g>
      <path d={shape.body} className={styles.gate} />
      {shape.tail && <path d={shape.tail} className={styles.gateOutline} />}
      {shape.bubble && (
        <circle cx={shape.bubble.cx} cy={shape.bubble.cy} r={shape.bubble.r} className={styles.bubble} />
      )}
      <title>{kind.toUpperCase()}{label ? `: ${label}` : ''}</title>
    </g>
  )
}
