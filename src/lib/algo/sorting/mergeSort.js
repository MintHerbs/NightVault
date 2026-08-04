// src/lib/algo/sorting/mergeSort.js
//
// Split down to single values, then merge back up (T-105). The split structure
// is carried by the pass labels on the history stack — "Merge [1, 4] + [5]" —
// rather than by a separate call-stack ladder, which is why `ctx.stack` is kept
// for the recursion itself but no longer emitted as drawable `frames`.
//
// `k` is the write
// position in the array, and `i`/`j` index the two runs being consumed rather
// than the array itself, which is why the merge steps carry a `runs` block: the
// canvas draws the two source runs above the row they are being merged into,
// and `runs` is also what makes the merge verifiable.
//
// Mid-merge the array is genuinely not a permutation of the input, because the
// cells past `k` still hold the stale values the runs were copied from. That is
// what the runs block accounts for: output-so-far plus what is left of both
// runs is always exactly the range's original contents, and the test asserts
// that rather than pretending the array alone is conserved.

import { MERGE_LINES as L } from './pseudocode.js'
import { comparator, createRecorder, marksOf } from './steps.js'

function snapshot(ctx) {
  const marks = marksOf([...ctx.sorted].map((idx) => [idx, 'sorted']))
  if (ctx.k !== null) marks[ctx.k] = 'k'
  return {
    marks,
    pointers: { i: ctx.i, j: ctx.j, k: ctx.k, low: ctx.low, high: ctx.high },
    runs: ctx.runs
      ? {
          low: ctx.runs.low,
          mid: ctx.runs.mid,
          high: ctx.runs.high,
          left: [...ctx.runs.left],
          right: [...ctx.runs.right],
          i: ctx.runs.i,
          j: ctx.runs.j,
          k: ctx.runs.k,
        }
      : null,
    pass: ctx.pass,
    passLabel: ctx.passLabel,
  }
}

function mergeRuns(rec, low, mid, high, ctx) {
  const before = comparator(ctx.direction)
  const rel = ctx.direction === 'desc' ? '≥' : '≤'
  const left = rec.arr.slice(low, mid + 1)
  const right = rec.arr.slice(mid + 1, high + 1)

  ctx.runs = { low, mid, high, left, right, i: 0, j: 0, k: low }
  ctx.i = 0
  ctx.j = 0
  ctx.k = low
  ctx.pass += 1
  ctx.passLabel = `Merge [${left.join(', ')}] + [${right.join(', ')}]`

  rec.push(
    'frame-enter',
    `Merge [${left.join(', ')}] with [${right.join(', ')}] back into positions ${low} to ${high}.`,
    { ...snapshot(ctx), rowStart: true, codeLine: L.split }
  )

  const take = (side) => {
    const value = side === 'left' ? left[ctx.runs.i] : right[ctx.runs.j]
    rec.arr[ctx.runs.k] = value
    if (side === 'left') ctx.runs.i += 1
    else ctx.runs.j += 1
    ctx.runs.k += 1
    ctx.i = ctx.runs.i
    ctx.j = ctx.runs.j
    ctx.k = ctx.runs.k
    rec.push(
      'merge-take',
      `${value} is taken from the ${side} run into position ${ctx.runs.k - 1}.`,
      { ...snapshot(ctx), rowStart: true, codeLine: side === 'left' ? L.takeLeft : L.takeRight }
    )
  }

  while (ctx.runs.i < left.length && ctx.runs.j < right.length) {
    const a = left[ctx.runs.i]
    const b = right[ctx.runs.j]
    // `!before(b, a)` rather than `before(a, b)`: on a tie this keeps the left
    // run's value first, which is what makes merge sort stable.
    const takeLeft = !before(b, a)

    rec.push(
      'compare',
      takeLeft
        ? `The left run's head ${a} is ${rel} the right run's head ${b}, so ${a} goes next.`
        : `The right run's head ${b} beats the left run's head ${a}, so ${b} goes next.`,
      { ...snapshot(ctx), codeLine: L.test }
    )

    take(takeLeft ? 'left' : 'right')
  }

  while (ctx.runs.i < left.length) {
    rec.push('compare', `The right run is empty, so the rest of the left run follows in order.`, {
      ...snapshot(ctx),
      codeLine: L.drainLeft,
    })
    take('left')
  }

  while (ctx.runs.j < right.length) {
    rec.push('compare', `The left run is empty, so the rest of the right run follows in order.`, {
      ...snapshot(ctx),
      codeLine: L.drainRight,
    })
    take('right')
  }

  ctx.runs = null
  ctx.i = null
  ctx.j = null
  ctx.k = null
  for (let idx = low; idx <= high; idx++) ctx.sorted.add(idx)

  rec.push(
    'mark-sorted',
    `Positions ${low} to ${high} are now sorted among themselves: [${rec.arr.slice(low, high + 1).join(', ')}].`,
    { ...snapshot(ctx), rowStart: true, codeLine: L.mergeCall }
  )
}

function mergeSortRange(rec, low, high, ctx) {
  ctx.stack.push({ low, high, depth: ctx.stack.length })
  ctx.low = low
  ctx.high = high

  if (low === high) {
    ctx.sorted.add(low)
    rec.push('frame-enter', `mergeSort([${rec.arr[low]}]): a single value is already sorted.`, {
      ...snapshot(ctx),
      codeLine: L.guard,
    })
  } else if (low < high) {
    const mid = Math.floor((low + high) / 2)
    rec.push(
      'frame-enter',
      `mergeSort([${rec.arr.slice(low, high + 1).join(', ')}]): split into positions ${low}..${mid} and ${mid + 1}..${high}.`,
      { ...snapshot(ctx), codeLine: L.mid }
    )

    mergeSortRange(rec, low, mid, ctx)
    ctx.low = low
    ctx.high = high
    mergeSortRange(rec, mid + 1, high, ctx)

    ctx.low = low
    ctx.high = high
    mergeRuns(rec, low, mid, high, ctx)
  }

  ctx.stack.pop()
}

export default function traceMergeSort(values, direction) {
  const rec = createRecorder([...values], { algo: 'merge', direction })
  const ctx = {
    direction,
    stack: [],
    sorted: new Set(),
    runs: null,
    i: null,
    j: null,
    k: null,
    low: 0,
    high: values.length - 1,
    pass: 0,
    passLabel: 'Split',
  }

  rec.push('frame-enter', `The array as given: [${rec.arr.join(', ')}].`, {
    ...snapshot(ctx),
    codeLine: L.call,
  })

  mergeSortRange(rec, 0, values.length - 1, ctx)

  for (let idx = 0; idx < values.length; idx++) ctx.sorted.add(idx)
  ctx.pass += 1
  ctx.passLabel = 'Result'
  rec.push('done', `Sorted: [${rec.arr.join(', ')}].`, {
    ...snapshot(ctx),
    rowStart: true,
    codeLine: L.call,
  })

  return rec.steps
}
