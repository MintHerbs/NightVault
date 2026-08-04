/**
 * Sorting canvas layout tests (T-105).
 *
 * Run with: npm run test:sorting
 *
 * Same rationale as treeLayout.test.js: geometry is where a visualiser goes
 * quietly wrong. Cells that overlap by two pixels, or a band that lands on top
 * of another, look like a rendering glitch rather than a bug, so they survive
 * review. These are the checks a screenshot cannot make.
 */

import {
  CELL_GAP,
  CELL_HEIGHT,
  CELL_WIDTH,
  buildHistory,
  cellCenterX,
  cellX,
  layoutHistory,
  layoutTree,
  pointerX,
  rowWidth,
} from './sortLayout.js'
import { traceSort } from './index.js'

let passed = 0
const failures = []

function check(name, actual, expected) {
  if (actual === expected) passed++
  else failures.push(`${name}\n      expected: ${expected}\n      actual:   ${actual}`)
}

function checkThat(name, condition, detail = '') {
  if (condition) passed++
  else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`)
}

// ---------------------------------------------------------------------------
// 1. Cells tile without overlapping or touching
// ---------------------------------------------------------------------------

for (const count of [1, 2, 3, 9, 17, 24]) {
  let overlaps = 0
  for (let i = 1; i < count; i++) {
    const previousRight = cellX(i - 1) + CELL_WIDTH
    if (cellX(i) < previousRight) overlaps += 1
    if (cellX(i) - previousRight !== CELL_GAP) overlaps += 1
  }
  check(`n=${count}: cells are spaced by exactly one gap`, overlaps, 0)
  check(`n=${count}: row width matches the last cell's right edge`, rowWidth(count), cellX(count - 1) + CELL_WIDTH)
  check(`n=${count}: first cell starts at 0`, cellX(0), 0)
}

check('a zero-length row has no width', rowWidth(0), 0)

for (const index of [0, 1, 5]) {
  check(`cell ${index} centre`, cellCenterX(index), cellX(index) + CELL_WIDTH / 2)
}

// ---------------------------------------------------------------------------
// 2. A pointer outside the range is drawn outside the range
// ---------------------------------------------------------------------------
//
// The descending lecture trace opens with i at -1 and holds it there through
// the first comparison. Drawing that on cell 0 would say i has entered the
// range when it has not, which is the one thing this marker must not imply.

checkThat(
  'i at -1 sits left of the first cell',
  pointerX(-1, 9) < cellX(0),
  `pointerX(-1) = ${pointerX(-1, 9)}, cellX(0) = ${cellX(0)}`
)
checkThat(
  'i at -1 clears the first cell entirely',
  pointerX(-1, 9) + CELL_WIDTH / 2 <= cellX(0),
  `${pointerX(-1, 9)} + half a cell overlaps cell 0`
)
checkThat(
  'a pointer past the end sits right of the last cell',
  pointerX(9, 9) > cellX(8) + CELL_WIDTH,
  `pointerX(9) = ${pointerX(9, 9)}`
)
check('an in-range pointer sits on its cell centre', pointerX(3, 9), cellCenterX(3))

const INPUT = [2, 8, 4, 7, 1, 3, 9, 6, 5]

// ---------------------------------------------------------------------------
// 4b. Quicksort's recursion tree
// ---------------------------------------------------------------------------
//
// The shape this view exists for: one row per depth, deeper rows below
// shallower ones, segments at a depth side by side over the cells they own,
// exactly one row live at a time, and the combined result only at the end.

