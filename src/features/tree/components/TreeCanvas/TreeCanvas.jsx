// SVG viewport - owns the <svg> root element and handles pan/zoom
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import styles from './TreeCanvas.module.css'
import TreeNode from '../TreeNode/TreeNode'
import TreeEdge from '../TreeEdge/TreeEdge'
import { calculateTreeLayout, getNodeSlots } from '../../../../lib/treeLayout'
import { getTouchDistance, getTouchMidpoint } from '../../../../lib/touchGestures'

// Zoom is expressed as the viewBox width, so a SMALLER width is a closer zoom. Without
// bounds each wheel tick just multiplied it, so zooming in ran the width toward zero:
// by ~200 ticks it is 1e-9, and the browser is asked to rasterise glyphs and strokes at
// a scale of a billion, which is what froze the tab. Zooming out ran it to infinity with
// the same result.
const BASE_WIDTH = 1000
const BASE_HEIGHT = 800
// 4x rather than 8x. Every node carries a drop-shadow glow, and a filter is
// rasterised at the on-screen scale, so the cost of the whole canvas grows with
// the square of the zoom. 8x was still enough to make a big tree crawl on the way
// in; 4x is past the point where a node is comfortably readable anyway.
const MIN_WIDTH = BASE_WIDTH / 4
const MAX_WIDTH = BASE_WIDTH * 12   // far enough out to see a very wide tree whole

function clampWidth(width) {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
}

