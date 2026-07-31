// Layout invariants for the tableau canvas.
// Run with: npm run test:logic

import { runTableaux } from './tableauxEngine.js'
import {
  calculateLayout,
  flattenTree,
  nodeWidth,
  ROW_HEIGHT,
  SIBLING_GAP,
  NODE_HEIGHT,
  MARKER_SPACE
} from './tableauxLayout.js'

let failures = 0
const assert = (cond, msg) => { if (!cond) { failures++; if (failures <= 20) console.error(`  FAIL: ${msg}`) } }

const FORMULAS = [
  'P',
  'P&~P',
  '(P&Q)&(R&S)',
  '~(~(P&Q)<->(~P|~Q))',
  '(P->Q)&(Q->R)->(P->R)',
  '(P|Q)&(~P|R)&(~Q|~R)&(P|~R)',
  '((P|Q)&(P|R))<->(P|(Q&R))',
  '(P<->Q)&(Q<->R)&(R<->P)',
  '((P<->Q)<->(R<->S))<->(P<->(Q<->(R<->S)))'
]

for (const formula of FORMULAS) {
  for (const mode of ['satisfiability', 'validity']) {
    const { tree } = runTableaux(formula, mode)
    const { positions, bounds } = calculateLayout(tree)
    const { nodes, edges } = flattenTree(tree)
    const where = `${mode} ${formula}`

    // Every node is placed exactly once.
    assert(positions.size === nodes.length, `${where}: ${positions.size} positions for ${nodes.length} nodes`)
    for (const node of nodes) {
      assert(positions.has(node.id), `${where}: node ${node.id} has no position`)
    }

    // No two boxes on the same row overlap. This is the whole point of the rewrite: the
    // old repulsion pass could leave neighbours on top of each other.
    const rows = new Map()
    for (const node of nodes) {
      const pos = positions.get(node.id)
      if (!rows.has(pos.y)) rows.set(pos.y, [])
      rows.get(pos.y).push({ node, pos })
    }
    for (const [y, row] of rows) {
      row.sort((a, b) => a.pos.x - b.pos.x)
      for (let i = 0; i < row.length - 1; i++) {
        const rightEdge = row[i].pos.x + row[i].pos.width / 2
        const leftEdge = row[i + 1].pos.x - row[i + 1].pos.width / 2
        assert(leftEdge >= rightEdge - 0.001,
          `${where}: row ${y} overlaps between ${row[i].node.id} and ${row[i + 1].node.id} (gap ${(leftEdge - rightEdge).toFixed(1)})`)
      }
    }

    // Boxes are wide enough for their text.
    for (const node of nodes) {
      assert(positions.get(node.id).width === nodeWidth(node), `${where}: node ${node.id} width mismatch`)
    }

    // A child is always exactly one row below its parent.
    for (const { from, to } of edges) {
      const a = positions.get(from.id)
      const b = positions.get(to.id)
      assert(Math.abs(b.y - a.y - ROW_HEIGHT) < 0.001,
        `${where}: edge ${from.id}->${to.id} spans ${b.y - a.y}, expected ${ROW_HEIGHT}`)
    }

    // Chains hang straight down; splits sit over the midpoint of their children.
    for (const node of nodes) {
      const pos = positions.get(node.id)
      if (node.children.length === 1) {
        assert(Math.abs(positions.get(node.children[0].id).x - pos.x) < 0.001,
          `${where}: chain at ${node.id} is not vertical`)
      } else if (node.children.length === 2) {
        const [l, r] = node.children.map((c) => positions.get(c.id).x)
        assert(Math.abs((l + r) / 2 - pos.x) < 0.001, `${where}: split at ${node.id} is off-centre`)
        assert(r > l, `${where}: split at ${node.id} has its branches out of order`)
        const gap = (r - positions.get(node.children[1].id).width / 2)
          - (l + positions.get(node.children[0].id).width / 2)
        assert(gap >= SIBLING_GAP - 0.001,
          `${where}: split at ${node.id} leaves only ${gap.toFixed(1)}px between branches`)
      }
    }

    // Bounds cover every box, plus room for the deepest marker.
    let maxY = 0
    for (const node of nodes) {
      const pos = positions.get(node.id)
      assert(pos.x - pos.width / 2 >= bounds.x - 0.001, `${where}: node ${node.id} left of bounds`)
      assert(pos.x + pos.width / 2 <= bounds.x + bounds.width + 0.001, `${where}: node ${node.id} right of bounds`)
      maxY = Math.max(maxY, pos.y)
    }
    assert(Math.abs(bounds.height - (maxY + NODE_HEIGHT + MARKER_SPACE)) < 0.001,
      `${where}: bounds height ${bounds.height} does not leave marker room`)
    assert(bounds.width > 0 && bounds.height > 0, `${where}: empty bounds`)
  }
}

if (failures > 0) {
  console.error(`[tableauxLayout] ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log(`[tableauxLayout] all tests passed (${FORMULAS.length} formulas, 2 modes each)`)
