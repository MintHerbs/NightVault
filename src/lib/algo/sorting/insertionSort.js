// src/lib/algo/sorting/insertionSort.js
//
// `i` is the boundary of the sorted prefix, `key` is lifted out into the temp
// box and `j` walks back through the prefix shifting values right until the
// key's slot opens up (T-105).
//
// Shifts are emitted as `shift`, not as swaps: insertion sort does not swap,
// it copies one cell into the next and finally drops the held key in. Drawing
// that as a swap would teach the wrong operation and would also leave a
// duplicated value visible on screen with no explanation for it.

import { INSERTION_LINES as L } from './pseudocode.js'
import { comparator, createRecorder, marksOf } from './steps.js'

function snapshot(ctx) {
  const marks = marksOf([...ctx.sorted].map((idx) => [idx, 'sorted']))
  if (ctx.i !== null) marks[ctx.i] = 'i'
  if (ctx.j !== null && ctx.j >= 0) marks[ctx.j] = 'j'
  return {
    marks,
    pointers: { i: ctx.i, j: ctx.j, low: 0, high: ctx.n - 1 },
    ranges: ctx.prefix > 0 ? [{ low: 0, high: ctx.prefix - 1, role: 'settled' }] : null,
  }
}

export default function traceInsertionSort(values, direction) {
  const rec = createRecorder([...values], { algo: 'insertion', direction })
  const before = comparator(direction)
  const n = values.length
  const rel = direction === 'desc' ? '<' : '>'

  const ctx = { i: null, j: null, n, sorted: new Set(), prefix: Math.min(1, n) }

  if (n > 0) {
    ctx.sorted.add(0)
    rec.push('frame-enter', `The first value, ${rec.arr[0]}, counts as a sorted prefix of one. Everything else gets inserted into it.`, {
      ...snapshot(ctx),
      codeLine: L.call,
    })
  }

  for (let i = 1; i < n; i++) {
    ctx.i = i
    const key = rec.arr[i]

    rec.push('frame-enter', `Lift a[${i}] = ${key} out into key, leaving its slot free to shift into.`, {
      ...snapshot(ctx),
      temp: { value: key, from: i },
      codeLine: L.key,
    })

    let j = i - 1
    ctx.j = j

    while (j >= 0 && before(key, rec.arr[j])) {
      rec.push('compare', `a[${j}] = ${rec.arr[j]} ${rel} key ${key}, so it shifts one place right.`, {
        ...snapshot(ctx),
        temp: { value: key, from: i },
        codeLine: L.test,
      })

      rec.arr[j + 1] = rec.arr[j]
      rec.push('shift', `${rec.arr[j]} moves from position ${j} to position ${j + 1}.`, {
        ...snapshot(ctx),
        temp: { value: key, from: i },
        codeLine: L.shift,
      })

      j -= 1
      ctx.j = j
      if (j >= 0) {
        rec.push('pointer-advance', `j steps back to ${j}.`, {
          ...snapshot(ctx),
          temp: { value: key, from: i },
          codeLine: L.decJ,
        })
      }
    }

    if (j >= 0) {
      rec.push('compare', `a[${j}] = ${rec.arr[j]} is not ${rel} key ${key}, so the walk stops here.`, {
        ...snapshot(ctx),
        temp: { value: key, from: i },
        codeLine: L.test,
      })
    } else {
      rec.push('compare', `j has run off the front of the array, so key ${key} belongs at position 0.`, {
        ...snapshot(ctx),
        temp: { value: key, from: i },
        codeLine: L.test,
      })
    }

    rec.arr[j + 1] = key
    ctx.j = null
    ctx.prefix = i + 1
    for (let idx = 0; idx <= i; idx++) ctx.sorted.add(idx)
    rec.push('place', `key ${key} drops into position ${j + 1}. The first ${i + 1} values are sorted among themselves.`, {
      ...snapshot(ctx),
      codeLine: L.place,
    })
  }

  ctx.i = null
  ctx.j = null
  ctx.prefix = n
  for (let idx = 0; idx < n; idx++) ctx.sorted.add(idx)
  rec.push('done', `Sorted: [${rec.arr.join(', ')}].`, { ...snapshot(ctx), codeLine: L.call })

  return rec.steps
}
