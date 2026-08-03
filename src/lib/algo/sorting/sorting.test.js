/**
 * Sorting engine unit tests (T-105).
 *
 * Run with: npm run test:sorting
 *
 * The two quicksort tables here are the lecture material the tool was built to
 * reproduce, asserted iteration by iteration rather than on the final array
 * only. An engine can reach a sorted array by a completely different route, and
 * the route is the entire thing this tool exists to show.
 */

import { parseSortInput, MAX_VALUES, MIN_VALUES } from './parseSortInput.js'
import { pseudocodeFor, QUICK_LINES } from './pseudocode.js'
import traceQuickSort from './quickSort.js'
import { METHODS, expectedResult, traceSort } from './index.js'

let passed = 0
const failures = []

function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}\n      expected: ${e}\n      actual:   ${a}`)
}

function checkThat(name, condition, detail = '') {
  if (condition) passed++
  else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`)
}

// ---------------------------------------------------------------------------
// 1. The lecture trace, both directions
// ---------------------------------------------------------------------------

const LECTURE = [2, 8, 4, 7, 1, 3, 9, 6, 5]

/**
 * State at the end of each `j` iteration of the first partition.
 *
 * Built by keeping the *last* step carrying each `j`, which is what "after that
 * iteration" means: the compare, any pointer move and all three beats of the
 * swap all carry the same `j`, so the last of them is the settled state.
 */
function firstPartitionByJ(steps, high) {
  const byJ = new Map()
  for (const step of steps) {
    const j = step.pointers?.j
    if (j !== null && j !== undefined && j < high) {
      byJ.set(j, { i: step.pointers.i, array: step.array })
    }
    if (step.type === 'partition-done') break
  }
  return byJ
}

// [ j, i after, array after ]
const ASC_TABLE = [
  [0, 0, [2, 8, 4, 7, 1, 3, 9, 6, 5]],
  [1, 0, [2, 8, 4, 7, 1, 3, 9, 6, 5]],
  [2, 1, [2, 4, 8, 7, 1, 3, 9, 6, 5]],
  [3, 1, [2, 4, 8, 7, 1, 3, 9, 6, 5]],
  [4, 2, [2, 4, 1, 7, 8, 3, 9, 6, 5]],
  [5, 3, [2, 4, 1, 3, 8, 7, 9, 6, 5]],
  [6, 3, [2, 4, 1, 3, 8, 7, 9, 6, 5]],
  [7, 3, [2, 4, 1, 3, 8, 7, 9, 6, 5]],
]

const DESC_TABLE = [
  [0, -1, [2, 8, 4, 7, 1, 3, 9, 6, 5]],
  [1, 0, [8, 2, 4, 7, 1, 3, 9, 6, 5]],
  [2, 0, [8, 2, 4, 7, 1, 3, 9, 6, 5]],
  [3, 1, [8, 7, 4, 2, 1, 3, 9, 6, 5]],
  [4, 1, [8, 7, 4, 2, 1, 3, 9, 6, 5]],
  [5, 1, [8, 7, 4, 2, 1, 3, 9, 6, 5]],
  [6, 2, [8, 7, 9, 2, 1, 3, 4, 6, 5]],
  [7, 3, [8, 7, 9, 6, 1, 3, 4, 2, 5]],
]

for (const [direction, table, settled] of [
  ['asc', ASC_TABLE, [2, 4, 1, 3, 5, 7, 9, 6, 8]],
  ['desc', DESC_TABLE, [8, 7, 9, 6, 5, 3, 4, 2, 1]],
]) {
  const steps = traceQuickSort(LECTURE, direction)
  const byJ = firstPartitionByJ(steps, LECTURE.length - 1)

  for (const [j, i, array] of table) {
    const actual = byJ.get(j)
    check(`quick/${direction}: i after j=${j}`, actual?.i, i)
    check(`quick/${direction}: array after j=${j}`, actual?.array, array)
  }

  const partitionDone = steps.find((s) => s.type === 'partition-done')
  check(`quick/${direction}: first partition result`, partitionDone?.array, settled)
  check(`quick/${direction}: pivot lands at 4`, partitionDone?.pointers?.pivot, 4)
  check(`quick/${direction}: pivot is marked final`, partitionDone?.marks?.[4], 'pivot')
}

// The input array is never touched: the page hands the same array to the trace
// and to its own summary line, and a mutating engine would make those disagree.
const guarded = [...LECTURE]
traceQuickSort(guarded, 'asc')
check('quick: input array is not mutated', guarded, LECTURE)

