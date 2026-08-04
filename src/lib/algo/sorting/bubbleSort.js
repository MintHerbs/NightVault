// src/lib/algo/sorting/bubbleSort.js
//
// `j` scans each adjacent pair; the tail grows into the sorted region by one
// value per pass, which is the thing bubble sort is worth watching for (T-105).
//
// One history row per comparison, not per swap. That is what the lecture
// diagram draws: a row for every look at the array, showing the pair that was
// compared and the arrangement that look left behind, whether or not anything
// moved. Four rows per swap would bury the pass structure in swap mechanics.
//
// There is deliberately no `i` marker on the array. Bubble sort's outer counter
// is a pass number, not a position, and marking cell[i] with it — which this
// did — put a green ring on an arbitrary cell that had nothing to do with the
// comparison. The pass is named on its bracket instead.

import { BUBBLE_LINES as L } from './pseudocode.js'
import { comparator, createRecorder, marksOf, recordSwap } from './steps.js'

function snapshot(ctx) {
  const marks = marksOf([...ctx.sorted].map((idx) => [idx, 'sorted']))
  // Both cells of the pair, the way the diagram greys them: a comparison is
  // about the two of them together, and colouring only one implies the other
  // is a bystander.
  if (ctx.j !== null) {
    marks[ctx.j] = 'pair'
    if (ctx.j + 1 < ctx.n) marks[ctx.j + 1] = 'pair'
  }
  return {
    marks,
    pointers: { i: null, j: ctx.j, low: 0, high: ctx.n - 1 },
    ranges: ctx.sortedFrom < ctx.n ? [{ low: ctx.sortedFrom, high: ctx.n - 1, role: 'settled' }] : null,
    pass: ctx.pass,
    passLabel: ctx.passLabel,
  }
}

export default function traceBubbleSort(values, direction) {
  const rec = createRecorder([...values], { algo: 'bubble', direction })
  const before = comparator(direction)
  const n = values.length
  const notRel = direction === 'desc' ? '≥' : '≤'
  const rel = direction === 'desc' ? '<' : '>'

  const ctx = { j: null, n, sorted: new Set(), sortedFrom: n, pass: 0, passLabel: 'Input' }

  rec.push('frame-enter', `The array as given: [${rec.arr.join(', ')}].`, {
    ...snapshot(ctx),
    codeLine: L.call,
  })

  for (let pass = 0; pass < Math.max(0, n - 1); pass++) {
    ctx.pass = pass + 1
    ctx.passLabel = `Pass ${pass + 1}`
    ctx.j = null
    let swapped = false

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
          ? `a[${j}] = ${a} ${rel} a[${j + 1}] = ${b}, so this pair is out of order and swaps.`
          : `a[${j}] = ${a} ${notRel} a[${j + 1}] = ${b}, so this pair is already in order.`,
        { ...snapshot(ctx), rowStart: true, codeLine: L.test }
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
      { ...snapshot(ctx), rowStart: true, codeLine: L.outer }
    )

    if (!swapped) {
      // Nothing moved, so every remaining pair is already ordered. Stopping
      // here is part of the algorithm, not an optimisation the animation is
      // hiding: a sorted input finishing in one pass is the point.
      for (let idx = 0; idx < n; idx++) ctx.sorted.add(idx)
      ctx.sortedFrom = 0
      rec.push('mark-sorted', 'No swaps happened in that pass, so the array is already sorted and the algorithm stops early.', {
        ...snapshot(ctx),
        rowStart: true,
        codeLine: L.earlyExit,
      })
      break
    }
  }

  ctx.j = null
  ctx.sortedFrom = 0
  ctx.pass += 1
  ctx.passLabel = 'Result'
  for (let idx = 0; idx < n; idx++) ctx.sorted.add(idx)
  rec.push('done', `Sorted: [${rec.arr.join(', ')}].`, {
    ...snapshot(ctx),
    rowStart: true,
    codeLine: L.call,
  })

  return rec.steps
}