for (const direction of ['asc', 'desc']) {
  const steps = traceSort(INPUT, 'quick', direction)
  const problems = []
  let sawTree = false
  let sawResult = false
  let maxDepth = 0

  for (const step of steps) {
    const layout = layoutTree(step, INPUT.length)
    if (layout.mode !== 'tree') {
      problems.push(`step ${step.id}: quicksort did not lay out as a tree`)
      continue
    }
    sawTree = true

    const actives = layout.levels.flatMap((l) => l.segments).filter((s) => s.state === 'active')
    if (actives.length > 1) problems.push(`step ${step.id}: ${actives.length} rows are active at once`)

    for (let n = 1; n < layout.levels.length; n++) {
      const above = layout.levels[n - 1]
      const below = layout.levels[n]
      if (below.depth <= above.depth) problems.push(`step ${step.id}: depths out of order`)
      // A row must clear the one above it, including the pointer lane and temp
      // box the active row reserves.
      if (below.y < above.y + CELL_HEIGHT) {
        problems.push(`step ${step.id}: depth ${below.depth} overlaps depth ${above.depth}`)
      }
    }

    for (const level of layout.levels) {
      maxDepth = Math.max(maxDepth, level.depth)
      const ordered = [...level.segments].sort((a, b) => a.x - b.x)
      for (let n = 1; n < ordered.length; n++) {
        // Siblings own disjoint ranges, so their rows must not run into each
        // other — the pivot between them is on the row above, not this one.
        if (ordered[n].x < ordered[n - 1].x + ordered[n - 1].width) {
          problems.push(`step ${step.id}: segments overlap at depth ${level.depth}`)
        }
      }
      for (const segment of level.segments) {
        if (segment.x !== cellX(segment.low)) {
          problems.push(`step ${step.id}: segment starts at ${segment.x}, cell ${segment.low} is at ${cellX(segment.low)}`)
        }
        if (segment.values.length !== segment.high - segment.low + 1) {
          problems.push(`step ${step.id}: segment [${segment.low}..${segment.high}] holds ${segment.values.length} values`)
        }
      }
    }

    if (layout.result) {
      sawResult = true
      if (step.type !== 'done') problems.push(`step ${step.id}: the result row appeared before the run finished`)
      const lowest = layout.levels[layout.levels.length - 1]
      if (layout.result.y < lowest.y + CELL_HEIGHT) {
        problems.push(`step ${step.id}: the result row overlaps the deepest level`)
      }
    }

    if (layout.bands) problems.push(`step ${step.id}: tree layout still carries row bands`)
  }

  checkThat(`quick/${direction}: lays out as a tree`, sawTree)
  checkThat(`quick/${direction}: recursion goes deeper than one level`, maxDepth >= 2, `max depth ${maxDepth}`)
  checkThat(`quick/${direction}: the combined result is shown at the end`, sawResult)
  check(`quick/${direction}: tree geometry holds`, problems.length, 0)
  if (problems.length > 0) failures.push(`      ${problems[0]}`)
}

// The finished tree keeps every row that was ever worked on, which is the
// point: it is a record of how the array came apart, not a live view.
{
  const steps = traceSort(INPUT, 'quick', 'asc')
  const final = steps[steps.length - 1]
  checkThat(
    'quick: every level survives to the last frame',
    final.segments.length >= 7,
    `only ${final.segments.length} segments`
  )
  checkThat(
    'quick: no row is left active at the end',
    final.segments.every((s) => s.state !== 'active'),
    'a row was still marked active'
  )
  checkThat(
    'quick: the top row keeps its own partition, not the sorted array',
    JSON.stringify(final.segments[0].values) === JSON.stringify([2, 4, 1, 3, 5, 7, 9, 6, 8]),
    JSON.stringify(final.segments[0].values)
  )
}

// ---------------------------------------------------------------------------
// 6. Layout is deterministic
// ---------------------------------------------------------------------------

const someStep = traceSort(INPUT, 'quick', 'asc')[12]
check(
  'the same step lays out identically twice',
  JSON.stringify(layoutTree(someStep, INPUT.length)),
  JSON.stringify(layoutTree(someStep, INPUT.length))
)
check(
  'an empty history still yields a usable canvas',
  layoutHistory([], INPUT.length).width,
  rowWidth(INPUT.length)
)

