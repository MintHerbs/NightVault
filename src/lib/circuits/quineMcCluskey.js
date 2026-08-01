/**
 * Quine-McCluskey minimisation with don't-cares (T-089).
 *
 * This is the engine; the K-map is only the display. Finding groups by scanning
 * the drawn grid for rectangles is the obvious approach and it is wrong: the map
 * wraps on both axes, so greedy rectangle-finding misses minimum covers and the
 * four-corner group in particular. Prime implicants are computed algebraically
 * here and projected back onto the map by kmapLayout.js.
 *
 * Two rules about don't-cares that are easy to get backwards, and both change
 * the answer:
 *   - they DO take part in combining, which is what makes them worth having;
 *   - they are NEVER cover obligations, so a prime implicant that covers only
 *     don't-cares is never essential and never needed.
 *
 * A cube is stored as {mask, value}: `mask` has a 1 wherever the variable was
 * eliminated, `value` holds the fixed bits. Bit position i counts from the LSB,
 * and variable k (MSB first, matching TruthTable.vars) sits at bit width-1-k.
 */

// Enumerating every minimum cover can blow up combinatorially on adversarial
// inputs. The search reports whether it finished rather than silently returning
// "the" minimum it happened to reach.
const NODE_BUDGET = 200000
const MAX_ALTERNATIVES = 12

/**
 * @typedef {Object} Implicant
 * @property {number} mask     1 bits mark eliminated variables
 * @property {number} value    fixed bits
 * @property {string} bits     display form, MSB first, '-' for eliminated
 * @property {number[]} covers every index in the cube, don't-cares included
 * @property {number[]} cares  the required minterms in the cube
 * @property {number} literals count of variables still present
 */

/**
 * @typedef {Object} Solution
 * @property {'sop'|'pos'} form
 * @property {string[]} vars
 * @property {Implicant[]} primeImplicants
 * @property {Implicant[]} essential
 * @property {Array<{implicants: Implicant[], terms: number, literals: number}>} covers
 * @property {boolean} exhaustive   false when the search hit its budget
 * @property {'expression'|'zero'|'one'} kind
 */

/**
 * Minimises a truth table.
 *
 * @param {import('./truthTable.js').TruthTable} table
 * @param {{form?: 'sop'|'pos'}} [options]
 * @returns {Solution}
 */
export function minimize(table, { form = 'sop' } = {}) {
  const width = table.vars.length

  // POS is the same problem asked of the zeros. Minimise F' as a sum of
  // products, then De Morgan turns each product into a sum factor at display
  // time. Don't-cares stay don't-cares in both directions.
  const ones = form === 'pos' ? table.maxterms : table.minterms
  const dontCares = table.dontCares

  const result = minimizeOnes(ones, dontCares, width)
  return { ...result, form, vars: table.vars }
}

function minimizeOnes(ones, dontCares, width) {
  const size = 2 ** width

  if (ones.length === 0) {
    return { primeImplicants: [], essential: [], covers: [{ implicants: [], terms: 0, literals: 0 }], exhaustive: true, kind: 'zero' }
  }
  // Every care row is a 1, so the function is the constant 1 and the single
  // prime implicant is the all-eliminated cube.
  if (ones.length + dontCares.length === size) {
    const all = makeImplicant(size - 1, 0, width, new Set(ones))
    return { primeImplicants: [all], essential: [all], covers: [{ implicants: [all], terms: 1, literals: 0 }], exhaustive: true, kind: 'one' }
  }

  const careSet = new Set(ones)
  const primes = findPrimeImplicants([...ones, ...dontCares], width, careSet)

  // A prime implicant covering nothing required can never help. Dropping it
  // here keeps it out of the cover search and out of the "alternatives" count,
  // where it would otherwise generate cosmetically different equal-cost covers.
  const useful = primes.filter(p => p.cares.length > 0)

  const { essential, covers, exhaustive } = selectCovers(useful, ones)

  return { primeImplicants: primes, essential, covers, exhaustive, kind: 'expression' }
}

