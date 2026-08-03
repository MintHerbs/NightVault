// src/lib/algo/sorting/bubbleSort.js
//
// `i` counts finished passes, `j` is the scanner comparing each adjacent pair
// (T-105). The tail grows into the sorted region one value per pass, which is
// the thing bubble sort is worth watching for.

import { BUBBLE_LINES as L } from './pseudocode.js'
import { comparator, createRecorder, marksOf, recordSwap } from './steps.js'

function snapshot(ctx) {
  const marks = marksOf([...ctx.sorted].map((idx) => [idx, 'sorted']))
  if (ctx.i !== null && ctx.i >= 0) marks[ctx.i] = 'i'
  if (ctx.j !== null) marks[ctx.j] = 'j'
  return {
    marks,
    pointers: { i: ctx.i, j: ctx.j, low: 0, high: ctx.n - 1 },
    ranges: ctx.sortedFrom < ctx.n ? [{ low: ctx.sortedFrom, high: ctx.n - 1, role: 'settled' }] : null,
  }
}

export default function traceBubbleSort(values, direction) {
  const rec = createRecorder([...values], { algo: 'bubble', direction })
  const before = comparator(direction)
  const n = values.length
  const notRel = direction === 'desc' ? '≥' : '≤'
  const rel = direction === 'desc' ? '<' : '>'

  const ctx = { i: null, j: null, n, sorted: new Set(), sortedFrom: n }

  for (let pass = 0; pass < Math.max(0, n - 1); pass++) {
    ctx.i = pass
    let swapped = false

    rec.push('frame-enter', `Pass ${pass + 1}: walk j along the unsorted part and swap any pair that is out of order.`, {
      ...snapshot(ctx),
      codeLine: L.outer,
    })

    for (let j = 0; j < n - 1 - pass; j++) {
      ctx.j = j
      const a = rec.arr[j]
      const b = rec.arr[j + 1]
      // `before(b, a)` rather than `!before(a, b)`: with equal neighbours the
      // negated form would report them as out of order and swap, which is what
      // makes a sort unstable for no reason at all.
      const outOfOrder = before(b, a)

      rec.push(
        'compare',
        outOfOrder
          ? `a[${j}] = ${a} ${rel} a[${j + 1}] = ${b}, so this pair is out of order.`
          : `a[${j}] = ${a} ${notRel} a[${j + 1}] = ${b}, so this pair is already in order.`,
        { ...snapshot(ctx), codeLine: L.test }
      )

      if (outOfOrder) {
        recordSwap(rec, j, j + 1, snapshot(ctx), [L.hold, L.writeLeft, L.writeRight])
        swapped = true
      }
    }

    ctx.j = null
    ctx.sorted.add(n - 1 - pass)
    ctx.sortedFrom = n - 1 - pass
    rec.push(
      'mark-sorted',
      `Pass ${pass + 1} is done. ${rec.arr[n - 1 - pass]} has been carried to position ${n - 1 - pass} and is now final.`,
      { ...snapshot(ctx), codeLine: L.outer }
    )

    if (!swapped) {
      // Nothing moved, so every remaining pair is already ordered. Stopping
      // here is part of the algorithm, not an optimisation the animation is
      // hiding: a sorted input finishing in one pass is the point.
      for (let idx = 0; idx < n; idx++) ctx.sorted.add(idx)
      ctx.sortedFrom = 0
      rec.push('mark-sorted', 'No swaps happened in that pass, so the array is already sorted and the algorithm stops early.', {
        ...snapshot(ctx),
        codeLine: L.earlyExit,
      })
      break
    }
  }

  ctx.i = null
  ctx.j = null
  ctx.sortedFrom = 0
  for (let idx = 0; idx < n; idx++) ctx.sorted.add(idx)
  rec.push('done', `Sorted: [${rec.arr.join(', ')}].`, { ...snapshot(ctx), codeLine: L.call })

  return rec.steps
}
