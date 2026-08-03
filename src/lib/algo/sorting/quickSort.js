// src/lib/algo/sorting/quickSort.js
//
// Lomuto partition with the pivot taken from the end of the range, `i` as the
// boundary of the settled region and `j` as the scanner (T-105). This is the
// scheme the owner was taught, and the two oracle tables in the ticket are
// asserted against it line by line, so the emission order here is a contract
// rather than a preference.
//
// Every swap goes through recordSwap's explicit `temp`, because `temp` is the
// part of the lesson a single-frame swap erases.
//
// The recursion is emitted as a **tree of segments** rather than a call stack.
// A segment is one range that one quickSort call owns, and it holds its own
// frozen copy of what that range looked like when its partition finished. That
// is what lets the canvas draw the lecture's shape: the whole array partitions
// in place, then moves up and splits into two rows beneath it, then the left
// row works, then the right, with every finished row still on screen above.
// A call stack cannot express that, because it pops the ranges you still want
// to see.

import { QUICK_LINES as L } from './pseudocode.js'
import { belongsBefore, createRecorder, marksOf, recordSwap, relSymbol } from './steps.js'

/**
 * Segment states, in the order one goes through them:
 *
 *   pending  created by its parent's split, not started. Drawn dim.
 *   active   being partitioned right now. Owns i, j, the pivot and temp.
 *   split    partitioned; its pivot is final and its two halves are below it.
 *   done     a single value, or an empty range's stand-in. Nothing to do.
 */
function makeSegment(ctx, low, high, depth, originLine) {
  const segment = {
    id: `d${depth}:${low}-${high}`,
    depth,
    low,
    high,
    state: 'pending',
    // Which line of the listing called this range into being. Without it the
    // right half of every split highlighted `quickSort(A, low, p - 1)` when it
    // started, and line 5 never lit up at all.
    originLine,
    // Frozen when the segment stops being active. While it is active the
    // snapshot below reads the live array instead, so the row being worked on
    // animates and the rows above it stay as they were left.
    values: [],
    pivotIndex: null,
  }
  ctx.segments.push(segment)
  return segment
}

function snapshot(rec, ctx) {
  const segments = ctx.segments.map((segment) => ({
    ...segment,
    values:
      segment.state === 'active'
        ? rec.arr.slice(segment.low, segment.high + 1)
        : [...segment.values],
  }))

  const marks = marksOf([...ctx.sorted].map((idx) => [idx, 'sorted']))
  // Live roles overwrite `sorted`, so a pivot being compared reads as the
  // pivot rather than disappearing into the finished region behind it.
  if (ctx.pivot !== null) marks[ctx.pivot] = 'pivot'
  if (ctx.i !== null && ctx.i >= 0) marks[ctx.i] = 'i'
  if (ctx.j !== null) marks[ctx.j] = 'j'

  return {
    segments,
    marks,
    pointers: { i: ctx.i, j: ctx.j, pivot: ctx.pivot, low: ctx.low, high: ctx.high },
    ranges: ctx.ranges,
  }
}

function partition(rec, segment, ctx) {
  const { low, high } = segment
  const before = belongsBefore(ctx.direction)
  const rel = relSymbol(ctx.direction)
  const notRel = ctx.direction === 'desc' ? '<' : '>'
  const pivotValue = rec.arr[high]

  ctx.pivot = high
  ctx.i = low - 1
  ctx.j = low
  ctx.ranges = null

  rec.push(
    'pointer-init',
    `Partition [${low}..${high}]: the pivot is the last value, ${pivotValue}. i starts at ${low - 1}, just outside the range, and j starts at ${low}.`,
    { ...snapshot(rec, ctx), codeLine: L.pivot }
  )

  for (let j = low; j < high; j++) {
    ctx.j = j
    const value = rec.arr[j]
    const keep = before(value, pivotValue)

    rec.push(
      'compare',
      keep
        ? `a[${j}] = ${value} ${rel} pivot ${pivotValue}, so it belongs on the pivot's near side.`
        : `a[${j}] = ${value} ${notRel} pivot ${pivotValue}, so it stays where it is and j moves on.`,
      { ...snapshot(rec, ctx), codeLine: L.test }
    )

    if (!keep) continue

    ctx.i += 1
    rec.push('pointer-advance', `i advances to ${ctx.i}.`, {
      ...snapshot(rec, ctx),
      codeLine: L.incI,
    })
    recordSwap(rec, ctx.i, j, snapshot(rec, ctx), [L.hold, L.writeLeft, L.writeRight])
  }

  const p = ctx.i + 1
  ctx.j = high
  rec.push(
    'pointer-advance',
    `The scan is finished. i stopped at ${ctx.i}, so the pivot's place is position ${p}.`,
    { ...snapshot(rec, ctx), codeLine: L.pivotHold }
  )

  recordSwap(rec, p, high, snapshot(rec, ctx), [L.pivotHold, L.pivotWriteLeft, L.pivotWriteRight])

  ctx.sorted.add(p)
  ctx.pivot = p
  ctx.i = null
  ctx.j = null
  ctx.ranges = [
    ...(p > low ? [{ low, high: p - 1, role: 'left' }] : []),
    ...(p < high ? [{ low: p + 1, high, role: 'right' }] : []),
  ]

  rec.push(
    'partition-done',
    `${pivotValue} is in its final position ${p}. Everything to its left is ${rel} ${pivotValue}, everything to its right is not.`,
    { ...snapshot(rec, ctx), codeLine: L.ret }
  )

  return p
}

