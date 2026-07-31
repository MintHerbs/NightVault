// src/lib/logic/tableauxLayout.js
// Positions a finished tableau for drawing. Pure JS, no React imports.

export const NODE_HEIGHT = 38
export const ROW_GAP = 30
export const ROW_HEIGHT = NODE_HEIGHT + ROW_GAP
export const NODE_MIN_WIDTH = 92
export const CHAR_WIDTH = 9.6
export const NODE_PADDING_X = 28
/** Horizontal clearance between the two subtrees of a split. */
export const SIBLING_GAP = 44
/** Room under the deepest leaf for its ✗ / ○ marker. */
export const MARKER_SPACE = 42

export function nodeWidth(node) {
  return Math.max(NODE_MIN_WIDTH, node.formula.length * CHAR_WIDTH + NODE_PADDING_X)
}

/**
 * Two-pass tidy layout.
 *
 * Pass one measures the horizontal band each subtree needs; pass two hands each subtree
 * its own band and centres it there. Sibling bands are disjoint by construction, so
 * nodes cannot collide and there is nothing to repair afterwards. The previous layout
 * placed splits at a fixed fraction of the available width and then ran 20 rounds of
 * pairwise repulsion that moved nodes without moving their descendants, which is why the
 * tree drifted off-centre and branches ended up at inconsistent spacing (T-084).
 *
 * @param {object} tree - finished tableau root
 * @returns {{positions: Map<string, {x: number, y: number, width: number}>,
 *            bounds: {x: number, y: number, width: number, height: number}}}
 */
export function calculateLayout(tree) {
  const widths = new Map()
  const positions = new Map()

  function measure(node) {
    const own = nodeWidth(node)
    let width
    if (node.children.length === 0) {
      width = own
    } else if (node.children.length === 1) {
      width = Math.max(own, measure(node.children[0]))
    } else {
      const spans = node.children.map(measure)
      width = Math.max(own, spans.reduce((a, b) => a + b, 0) + SIBLING_GAP * (spans.length - 1))
    }
    widths.set(node.id, width)
    return width
  }

  function assign(node, left, depth) {
    const band = widths.get(node.id)
    const y = depth * ROW_HEIGHT
    let x

    if (node.children.length === 0) {
      x = left + band / 2
    } else if (node.children.length === 1) {
      const child = node.children[0]
      assign(child, left + (band - widths.get(child.id)) / 2, depth + 1)
      // A chain hangs straight down, so the parent sits directly over its child.
      x = positions.get(child.id).x
    } else {
      const spans = node.children.map((child) => widths.get(child.id))
      const total = spans.reduce((a, b) => a + b, 0) + SIBLING_GAP * (spans.length - 1)
      let cursor = left + (band - total) / 2
      node.children.forEach((child, i) => {
        assign(child, cursor, depth + 1)
        cursor += spans[i] + SIBLING_GAP
      })
      const centres = node.children.map((child) => positions.get(child.id).x)
      x = (Math.min(...centres) + Math.max(...centres)) / 2
    }

    positions.set(node.id, { x, y, width: nodeWidth(node) })
  }

  measure(tree)
  assign(tree, 0, 0)

  let minX = Infinity
  let maxX = -Infinity
  let maxY = 0
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x - pos.width / 2)
    maxX = Math.max(maxX, pos.x + pos.width / 2)
    maxY = Math.max(maxY, pos.y)
  })

  return {
    positions,
    bounds: {
      x: minX,
      y: 0,
      width: maxX - minX,
      height: maxY + NODE_HEIGHT + MARKER_SPACE
    }
  }
}

/** Flattens the tree once, so rendering does not walk it per node. */
export function flattenTree(tree) {
  const nodes = []
  const edges = []
  ;(function walk(node) {
    nodes.push(node)
    for (const child of node.children) {
      edges.push({ id: `${node.id}-${child.id}`, from: node, to: child })
      walk(child)
    }
  })(tree)
  return { nodes, edges }
}
