/**
 * Oracle test for Quine-McCluskey (T-089).
 * Run with: npm run test:circuits
 *
 * Sweeps ALL 65 536 four-variable functions and checks three things against
 * reference implementations that share no code with the engine:
 *
 *   1. the prime-implicant set matches an independent 3^n cube scan
 *   2. the minimised expression agrees with the original truth table
 *   3. the cost equals an independent iterative-deepening minimum-cover search
 *
 * (1) is the strongest of the three. The tabular method and "enumerate every
 * cube, keep the maximal implicants" have nothing in common but their answer,
 * so agreeing on all 65 536 functions is close to a proof at n=4.
 *
 * Don't-cares are sampled rather than swept: 3^16 assignments is 43 million.
 */

import {
  minimize,
  findPrimeImplicants,
  expandCube,
  coverToExpression,
  coverToAst,
  implicantToTerm,
} from './quineMcCluskey.js'
import { tableFromMinterms } from './truthTable.js'
import { evaluate } from './expressionParser.js'

let failures = 0
const fail = (msg) => {
  failures++
  if (failures <= 20) console.error(`  FAIL: ${msg}`)
  if (failures === 21) console.error('  ... further failures suppressed')
}

// ---------------------------------------------------------------------------
// Reference implementations. Deliberately naive and deliberately not sharing
// anything with quineMcCluskey.js beyond the cube encoding.
// ---------------------------------------------------------------------------

/** Every cube over `width` variables, as [mask, value] pairs. */
function allCubes(width) {
  const cubes = []
  const build = (position, mask, value) => {
    if (position === width) { cubes.push([mask, value]); return }
    const bit = 1 << position
    build(position + 1, mask, value)              // variable fixed at 0
    build(position + 1, mask, value | bit)        // variable fixed at 1
    build(position + 1, mask | bit, value)        // variable eliminated
  }
  build(0, 0, 0)
  return cubes
}

/** Indices inside a cube, computed by scanning rather than by subset expansion. */
function cubeMembers(mask, value, width) {
  const out = []
  for (let i = 0; i < 2 ** width; i += 1) {
    if ((i & ~mask & (2 ** width - 1)) === value) out.push(i)
  }
  return out
}

/**
 * Prime implicants by definition: an implicant is a cube lying entirely inside
 * ones + don't-cares; it is prime when eliminating any one more variable stops
 * that being true.
 */
function referencePrimeImplicants(allowed, width) {
  const isImplicant = (mask, value) => cubeMembers(mask, value, width).every(m => allowed.has(m))

  const primes = []
  for (const [mask, value] of allCubes(width)) {
    if (!isImplicant(mask, value)) continue

    let maximal = true
    for (let bit = 0; bit < width; bit += 1) {
      if (mask & (1 << bit)) continue
      const grown = mask | (1 << bit)
      if (isImplicant(grown, value & ~(1 << bit))) { maximal = false; break }
    }
    if (maximal) primes.push([mask, value & ~mask])
  }
  return primes
}

/**
 * Minimum cover by iterative deepening over subset size. Independent of the
 * engine's branch and bound, and slow enough that it needs a budget.
 */
function referenceMinimumCost(primes, required, budget) {
  if (required.length === 0) return { terms: 0, literals: 0, complete: true }

  const usable = primes.filter(p => p.cares.length > 0)
  const coverage = usable.map(p => new Set(p.cares))
  let examined = 0

  for (let size = 1; size <= usable.length; size += 1) {
    let bestLiterals = Infinity
    const chosen = []

    const walk = (start) => {
      if (examined > budget) return
      if (chosen.length === size) {
        examined += 1
        for (const m of required) {
          if (!chosen.some(i => coverage[i].has(m))) return
        }
        const literals = chosen.reduce((sum, i) => sum + usable[i].literals, 0)
        if (literals < bestLiterals) bestLiterals = literals
        return
      }
      for (let i = start; i < usable.length; i += 1) {
        chosen.push(i)
        walk(i + 1)
        chosen.pop()
        if (examined > budget) return
      }
    }

    walk(0)
    if (examined > budget) return { complete: false }
    if (bestLiterals < Infinity) return { terms: size, literals: bestLiterals, complete: true }
  }

  return { complete: false }
}

