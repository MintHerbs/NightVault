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

import { QUICK_LINES as L } from './pseudocode.js'
import { belongsBefore, createRecorder, marksOf, recordSwap, relSymbol } from './steps.js'

/** Marks, pointers and frames as they stand right now. */
function snapshot(ctx) {
  const frames = ctx.stack.map((f, idx) => ({
    low: f.low,
    high: f.high,
    depth: f.depth,
    state: idx === ctx.stack.length - 1 ? 'active' : 'waiting',
  }))

  const marks = marksOf([...ctx.sorted].map((idx) => [idx, 'sorted']))
  // Live roles overwrite `sorted`, so a pivot being compared reads as the
  // pivot rather than disappearing into the finished region behind it.
  if (ctx.pivot !== null) marks[ctx.pivot] = 'pivot'
  if (ctx.i !== null && ctx.i >= 0) marks[ctx.i] = 'i'
  if (ctx.j !== null) marks[ctx.j] = 'j'

  return {
    frames,
    marks,
    pointers: { i: ctx.i, j: ctx.j, pivot: ctx.pivot, low: ctx.low, high: ctx.high },
    ranges: ctx.ranges,
  }
}

function partition(rec, low, high, ctx) {
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
    { ...snapshot(ctx), codeLine: L.pivot }
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
      { ...snapshot(ctx), codeLine: L.test }
    )

    if (!keep) continue

    ctx.i += 1
    rec.push('pointer-advance', `i advances to ${ctx.i}.`, {
      ...snapshot(ctx),
      codeLine: L.incI,
    })
    recordSwap(rec, ctx.i, j, snapshot(ctx), [L.hold, L.writeLeft, L.writeRight])
  }

  const p = ctx.i + 1
  ctx.j = high
  rec.push(
    'pointer-advance',
    `The scan is finished. i stopped at ${ctx.i}, so the pivot's place is position ${p}.`,
    { ...snapshot(ctx), codeLine: L.pivotHold }
  )

  recordSwap(rec, p, high, snapshot(ctx), [L.pivotHold, L.pivotWriteLeft, L.pivotWriteRight])

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
    { ...snapshot(ctx), codeLine: L.ret }
  )

  return p
}

function quickSortRange(rec, low, high, ctx) {
  ctx.stack.push({ low, high, depth: ctx.stack.length })
  ctx.low = low
  ctx.high = high
  ctx.pivot = null
  ctx.i = null
  ctx.j = null
  ctx.ranges = null

  if (low === high) {
    // A one-element range is sorted by definition. Marking it here rather than
    // silently returning is what stops single cells being left un-highlighted
    // at the end of a run, which reads as "the tool forgot about them".
    ctx.sorted.add(low)
    rec.push('frame-enter', `quickSort([${rec.arr[low]}]): a single value is already sorted.`, {
      ...snapshot(ctx),
      codeLine: L.guard,
    })
  } else if (low < high) {
    rec.push(
      'frame-enter',
      `quickSort([${rec.arr.slice(low, high + 1).join(', ')}]): sort positions ${low} to ${high}.`,
      { ...snapshot(ctx), codeLine: L.call }
    )

    const p = partition(rec, low, high, ctx)

    if (low <= p - 1) {
      rec.push('recurse', `Now sort the left side, positions ${low} to ${p - 1}.`, {
        ...snapshot(ctx),
        codeLine: L.recurseLeft,
      })
    }
    quickSortRange(rec, low, p - 1, ctx)

    ctx.low = low
    ctx.high = high
    if (p + 1 <= high) {
      rec.push('recurse', `Now sort the right side, positions ${p + 1} to ${high}.`, {
        ...snapshot(ctx),
        codeLine: L.recurseRight,
      })
    }
    quickSortRange(rec, p + 1, high, ctx)
  }

  ctx.stack.pop()
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
    stack: [],
    sorted: new Set(),
    i: null,
    j: null,
    pivot: null,
    low: 0,
    high: values.length - 1,
    ranges: null,
  }

  quickSortRange(rec, 0, values.length - 1, ctx)

  ctx.i = null
  ctx.j = null
  ctx.pivot = null
  ctx.ranges = null
  values.forEach((_, idx) => ctx.sorted.add(idx))
  rec.push('done', `Sorted: [${rec.arr.join(', ')}].`, { ...snapshot(ctx), codeLine: L.call })

  return rec.steps
}