// ---------------------------------------------------------------------------
// Prime implicants
// ---------------------------------------------------------------------------

/**
 * Standard tabular method: repeatedly combine cubes that differ in exactly one
 * fixed bit. Anything never combined is prime.
 */
export function findPrimeImplicants(terms, width, careSet) {
  const size = 2 ** width
  let current = new Map()
  for (const term of terms) {
    if (term < 0 || term >= size) continue
    current.set(key(0, term), { mask: 0, value: term })
  }

  const primes = new Map()

  while (current.size > 0) {
    const next = new Map()
    const combined = new Set()

    // Group by mask first: two cubes can only combine if the same variables
    // were eliminated. Within a mask, group by population count so each cube is
    // only compared against the adjacent count class.
    const byMask = new Map()
    for (const [id, cube] of current) {
      if (!byMask.has(cube.mask)) byMask.set(cube.mask, new Map())
      const groups = byMask.get(cube.mask)
      const ones = popcount(cube.value)
      if (!groups.has(ones)) groups.set(ones, [])
      groups.get(ones).push({ id, cube })
    }

    for (const [mask, groups] of byMask) {
      const counts = [...groups.keys()].sort((a, b) => a - b)
      for (const count of counts) {
        const lower = groups.get(count)
        const upper = groups.get(count + 1)
        if (!upper) continue
        for (const a of lower) {
          for (const b of upper) {
            const diff = a.cube.value ^ b.cube.value
            if (diff === 0 || (diff & (diff - 1)) !== 0) continue
            combined.add(a.id)
            combined.add(b.id)
            const merged = { mask: mask | diff, value: a.cube.value & ~diff }
            next.set(key(merged.mask, merged.value), merged)
          }
        }
      }
    }

    for (const [id, cube] of current) {
      if (!combined.has(id)) primes.set(key(cube.mask, cube.value), cube)
    }

    current = next
  }

  return [...primes.values()]
    .map(cube => makeImplicant(cube.mask, cube.value, width, careSet))
    .sort((a, b) => a.literals - b.literals || a.value - b.value)
}

function makeImplicant(mask, value, width, careSet) {
  const covers = expandCube(mask, value, width)
  return {
    mask,
    value,
    bits: cubeToBits(mask, value, width),
    covers,
    cares: covers.filter(m => careSet.has(m)),
    literals: width - popcount(mask),
  }
}

/** Every index inside the cube: iterate the subsets of the eliminated bits. */
export function expandCube(mask, value, width) {
  const out = []
  const bits = []
  for (let i = 0; i < width; i += 1) if (mask & (1 << i)) bits.push(i)

  for (let s = 0; s < 2 ** bits.length; s += 1) {
    let index = value
    bits.forEach((bit, k) => { if (s & (1 << k)) index |= (1 << bit) })
    out.push(index)
  }
  return out.sort((a, b) => a - b)
}

/** Display form, MSB first so it lines up with TruthTable.vars. */
export function cubeToBits(mask, value, width) {
  let out = ''
  for (let k = 0; k < width; k += 1) {
    const bit = width - 1 - k
    if (mask & (1 << bit)) out += '-'
    else out += (value >> bit) & 1
  }
  return out
}

const key = (mask, value) => `${mask}:${value}`

function popcount(n) {
  let count = 0
  let v = n
  while (v) { v &= v - 1; count += 1 }
  return count
}

// ---------------------------------------------------------------------------
// Cover selection
// ---------------------------------------------------------------------------

/**
 * Essential prime implicants, then an exact minimum cover of what is left.
 *
 * Cost is fewest product terms first, then fewest total literals. Other
 * tie-breaks give a different "minimal" answer, which is why the UI states this
 * one rather than leaving the student to guess why their grouping differs.
 */