/** Truth-table evaluation of a cover, straight from the implicant bits. */
function evaluateCover(cover, index, width, form) {
  if (cover.implicants.length === 0) return form === 'pos' ? 1 : 0

  const hits = cover.implicants.map((pi) => {
    const inside = (index & ~pi.mask & (2 ** width - 1)) === pi.value
    return inside
  })

  // In SOP the cover describes F directly. In POS it describes F', because the
  // implicants were found over the zeros, so the output is inverted.
  const any = hits.some(Boolean)
  return form === 'pos' ? (any ? 0 : 1) : (any ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Exhaustive sweep over every 4-variable function
// ---------------------------------------------------------------------------

const WIDTH = 4
const SIZE = 2 ** WIDTH
const VARS = ['A', 'B', 'C', 'D']

const started = Date.now()
let minimalityChecked = 0
let minimalitySkipped = 0

for (let bitmap = 0; bitmap < 2 ** SIZE; bitmap += 1) {
  const minterms = []
  for (let i = 0; i < SIZE; i += 1) if (bitmap & (1 << i)) minterms.push(i)

  const table = tableFromMinterms({ vars: VARS, minterms })
  const solution = minimize(table)

  // --- 1. prime implicants against the cube scan ---------------------------
  const reference = referencePrimeImplicants(new Set(minterms), WIDTH)
  const referenceKeys = new Set(reference.map(([mask, value]) => `${mask}:${value}`))
  const engineKeys = new Set(solution.primeImplicants.map(pi => `${pi.mask}:${pi.value}`))

  if (referenceKeys.size !== engineKeys.size || [...referenceKeys].some(k => !engineKeys.has(k))) {
    fail(`bitmap ${bitmap}: prime implicants differ (reference ${referenceKeys.size}, engine ${engineKeys.size})`)
  }

  // --- 2. equivalence ------------------------------------------------------
  const cover = solution.covers[0]
  for (let i = 0; i < SIZE; i += 1) {
    const expected = (bitmap >> i) & 1
    if (evaluateCover(cover, i, WIDTH, 'sop') !== expected) {
      fail(`bitmap ${bitmap}: cover disagrees at index ${i}`)
      break
    }
  }

  // --- 3. minimality -------------------------------------------------------
  const best = referenceMinimumCost(solution.primeImplicants, minterms, 200000)
  if (!best.complete) {
    minimalitySkipped += 1
  } else {
    minimalityChecked += 1
    if (best.terms !== cover.terms || best.literals !== cover.literals) {
      fail(`bitmap ${bitmap}: cost ${cover.terms}/${cover.literals} but minimum is ${best.terms}/${best.literals}`)
    }
  }

  // --- 4. every reported alternative is a real, equal-cost cover -----------
  for (const alt of solution.covers) {
    if (alt.terms !== cover.terms || alt.literals !== cover.literals) {
      fail(`bitmap ${bitmap}: alternative cover costs ${alt.terms}/${alt.literals}, not ${cover.terms}/${cover.literals}`)
      break
    }
    let mismatch = false
    for (let i = 0; i < SIZE && !mismatch; i += 1) {
      if (evaluateCover(alt, i, WIDTH, 'sop') !== ((bitmap >> i) & 1)) mismatch = true
    }
    if (mismatch) { fail(`bitmap ${bitmap}: alternative cover is not equivalent`); break }
  }

  // --- 5. essential implicants really are essential ------------------------
  for (const pi of solution.essential) {
    const others = solution.primeImplicants.filter(p => p !== pi && p.cares.length > 0)
    const soleCoverage = pi.cares.some(m => !others.some(p => p.cares.includes(m)))
    if (!soleCoverage) { fail(`bitmap ${bitmap}: ${pi.bits} marked essential but nothing needs it`); break }
  }

  if (failures > 40) break
}

const sweepMs = Date.now() - started
console.log(`  swept 65536 functions in ${(sweepMs / 1000).toFixed(1)}s`)
console.log(`  minimality verified on ${minimalityChecked}, skipped ${minimalitySkipped} over budget`)
if (minimalitySkipped > 0) {
  console.log('  (skips are reported rather than hidden: they are not silent passes)')
}

// ---------------------------------------------------------------------------
// Don't-cares: sampled, since 3^16 assignments cannot be swept
// ---------------------------------------------------------------------------

// Deterministic LCG so a failure is reproducible from the seed alone.
let seed = 20260801
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

let dcChecked = 0
for (let trial = 0; trial < 4000; trial += 1) {
  const width = 2 + (trial % 3)                 // 2, 3 and 4 variables
  const size = 2 ** width
  const vars = VARS.slice(0, width)

  const minterms = []
  const dontCares = []
  for (let i = 0; i < size; i += 1) {
    const roll = rand()
    if (roll < 0.35) minterms.push(i)
    else if (roll < 0.55) dontCares.push(i)
  }
  if (minterms.length === 0) continue

  const table = tableFromMinterms({ vars, minterms, dontCares })
  const solution = minimize(table)
  const cover = solution.covers[0]
  dcChecked += 1

  // Equivalence on the CARE set only. A don't-care row may come out either way,
  // and demanding a particular value there would be testing the wrong thing.
  const careOnes = new Set(minterms)
  const careZeros = new Set()
  for (let i = 0; i < size; i += 1) {
    if (!careOnes.has(i) && !dontCares.includes(i)) careZeros.add(i)
  }
  for (let i = 0; i < size; i += 1) {
    if (dontCares.includes(i)) continue
    const expected = careOnes.has(i) ? 1 : 0
    if (evaluateCover(cover, i, width, 'sop') !== expected) {
      fail(`don't-care trial ${trial}: disagrees at index ${i}`)
      break
    }
  }

  // Prime implicants must be computed over ones PLUS don't-cares.
  const allowed = new Set([...minterms, ...dontCares])
  const reference = referencePrimeImplicants(allowed, width)
  const referenceKeys = new Set(reference.map(([mask, value]) => `${mask}:${value}`))
  const engineKeys = new Set(solution.primeImplicants.map(pi => `${pi.mask}:${pi.value}`))
  if (referenceKeys.size !== engineKeys.size || [...referenceKeys].some(k => !engineKeys.has(k))) {
    fail(`don't-care trial ${trial}: prime implicants differ`)
  }

  // A prime implicant that covers only don't-cares must never be essential.
  for (const pi of solution.essential) {
    if (pi.cares.length === 0) fail(`don't-care trial ${trial}: ${pi.bits} covers nothing required but is essential`)
  }

  const best = referenceMinimumCost(solution.primeImplicants, minterms, 200000)
  if (best.complete && (best.terms !== cover.terms || best.literals !== cover.literals)) {
    fail(`don't-care trial ${trial}: cost ${cover.terms}/${cover.literals} but minimum is ${best.terms}/${best.literals}`)
  }
}
console.log(`  don't-care sampling: ${dcChecked} trials`)

// ---------------------------------------------------------------------------
// POS
// ---------------------------------------------------------------------------

for (let trial = 0; trial < 2000; trial += 1) {
  const width = 2 + (trial % 3)
  const size = 2 ** width
  const vars = VARS.slice(0, width)

  const minterms = []
  for (let i = 0; i < size; i += 1) if (rand() < 0.5) minterms.push(i)
  if (minterms.length === 0 || minterms.length === size) continue

  const table = tableFromMinterms({ vars, minterms })
  const solution = minimize(table, { form: 'pos' })
  const cover = solution.covers[0]

  const ones = new Set(minterms)
  for (let i = 0; i < size; i += 1) {
    if (evaluateCover(cover, i, width, 'pos') !== (ones.has(i) ? 1 : 0)) {
      fail(`pos trial ${trial}: disagrees at index ${i}`)
      break
    }
  }

  // The rendered POS expression must evaluate the same way as the raw cover,
  // which is what catches an inverted literal in implicantToTerm.
  const ast = coverToAst(cover, vars, 'pos')
  for (let i = 0; i < size; i += 1) {
    const assignment = {}
    vars.forEach((name, k) => { assignment[name] = (i >> (width - 1 - k)) & 1 })
    if (evaluate(ast, assignment) !== (ones.has(i) ? 1 : 0)) {
      fail(`pos trial ${trial}: rendered AST disagrees at index ${i}`)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Rendered SOP AST agrees with the cover, across the exhaustive 4-var space
// (sampled, since building an AST 65 536 times is the slow part)
// ---------------------------------------------------------------------------

for (let trial = 0; trial < 3000; trial += 1) {
  const bitmap = Math.floor(rand() * 2 ** SIZE)
  const minterms = []
  for (let i = 0; i < SIZE; i += 1) if (bitmap & (1 << i)) minterms.push(i)

  const table = tableFromMinterms({ vars: VARS, minterms })
  const solution = minimize(table)
  const ast = coverToAst(solution.covers[0], VARS, 'sop')

  for (let i = 0; i < SIZE; i += 1) {
    const assignment = {}
    VARS.forEach((name, k) => { assignment[name] = (i >> (WIDTH - 1 - k)) & 1 })
    if (evaluate(ast, assignment) !== ((bitmap >> i) & 1)) {
      fail(`sop ast trial ${trial}: disagrees at index ${i}`)
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Edge cases and known answers
// ---------------------------------------------------------------------------

const alwaysZero = minimize(tableFromMinterms({ vars: VARS, minterms: [] }))
if (alwaysZero.kind !== 'zero') fail('constant 0: kind')
if (coverToExpression(alwaysZero.covers[0], VARS) !== '0') fail('constant 0: expression')

const alwaysOne = minimize(tableFromMinterms({ vars: VARS, minterms: [...Array(16).keys()] }))
if (alwaysOne.kind !== 'one') fail('constant 1: kind')
if (coverToExpression(alwaysOne.covers[0], VARS) !== '1') fail('constant 1: expression')
if (alwaysOne.covers[0].literals !== 0) fail('constant 1: no literals')

// Don't-cares only, no ones: the function is 0, not "anything".
const dcOnly = minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [], dontCares: [0, 1, 2, 3] }))
if (coverToExpression(dcOnly.covers[0], ['A', 'B']) !== '0') fail("don't-cares only: should minimise to 0")

// The four-corner group: minterms 0, 2, 8, 10 of ABCD is B'D'. A grouping pass
// that cannot wrap both axes misses this entirely.
const corners = minimize(tableFromMinterms({ vars: VARS, minterms: [0, 2, 8, 10] }))
if (coverToExpression(corners.covers[0], VARS) !== "B'D'") {
  fail(`four corners: expected B'D', got ${coverToExpression(corners.covers[0], VARS)}`)
}

// The checkerboard has no groups at all: every minterm is isolated, so the
// minimum is eight four-literal terms.
const checker = minimize(tableFromMinterms({ vars: VARS, minterms: [0, 3, 5, 6, 9, 10, 12, 15] }))
if (checker.covers[0].terms !== 8) fail(`checkerboard: expected 8 terms, got ${checker.covers[0].terms}`)
if (checker.covers[0].literals !== 32) fail(`checkerboard: expected 32 literals, got ${checker.covers[0].literals}`)

// A textbook case with a genuine choice: F = Σm(0,1,2,5,6,7) over ABC has two
// equally minimal covers, and hiding one of them is what makes a student think
// their own answer is wrong.
const twoWays = minimize(tableFromMinterms({ vars: ['A', 'B', 'C'], minterms: [0, 1, 2, 5, 6, 7] }))
if (twoWays.covers.length < 2) fail(`Σm(0,1,2,5,6,7): expected multiple minimum covers, got ${twoWays.covers.length}`)
for (const alt of twoWays.covers) {
  if (alt.terms !== 3 || alt.literals !== 6) fail(`Σm(0,1,2,5,6,7): alternative costs ${alt.terms}/${alt.literals}`)
}

// Don't-cares that genuinely help: without them this needs two terms.
const helped = minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [1], dontCares: [3] }))
if (coverToExpression(helped.covers[0], ['A', 'B']) !== 'B') {
  fail(`don't-care combine: expected B, got ${coverToExpression(helped.covers[0], ['A', 'B'])}`)
}

// Single-variable function.
const single = minimize(tableFromMinterms({ vars: ['A'], minterms: [1] }))
if (coverToExpression(single.covers[0], ['A']) !== 'A') fail('single variable: expected A')

// expandCube and the reference member scan must agree.
for (const [mask, value] of allCubes(4)) {
  const a = expandCube(mask, value & ~mask, 4).join(',')
  const b = cubeMembers(mask, value & ~mask, 4).join(',')
  if (a !== b) { fail(`expandCube disagrees for mask ${mask} value ${value}`); break }
}

// implicantToTerm sense: bits '10--' over ABCD is AB' in SOP, (A'+B) in POS.
const term = { mask: 0b0011, value: 0b1000, bits: '10--', literals: 2 }
if (implicantToTerm(term, VARS, 'sop').text !== "AB'") {
  fail(`implicantToTerm sop: got ${implicantToTerm(term, VARS, 'sop').text}`)
}
if (implicantToTerm(term, VARS, 'pos').text !== "(A' + B)") {
  fail(`implicantToTerm pos: got ${implicantToTerm(term, VARS, 'pos').text}`)
}

if (failures === 0) console.log('quineMcCluskey: all tests passed')
else { console.error(`quineMcCluskey: ${failures} failure(s)`); process.exit(1) }
