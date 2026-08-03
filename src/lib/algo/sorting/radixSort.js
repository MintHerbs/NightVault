// src/lib/algo/sorting/radixSort.js
//
// LSD radix, base 10 (T-105). The one method here that performs no comparison
// at all, which is why descending is not a flipped operator: it is produced by
// collecting the buckets 9 → 0 instead of 0 → 9. Stability within a bucket is
// preserved either way, so only the order the buckets are emptied in changes.
//
// Non-negative input only. A base-10 digit has no representation for a sign, so
// rather than quietly offsetting the values behind the visitor's back (which
// would animate a pass over numbers they never entered) the parser rejects
// negatives for this method and says why.
//
// Like merge sort, the array is not a permutation of the input during the
// collect phase. The `buckets` block carries what has not been collected yet,
// so output-so-far plus the remaining buckets is always the whole input, and
// the test asserts that.

import { RADIX_LINES as L } from './pseudocode.js'
import { createRecorder, marksOf } from './steps.js'

const PLACE_NAMES = ['ones', 'tens', 'hundreds', 'thousands']

function placeName(place) {
  const index = Math.round(Math.log10(place))
  return PLACE_NAMES[index] || `10^${index}`
}

function snapshot(ctx) {
  const marks = marksOf([...ctx.sorted].map((idx) => [idx, 'sorted']))
  if (ctx.j !== null) marks[ctx.j] = 'j'
  if (ctx.k !== null) marks[ctx.k] = 'k'
  return {
    marks,
    pointers: { j: ctx.j, k: ctx.k, digit: ctx.place, low: 0, high: ctx.n - 1 },
    buckets: ctx.buckets
      ? {
          rows: ctx.buckets.map((row) => [...row]),
          phase: ctx.phase,
          collected: ctx.collected,
          place: ctx.place,
        }
      : null,
  }
}

export default function traceRadixSort(values, direction) {
  const rec = createRecorder([...values], { algo: 'radix', direction })
  const n = values.length
  const max = n === 0 ? 0 : Math.max(...values)

  const ctx = {
    n,
    sorted: new Set(),
    buckets: null,
    phase: null,
    collected: 0,
    place: 1,
    j: null,
    k: null,
  }

  if (n > 0) {
    rec.push(
      'frame-enter',
      `Radix sort reads one digit at a time, starting from the ones. The largest value is ${max}, so that is ${String(max).length} pass(es).`,
      { ...snapshot(ctx), codeLine: L.call }
    )
  }

  // Driven by the digit count of the largest value rather than by `max >= place`,
  // so an all-zero array still runs one visible pass instead of jumping straight
  // to "done" and looking like the tool refused to do anything.
  const passes = n === 0 ? 0 : String(max).length

  for (let pass = 0, place = 1; pass < passes; pass++, place *= 10) {
    ctx.place = place
    ctx.buckets = Array.from({ length: 10 }, () => [])
    ctx.phase = 'scatter'
    ctx.collected = 0
    ctx.k = null

    rec.push('frame-enter', `Pass on the ${placeName(place)} digit: start with ten empty buckets.`, {
      ...snapshot(ctx),
      codeLine: L.empty,
    })

    for (let idx = 0; idx < n; idx++) {
      ctx.j = idx
      const value = rec.arr[idx]
      const digit = Math.floor(value / place) % 10
      ctx.buckets[digit].push(value)
      rec.push(
        'bucket-scatter',
        `${value} has ${placeName(place)} digit ${digit}, so it joins the back of bucket ${digit}.`,
        { ...snapshot(ctx), codeLine: L.scatter }
      )
    }

    ctx.j = null
    ctx.phase = 'collect'
    const order = direction === 'desc' ? [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

    rec.push(
      'frame-exit',
      direction === 'desc'
        ? 'Every value is in a bucket. Empty them back into the array from bucket 9 down to bucket 0.'
        : 'Every value is in a bucket. Empty them back into the array from bucket 0 up to bucket 9.',
      { ...snapshot(ctx), codeLine: L.collect }
    )

    let k = 0
    for (const digit of order) {
      while (ctx.buckets[digit].length > 0) {
        const value = ctx.buckets[digit].shift()
        rec.arr[k] = value
        ctx.k = k
        ctx.collected = k + 1
        rec.push('bucket-collect', `${value} comes out of bucket ${digit} into position ${k}.`, {
          ...snapshot(ctx),
          codeLine: L.collect,
        })
        k += 1
      }
    }

    ctx.buckets = null
    ctx.phase = null
    ctx.k = null
    rec.push(
      'mark-sorted',
      `After the ${placeName(place)} pass the array is [${rec.arr.join(', ')}], sorted by every digit read so far.`,
      { ...snapshot(ctx), codeLine: L.place }
    )
  }

  ctx.j = null
  ctx.k = null
  for (let idx = 0; idx < n; idx++) ctx.sorted.add(idx)
  rec.push('done', `Sorted: [${rec.arr.join(', ')}].`, { ...snapshot(ctx), codeLine: L.ret })

  return rec.steps
}
