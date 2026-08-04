// src/lib/algo/sorting/selectionSort.js
//
// `i` is the boundary of the sorted prefix, `j` scans the rest for the value
// that belongs at `i`, and `min` follows the best candidate found so far
// (T-105). Exactly one swap per pass, which is what separates it from bubble
// sort visually as well as in the complexity argument.
//
// `min` keeps its name in the descending case even though it is then tracking
// the largest remaining value. Renaming it per direction would mean the
// listing, the marker and the narration all disagreeing with the textbook.

import { SELECTION_LINES as L } from './pseudocode.js'
import { comparator, createRecorder, marksOf, recordSwap } from './steps.js'

function snapshot(ctx) {
  const marks = marksOf([...ctx.sorted].map((idx) => [idx, 'sorted']))
  if (ctx.min !== null) marks[ctx.min] = 'min'
  if (ctx.i !== null) marks[ctx.i] = 'i'
  if (ctx.j !== null) marks[ctx.j] = 'j'
  return {
    marks,
    pointers: { i: ctx.i, j: ctx.j, min: ctx.min, low: 0, high: ctx.n - 1 },
    ranges: ctx.prefix > 0 ? [{ low: 0, high: ctx.prefix - 1, role: 'settled' }] : null,
    pass: ctx.pass,
    passLabel: ctx.passLabel,
  }
}

export default function traceSelectionSort(values, direction) {
  const rec = createRecorder([...values], { algo: 'selection', direction })
  const better = comparator(direction)
  const n = values.length
  const superlative = direction === 'desc' ? 'largest' : 'smallest'
  const rel = direction === 'desc' ? '>' : '<'

  const ctx = { i: null, j: null, min: null, n, sorted: new Set(), prefix: 0, pass: 0, passLabel: 'Input' }

  rec.push('frame-enter', `The array as given: [${rec.arr.join(', ')}].`, {
    ...snapshot(ctx),
    codeLine: L.call,
  })

  for (let i = 0; i < Math.max(0, n - 1); i++) {
    ctx.i = i
    ctx.min = i
    ctx.j = null
    ctx.pass = i + 1
    ctx.passLabel = `Pass ${i + 1}`

    rec.push(
      'frame-enter',
      `Pass ${i + 1}: find the ${superlative} value in positions ${i} to ${n - 1}. Assume it is a[${i}] = ${rec.arr[i]} until something beats it.`,
      { ...snapshot(ctx), rowStart: true, codeLine: L.initMin }
    )

    for (let j = i + 1; j < n; j++) {
      ctx.j = j
      const candidate = rec.arr[j]
      const current = rec.arr[ctx.min]
      const beats = better(candidate, current)

      rec.push(
        'compare',
        beats
          ? `a[${j}] = ${candidate} ${rel} a[${ctx.min}] = ${current}, so min moves to ${j}.`
          : `a[${j}] = ${candidate} does not beat a[${ctx.min}] = ${current}, so min stays at ${ctx.min}.`,
        { ...snapshot(ctx), rowStart: true, codeLine: L.test }
      )

      if (beats) {
        ctx.min = j
        rec.push('pointer-advance', `min is now ${j}, holding ${candidate}.`, {
          ...snapshot(ctx),
          codeLine: L.setMin,
        })
      }
    }

    ctx.j = null
    rec.push(
      'frame-exit',
      `The ${superlative} remaining value is ${rec.arr[ctx.min]} at position ${ctx.min}. Swap it into position ${i}.`,
      { ...snapshot(ctx), rowStart: true, codeLine: L.hold }
    )

    recordSwap(rec, i, ctx.min, snapshot(ctx), [L.hold, L.writeLeft, L.writeRight])

    ctx.sorted.add(i)
    ctx.prefix = i + 1
    ctx.min = null
    rec.push('mark-sorted', `Position ${i} is final: ${rec.arr[i]}.`, {
      ...snapshot(ctx),
      rowStart: true,
      codeLine: L.outer,
    })
  }

  ctx.i = null
  ctx.j = null
  ctx.min = null
  ctx.prefix = n
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