function TreeCanvas({ tree, step = null, interactive = false, onEditKey, onDeleteKey }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const [viewBox, setViewBox] = useState({ x: -500, y: -100, width: BASE_WIDTH, height: BASE_HEIGHT })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const touchStateRef = useRef(null) // { mode: 'pan' | 'pinch', ... }
  const [hovered, setHovered] = useState(null) // { nodeId, keyIndex, keyValue, isLeaf, left, top }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const closeTimerRef = useRef(null)

  // Calculate layout from tree
  const layout = useMemo(() => {
    if (!tree || !tree.root) return { nodes: [], edges: [] }
    return calculateTreeLayout(tree.root)
  }, [tree])

  const hasTree = layout.nodes.length > 0

  // The current step's highlight, indexed by node id. Keys are carried alongside
  // so TreeNode can mark them without re-scanning every node for the value.
  const markByNode = useMemo(() => {
    const map = new Map()
    if (!step?.nodes?.length) return map
    for (const nodeId of step.nodes) {
      map.set(nodeId, {
        intent: step.intent,
        keys: step.keys,
        // Only the step that still contains the doomed key pulses it.
        pulse: step.kind === 'mark'
      })
    }
    return map
  }, [step])

  // Mouse down - start panning
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return // Only left click
    // The popover's position is resolved once, on hover. Panning moves the key out
    // from under it, so dismiss it rather than leave it pointing at empty space.
    setHovered(null)
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
    e.preventDefault()
  }, [])

  // Mouse move - pan the view
  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return

    const dx = e.clientX - panStart.x
    const dy = e.clientY - panStart.y

    // Scale movement by viewBox size / SVG size
    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const scaleX = viewBox.width / rect.width
    const scaleY = viewBox.height / rect.height

    setViewBox(prev => ({
      ...prev,
      x: prev.x - dx * scaleX,
      y: prev.y - dy * scaleY
    }))

    setPanStart({ x: e.clientX, y: e.clientY })
  }, [isPanning, panStart, viewBox.width, viewBox.height])

  // Mouse up - stop panning
  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Mouse leave - stop panning
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Wheel - zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault()

    const delta = e.deltaY
    const zoomFactor = delta > 0 ? 1.1 : 0.9

    // Zoom towards mouse position
    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Convert mouse position to SVG coordinates
    const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width
    const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height

    setViewBox(prev => {
      // Clamp on width and derive height from it, so the aspect ratio survives a
      // clamped step instead of drifting every time the limit is hit.
      const newWidth = clampWidth(prev.width * zoomFactor)
      const newHeight = prev.height * (newWidth / prev.width)

      // Adjust position to zoom towards mouse
      const newX = svgX - (mouseX / rect.width) * newWidth
      const newY = svgY - (mouseY / rect.height) * newHeight

      return {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      }
    })
  }, [viewBox])

  // Registered by hand rather than via onWheel: React attaches wheel listeners as
  // passive, which makes the preventDefault above a silent no-op, so scrolling to zoom
  // also scrolled the page behind the canvas.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Touch start - begin single-finger pan or two-finger pinch
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      touchStateRef.current = { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      touchStateRef.current = {
        mode: 'pinch',
        distance: getTouchDistance(e.touches)
      }
    }
  }, [])

  // Touch move - pan with one finger, pinch-zoom with two
  // Note: React attaches touchmove as a passive listener, so preventDefault() here would
  // be a no-op (and log a warning) - touch-action: none in CSS is what stops native scroll/zoom
  const handleTouchMove = useCallback((e) => {
    const state = touchStateRef.current
    if (!state) return

    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()

    if (state.mode === 'pan' && e.touches.length === 1) {
      const touch = e.touches[0]
      const dx = touch.clientX - state.x
      const dy = touch.clientY - state.y
      const scaleX = viewBox.width / rect.width
      const scaleY = viewBox.height / rect.height

      setViewBox(prev => ({
        ...prev,
        x: prev.x - dx * scaleX,
        y: prev.y - dy * scaleY
      }))

      touchStateRef.current = { ...state, x: touch.clientX, y: touch.clientY }
    } else if (state.mode === 'pinch' && e.touches.length === 2) {
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
        const newWidth = clampWidth(prev.width * zoomFactor)
        const newHeight = prev.height * (newWidth / prev.width)

        return {
          x: svgX - (midX / rect.width) * newWidth,
          y: svgY - (midY / rect.height) * newHeight,
          width: newWidth,
          height: newHeight
        }
      })

      touchStateRef.current = { ...state, distance: newDistance }
    }
  }, [viewBox])

  // --- Hovering a key ------------------------------------------------------
  //
  // The popover is HTML positioned over the canvas rather than SVG drawn inside
  // it, so it keeps a constant size: rendered in user space it would grow with
  // the zoom and swamp the tree at 8x.

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const closePopover = useCallback(() => {
    cancelClose()
    setHovered(null)
    setEditing(false)
    setError('')
  }, [cancelClose])

  const handleKeyEnter = useCallback((info) => {
    // While a run is still playing the canvas is showing a past frame. Acting on
    // it would apply the edit to the committed tree, which is a different shape
    // from the one under the cursor, so the affordance stays shut until the end.
    if (!interactive) return
    // An open editor owns the popover until it is submitted or dismissed; sliding
    // the pointer over a neighbouring key must not silently discard what was typed.
    if (editing) return
    cancelClose()

    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container) return

    const ctm = svg.getScreenCTM()
    if (!ctm) return

    const pt = svg.createSVGPoint()
    pt.x = info.nodeX + info.localX
    pt.y = info.nodeY
    const screen = pt.matrixTransform(ctm)
    const bounds = container.getBoundingClientRect()

    setEditing(false)
    setError('')
    setHovered({
      nodeId: info.nodeId,
      keyIndex: info.keyIndex,
      keyValue: info.keyValue,
      isLeaf: info.isLeaf,
      left: screen.x - bounds.left,
      top: screen.y - bounds.top
    })
  }, [interactive, cancelClose])

  // Grace period so the pointer can travel from the key to the popover without
  // crossing a gap that closes it. An open editor is dismissed deliberately
  // (Save, Cancel, Escape, or a click on the canvas), never by the pointer
  // wandering off mid-word.
  const handleKeyLeave = useCallback(() => {
    if (editing) return
    cancelClose()
    closeTimerRef.current = setTimeout(() => setHovered(null), 140)
  }, [cancelClose, editing])

  // A step change means the tree under the popover just changed shape.
  useEffect(() => { closePopover() }, [step, closePopover])
  useEffect(() => cancelClose, [cancelClose])

  const submitEdit = useCallback(() => {
    const next = draft.trim()
    if (!next) return
    if (String(next).toLowerCase() === String(hovered.keyValue).toLowerCase()) {
      closePopover()
      return
    }
    const failure = onEditKey?.(hovered.keyValue, next)
    if (failure) {
      setError(failure)
      return
    }
    closePopover()
  }, [draft, hovered, onEditKey, closePopover])

  // Touch end - stop panning/pinching, or fall back to single-finger pan if one finger remains
  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 1) {
      touchStateRef.current = { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else {
      touchStateRef.current = null
    }
  }, [])

  // Build node map for quick lookup
  const nodeMap = new Map()
  layout.nodes.forEach(node => {
    nodeMap.set(node.id, node)
  })

  // Empty state - no tree yet
  if (!hasTree) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🌳</div>
          <h2 className={styles.emptyTitle}>No Tree Yet</h2>
          <p className={styles.emptyText}>
            Use the panel on the right to insert values and build your B+ tree, or start a new tree from the bottom of that panel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Define arrow markers */}
        <defs>
          {/* Leaf pointer arrow (green) */}
          <marker
            id="leaf-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="var(--accent-green)" />
          </marker>
        </defs>

        {/* Render parent-child edges first (behind nodes) */}
        {layout.edges.map((edge, index) => {
          if (edge.isLeafPointer) return null // Skip leaf pointers here

          const fromNode = nodeMap.get(edge.fromId)
          const toNode = nodeMap.get(edge.toId)

          if (!fromNode || !toNode) return null

          // Anchor the edge at the centre of the parent's pointer slot for this
          // child, so each separator key visibly sits between the two subtrees it
          // divides. Fall back to the node centre if the slot can't be resolved.
          const parentSlots = getNodeSlots(fromNode.keys.length, fromNode.keySlotWidths)
          const pointerSlots = parentSlots.filter(s => s.type === 'pointer')
          const slot = pointerSlots[edge.childIndex]
          const fromX = slot
            ? fromNode.x - fromNode.width / 2 + slot.x + slot.width / 2
            : fromNode.x

          const from = {
            x: fromX,
            y: fromNode.y + fromNode.height / 2
          }
          const to = {
            x: toNode.x,
            y: toNode.y - toNode.height / 2
          }

          return (
            <TreeEdge
              key={`edge-${index}`}
              from={from}
              to={to}
              isLeafPointer={false}
            />
          )
        })}

        {/* Render nodes */}
        {layout.nodes.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            mark={markByNode.get(node.id) || null}
            hoveredKey={hovered}
            onKeyEnter={handleKeyEnter}
            onKeyLeave={handleKeyLeave}
          />
        ))}

        {/* Render leaf-to-leaf pointers (on top of nodes) */}
        {layout.nodes.map(node => {
          if (!node.isLeaf || !node.nextLeafId) return null

          const nextNode = nodeMap.get(node.nextLeafId)
          if (!nextNode) return null

          // Calculate horizontal arrow from right edge of current to left edge of next
          const from = {
            x: node.x + node.width / 2,
            y: node.y
          }
          const to = {
            x: nextNode.x - nextNode.width / 2,
            y: nextNode.y
          }

          return (
            <TreeEdge
              key={`leaf-pointer-${node.id}`}
              from={from}
              to={to}
              isLeafPointer={true}
            />
          )
        })}
      </svg>

      {hovered && (
        <div
          className={styles.popover}
          style={{ left: hovered.left, top: hovered.top }}
          onMouseEnter={cancelClose}
          onMouseLeave={handleKeyLeave}
        >
          {hovered.isLeaf ? (
            <>
              <p className={styles.popoverKind}>Record</p>
              <p className={styles.popoverValue}>{String(hovered.keyValue)}</p>

              {editing ? (
                <>
                  <input
                    className={styles.popoverInput}
                    value={draft}
                    autoFocus
                    onChange={(e) => { setDraft(e.target.value); setError('') }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitEdit()
                      if (e.key === 'Escape') closePopover()
                    }}
                    aria-label={`New value for ${hovered.keyValue}`}
                  />
                  {error && <p className={styles.popoverError}>{error}</p>}
                  <p className={styles.popoverNote}>
                    Keys are stored in order, so this is applied as a delete and an insert.
                  </p>
                  <div className={styles.popoverRow}>
                    <button type="button" className={styles.popoverPrimary} onClick={submitEdit}>
                      Save
                    </button>
                    <button type="button" className={styles.popoverGhost} onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.popoverRow}>
                  <button
                    type="button"
                    className={styles.popoverGhost}
                    onClick={() => { setDraft(String(hovered.keyValue)); setEditing(true) }}
                  >
                    <Pencil size={13} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.popoverDanger}
                    onClick={() => { onDeleteKey?.(hovered.keyValue); closePopover() }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className={styles.popoverKind}>Separator</p>
              <p className={styles.popoverValue}>{String(hovered.keyValue)}</p>
              {/* The question this answers: why can't I delete the 5 in the root
                  when there is also a 5 in a leaf? Because only one of them is a
                  record. Saying so is more use than hiding the affordance. */}
              <p className={styles.popoverNote}>
                A signpost, not a record. Keys of {String(hovered.keyValue)} and above are
                routed down its right-hand side. Records only ever live in the leaves, so
                there is nothing here to edit or delete.
              </p>
            </>
          )}
        </div>
      )}

      {/* Zoom controls hint */}
      <div className={styles.hint}>
        {interactive ? 'Drag to pan • Scroll to zoom • Hover a key to edit it' : 'Drag to pan • Scroll to zoom'}
      </div>
    </div>
  )
}

export default TreeCanvas