function selectCovers(primes, requiredMinterms) {
  const required = [...requiredMinterms]
  const indexOf = new Map(required.map((m, i) => [m, i]))

  // Coverage as a bitset over required minterms only. Words rather than one
  // number because 8 variables means up to 256 obligations.
  const words = Math.max(1, Math.ceil(required.length / 32))
  const coverageOf = new Map()
  for (const pi of primes) {
    const set = new Uint32Array(words)
    for (const m of pi.cares) {
      const i = indexOf.get(m)
      if (i !== undefined) set[i >> 5] |= (1 << (i & 31))
    }
    coverageOf.set(pi, set)
  }

  // A minterm covered by exactly one prime implicant forces that implicant into
  // every cover, minimum or not.
  const coveringPis = required.map(m => primes.filter(pi => indexOf.has(m) && pi.cares.includes(m)))
  const essential = []
  const seen = new Set()
  coveringPis.forEach((list) => {
    if (list.length === 1 && !seen.has(list[0])) {
      seen.add(list[0])
      essential.push(list[0])
    }
  })

  const covered = new Uint32Array(words)
  for (const pi of essential) orInto(covered, coverageOf.get(pi))

  const remaining = required.filter((m, i) => !bitSet(covered, i))
  if (remaining.length === 0) {
    return {
      essential,
      covers: [buildCover(essential)],
      exhaustive: true,
    }
  }

  // Only implicants that still cover something matter from here.
  const candidates = primes.filter(pi => !seen.has(pi) && pi.cares.some(m => remaining.includes(m)))
  const search = searchMinimumCovers(candidates, remaining, coverageOf, indexOf, words, covered)

  const covers = search.covers.map(extra => buildCover([...essential, ...extra]))
  const deduped = dedupeCovers(covers)

  return {
    essential,
    covers: deduped.length > 0 ? deduped.slice(0, MAX_ALTERNATIVES) : [buildCover(essential)],
    exhaustive: search.exhaustive && deduped.length <= MAX_ALTERNATIVES,
  }
}

/**
 * Branch and bound over the uncovered minterms, most-constrained first.
 *
 * Chosen over Petrick's method because the bound is explicit: Petrick's product
 * expansion has no natural place to stop when it explodes, and stopping it
 * halfway yields a wrong answer rather than a flagged one.
 */
function searchMinimumCovers(candidates, remaining, coverageOf, indexOf, words, alreadyCovered) {
  let bestTerms = Infinity
  let bestLiterals = Infinity
  let found = []
  let nodes = 0
  let exhaustive = true

  const branchesFor = new Map()
  for (const m of remaining) {
    branchesFor.set(m, candidates.filter(pi => pi.cares.includes(m)))
  }

  const recurse = (covered, chosen, literals) => {
    nodes += 1
    if (nodes > NODE_BUDGET) { exhaustive = false; return }

    // Cheapest useful bound: any unfinished branch needs at least one more term.
    const uncovered = remaining.filter(m => !bitSet(covered, indexOf.get(m)))
    if (uncovered.length === 0) {
      if (chosen.length < bestTerms || (chosen.length === bestTerms && literals < bestLiterals)) {
        bestTerms = chosen.length
        bestLiterals = literals
        found = [[...chosen]]
      } else if (chosen.length === bestTerms && literals === bestLiterals) {
        found.push([...chosen])
      }
      return
    }

    if (chosen.length + 1 > bestTerms) return
    if (chosen.length + 1 === bestTerms && literals >= bestLiterals) return

    // Branching on the minterm with the fewest options keeps the tree narrow
    // and makes duplicate orderings much less likely.
    let target = uncovered[0]
    let fewest = Infinity
    for (const m of uncovered) {
      const options = branchesFor.get(m).length
      if (options < fewest) { fewest = options; target = m }
    }

    for (const pi of branchesFor.get(target)) {
      const nextCovered = new Uint32Array(covered)
      orInto(nextCovered, coverageOf.get(pi))
      chosen.push(pi)
      recurse(nextCovered, chosen, literals + pi.literals)
      chosen.pop()
      if (nodes > NODE_BUDGET) return
    }
  }

  recurse(new Uint32Array(alreadyCovered), [], 0)

  return { covers: found, exhaustive }
}

