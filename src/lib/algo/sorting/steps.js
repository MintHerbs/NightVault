// src/lib/algo/sorting/steps.js
//
// The step contract every sorting engine emits against, and the recorder that
// builds it (T-105).
//
// Modelled on src/engine/AnimationEngine.js: each step carries a full snapshot
// of the array as it stood at that moment rather than a description of a
// mutation to apply. That is what lets the transport's scrubber run backwards
// without an undo path — a frame is a picture, not a diff — and it is why the
// canvas never has to replay history to draw step 40.

/** Sort direction. `desc` is one flipped comparison, never a second loop. */
export const ASC = 'asc'
export const DESC = 'desc'

/**
 * The comparator every engine reads. Returns true when `a` should come before
 * `b` under the current direction.
 *
 * Resolved once per run and threaded down. An engine that inlines `<` anywhere
 * has a direction bug waiting in it, which is exactly what the
 * "descending is not a no-op" test exists to catch.
 */
export function comparator(direction) {
  return direction === DESC ? (a, b) => a > b : (a, b) => a < b
}

/** `a` belongs on the pivot's near side: `<=` ascending, `>=` descending. */
export function belongsBefore(direction) {
  return direction === DESC ? (a, pivot) => a >= pivot : (a, pivot) => a <= pivot
}

/** The comparison symbol to print in a step description, for this direction. */
export function relSymbol(direction) {
  return direction === DESC ? '≥' : '≤'
}

/**
 * Recorder shared by all six engines.
 *
 * `arr` is live and mutated by the engine; every `push` clones it. Engines must
 * never hand out the live reference, and never mutate a recorded snapshot.
 */
export function createRecorder(arr, { algo, direction }) {
  const steps = []
  let id = 0

  return {
    arr,
    steps,
    push(type, description, extra = {}) {
      steps.push({
        id: id++,
        algo,
        direction,
        type,
        array: [...arr],
        // History grouping. `rowStart` opens a new row in the stacked history
        // the canvas draws; every step after it, up to the next rowStart,
        // belongs to that row and updates it in place. `pass` groups rows under
        // one bracket. Both are inert for quicksort, which draws its recursion
        // tree instead.
        rowStart: false,
        pass: 0,
        passLabel: '',
        pointers: null,
        marks: null,
        ranges: null,
        frames: null,
        temp: null,
        buckets: null,
        codeLine: 0,
        description,
        ...extra,
      })
    },
  }
}

/**
 * Emit a swap as the three beats a student is taught, through an explicit
 * `temp`, because `temp` is the part of the lesson a single-frame swap erases.
 *
 * The three beats deliberately carry no `rowStart`: they belong to the row the
 * comparison that caused them opened, so the history shows one row per look at
 * the array rather than four rows per swap.
 *
 * A self-swap collapses to one step. Without that, an already-ordered input
 * spends most of its animation moving values into the slots they are already
 * in, and the visitor learns that sorting is mostly shuffling.
 *
 * @param {object} rec        recorder from createRecorder
 * @param {number} a          index
 * @param {number} b          index
 * @param {object} frameState pointers/marks/ranges/frames to repeat on all three steps
 * @param {number[]} lines    [hold, writeLeft, writeRight] pseudocode lines
 */
export function recordSwap(rec, a, b, frameState, lines) {
  const [holdLine, leftLine, rightLine] = lines
  const va = rec.arr[a]
  const vb = rec.arr[b]

  if (a === b) {
    rec.push('swap-noop', `${va} is already in position ${a}, so no swap is needed`, {
      ...frameState,
      codeLine: holdLine,
    })
    return
  }

  rec.push('swap-hold', `temp holds ${va} from position ${a}`, {
    ...frameState,
    temp: { value: va, from: a },
    codeLine: holdLine,
  })

  rec.arr[a] = vb
  rec.push('swap-write-left', `${vb} moves from position ${b} into position ${a}`, {
    ...frameState,
    temp: { value: va, from: a },
    codeLine: leftLine,
  })

  rec.arr[b] = va
  rec.push('swap-write-right', `temp puts ${va} into position ${b}`, {
    ...frameState,
    temp: null,
    codeLine: rightLine,
  })
}

/** Mark helper: `{ [index]: role }` built from sparse pairs, skipping nulls. */
export function marksOf(pairs) {
  const marks = {}
  for (const [index, role] of pairs) {
    if (index === null || index === undefined || index < 0) continue
    marks[index] = role
  }
  return marks
}
