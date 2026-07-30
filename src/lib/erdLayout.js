// Assigns x/y coordinates to all ERD nodes.
//
// Layered, in this order, because each layer positions itself relative to the
// one before it:
//   1. anchors  — entities, ISA triangles, relationship diamonds
//   2. repulsion on anchors only
//   3. attributes — placed on the largest free arc around their settled anchor
//   4. angular de-overlap of attributes, which keeps each one bonded to its owner
//
// Anchors must be final before attributes are placed. An earlier version placed
// attributes in step 1 and then moved ISA child entities underneath their parent,
// which stranded those attributes at the child's old grid slot.

const H_SPACING = 420
const V_SPACING = 360
const ISA_PARENT_GAP = 170     // parent centre -> triangle centre
const ISA_CHILD_GAP = 170      // triangle centre -> child centre
const ISA_CHILD_SPACING = 260
const MIN_NODE_GAP = 40
const ATTR_MIN_RADIUS = 170

function entitySize(entity) {
  return { width: Math.max(130, entity.name.length * 10 + 40), height: 54 }
}

function attributeSize(attr) {
  return { width: Math.max(90, attr.name.length * 8 + 28), height: 38 }
}

// AABB gap between two nodes: negative when overlapping, positive when separated.
function nodeGap(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const overlapX = (a.width + b.width) / 2 - Math.abs(dx)
  const overlapY = (a.height + b.height) / 2 - Math.abs(dy)
  if (overlapX > 0 && overlapY > 0) return -Math.min(overlapX, overlapY)
  return Math.hypot(Math.max(0, -overlapX), Math.max(0, -overlapY))
}

// Pushes overlapping nodes apart. Nodes with manuallyPlaced set are anchors the
// user positioned deliberately, so they are never moved — only pushed against.
function relax(list, iterations, minGap) {
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (a.manuallyPlaced && b.manuallyPlaced) continue

        const gap = nodeGap(a, b)
        if (gap >= minGap) continue

        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.001
        const nx = dx / dist
        const ny = dy / dist
        const push = (minGap - gap) * 0.5
        moved = true

        // A pinned node absorbs none of the correction, so the free one takes all of it
        if (a.manuallyPlaced) {
          b.x += nx * push
          b.y += ny * push
        } else if (b.manuallyPlaced) {
          a.x -= nx * push
          a.y -= ny * push
        } else {
          a.x -= nx * push * 0.5
          a.y -= ny * push * 0.5
          b.x += nx * push * 0.5
          b.y += ny * push * 0.5
        }
      }
    }
    // Converged early: the common case for small diagrams, and it keeps the
    // cost down on the large ones where this loop is O(n^2) per iteration.
    if (!moved) break
  }
}

// Largest angular gap between neighbours, so attributes fan out into open space
// rather than across the entity's own relationship lines.
function largestFreeArc(anchor, neighbours) {
  const angles = []
  for (const n of neighbours) {
    const dx = n.x - anchor.x
    const dy = n.y - anchor.y
    const dist = Math.hypot(dx, dy)
    if (dist > 0 && dist < 600) angles.push(Math.atan2(dy, dx))
  }

  if (angles.length === 0) return { start: -Math.PI / 2, span: 2 * Math.PI }

  angles.sort((a, b) => a - b)
  let maxGap = 0
  let maxGapStart = angles[0]
  for (let i = 0; i < angles.length; i++) {
    const current = angles[i]
    const next = i === angles.length - 1 ? angles[0] + 2 * Math.PI : angles[i + 1]
    const gap = next - current
    if (gap > maxGap) {
      maxGap = gap
      maxGapStart = current
    }
  }

  if (maxGap < Math.PI / 3) return { start: -Math.PI / 2, span: 2 * Math.PI }
  return { start: maxGapStart + 0.25, span: maxGap - 0.5 }
}

// Radius wide enough that the attributes spread along the arc without touching.
// Fixing the radius is what made dense entities overlap.
function arcRadius(attrs, span) {
  if (attrs.length <= 1) return ATTR_MIN_RADIUS
  const widest = Math.max(...attrs.map(a => attributeSize(a).width))
  const needed = ((attrs.length - 1) * (widest + 24)) / Math.max(span, 0.1)
  return Math.max(ATTR_MIN_RADIUS, Math.min(needed, 460))
}