// ---------------------------------------------------------------------------
// 2. Swap atomicity and the temp box
// ---------------------------------------------------------------------------

for (const method of ['quick', 'bubble', 'selection']) {
  const steps = traceSort(LECTURE, method, 'asc')
  let holds = 0
  let malformed = 0
  let tempLeaked = 0

  for (let n = 0; n < steps.length; n++) {
    if (steps[n].type !== 'swap-hold') continue
    holds += 1
    if (steps[n + 1]?.type !== 'swap-write-left' || steps[n + 2]?.type !== 'swap-write-right') {
      malformed += 1
      continue
    }
    // temp must hold across exactly the first two beats and be released on the
    // third. A temp that is still set afterwards means the canvas would keep
    // drawing a box holding a value that has already been put away.
    if (!steps[n].temp || !steps[n + 1].temp || steps[n + 2].temp) tempLeaked += 1
  }

  checkThat(`${method}: has swaps to check`, holds > 0, `holds=${holds}`)
  check(`${method}: every swap-hold is followed by both writes`, malformed, 0)
  check(`${method}: temp is held for exactly two beats`, tempLeaked, 0)
}

// A swap of a cell with itself collapses to one step rather than three beats of
// moving a value into the slot it already occupies.
const alreadySorted = traceSort([1, 2, 3, 4, 5], 'quick', 'asc')
checkThat(
  'quick: self-swaps collapse to swap-noop',
  alreadySorted.some((s) => s.type === 'swap-noop'),
  'no swap-noop emitted for an already-sorted input'
)
checkThat(
  'quick: a collapsed swap emits no temp',
  alreadySorted.filter((s) => s.type === 'swap-noop').every((s) => s.temp === null),
  'swap-noop carried a temp box'
)

// ---------------------------------------------------------------------------
// 3. Insertion sort shifts rather than swaps
// ---------------------------------------------------------------------------

const insertionSteps = traceSort(LECTURE, 'insertion', 'asc')
check(
  'insertion: emits no swaps',
  insertionSteps.filter((s) => s.type.startsWith('swap')).length,
  0
)
checkThat(
  'insertion: holds the key in temp while shifting',
  insertionSteps.filter((s) => s.type === 'shift').every((s) => s.temp !== null),
  'a shift step had no key in temp'
)

// ---------------------------------------------------------------------------
// 4. Every step points at a real line of its own listing
// ---------------------------------------------------------------------------

for (const method of METHODS.map((m) => m.id)) {
  for (const direction of ['asc', 'desc']) {
    const listing = pseudocodeFor(method, direction)
    const steps = traceSort(LECTURE, method, direction)
    const outOfRange = steps.filter(
      (s) => !Number.isInteger(s.codeLine) || s.codeLine < 0 || s.codeLine >= listing.length
    )
    check(`${method}/${direction}: every codeLine indexes the listing`, outOfRange.length, 0)
    checkThat(
      `${method}/${direction}: listing is non-empty`,
      listing.length > 0,
      `listing had ${listing.length} lines`
    )
  }
}

// The listing has to agree with the comparison the engine actually made, or the
// pane is teaching the opposite of what the canvas is showing.
checkThat(
  'quick/asc: listing tests <=',
  pseudocodeFor('quick', 'asc')[QUICK_LINES.test].includes('<='),
  pseudocodeFor('quick', 'asc')[QUICK_LINES.test]
)
checkThat(
  'quick/desc: listing tests >=',
  pseudocodeFor('quick', 'desc')[QUICK_LINES.test].includes('>='),
  pseudocodeFor('quick', 'desc')[QUICK_LINES.test]
)
checkThat(
  'radix/desc: listing collects 9 -> 0',
  pseudocodeFor('radix', 'desc').some((line) => line.includes('9 -> 0')),
  'descending radix listing still reads 0 -> 9'
)

// ---------------------------------------------------------------------------
// 5. Descending is not a no-op
// ---------------------------------------------------------------------------

// The failure this catches is a `direction` that is threaded through the UI and
// then never read. Every sortedness assertion still passes against an engine
// that always sorts ascending, because the ascending half of the suite is the
// half that runs first.
for (const method of METHODS.map((m) => m.id)) {
  const asc = traceSort(LECTURE, method, 'asc')
  const desc = traceSort(LECTURE, method, 'desc')
  const ascFinal = asc[asc.length - 1].array
  const descFinal = desc[desc.length - 1].array
  check(`${method}: ascending result`, ascFinal, expectedResult(LECTURE, 'asc'))
  check(`${method}: descending result`, descFinal, expectedResult(LECTURE, 'desc'))
  checkThat(
    `${method}: the two directions differ`,
    JSON.stringify(ascFinal) !== JSON.stringify(descFinal),
    'ascending and descending produced the same array'
  )
}

