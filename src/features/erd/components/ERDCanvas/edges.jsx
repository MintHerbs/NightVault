// Pure SVG edge functions for ERD connections

// Border intersection functions

/**
 * Calculate where a line from rectangle center toward target exits the rectangle boundary
 */
export function getRectEdgePoint(cx, cy, width, height, targetX, targetY) {
  const dx = targetX - cx
  const dy = targetY - cy
  
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  
  const halfW = width / 2
  const halfH = height / 2
  
  // Calculate intersection with all four edges and pick the closest
  const t = Math.min(
    dx !== 0 ? Math.abs(halfW / dx) : Infinity,
    dy !== 0 ? Math.abs(halfH / dy) : Infinity
  )
  
  return {
    x: cx + dx * t,
    y: cy + dy * t
  }
}

/**
 * Calculate where a line from ellipse center toward target exits the ellipse boundary
 */
export function getEllipseEdgePoint(cx, cy, rx, ry, targetX, targetY) {
  const dx = targetX - cx
  const dy = targetY - cy
  
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  
  // Parametric ellipse intersection: find t where (cx + t*dx, cy + t*dy) is on ellipse
  // Ellipse equation: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 = 1
  // Substituting: (t*dx/rx)^2 + (t*dy/ry)^2 = 1
  // Solving for t: t = 1 / sqrt((dx/rx)^2 + (dy/ry)^2)
  
  const t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
  
  return {
    x: cx + dx * t,
    y: cy + dy * t
  }
}

/**
 * Calculate where a line from diamond center toward target exits the diamond boundary
 */
export function getDiamondEdgePoint(cx, cy, width, height, targetX, targetY) {
  const dx = targetX - cx
  const dy = targetY - cy
  
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  
  const halfW = width / 2
  const halfH = height / 2
  
  // Diamond has 4 edges forming a rotated square
  // Calculate intersection with each edge and pick the one in the direction of target
  // Diamond edges: top-right, right-bottom, bottom-left, left-top
  
  // Use Manhattan distance approach: t = 1 / (|dx|/halfW + |dy|/halfH)
  const t = 1 / (Math.abs(dx) / halfW + Math.abs(dy) / halfH)
  
  return {
    x: cx + dx * t,
    y: cy + dy * t
  }
}

/**
 * Vertices of an ISA triangle, in the orientation it is drawn.
 * upright  — apex on top, so the superclass line meets the point and the
 *            subclass lines meet the flat base
 * inverted — apex on the bottom, so the superclass line meets the flat top edge
 *            and the subclass lines meet the two slanted sides
 */
export function getTriangleVertices(node) {
  const hw = node.width / 2
  const hh = node.height / 2
  if (node.orientation === 'inverted') {
    return [
      { x: node.x - hw, y: node.y - hh },
      { x: node.x + hw, y: node.y - hh },
      { x: node.x, y: node.y + hh },
    ]
  }
  return [
    { x: node.x, y: node.y - hh },
    { x: node.x + hw, y: node.y + hh },
    { x: node.x - hw, y: node.y + hh },
  ]
}

/**
 * Calculate where a line from triangle center toward target exits the triangle.
 * Ray/segment intersection against each of the three sides — a bounding-box
 * approximation puts the line well outside the shape on the slanted edges.
 */
export function getTriangleEdgePoint(node, targetX, targetY) {
  const dx = targetX - node.x
  const dy = targetY - node.y
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y }

  const verts = getTriangleVertices(node)
  const cross = (ax, ay, bx, by) => ax * by - ay * bx

  let best = null
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]
    const b = verts[(i + 1) % verts.length]
    const ex = b.x - a.x
    const ey = b.y - a.y

    const denom = cross(dx, dy, ex, ey)
    if (Math.abs(denom) < 1e-9) continue // parallel to this side

    const qx = a.x - node.x
    const qy = a.y - node.y
    const t = cross(qx, qy, ex, ey) / denom  // distance along the ray
    const u = cross(qx, qy, dx, dy) / denom  // position along the side

    if (t > 0 && u >= 0 && u <= 1 && (best === null || t < best)) best = t
  }

  if (best === null) return { x: node.x, y: node.y }
  return { x: node.x + dx * best, y: node.y + dy * best }
}

/**
 * Get edge point based on node type
 */
export function getNodeEdgePoint(node, targetX, targetY) {
  if (node.type === 'isa') {
    return getTriangleEdgePoint(node, targetX, targetY)
  } else if (node.type === 'entity') {
    return getRectEdgePoint(node.x, node.y, node.width, node.height, targetX, targetY)
  } else if (node.type === 'attribute') {
    const rx = node.width / 2
    const ry = node.height / 2
    return getEllipseEdgePoint(node.x, node.y, rx, ry, targetX, targetY)
  } else if (node.type === 'relationship') {
    return getDiamondEdgePoint(node.x, node.y, node.width, node.height, targetX, targetY)
  }
  
  // Fallback to center
  return { x: node.x, y: node.y }
}

export function renderSingleLine(x1, y1, x2, y2) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.5" />
}

export function renderDoubleLine(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return renderSingleLine(x1, y1, x2, y2)

  // Perpendicular unit vector, offset 2px each side = 4px total gap
  const px = (-dy / len) * 2
  const py = (dx / len) * 2

  return (
    <g>
      <line x1={x1 + px} y1={y1 + py} x2={x2 + px} y2={y2 + py} stroke="#94a3b8" strokeWidth="1.5" />
      <line x1={x1 - px} y1={y1 - py} x2={x2 - px} y2={y2 - py} stroke="#94a3b8" strokeWidth="1.5" />
    </g>
  )
}

export function renderAttributeLine(x1, y1, x2, y2) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth="1" />
}