function sortSegment(rec, segment, ctx) {
  const { low, high, depth } = segment

  segment.state = 'active'
  ctx.low = low
  ctx.high = high
  ctx.pivot = null
  ctx.i = null
  ctx.j = null
  ctx.ranges = null

  if (low === high) {
    // A one-element range is sorted by definition. Marked rather than skipped,
    // so a single cell is not left un-highlighted at the end of a run looking
    // like the tool forgot about it.
    ctx.sorted.add(low)
    segment.values = [rec.arr[low]]
    segment.state = 'done'
    rec.push('frame-enter', `quickSort([${rec.arr[low]}]): a single value is already sorted.`, {
      ...snapshot(rec, ctx),
      codeLine: segment.originLine ?? L.guard,
    })
    return
  }

  rec.push(
    'frame-enter',
    `quickSort([${rec.arr.slice(low, high + 1).join(', ')}]): sort positions ${low} to ${high}.`,
    { ...snapshot(rec, ctx), codeLine: segment.originLine ?? L.call }
  )

  const p = partition(rec, segment, ctx)

  // The row stops being live here: it keeps the arrangement its own partition
  // produced, and everything that happens from now on happens in the rows below.
  segment.values = rec.arr.slice(low, high + 1)
  segment.pivotIndex = p
  segment.state = 'split'

  // Both halves are created before either is worked on, so the split itself is
  // a step you can stop on: one row becomes two, and only then does the left
  // one start moving.
  const left = low <= p - 1 ? makeSegment(ctx, low, p - 1, depth + 1, L.recurseLeft) : null
  const right = p + 1 <= high ? makeSegment(ctx, p + 1, high, depth + 1, L.recurseRight) : null
  if (left) left.values = rec.arr.slice(left.low, left.high + 1)
  if (right) right.values = rec.arr.slice(right.low, right.high + 1)

  const pivotValue = rec.arr[p]
  const describe = (seg, side) =>
    seg ? `[${seg.values.join(', ')}] on the ${side}` : `nothing on the ${side}`

  rec.push(
    'recurse',
    `${pivotValue} is settled, so this row is finished. It splits into ${describe(left, 'left')} and ${describe(right, 'right')}, each sorted the same way.`,
    // The partition call, which has just returned p and is what produced the
    // split. The two recursive calls light their own lines when each half
    // actually starts, so the listing reads 3 → 4 → 5 rather than 4 twice.
    { ...snapshot(rec, ctx), codeLine: L.partitionCall }
  )

  if (left) sortSegment(rec, left, ctx)
  if (right) sortSegment(rec, right, ctx)
}

/**
 * @param {number[]} values
 * @param {string} direction - 'asc' | 'desc'
 * @returns {object[]} animation steps
 */
export default function traceQuickSort(values, direction) {
  const rec = createRecorder([...values], { algo: 'quick', direction })
  const ctx = {
    direction,
    segments: [],
    sorted: new Set(),
    i: null,
    j: null,
    pivot: null,
    low: 0,
    high: values.length - 1,
    ranges: null,
  }

  if (values.length > 0) {
    sortSegment(rec, makeSegment(ctx, 0, values.length - 1, 0, L.call), ctx)
  }

  ctx.i = null
  ctx.j = null
  ctx.pivot = null
  ctx.ranges = null
  values.forEach((_, idx) => ctx.sorted.add(idx))
  rec.push('done', `Sorted: [${rec.arr.join(', ')}].`, {
    ...snapshot(rec, ctx),
    codeLine: L.call,
  })

  return rec.steps
}