// ---------------------------------------------------------------------------
// 7. History rows
// ---------------------------------------------------------------------------
//
// The stacked record every method except quicksort draws. Its geometry is what
// keeps a long run readable, so rows must not overlap, passes must not
// interleave, and the record must never rewrite itself behind the visitor.

for (const method of ['merge', 'radix', 'bubble', 'insertion', 'selection']) {
  const source = method === 'radix' ? [12, 21, 5, 50, 45, 8] : [4, 1, 5, 1, 2, 3]
  const steps = traceSort(source, method, 'asc')
  const problems = []

  for (const at of [0, 3, Math.floor(steps.length / 2), steps.length - 1]) {
    const rows = buildHistory(steps, at)
    const layout = layoutHistory(rows, source.length)

    if (layout.mode !== 'history') problems.push(`step ${at}: not a history layout`)

    // Exactly one live row, and it is the last one.
    const live = rows.filter((r) => r.live)
    if (live.length !== 1) problems.push(`step ${at}: ${live.length} live rows`)
    if (live[0] && live[0].rowIndex !== rows.length - 1) {
      problems.push(`step ${at}: the live row is not the last one`)
    }

    // Rows stack downward and never overlap.
    const all = layout.groups.flatMap((g) => g.rows)
    for (let n = 1; n < all.length; n++) {
      if (all[n].y < all[n - 1].y + CELL_HEIGHT) {
        problems.push(`step ${at}: row ${n} overlaps row ${n - 1}`)
      }
    }

    // Groups are contiguous: a pass is never re-opened further down.
    const labels = layout.groups.map((g) => g.label)
    if (labels.length !== new Set(labels).size) problems.push(`step ${at}: a pass appears twice`)

    // Every row holds the whole array. A row that lost a cell would be a
    // snapshot of something that never existed.
    for (const row of all) {
      if (row.values.length !== source.length) {
        problems.push(`step ${at}: a row holds ${row.values.length} of ${source.length} values`)
      }
    }

    if (layout.height < (all[all.length - 1]?.y ?? 0) + CELL_HEIGHT) {
      problems.push(`step ${at}: the canvas is shorter than its last row`)
    }
  }

  check(`${method}: history geometry holds`, problems.length, 0)
  if (problems.length > 0) failures.push(`      ${problems[0]}`)
}

// History only ever grows, and what is already written never changes. This is
// the property the whole view exists for: scrubbing forward must not rewrite a
// row the visitor has already read.
{
  const steps = traceSort([4, 1, 5, 1, 2, 3], 'bubble', 'asc')
  let previous = buildHistory(steps, 0)
  const rewritten = []

  for (let at = 1; at < steps.length; at++) {
    const rows = buildHistory(steps, at)
    if (rows.length < previous.length) rewritten.push(`step ${at}: history shrank`)
    // Every row before the one that was live last time must be untouched.
    for (let r = 0; r < previous.length - 1; r++) {
      if (JSON.stringify(rows[r].values) !== JSON.stringify(previous[r].values)) {
        rewritten.push(`step ${at}: row ${r} changed after it was finished`)
      }
    }
    previous = rows
  }

  check('bubble: finished rows are never rewritten', rewritten.length, 0)
  if (rewritten.length > 0) failures.push(`      ${rewritten[0]}`)
}

// The first row is the input exactly as it was typed, which is what the diagram
// opens with and what everything below it is read against.
for (const method of ['bubble', 'selection', 'insertion']) {
  const source = [4, 1, 5, 1, 2, 3]
  const rows = buildHistory(traceSort(source, method, 'asc'), 0)
  // Joined, because this file's `check` is strict equality and two arrays with
  // the same contents are never ===.
  check(`${method}: the history opens on the untouched input`, rows[0].values.join(','), source.join(','))
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✗ sortLayout: ${failures.length} failure(s), ${passed} passed\n`)
  failures.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log(`✓ sortLayout: ${passed} assertions passed`)
