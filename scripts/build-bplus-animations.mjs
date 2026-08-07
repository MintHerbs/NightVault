#!/usr/bin/env node
// Builds the `::anim` figures for Semester 2 lecture 5, B+ trees.
//
//   node scripts/build-bplus-animations.mjs
//
// Every tree drawn here comes out of scripts/anim/bplus.mjs, so a picture
// cannot disagree with the answer printed beside it.

import { writeFile } from 'node:fs/promises'
import { C, W, text, rect, line, moduleSource, fitHeights } from './anim/draw.mjs'
import { build, check, leafOrder as leafOrderOf } from './anim/bplus.mjs'

const KEY_W = 30
const NODE_H = 24
const LEVEL_H = 62

/** Width of a node box holding n keys. */
const nodeW = (n) => Math.max(1, n) * KEY_W + 6

/**
 * Positions every node. Leaves are laid out left to right at a fixed pitch;
 * an internal node is centred over the children it points at. Doing it in that
 * order is what guarantees no two boxes on a level can overlap and no edge
 * crosses another.
 */
function layout(levels, { gap = 14, top = 26 } = {}) {
  const rows = levels.map((row) => row.map((n) => ({ ...n, w: nodeW(n.keys.length) })))
  const leafRow = rows[rows.length - 1]

  let x = 0
  for (const n of leafRow) {
    n.x = x
    x += n.w + gap
  }
  const totalW = Math.max(0, x - gap)

  // Walk upward, centring each parent over its own children.
  for (let li = rows.length - 2; li >= 0; li -= 1) {
    let childIndex = 0
    const below = rows[li + 1]
    for (const n of rows[li]) {
      const count = n.keys.length + 1
      const kids = below.slice(childIndex, childIndex + count)
      childIndex += count
      const first = kids[0]
      const last = kids[kids.length - 1]
      n.x = first && last ? (first.x + (last.x + last.w)) / 2 - n.w / 2 : 0
      n.kids = kids
    }
  }

  const offset = (W - totalW) / 2
  rows.forEach((row, li) => {
    for (const n of row) {
      n.x += offset
      n.y = top + li * LEVEL_H
    }
  })

  return { rows, height: top + rows.length * LEVEL_H }
}

/** One node box with its key cells. */
function drawNode(n, { hot = new Set(), tint, stroke } = {}) {
  const out = []
  const isHot = tint != null
  out.push(
    rect(n.x, n.y, n.w, NODE_H, {
      fill: isHot ? tint : C.fill,
      stroke: stroke ?? (n.leaf ? C.line : C.muted),
      sw: isHot ? 1.6 : 1,
      rx: 3,
    })
  )
  n.keys.forEach((k, i) => {
    const cx = n.x + 3 + i * KEY_W + KEY_W / 2
    if (i > 0) {
      out.push(line(n.x + 3 + i * KEY_W, n.y + 2, n.x + 3 + i * KEY_W, n.y + NODE_H - 2, { stroke: C.line, sw: 0.6 }))
    }
    out.push(
      text(cx, n.y + NODE_H / 2 + 4, k, {
        size: 11.5,
        anchor: 'middle',
        mono: true,
        weight: hot.has(k) ? 700 : 400,
        fill: hot.has(k) ? C.focus : C.text,
      })
    )
  })
  return out.join('')
}

/** Edges from a node down to its children. */
function drawEdges(n) {
  if (!n.kids) return ''
  return n.kids
    .map((c) =>
      line(n.x + n.w / 2, n.y + NODE_H, c.x + c.w / 2, c.y, { stroke: C.line, sw: 0.9 })
    )
    .join('')
}

/** The dashed chain joining the leaves, which is the thing that makes it a B+ tree. */
function drawLeafChain(leafRow) {
  const out = []
  for (let i = 0; i < leafRow.length - 1; i += 1) {
    const a = leafRow[i]
    const b = leafRow[i + 1]
    out.push(
      line(a.x + a.w, a.y + NODE_H / 2, b.x, b.y + NODE_H / 2, {
        stroke: C.link,
        sw: 1.1,
        dash: '3 3',
        marker: 'chain',
      })
    )
  }
  return out.join('')
}

/** A whole tree, as one frame's worth of SVG. */
function drawTree(levels, { hot = new Set(), hotNode = null, top = 26, chain = true } = {}) {
  const { rows } = layout(levels, { top })
  const out = []
  for (const row of rows) for (const n of row) out.push(drawEdges(n))
  if (chain) out.push(drawLeafChain(rows[rows.length - 1]))
  for (const row of rows) {
    for (const n of row) {
      const isHot = hotNode != null && n.keys.join(',') === hotNode
      out.push(drawNode(n, { hot, tint: isHot ? 'color-mix(in srgb, var(--anim-focus) 20%, transparent)' : null }))
    }
  }
  return { svg: out.join(''), rows }
}

const DEFS =
  `<marker id="chain" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="7" markerHeight="6" ` +
  `markerUnits="userSpaceOnUse" orient="auto"><path d="M0.6,0.6 L9.4,4 L0.6,7.4 z" fill="${C.link}"/></marker>`