function buildCover(implicants) {
  const sorted = [...implicants].sort((a, b) => a.value - b.value || a.mask - b.mask)
  return {
    implicants: sorted,
    terms: sorted.length,
    literals: sorted.reduce((sum, pi) => sum + pi.literals, 0),
  }
}

function dedupeCovers(covers) {
  const seen = new Set()
  const out = []
  for (const cover of covers) {
    const id = cover.implicants.map(pi => key(pi.mask, pi.value)).join('|')
    if (seen.has(id)) continue
    seen.add(id)
    out.push(cover)
  }
  return out
}

const bitSet = (set, i) => (set[i >> 5] & (1 << (i & 31))) !== 0

function orInto(target, source) {
  for (let i = 0; i < target.length; i += 1) target[i] |= source[i]
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * One implicant as literals.
 *
 * In SOP a 0 bit means the complemented variable; in POS the whole thing is
 * De Morgan'd, so the sense flips and the term is a sum. That single inversion
 * is the entire difference between the two outputs.
 *
 * @returns {{literals: Array<{name: string, negated: boolean}>, text: string}}
 */
export function implicantToTerm(implicant, vars, form = 'sop') {
  const width = vars.length
  const literals = []

  for (let k = 0; k < width; k += 1) {
    const bit = width - 1 - k
    if (implicant.mask & (1 << bit)) continue
    const isOne = ((implicant.value >> bit) & 1) === 1
    literals.push({ name: vars[k], negated: form === 'pos' ? isOne : !isOne })
  }

  if (literals.length === 0) return { literals, text: form === 'pos' ? '0' : '1' }

  const text = form === 'pos'
    ? `(${literals.map(l => l.name + (l.negated ? "'" : '')).join(' + ')})`
    : literals.map(l => l.name + (l.negated ? "'" : '')).join('')

  return { literals, text }
}

/**
 * The minimised expression for one cover.
 * @returns {string}
 */
export function coverToExpression(cover, vars, form = 'sop') {
  if (cover.implicants.length === 0) return form === 'pos' ? '1' : '0'

  const terms = cover.implicants.map(pi => implicantToTerm(pi, vars, form))

  // The all-eliminated cube is the constant, and a constant absorbs everything
  // beside it: F = 1 + AB is just 1.
  if (terms.some(t => t.literals.length === 0)) return form === 'pos' ? '0' : '1'

  return form === 'pos' ? terms.map(t => t.text).join('') : terms.map(t => t.text).join(' + ')
}

/**
 * The minimised expression as an AST, so circuit synthesis and re-evaluation
 * share one representation with the parser.
 * @returns {Object}
 */
export function coverToAst(cover, vars, form = 'sop') {
  if (cover.implicants.length === 0) return { type: 'const', value: form === 'pos' ? 1 : 0 }

  const groups = cover.implicants.map(pi => {
    const { literals } = implicantToTerm(pi, vars, form)
    if (literals.length === 0) return { type: 'const', value: form === 'pos' ? 0 : 1 }
    const operands = literals.map(l => (
      l.negated ? { type: 'not', child: { type: 'var', name: l.name } } : { type: 'var', name: l.name }
    ))
    const inner = operands.length === 1 ? operands[0] : { type: form === 'pos' ? 'or' : 'and', operands }
    return inner
  })

  if (groups.some(g => g.type === 'const')) return { type: 'const', value: form === 'pos' ? 0 : 1 }
  if (groups.length === 1) return groups[0]
  return { type: form === 'pos' ? 'and' : 'or', operands: groups }
}
