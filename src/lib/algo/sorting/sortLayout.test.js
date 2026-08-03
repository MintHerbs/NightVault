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
  cellCenterX,
  cellX,
  layoutForStep,
  pointerX,
  rangeBox,
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

// ---------------------------------------------------------------------------
// 3. Bands never overlap, at any step of any method
// ---------------------------------------------------------------------------

const INPUT = [2, 8, 4, 7, 1, 3, 9, 6, 5]

for (const method of ['merge', 'radix', 'bubble', 'insertion', 'selection']) {
  for (const direction of ['asc', 'desc']) {
    const steps = traceSort(INPUT, method, direction)
    const collisions = []
    const shortRows = []

    for (const step of steps) {
      const layout = layoutForStep(step, INPUT.length)

      // Bands are stacked, so each must start at or below the previous one's
      // bottom edge.
      for (let b = 1; b < layout.bands.length; b++) {
        const above = layout.bands[b - 1]
        const below = layout.bands[b]
        if (below.y < above.y + above.height) {
          collisions.push(`${method}/${direction} step ${step.id}: ${below.kind} overlaps ${above.kind}`)
        }
      }

      // The first band must clear the array row and its pointer lane.
      if (layout.bands.length > 0 && layout.bands[0].y < layout.arrayY + CELL_HEIGHT) {
        collisions.push(`${method}/${direction} step ${step.id}: ${layout.bands[0].kind} overlaps the array row`)
      }

      // Every band has to fit inside the reported height, or the SVG clips it.
      for (const band of layout.bands) {
        if (band.y + band.height > layout.height) {
          shortRows.push(`${method}/${direction} step ${step.id}: ${band.kind} extends past the canvas`)
        }
      }
    }

    check(`${method}/${direction}: no band collides with another`, collisions.length, 0)
    if (collisions.length > 0) failures.push(`      ${collisions[0]}`)
    check(`${method}/${direction}: every band fits the canvas`, shortRows.length, 0)
    if (shortRows.length > 0) failures.push(`      ${shortRows[0]}`)
  }
}

// ---------------------------------------------------------------------------
// 4. Recursion frames land on the cells they describe
// ---------------------------------------------------------------------------

{
  const steps = traceSort(INPUT, 'merge', 'asc')
  const misplaced = []
  let sawFrames = false

  for (const step of steps) {
    const layout = layoutForStep(step, INPUT.length)
    if (layout.frames.length > 0) sawFrames = true

    for (const frame of layout.frames) {
      if (frame.x !== cellX(frame.low)) {
        misplaced.push(`step ${step.id}: frame starts at ${frame.x}, cell ${frame.low} is at ${cellX(frame.low)}`)
      }
      if (frame.x + frame.width !== cellX(frame.high) + CELL_WIDTH) {
        misplaced.push(`step ${step.id}: frame ends at ${frame.x + frame.width}, cell ${frame.high} ends at ${cellX(frame.high) + CELL_WIDTH}`)
      }
    }

    // Deeper frames are drawn lower, which is the whole reading of the ladder.
    for (let f = 1; f < layout.frames.length; f++) {
      if (layout.frames[f].y <= layout.frames[f - 1].y) {
        misplaced.push(`step ${step.id}: depth ${f} is not below depth ${f - 1}`)
      }
    }
  }

  checkThat('merge: the run produces recursion frames', sawFrames)
  check('merge: frames align to their cells', misplaced.length, 0)
  if (misplaced.length > 0) failures.push(`      ${misplaced[0]}`)
}

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
    const layout = layoutForStep(step, INPUT.length)
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
// 5. Partition bands wrap their cells
// ---------------------------------------------------------------------------

const partitionStep = traceSort(INPUT, 'quick', 'asc').find((s) => s.type === 'partition-done')
checkThat('quick: a partition-done step carries bands', (partitionStep?.ranges || []).length === 2)

for (const range of partitionStep.ranges) {
  const box = rangeBox(range)
  checkThat(
    `band ${range.role} starts left of cell ${range.low}`,
    box.x <= cellX(range.low),
    `box.x = ${box.x}, cellX = ${cellX(range.low)}`
  )
  checkThat(
    `band ${range.role} ends right of cell ${range.high}`,
    box.x + box.width >= cellX(range.high) + CELL_WIDTH,
    `band ends at ${box.x + box.width}, cell ends at ${cellX(range.high) + CELL_WIDTH}`
  )
}

// The two bands must not touch: they sit either side of the pivot, and a band
// that ran over it would paint the finished cell as unfinished.
const leftBox = rangeBox(partitionStep.ranges[0])
const rightBox = rangeBox(partitionStep.ranges[1])
checkThat(
  'the two partition bands leave the pivot clear',
  leftBox.x + leftBox.width < rightBox.x,
  `left ends ${leftBox.x + leftBox.width}, right starts ${rightBox.x}`
)

// ---------------------------------------------------------------------------
// 6. Layout is deterministic
// ---------------------------------------------------------------------------

const someStep = traceSort(INPUT, 'quick', 'asc')[12]
check(
  'the same step lays out identically twice',
  JSON.stringify(layoutForStep(someStep, INPUT.length)),
  JSON.stringify(layoutForStep(someStep, INPUT.length))
)
check(
  'a null step still yields a usable canvas',
  layoutForStep(null, INPUT.length).width,
  rowWidth(INPUT.length)
)

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✗ sortLayout: ${failures.length} failure(s), ${passed} passed\n`)
  failures.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log(`✓ sortLayout: ${passed} assertions passed`)