// Radix descending is the one that is not a flipped comparison: it collects the
// buckets 9 -> 0. Asserted on the collect steps, not just the final array,
// because a radix that secretly reversed the result at the end would pass the
// array check while animating a lie.
const radixDesc = traceSort([12, 21, 5, 50, 45], 'radix', 'desc')
const firstCollectDigits = []
for (const step of radixDesc) {
  if (step.type !== 'bucket-collect') continue
  const digit = Number(step.description.match(/bucket (\d)/)?.[1])
  firstCollectDigits.push(digit)
  if (step.pointers.k === 4) break
}
checkThat(
  'radix/desc: buckets are emptied from 9 downwards',
  firstCollectDigits.every((d, n) => n === 0 || d <= firstCollectDigits[n - 1]),
  `collect order was ${firstCollectDigits.join(', ')}`
)

// ---------------------------------------------------------------------------
// 6. Duplicates and negatives
// ---------------------------------------------------------------------------

const DUPES = [5, 3, 5, 1, 3, 5]
const NEGATIVES = [4, -7, 0, -2, 9, -7]

for (const method of METHODS.map((m) => m.id)) {
  for (const direction of ['asc', 'desc']) {
    const dupeSteps = traceSort(DUPES, method, direction)
    check(
      `${method}/${direction}: duplicates sort`,
      dupeSteps[dupeSteps.length - 1].array,
      expectedResult(DUPES, direction)
    )

    // Radix is excluded by the parser, not by the engine, so it is not asked to
    // do something it has already said it cannot.
    if (method === 'radix') continue
    const negSteps = traceSort(NEGATIVES, method, direction)
    check(
      `${method}/${direction}: negatives sort`,
      negSteps[negSteps.length - 1].array,
      expectedResult(NEGATIVES, direction)
    )
  }
}

// ---------------------------------------------------------------------------
// 7. Parser
// ---------------------------------------------------------------------------

check('parse: commas', parseSortInput('2, 8, 4', 'quick').values, [2, 8, 4])
check('parse: spaces alone', parseSortInput('2 8 4', 'quick').values, [2, 8, 4])
check('parse: mixed separators', parseSortInput('2,8 , 4,, 7', 'quick').values, [2, 8, 4, 7])
check('parse: negatives', parseSortInput('-3, 0, 5', 'quick').values, [-3, 0, 5])
check('parse: duplicates are kept', parseSortInput('5, 5, 5', 'quick').values, [5, 5, 5])

checkThat('parse: empty is rejected', parseSortInput('', 'quick').error !== null)
checkThat('parse: words are rejected', parseSortInput('2, banana, 4', 'quick').error !== null)
checkThat('parse: decimals are rejected', parseSortInput('2, 3.5, 4', 'quick').error !== null)
checkThat(
  'parse: exponent notation is rejected',
  parseSortInput('2, 1e3, 4', 'quick').error !== null,
  'Number("1e3") is 1000, which is not what was typed'
)

const tooFew = parseSortInput(Array(MIN_VALUES - 1).fill('1').join(','), 'quick')
checkThat('parse: below the minimum is rejected', tooFew.error !== null)
checkThat(
  'parse: the minimum itself is accepted',
  parseSortInput(Array(MIN_VALUES).fill('1').join(','), 'quick').error === null
)

const tooMany = parseSortInput(Array(MAX_VALUES + 1).fill('1').join(','), 'quick')
checkThat('parse: above the maximum is rejected', tooMany.error !== null)
checkThat(
  'parse: the error names the cap',
  (tooMany.error || '').includes(String(MAX_VALUES)),
  tooMany.error || ''
)
checkThat(
  'parse: the maximum itself is accepted',
  parseSortInput(Array(MAX_VALUES).fill('1').join(','), 'quick').error === null
)

const radixNeg = parseSortInput('4, -7, 9', 'radix')
checkThat('parse: radix rejects negatives', radixNeg.error !== null)
checkThat(
  'parse: the radix refusal says why',
  (radixNeg.error || '').toLowerCase().includes('digit'),
  radixNeg.error || ''
)
checkThat(
  'parse: other methods accept the same negatives',
  parseSortInput('4, -7, 9', 'quick').error === null
)

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✗ sorting: ${failures.length} failure(s), ${passed} passed\n`)
  failures.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log(`✓ sorting: ${passed} assertions passed`)
