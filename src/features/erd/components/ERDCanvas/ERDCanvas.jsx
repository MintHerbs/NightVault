import { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react'
import { calculateERDLayout } from '../../../../lib/erdLayout'
import {
  EntityRectangle,
  WeakEntityRectangle,
  AttributeEllipse,
  KeyAttributeEllipse,
  PartialKeyAttributeEllipse,
  MultiValuedAttributeEllipse,
  DerivedAttributeEllipse,
  RelationshipDiamond,
  IdentifyingRelationshipDiamond,
  IsATriangle
} from './shapes.jsx'
import {
  renderSingleLine,
  renderDoubleLine,
  renderAttributeLine,
  getNodeEdgePoint
} from './edges.jsx'
import { getTouchDistance, getTouchMidpoint } from '../../../../lib/touchGestures'
import styles from './ERDCanvas.module.css'

function nodeShape(node) {
  const props = { x: node.x, y: node.y, width: node.width, height: node.height, label: node.name ?? 'IS-A' }

  if (node.type === 'entity') {
    return node.isWeak
      ? <WeakEntityRectangle {...props} />
      : <EntityRectangle {...props} />
  }

  if (node.type === 'relationship') {
    return node.isIdentifying
      ? <IdentifyingRelationshipDiamond {...props} />
      : <RelationshipDiamond {...props} />
  }

  if (node.type === 'attribute') {
    const animationDelay = `${(node.animationIndex || 0) * 0.3}s`
    // Cases must match the canonical types parseERD emits — see ATTRIBUTE_TYPE_ALIASES
    const Component = (() => {
      switch (node.attrType) {
        case 'key':         return KeyAttributeEllipse
        case 'partialKey':  return PartialKeyAttributeEllipse
        case 'multiValued': return MultiValuedAttributeEllipse
        case 'derived':     return DerivedAttributeEllipse
        default:            return AttributeEllipse
      }
    })()
    return (
      <g className={styles.floatingAttribute} style={{ animationDelay }}>
        <Component {...props} />
      </g>
    )
  }

  if (node.type === 'isa') {
    return <IsATriangle {...props} label="IS-A" orientation={node.orientation} />
  }

  return null
}

function edgeContent(edge) {
  const { fromNode: from, toNode: to } = edge

  // Calculate border intersection points
  const fromPoint = getNodeEdgePoint(from, to.x, to.y)
  const toPoint = getNodeEdgePoint(to, from.x, from.y)

  if (edge.type === 'attribute-link') {
    return renderAttributeLine(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y)
  }

  if (edge.type === 'relationship-entity') {
    const line = edge.participation === 'total'
      ? renderDoubleLine(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y)
      : renderSingleLine(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y)

    // Cardinality label 20px from entity end, along the line toward relationship
    const totalDist = Math.sqrt((toPoint.x - fromPoint.x) ** 2 + (toPoint.y - fromPoint.y) ** 2) || 1
    const ux = (fromPoint.x - toPoint.x) / totalDist
    const uy = (fromPoint.y - toPoint.y) / totalDist
    const labelX = toPoint.x + ux * 20
    const labelY = toPoint.y + uy * 20

    return (
      <>
        {line}
        {edge.cardinality && (
          <text
            x={labelX}
            y={labelY}
            fill="#ffffff"
            fontSize="12"
            fontWeight="600"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {edge.cardinality}
          </text>
        )}
      </>
    )
  }

  if (edge.type === 'isa-parent') {
    return edge.participation === 'total'
      ? renderDoubleLine(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y)
      : renderSingleLine(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y)
  }

  if (edge.type === 'isa-child') {
    return renderSingleLine(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y)
  }

  return null
}

// Memoised so a drag only re-renders the shapes that actually moved. The inline
// handler closures live inside the component rather than at the call site, so
// they don't defeat the memo comparison.
const ERDEdge = memo(function ERDEdge({ edge }) {
  return <g>{edgeContent(edge)}</g>
})

const ERDNode = memo(function ERDNode({ node, onMouseDown, onTouchStart }) {
  const isDraggable = node.type === 'entity' || node.type === 'relationship' || node.type === 'isa'
  return (
    <g
      onMouseDown={isDraggable ? (e) => onMouseDown(e, node) : undefined}
      onTouchStart={isDraggable ? (e) => onTouchStart(e, node) : undefined}
      style={{ cursor: isDraggable ? 'move' : 'default', touchAction: 'none' }}
    >
      {nodeShape(node)}
    </g>
  )
})

function ERDCanvas({ erdData }) {
  const svgRef = useRef(null)
  const [viewBox, setViewBox] = useState({ x: -700, y: -200, width: 1400, height: 900 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Positions the user has committed by finishing a drag. Deliberately NOT updated
  // during the drag itself — writing here re-runs the whole layout.
  const [committedPositions, setCommittedPositions] = useState({})

  // The in-flight drag, as a translation to apply on top of the base layout.
  const [dragDelta, setDragDelta] = useState(null) // { nodeId, attributeIds, dx, dy }

  // Touch tracking refs - read directly (not via React state) so a touchmove
  // immediately following a touchstart always sees up-to-date gating, even before
  // React has committed the corresponding state update
  const touchPinchRef = useRef(null) // { distance }
  const touchPanRef = useRef(null) // { x, y } - background single-finger pan
  const dragRef = useRef(null) // live drag bookkeeping, mirrors dragDelta
  const rafRef = useRef(null)

  // Base layout. calculateERDLayout runs an O(n^2) relaxation, so it must only be
  // re-run when the diagram actually changes shape — never per pointer event.
  const baseLayout = useMemo(
    () => erdData ? calculateERDLayout(erdData, committedPositions) : { nodes: [], edges: [] },
    [erdData, committedPositions]
  )

  // Applies the live drag as a plain O(n) translation of the dragged node and the
  // attributes bonded to it. No relayout.
  //
  // Everything not moving keeps its object identity, which is what lets the
  // memoised node/edge components bail out. Rebuilding all of them each frame
  // meant a 40-element reconcile and a full edge-geometry recompute per pointer
  // move, even though only a handful of shapes had actually changed.
  const layout = useMemo(() => {
    if (!dragDelta) return baseLayout

    const moving = new Set([dragDelta.nodeId, ...dragDelta.attributeIds])
    const nodes = baseLayout.nodes.map(n =>
      moving.has(n.id) ? { ...n, x: n.x + dragDelta.dx, y: n.y + dragDelta.dy } : n
    )
    const byId = new Map(nodes.map(n => [n.id, n]))
    const edges = baseLayout.edges.map(e => (
      moving.has(e.from) || moving.has(e.to)
        ? { ...e, fromNode: byId.get(e.from) ?? e.fromNode, toNode: byId.get(e.to) ?? e.toNode }
        : e
    ))
    return { nodes, edges }
  }, [baseLayout, dragDelta])

  // Convert mouse position to SVG coordinates
  const screenToSVG = useCallback((clientX, clientY) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const x = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width
    const y = viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height
    return { x, y }
  }, [viewBox])

  // Attribute ids bonded to a node, so a drag carries them along
  const attributesOf = useCallback((nodeId) => (
    baseLayout.edges
      .filter(e => e.type === 'attribute-link' && e.from === nodeId)
      .map(e => e.to)
  ), [baseLayout.edges])

  // Pointer events fire far faster than frames. Coalescing into rAF keeps one
  // React commit per frame instead of one per event, which is what made dragging
  // stutter on touch devices.
  const scheduleDeltaFlush = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const drag = dragRef.current
      if (!drag) return
      setDragDelta({
        nodeId: drag.nodeId,
        attributeIds: drag.attributeIds,
        dx: drag.dx,
        dy: drag.dy,
      })
    })
  }, [])

  const beginDrag = useCallback((clientX, clientY, node) => {
    if (node.type === 'attribute') return
    const svgPos = screenToSVG(clientX, clientY)
    const attributeIds = node.type === 'isa' ? [] : attributesOf(node.id)

    dragRef.current = {
      nodeId: node.id,
      attributeIds,
      startX: svgPos.x,
      startY: svgPos.y,
      dx: 0,
      dy: 0,
      hasMoved: false,
    }
    setDragDelta({ nodeId: node.id, attributeIds, dx: 0, dy: 0 })
  }, [attributesOf, screenToSVG])

  const moveDrag = useCallback((clientX, clientY) => {
    const drag = dragRef.current
    if (!drag) return
    const svgPos = screenToSVG(clientX, clientY)
    drag.dx = svgPos.x - drag.startX
    drag.dy = svgPos.y - drag.startY
    drag.hasMoved = drag.hasMoved || Math.abs(drag.dx) > 3 || Math.abs(drag.dy) > 3
    scheduleDeltaFlush()
  }, [screenToSVG, scheduleDeltaFlush])

  // Commit the drag into positions the layout will respect from here on. This is
  // the only place the expensive relayout is triggered by dragging.
  const endDrag = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (!drag) return

    if (drag.hasMoved) {
      const byId = new Map(baseLayout.nodes.map(n => [n.id, n]))
      setCommittedPositions(prev => {
        const next = { ...prev }
        for (const id of [drag.nodeId, ...drag.attributeIds]) {
          const n = byId.get(id)
          if (n) next[id] = { x: n.x + drag.dx, y: n.y + drag.dy, manuallyPlaced: true }
        }
        return next
      })
    }
    setDragDelta(null)
  }, [baseLayout.nodes])

  const handleNodeMouseDown = useCallback((e, node) => {
    if (node.type === 'attribute') return
    e.stopPropagation()
    beginDrag(e.clientX, e.clientY, node)
  }, [beginDrag])

  // Ignores a second finger landing on a different node mid-drag rather than
  // hijacking the drag onto it, since handleTouchMove tracks a single drag via touches[0]
  const handleNodeTouchStart = useCallback((e, node) => {
    if (node.type === 'attribute' || dragRef.current) return
    e.stopPropagation()
    const touch = e.touches[0]
    beginDrag(touch.clientX, touch.clientY, node)
  }, [beginDrag])

  const handleMouseMove = useCallback((e) => {
    if (dragRef.current) {
      moveDrag(e.clientX, e.clientY)
    } else if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const scaleX = viewBox.width / rect.width
      const scaleY = viewBox.height / rect.height
      setViewBox(prev => ({ ...prev, x: prev.x - dx * scaleX, y: prev.y - dy * scaleY }))
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [isPanning, panStart, viewBox.width, viewBox.height, moveDrag])

  const handleMouseUp = useCallback(() => {
    endDrag()
    setIsPanning(false)
  }, [endDrag])

  const handleMouseLeave = useCallback(() => {
    endDrag()
    setIsPanning(false)
  }, [endDrag])

  // Start panning (only if not dragging a node)
  const handleBackgroundMouseDown = useCallback((e) => {
    if (e.button !== 0 || dragRef.current) return
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
    e.preventDefault()
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width
    const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height
    setViewBox(prev => {
      const newWidth = prev.width * zoomFactor
      const newHeight = prev.height * zoomFactor
      return {
        x: svgX - (mouseX / rect.width) * newWidth,
        y: svgY - (mouseY / rect.height) * newHeight,
        width: newWidth,
        height: newHeight
      }
    })
  }, [viewBox])

  // Start panning or pinch-zooming (only if not dragging a node).
  // Note: gating reads dragRef, not dragDelta - a touchmove immediately following this
  // touchstart can fire before React commits the corresponding setState.
  const handleBackgroundTouchStart = useCallback((e) => {
    if (dragRef.current) return

    if (e.touches.length === 1) {
      setIsPanning(true)
      touchPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      setIsPanning(false)
      touchPanRef.current = null
      touchPinchRef.current = {
        distance: getTouchDistance(e.touches)
      }
    }
  }, [])

  // Note: React attaches touchmove as a passive listener, so preventDefault() here would be a
  // no-op (and log a warning) - touch-action: none in CSS is what stops native scroll/zoom
  const handleTouchMove = useCallback((e) => {
    // Dragging a node with one finger
    if (dragRef.current) {
      const touch = e.touches[0]
      moveDrag(touch.clientX, touch.clientY)
      return
    }

    // Two-finger pinch-zoom on the background
    if (e.touches.length === 2 && touchPinchRef.current) {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const state = touchPinchRef.current
      const newDistance = getTouchDistance(e.touches)
      const zoomFactor = state.distance / newDistance

      // Anchor at the current midpoint (not the one from pinch start) so the zoom tracks the
      // fingers even when they drift while pinching, matching wheel-zoom's live cursor anchor
      const midpoint = getTouchMidpoint(e.touches)
      const midX = midpoint.x - rect.left
      const midY = midpoint.y - rect.top
      const svgX = viewBox.x + (midX / rect.width) * viewBox.width
      const svgY = viewBox.y + (midY / rect.height) * viewBox.height

      setViewBox(prev => {
        const newWidth = prev.width * zoomFactor
        const newHeight = prev.height * zoomFactor
        return {
          x: svgX - (midX / rect.width) * newWidth,
          y: svgY - (midY / rect.height) * newHeight,
          width: newWidth,
          height: newHeight
        }
      })

      touchPinchRef.current = { ...state, distance: newDistance }
      return
    }

    // Single-finger pan on the background
    if (touchPanRef.current && e.touches.length === 1) {
      const touch = e.touches[0]
      const dx = touch.clientX - touchPanRef.current.x
      const dy = touch.clientY - touchPanRef.current.y
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const scaleX = viewBox.width / rect.width
      const scaleY = viewBox.height / rect.height
      setViewBox(prev => ({ ...prev, x: prev.x - dx * scaleX, y: prev.y - dy * scaleY }))
      touchPanRef.current = { x: touch.clientX, y: touch.clientY }
    }
  }, [viewBox, moveDrag])

  // End touch interaction — stop drag/pan/pinch, or fall back to pan if one finger remains
  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      endDrag()
      setIsPanning(false)
      touchPanRef.current = null
      touchPinchRef.current = null
    } else if (e.touches.length === 1) {
      touchPinchRef.current = null
      if (!dragRef.current) {
        setIsPanning(true)
        touchPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }
  }, [endDrag])

  // A drag in flight when the canvas unmounts would otherwise leave a frame queued
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className={styles.container}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleBackgroundTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ cursor: dragDelta ? 'grabbing' : isPanning ? 'grabbing' : 'grab' }}
        data-dragging={dragDelta ? 'true' : undefined}
      >
        {/* Edges first — behind nodes so lines don't overlap labels */}
        {layout.edges.map((edge, i) => (
          <ERDEdge key={`${edge.type}-${edge.from}-${edge.to}-${i}`} edge={edge} />
        ))}

        {/* Nodes on top */}
        {layout.nodes.map(node => (
          <ERDNode
            key={node.id}
            node={node}
            onMouseDown={handleNodeMouseDown}
            onTouchStart={handleNodeTouchStart}
          />
        ))}
      </svg>

      <div className={styles.hint}>
        {dragDelta ? 'Dragging node...' : 'Drag nodes to reposition • Drag background to pan • Scroll to zoom'}
      </div>
    </div>
  )
}

export default ERDCanvas