export function calculateERDLayout(erdData, manualPositions = {}) {
  const nodes = []
  const edges = []

  if (!erdData || !erdData.entities || erdData.entities.length === 0) {
    return { nodes, edges, bounds: { minX: -500, minY: -300, maxX: 500, maxY: 300, width: 1000, height: 600 } }
  }

  const entityMap = new Map()
  const hierarchies = erdData.isA || []
  const relationships = erdData.relationships || []

  const manualFor = (id) => {
    const m = manualPositions[id]
    return m?.manuallyPlaced ? m : null
  }

  // --- Step 1: Entity grid ---
  // ISA children are excluded: they are positioned under their parent in step 2.
  // Leaving them in the grid would reserve a slot that then sits empty.
  const isaChildIds = new Set(hierarchies.flatMap(h => h.children || []))
  const gridEntities = erdData.entities.filter(e => !isaChildIds.has(e.id))
  const cols = Math.max(1, Math.ceil(Math.sqrt(gridEntities.length)))
  const rows = Math.ceil(gridEntities.length / cols)
  const gridW = (cols - 1) * H_SPACING
  const gridH = (rows - 1) * V_SPACING

  let gridIndex = 0
  erdData.entities.forEach((entity) => {
    const manual = manualFor(entity.id)
    const size = entitySize(entity)
    let x = 0
    let y = 0

    if (!isaChildIds.has(entity.id)) {
      const col = gridIndex % cols
      const row = Math.floor(gridIndex / cols)
      x = -gridW / 2 + col * H_SPACING
      y = -gridH / 2 + row * V_SPACING
      gridIndex += 1
    }

    const node = {
      id: entity.id,
      type: 'entity',
      name: entity.name,
      x: manual ? manual.x : x,
      y: manual ? manual.y : y,
      ...size,
      isWeak: entity.isWeak || false,
      manuallyPlaced: Boolean(manual),
    }
    nodes.push(node)
    entityMap.set(entity.id, node)
  })

  // --- Step 2: ISA hierarchies — triangle under the parent, children under that ---
  const isaNodes = []
  hierarchies.forEach((hierarchy) => {
    const parent = entityMap.get(hierarchy.parent)
    if (!parent) return

    const manual = manualFor(hierarchy.id)
    const triangle = {
      id: hierarchy.id,
      type: 'isa',
      name: 'IS-A',
      x: manual ? manual.x : parent.x,
      y: manual ? manual.y : parent.y + ISA_PARENT_GAP,
      width: 88,
      height: 66,
      // Notation preference, not data: both orientations describe the same
      // hierarchy. Honoured per-hierarchy if present, otherwise set canvas-wide.
      orientation: hierarchy.orientation === 'inverted' ? 'inverted' : 'upright',
      manuallyPlaced: Boolean(manual),
    }
    nodes.push(triangle)
    isaNodes.push(triangle)

    edges.push({
      type: 'isa-parent',
      from: hierarchy.parent,
      to: hierarchy.id,
      fromNode: parent,
      toNode: triangle,
      participation: hierarchy.participation,
    })

    const children = (hierarchy.children || [])
      .map(id => entityMap.get(id))
      .filter(Boolean)

    const totalW = (children.length - 1) * ISA_CHILD_SPACING
    children.forEach((child, i) => {
      if (!child.manuallyPlaced) {
        child.x = triangle.x - totalW / 2 + i * ISA_CHILD_SPACING
        child.y = triangle.y + ISA_CHILD_GAP
      }
      edges.push({
        type: 'isa-child',
        from: hierarchy.id,
        to: child.id,
        fromNode: triangle,
        toNode: child,
      })
    })
  })

  // --- Step 3: Relationship diamonds at the centroid of their participants ---
  const relationshipMap = new Map()
  relationships.forEach((rel) => {
    const participants = (rel.participants || [])
      .map(p => entityMap.get(p.entityId))
      .filter(Boolean)

    const manual = manualFor(rel.id)
    let x = 0
    let y = 0
    if (manual) {
      x = manual.x
      y = manual.y
    } else if (participants.length === 1) {
      x = participants[0].x
      y = participants[0].y - 200
    } else if (participants.length >= 2) {
      x = participants.reduce((s, e) => s + e.x, 0) / participants.length
      y = participants.reduce((s, e) => s + e.y, 0) / participants.length
    }

    const node = {
      id: rel.id,
      type: 'relationship',
      name: rel.name,
      x,
      y,
      width: Math.max(110, rel.name.length * 9 + 36),
      height: 64,
      isIdentifying: rel.isIdentifying || false,
      manuallyPlaced: Boolean(manual),
    }
    nodes.push(node)
    relationshipMap.set(rel.id, node)

    ;(rel.participants || []).forEach((p) => {
      const entity = entityMap.get(p.entityId)
      if (!entity) return
      edges.push({
        type: 'relationship-entity',
        from: rel.id,
        to: p.entityId,
        fromNode: node,
        toNode: entity,
        cardinality: p.cardinality,
        participation: p.participation,
      })
    })
  })

  // --- Step 4: Settle anchors before anything hangs off them ---
  const anchors = nodes.filter(n => n.type !== 'attribute')
  relax(anchors, 60, MIN_NODE_GAP)

  // --- Step 5: Attributes on the largest free arc around each settled anchor ---
  let attrAnimIndex = 0
  const attributeNodes = []

  const placeAttributes = (owner, attrs, preferredArc) => {
    if (!attrs || attrs.length === 0) return

    const arc = preferredArc || largestFreeArc(owner, anchors.filter(n => n !== owner))
    const radius = arcRadius(attrs, arc.span)

    attrs.forEach((attr, i) => {
      const manual = manualFor(attr.id)
      const angle = attrs.length === 1
        ? arc.start + arc.span / 2
        : arc.start + (i / (attrs.length - 1)) * arc.span

      const node = {
        id: attr.id,
        type: 'attribute',
        name: attr.name,
        x: manual ? manual.x : owner.x + Math.cos(angle) * radius,
        y: manual ? manual.y : owner.y + Math.sin(angle) * radius,
        ...attributeSize(attr),
        attrType: attr.type,
        animationIndex: attrAnimIndex++,
        manuallyPlaced: Boolean(manual),
        ownerId: owner.id,
        angle,
        radius,
      }
      nodes.push(node)
      attributeNodes.push(node)
      edges.push({ type: 'attribute-link', from: owner.id, to: attr.id, fromNode: owner, toNode: node })
    })
  }

  erdData.entities.forEach((entity) => {
    const owner = entityMap.get(entity.id)
    if (owner) placeAttributes(owner, entity.attributes)
  })

  relationships.forEach((rel) => {
    const owner = relationshipMap.get(rel.id)
    // Relationship attributes hang below by convention, away from the entity lines
    if (owner) placeAttributes(owner, rel.attributes, { start: 0, span: Math.PI })
  })

  // --- Step 6: De-overlap attributes without breaking the bond to their owner ---
  // Attributes are pushed off anything they collide with, then pulled back onto
  // their owner's arc radius — so the correction becomes a slide *around* the
  // owner rather than a drift away from it. Letting them move freely is what
  // previously stranded them far from the shape they belong to.
  const ownerOf = (attr) => entityMap.get(attr.ownerId) || relationshipMap.get(attr.ownerId)

  const reproject = () => {
    for (const attr of attributeNodes) {
      if (attr.manuallyPlaced) continue
      const owner = ownerOf(attr)
      if (!owner) continue
      const dx = attr.x - owner.x
      const dy = attr.y - owner.y
      const dist = Math.hypot(dx, dy) || 0.001
      attr.x = owner.x + (dx / dist) * attr.radius
      attr.y = owner.y + (dy / dist) * attr.radius
    }
  }

  // Radius growth is the escape hatch for when no angle on the current circle is
  // free — a dense entity wedged between neighbours has nowhere to slide to.
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let iter = 0; iter < 30; iter++) {
      let moved = false

      for (let i = 0; i < attributeNodes.length; i++) {
        const a = attributeNodes[i]
        if (a.manuallyPlaced) continue

        // against other attributes
        for (let j = 0; j < attributeNodes.length; j++) {
          if (i === j) continue
          const b = attributeNodes[j]
          const gap = nodeGap(a, b)
          if (gap >= 22) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy) || 0.001
          const push = (22 - gap) * (b.manuallyPlaced ? 0.5 : 0.25)
          a.x -= (dx / dist) * push
          a.y -= (dy / dist) * push
          moved = true
        }

        // against entities, diamonds and triangles — its own owner excepted,
        // since the arc radius already clears it
        for (const anchor of anchors) {
          if (anchor.id === a.ownerId) continue
          const gap = nodeGap(a, anchor)
          if (gap >= 24) continue
          const dx = anchor.x - a.x
          const dy = anchor.y - a.y
          const dist = Math.hypot(dx, dy) || 0.001
          const push = (24 - gap) * 0.5
          a.x -= (dx / dist) * push
          a.y -= (dy / dist) * push
          moved = true
        }
      }

      reproject()
      if (!moved) break
    }

    // Owners whose attributes are still colliding get a wider arc, then retry
    const crowded = new Set()
    for (const a of attributeNodes) {
      if (a.manuallyPlaced) continue
      const hitsAttr = attributeNodes.some(b => b !== a && nodeGap(a, b) < 0)
      const hitsAnchor = anchors.some(n => n.id !== a.ownerId && nodeGap(a, n) < 0)
      if (hitsAttr || hitsAnchor) crowded.add(a.ownerId)
    }
    if (crowded.size === 0) break

    for (const a of attributeNodes) {
      if (crowded.has(a.ownerId) && a.radius < 520) a.radius += 55
    }
    reproject()
  }

  // --- Step 7: Bounding box ---
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2)
    minY = Math.min(minY, node.y - node.height / 2)
    maxX = Math.max(maxX, node.x + node.width / 2)
    maxY = Math.max(maxY, node.y + node.height / 2)
  }

  return { nodes, edges, bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY } }
}
