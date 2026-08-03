/**
 * Sorting engine oracle tests (T-105).
 *
 * Run with: npm run test:sorting
 *
 * The unit suite checks the lecture trace. This one checks the properties that
 * have to hold for *every* run, over randomised input, because the defects that
 * matter here are invisible in a screenshot: an engine that quietly jumps two
 * moves in one frame, or one that loses a value halfway through a shift, still
 * ends with a sorted array and still looks fine at a glance.
 */

import { METHODS, expectedResult, traceSort } from './index.js'
import { MAX_VALUES } from './parseSortInput.js'

let passed = 0
const failures = []

function checkThat(name, condition, detail = '') {
  if (condition) passed++
  else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`)
}

/** Deterministic PRNG, so a failure is reproducible from its seed alone. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function bag(values) {
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
  return counts
}

function sameBag(a, b) {
  const ba = bag(a)
  const bb = bag(b)
  if (ba.size !== bb.size) return false
  for (const [value, count] of ba) if (bb.get(value) !== count) return false
  return true
}

/** How many positions two arrays of equal length disagree in. */
function diffCount(a, b) {
  let n = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n += 1
  return n
}

const METHOD_IDS = METHODS.map((m) => m.id)

/**
 * Worst observed step counts at the input cap are roughly bubble 1150, quick
 * 970, insertion 880, selection 540, merge 320, radix 105. These ceilings sit
 * about 40% above that: high enough not to trip on an ordinary tweak, low
 * enough to catch a change that makes a run unwatchable.
 */
const STEP_CEILING = {
  quick: 1400,
  merge: 500,
  radix: 300,
  bubble: 1600,
  insertion: 1300,
  selection: 800,
}

// ---------------------------------------------------------------------------
// 1. Randomised sortedness, both directions
// ---------------------------------------------------------------------------

const TRIALS = 500
const random = rng(20260803)

const failedRuns = { }
for (const method of METHOD_IDS) failedRuns[method] = []

for (let trial = 0; trial < TRIALS; trial++) {
  const length = 1 + Math.floor(random() * MAX_VALUES)
  const values = Array.from({ length }, () => {
    const magnitude = Math.floor(random() * 60)
    // Radix is handed non-negative input only; the parser refuses the rest, so
    // asking the engine to cope would be testing a path that cannot be reached.
    return random() < 0.3 ? -magnitude : magnitude
  })

  for (const method of METHOD_IDS) {
    const usable = method === 'radix' ? values.map(Math.abs) : values
    for (const direction of ['asc', 'desc']) {
      const steps = traceSort(usable, method, direction)
      const final = steps[steps.length - 1]?.array
      if (JSON.stringify(final) !== JSON.stringify(expectedResult(usable, direction))) {
        failedRuns[method].push(`${direction} [${usable.join(',')}] -> [${final?.join(',')}]`)
      }
    }
  }
}

for (const method of METHOD_IDS) {
  checkThat(
    `${method}: ${TRIALS} random arrays sort in both directions`,
    failedRuns[method].length === 0,
    failedRuns[method].slice(0, 3).join('\n      ')
  )
}

// ---------------------------------------------------------------------------
// 2. Atomicity: one cell changes per frame, at most
// ---------------------------------------------------------------------------
//
// This is the property a scrubber depends on and the one a screenshot cannot
// show. A three-beat swap moves one cell per beat; a merge take, an insertion
// shift and a bucket collect each write one cell. Anything that moves two at
// once has skipped a frame the visitor was supposed to see.

for (const method of METHOD_IDS) {
  const offenders = []
  for (const seed of [11, 47, 202, 777]) {
    const r = rng(seed)
    const values = Array.from({ length: 12 }, () => Math.floor(r() * 40))
    for (const direction of ['asc', 'desc']) {
      const steps = traceSort(values, method, direction)
      for (let n = 1; n < steps.length; n++) {
        const changed = diffCount(steps[n - 1].array, steps[n].array)
        if (changed > 1) {
          offenders.push(`${method}/${direction} step ${n} (${steps[n].type}) changed ${changed} cells`)
        }
      }
    }
  }
  checkThat(
    `${method}: no frame changes more than one cell`,
    offenders.length === 0,
    offenders.slice(0, 3).join('\n      ')
  )
}

// ---------------------------------------------------------------------------
// 3. Conservation
// ---------------------------------------------------------------------------
//
// Three regimes, because the honest invariant is not the same in all of them:
//
//   settled   nothing in flight, so the array alone is a permutation of the
//             input. This is where a dropped or duplicated value shows up.
//   in flight temp, a merge's runs, or a radix bucket is holding part of the
//             array. The array alone is legitimately not a permutation, so the
//             held part is added back before the comparison.
//
// Exempting the in-flight frames without checking them would leave the longest
// stretches of every run untested, which is why merge and radix get their own
// reconstruction below rather than a pass.

for (const method of METHOD_IDS) {
  const lost = []
  for (const seed of [3, 91, 500]) {
    const r = rng(seed)
    const source = Array.from({ length: 14 }, () => Math.floor(r() * 30))
    const values = method === 'radix' ? source : source.map((v, i) => (i % 4 === 0 ? -v : v))

    for (const direction of ['asc', 'desc']) {
      const steps = traceSort(values, method, direction)

      for (const step of steps) {
        if (step.array.length !== values.length) {
          lost.push(`${direction}: step ${step.id} changed the array length`)
          continue
        }

        if (step.runs) {
          const { low, high, left, right, i, j, k } = step.runs
          const held = [
            ...step.array.slice(0, low),
            ...step.array.slice(low, k),
            ...left.slice(i),
            ...right.slice(j),
            ...step.array.slice(high + 1),
          ]
          if (!sameBag(held, values)) lost.push(`${direction}: merge step ${step.id} lost a value`)
          continue
        }

        if (step.buckets) {
          const inBuckets = step.buckets.rows.flat()
          if (step.buckets.phase === 'collect') {
            const held = [...step.array.slice(0, step.buckets.collected), ...inBuckets]
            if (!sameBag(held, values)) lost.push(`${direction}: collect step ${step.id} lost a value`)
          } else if (!sameBag(step.array, values)) {
            lost.push(`${direction}: scatter step ${step.id} disturbed the array`)
          }
          continue
        }

        if (step.temp) {
          // One cell has been written over and its old value is in temp, so the
          // array plus temp covers the input with exactly one value doubled.
          const held = [...step.array, step.temp.value]
          const inputBag = bag(values)
          let covers = true
          for (const [value, count] of inputBag) {
            const have = held.filter((v) => v === value).length
            if (have < count) covers = false
          }
          if (!covers) lost.push(`${direction}: in-flight step ${step.id} lost a value`)
          continue
        }

        if (!sameBag(step.array, values)) {
          lost.push(`${direction}: settled step ${step.id} (${step.type}) is not a permutation`)
        }
      }
    }
  }

  checkThat(
    `${method}: no value is ever lost or duplicated`,
    lost.length === 0,
    lost.slice(0, 3).join('\n      ')
  )
}

// ---------------------------------------------------------------------------
// 4. Pointer sanity
// ---------------------------------------------------------------------------

for (const seed of [5, 64, 900]) {
  const r = rng(seed)
  const values = Array.from({ length: 11 }, () => Math.floor(r() * 50))
  for (const direction of ['asc', 'desc']) {
    const steps = traceSort(values, 'quick', direction)
    const strays = []
    let activeLow = 0
    let activeHigh = values.length - 1

    for (const step of steps) {
      const p = step.pointers || {}
      if (Number.isInteger(p.low)) activeLow = p.low
      if (Number.isInteger(p.high)) activeHigh = p.high

      // i may sit one before the range, which is the "has not entered yet"
      // state the descending lecture trace opens on and the canvas has to draw.
      if (Number.isInteger(p.i) && (p.i < activeLow - 1 || p.i > activeHigh)) {
        strays.push(`step ${step.id}: i=${p.i} outside [${activeLow - 1}, ${activeHigh}]`)
      }
      if (Number.isInteger(p.j) && (p.j < activeLow || p.j > activeHigh)) {
        strays.push(`step ${step.id}: j=${p.j} outside [${activeLow}, ${activeHigh}]`)
      }
      if (step.type === 'pointer-init' && p.pivot !== activeHigh) {
        strays.push(`step ${step.id}: pivot=${p.pivot} is not the range's last cell ${activeHigh}`)
      }
    }

    checkThat(
      `quick/${direction} seed ${seed}: pointers stay inside their frame`,
      strays.length === 0,
      strays.slice(0, 3).join('\n      ')
    )
  }
}