const entries = []

// ───────────────────────────────────────── how to draw one, step by step
{
  const KEYS = [2, 3, 5, 7, 11, 17, 19, 23, 29]
  const P = 3
  const PLEAF = 2
  check(KEYS, P, PLEAF)
  const { steps } = build(KEYS, P, PLEAF)

  const frames = []
  const header = (s, colour = C.text) => text(W / 2, 16, s, { size: 12.5, weight: 700, anchor: 'middle', fill: colour })

  frames.push({
    caption: `Order p = ${P}, so an internal node holds at most ${P - 1} keys. A leaf holds at most ${PLEAF}. Insert ${KEYS.join(', ')} in that order.`,
    hold: 3800,
    svg:
      header('The rules before we start') +
      text(W / 2, 54, `p = ${P}  means at most ${P - 1} keys per internal node`, { size: 12, anchor: 'middle', fill: C.muted, mono: true }) +
      text(W / 2, 76, `pleaf = ${PLEAF}  means at most ${PLEAF} keys per leaf`, { size: 12, anchor: 'middle', fill: C.muted, mono: true }) +
      text(W / 2, 106, 'A leaf that reaches a third key splits. The last key of the left half', { size: 11.5, anchor: 'middle', fill: C.muted }) +
      text(W / 2, 124, 'is copied up to the parent. Every key still lives in a leaf.', { size: 11.5, anchor: 'middle', fill: C.muted }),
  })

  steps.forEach((s, i) => {
    const splitEvent = s.events.find((e) => e.type === 'splitLeaf')
    const rootEvent = s.events.find((e) => e.type === 'newRoot')
    const internalEvent = s.events.find((e) => e.type === 'splitInternal')

    let caption
    let colour = C.text
    if (internalEvent) {
      caption = `Insert ${s.key}. The leaf splits, and the parent overflows too, so ${internalEvent.up} is pushed up. The tree grows a level.`
      colour = C.alt
    } else if (rootEvent) {
      caption = `Insert ${s.key}. The leaf is full, so it splits and ${splitEvent.up} is copied up to make the first root.`
      colour = C.focus
    } else if (splitEvent) {
      caption = `Insert ${s.key}. The leaf overflows, so it splits into ${splitEvent.left.join(', ')} and ${splitEvent.right.join(', ')}, and ${splitEvent.up} is copied up.`
      colour = C.focus
    } else {
      caption = `Insert ${s.key}. It fits in a leaf with room, so nothing else changes.`
      colour = C.ok
    }

    const t = drawTree(s.levels, { hot: new Set([s.key]), top: 40 })
    frames.push({
      caption,
      hold: splitEvent ? 4200 : 2600,
      svg:
        header(`Insert ${s.key}`, colour) +
        (splitEvent
          ? text(W / 2, 32, `split: copy ${splitEvent.up} up`, { size: 10.5, anchor: 'middle', fill: colour, weight: 700 })
          : '') +
        t.svg,
    })
    void i
  })

  const last = steps[steps.length - 1]
  frames.push({
    caption: `Finished. Every key sits in a leaf, the leaves are chained left to right, and every leaf is the same distance from the root.`,
    hold: 5200,
    svg:
      header('The finished tree', C.ok) +
      drawTree(last.levels, { top: 40 }).svg +
      text(W / 2, 40 + last.levels.length * LEVEL_H + 16, last.leaves.map((l) => `[${l.join(' ')}]`).join('  →  '), {
        size: 11,
        anchor: 'middle',
        fill: C.link,
        mono: true,
      }),
  })

  entries.push({
    id: 'db-bplus-construction',
    label: 'Building a B+ tree, one insert at a time',
    alt: 'A B+ tree of order 3 built by inserting nine keys, splitting as it goes',
    width: W,
    height: 260,
    mode: 'replace',
    defs: DEFS,
    frames,
  })
}

// ─────────────────────────────────────────────────── the ten exam questions
export const BPLUS_QUESTIONS = [
  { id: 1, p: 3, pleaf: 2, keys: [1, 4, 7, 10, 17, 21, 31, 25, 19, 20], ask: 'Insert the keys in the order given.' },
  { id: 2, p: 3, pleaf: 2, keys: [5, 10, 15, 20, 25, 30, 35], ask: 'Insert an ascending run and note how one-sided the tree becomes.' },
  { id: 3, p: 4, pleaf: 3, keys: [8, 5, 1, 7, 3, 12, 9, 6], ask: 'A wider node: p = 4, pleaf = 3.' },
  { id: 4, p: 3, pleaf: 2, keys: [30, 25, 20, 15, 10, 5], ask: 'A descending run, the mirror of question 2.' },
  { id: 5, p: 3, pleaf: 2, keys: [2, 3, 5, 7, 11, 17, 19, 23, 29], ask: 'The lecture example. Check your answer against the walkthrough above.' },
  { id: 6, p: 4, pleaf: 2, keys: [40, 10, 30, 20, 50, 60, 15, 35], ask: 'Wide internal nodes, narrow leaves.' },
  { id: 7, p: 3, pleaf: 3, keys: [12, 7, 25, 31, 8, 19, 4, 40, 15], ask: 'Narrow internal nodes, wide leaves.' },
  { id: 8, p: 5, pleaf: 4, keys: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ask: 'A large order with twelve ascending keys.' },
  { id: 9, p: 3, pleaf: 2, keys: [50, 22, 71, 9, 35, 60, 88, 15, 44], ask: 'Scattered keys, so splits happen on both sides.' },
  { id: 10, p: 4, pleaf: 3, keys: [100, 50, 150, 25, 75, 125, 175, 60, 40, 90], ask: 'Ten keys, order 4. Give the height of the finished tree.' },
]

