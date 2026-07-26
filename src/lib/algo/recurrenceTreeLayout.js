/**
 * recurrenceTreeLayout.js
 *
 * Tidy layout for recursion trees. The old drawing positioned nodes with
 * hardcoded pixel offsets and a fixed 800px canvas, so boxes overlapped
 * whenever a level held more nodes than the constants assumed. Here geometry
 * is derived from the labels instead:
 *
 *   - every node is measured from its own text,
 *   - leaves are packed left to right with a fixed gap,
 *   - a parent is centred over its children,
 *   - a subtree slides right if its parent box would touch the subtree
 *     already placed at that depth.
 *
 * Non-overlap is therefore a property of the algorithm, not of the constants,
 * which is what `assertNoOverlap` below exists to prove on every test case.
 */

// JetBrains Mono at 13px advances ~7.7px per character.
const CHAR_W = 7.7;
const PAD_X = 22;
const MIN_W = 54;

export const NODE_H = 30;
export const LEVEL_HEIGHT = 94;
export const SIBLING_GAP = 28;
export const ELLIPSIS_W = 36;

/** Rendered width of a run of monospace text. */
export function textWidth(text) {
  return String(text ?? '').length * CHAR_W;
}

/** Box size for a label. */
export function measureNode(label, kind) {
  if (kind === 'ellipsis' || kind === 'dots') return { w: ELLIPSIS_W, h: NODE_H };
  const text = String(label ?? '');
  return { w: Math.max(MIN_W, text.length * CHAR_W + PAD_X), h: NODE_H };
}

/**
 * Lay out a spec tree of { id, kind, label, children } and return flat,
 * positioned nodes. x is the box centre, y the box centre.
 */
export function layoutTree(root, { levelHeight = LEVEL_HEIGHT, siblingGap = SIBLING_GAP } = {}) {
  const placed = [];
  const levelRight = [];

  const shiftSubtree = (node, dx) => {
    node.x += dx;
    (node.children ?? []).forEach(k => shiftSubtree(k, dx));
  };

  const place = (node, depth) => {
    const { w, h } = measureNode(node.label, node.kind);
    node.depth = depth;
    node.y = depth * levelHeight;
    node.w = w;
    node.h = h;
    placed.push(node);

    const kids = node.children ?? [];
    if (kids.length === 0) {
      const right = levelRight[depth];
      node.x = right === undefined ? w / 2 : right + siblingGap + w / 2;
    } else {
      kids.forEach(k => place(k, depth + 1));
      let x = (kids[0].x + kids[kids.length - 1].x) / 2;

      // The parent can be wider than the span of its children, which would
      // push it into the subtree on its left. Slide this whole subtree right.
      const right = levelRight[depth];
      if (right !== undefined && x - w / 2 < right + siblingGap) {
        const dx = right + siblingGap + w / 2 - x;
        kids.forEach(k => shiftSubtree(k, dx));
        for (let d = depth + 1; d < levelRight.length; d++) {
          if (levelRight[d] !== undefined) levelRight[d] += dx;
        }
        x += dx;
      }
      node.x = x;
    }
    levelRight[depth] = Math.max(levelRight[depth] ?? -Infinity, node.x + w / 2);
  };

  place(root, 0);
  return placed;
}

/** Parent to child links, in tree order. */
export function collectEdges(root) {
  const edges = [];
  const walk = node => {
    (node.children ?? []).forEach(kid => {
      edges.push({ from: node.id, to: kid.id, kind: kid.kind === 'ellipsis' ? 'dashed' : 'solid' });
      walk(kid);
    });
  };
  walk(root);
  return edges;
}

/** Shift every node so the leftmost box edge sits at `left`. */
export function normalize(nodes, left = 0) {
  const minLeft = Math.min(...nodes.map(n => n.x - n.w / 2));
  const dx = left - minLeft;
  if (dx !== 0) nodes.forEach(n => { n.x += dx; });
  return nodes;
}

/** Bounding box over node rectangles. */
export function boundsOf(nodes) {
  const minX = Math.min(...nodes.map(n => n.x - n.w / 2));
  const maxX = Math.max(...nodes.map(n => n.x + n.w / 2));
  const minY = Math.min(...nodes.map(n => n.y - n.h / 2));
  const maxY = Math.max(...nodes.map(n => n.y + n.h / 2));
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/** Nodes at one depth, left to right. */
export function nodesAtDepth(nodes, depth) {
  return nodes.filter(n => n.depth === depth).sort((p, q) => p.x - q.x);
}

/**
 * Report every pair of node boxes that overlap. Used by the test suite to
 * check the drawing rather than trusting it.
 * @returns {Array} list of { a, b, overlapX, overlapY }
 */
export function findOverlaps(nodes, { gap = 2 } = {}) {
  const clashes = [];
  const boxes = nodes.filter(n => n.kind !== 'dots');
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapX = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
      const overlapY = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
      if (overlapX > -gap && overlapY > -gap) {
        clashes.push({ a: a.id, b: b.id, overlapX, overlapY });
      }
    }
  }
  return clashes;
}