// Every step of every method carries the fields the canvas reads, so a missing
// one is caught here rather than as an undefined at render time.
for (const method of METHOD_IDS) {
  const steps = traceSort([9, 2, 7, 4, 4, 1], method, 'asc')
  const malformed = steps.filter(
    (s) =>
      !Number.isInteger(s.id) ||
      typeof s.type !== 'string' ||
      typeof s.description !== 'string' ||
      s.description.length === 0 ||
      !Array.isArray(s.array) ||
      s.algo !== method
  )
  checkThat(`${method}: every step is well formed`, malformed.length === 0, `${malformed.length} malformed`)

  const ids = steps.map((s) => s.id)
  checkThat(
    `${method}: step ids are sequential`,
    ids.every((id, n) => id === n),
    `ids started ${ids.slice(0, 5).join(',')}`
  )
}

// ---------------------------------------------------------------------------
// 5. Step budget at the input cap
// ---------------------------------------------------------------------------

for (const method of METHOD_IDS) {
  let worst = 0
  let worstInput = ''

  const candidates = [
    Array.from({ length: MAX_VALUES }, (_, i) => i + 1), // already sorted: quicksort's bad case
    Array.from({ length: MAX_VALUES }, (_, i) => MAX_VALUES - i), // reversed
    Array.from({ length: MAX_VALUES }, () => 7), // all equal
  ]
  const r = rng(4242)
  for (let trial = 0; trial < 60; trial++) {
    candidates.push(Array.from({ length: MAX_VALUES }, () => Math.floor(r() * 99)))
  }

  for (const values of candidates) {
    for (const direction of ['asc', 'desc']) {
      const count = traceSort(values, method, direction).length
      if (count > worst) {
        worst = count
        worstInput = `${direction} [${values.slice(0, 6).join(',')}...]`
      }
    }
  }

  checkThat(
    `${method}: stays under ${STEP_CEILING[method]} steps at ${MAX_VALUES} values`,
    worst <= STEP_CEILING[method],
    `worst was ${worst} on ${worstInput}`
  )
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✗ sorting oracle: ${failures.length} failure(s), ${passed} passed\n`)
  failures.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log(`✓ sorting oracle: ${passed} assertions passed`)