for (const q of BPLUS_QUESTIONS) {
  check(q.keys, q.p, q.pleaf)
  const { steps } = build(q.keys, q.p, q.pleaf)
  const frames = []
  const header = (s, colour = C.text) => text(W / 2, 16, s, { size: 12.5, weight: 700, anchor: 'middle', fill: colour })

  // A frame at every split, plus the final tree. Stepping through only the
  // moments where the shape changes keeps a ten-key question to a few frames
  // rather than ten near-identical ones.
  const interesting = steps.filter((s, i) => s.split || i === steps.length - 1)
  for (const s of interesting) {
    const splitEvent = s.events.find((e) => e.type === 'splitLeaf')
    const internalEvent = s.events.find((e) => e.type === 'splitInternal')
    const isLast = s === steps[steps.length - 1]
    const caption = isLast
      ? `All ${q.keys.length} keys inserted. Leaves: ${s.leaves.map((l) => `[${l.join(' ')}]`).join(' → ')}`
      : internalEvent
        ? `After ${s.key}: the leaf splits and the parent overflows, so ${internalEvent.up} is pushed up and the tree gains a level.`
        : `After ${s.key}: the leaf splits, ${splitEvent.up} is copied up.`
    frames.push({
      caption,
      hold: isLast ? 5000 : 3400,
      svg:
        header(
          isLast ? `Question ${q.id}: the finished tree` : `Question ${q.id}: after inserting ${s.key}`,
          isLast ? C.ok : internalEvent ? C.alt : C.focus
        ) + drawTree(s.levels, { hot: new Set([s.key]), top: 40 }).svg,
    })
  }

  entries.push({
    id: `db-bplus-q${q.id}`,
    label: `B+ tree question ${q.id}`,
    alt: `The B+ tree produced by inserting ${q.keys.join(', ')} with p = ${q.p} and pleaf = ${q.pleaf}`,
    width: W,
    height: 240,
    mode: 'replace',
    defs: DEFS,
    frames,
  })
}

// ─────────────────────────────────────────────────────────────── emit
const problems = fitHeights(entries)
if (problems.length) {
  for (const p of problems) console.error(`  OVERFLOW  ${p}`)
  process.exitCode = 1
}

const header = `// GENERATED by scripts/build-bplus-animations.mjs — do not edit by hand.
//
// Frames for the B+ tree figures in Semester 2 lecture 5. Every tree is
// produced by scripts/anim/bplus.mjs, which splits the way the lecture splits:
// the last key of the left leaf is copied up, and an internal split pushes the
// middle key up.
`

await writeFile(
  new URL('../src/content/animations/bplus.js', import.meta.url),
  moduleSource('bplusAnimations', entries, header),
  'utf8'
)

// Question prose emitted from the same array the figures are built from, and
// the final leaf layout is read back out of the solver rather than typed, so a
// question and its answer cannot disagree.
const questionsMd =
  `## Ten questions to practise on\n\n` +
  `Draw each tree on paper before you press play. Every answer below is\n` +
  `generated by the same code that produced the walkthrough, using the split\n` +
  `rule this module uses.\n\n` +
  BPLUS_QUESTIONS.map((q) => {
    const { tree } = build(q.keys, q.p, q.pleaf)
    const leaves = leafOrderOf(tree)
    return (
      `### Question ${q.id}\n\n` +
      `${q.ask}\n\n` +
      `\`p = ${q.p}\`, \`pleaf = ${q.pleaf}\`\n\n` +
      `\`\`\`\n${q.keys.join(', ')}\n\`\`\`\n\n` +
      `::anim{id="db-bplus-q${q.id}"}\n\n` +
      `:color[**Leaves.**]{hex="#22c55e"} ${leaves.map((l) => `[${l.join(' ')}]`).join(' → ')}\n`
    )
  }).join('\n')

await writeFile(new URL('../generated/bplus-questions.md', import.meta.url), questionsMd, 'utf8')

for (const e of entries) {
  console.log(`${e.id.padEnd(26)} ${String(e.frames.length).padStart(2)} frames  ${e.width}x${e.height}`)
}
console.log(`\n${entries.length} figure(s) written to src/content/animations/bplus.js`)
console.log(`${BPLUS_QUESTIONS.length} question(s) written to generated/bplus-questions.md`)
