/**
 * Boolean algebra rewrite fuzz test (T-089 phase 4).
 * Run with: npm run test:circuits
 *
 * The invariant that matters: EVERY INDIVIDUAL STEP preserves the truth table.
 * A rule with a typo in it produces a chain that looks like working and ends at
 * a different function, and nothing downstream would catch it. Checking the
 * whole chain end to end is not enough either, because two compensating bugs
 * would pass; each step is checked against the one before it.
 */

import { simplify, neighbours, sameFunction, cost } from './algebraSimplifier.js'
import { LAWS, same } from './booleanLaws.js'
import { parseExpression, collectVariables, evaluate, formatExpression } from './expressionParser.js'
import { buildTruthTable } from './truthTable.js'
import { minimize, coverToExpression } from './quineMcCluskey.js'

let failures = 0
const fail = (msg) => {
  failures++
  if (failures <= 20) console.error(`  FAIL: ${msg}`)
}
const assert = (cond, msg) => { if (!cond) fail(msg) }

// --- Random expression generator ---------------------------------------------

let seed = 20260801
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const pick = (list) => list[Math.floor(rand() * list.length)]

function randomAst(vars, depth) {
  if (depth <= 0 || rand() < 0.32) {
    const node = { type: 'var', name: pick(vars) }
    return rand() < 0.32 ? { type: 'not', child: node } : node
  }
  const type = pick(['and', 'or', 'and', 'or', 'xor'])
  const count = 2 + (rand() < 0.25 ? 1 : 0)
  const operands = Array.from({ length: count }, () => randomAst(vars, depth - 1))
  const node = { type, operands }
  return rand() < 0.14 ? { type: 'not', child: node } : node
}

// --- Every law preserves the function, applied anywhere ----------------------

let rewritesChecked = 0
for (let trial = 0; trial < 3000; trial += 1) {
  const vars = ['A', 'B', 'C', 'D'].slice(0, 2 + Math.floor(rand() * 3))
  const ast = randomAst(vars, 3)
  const names = collectVariables(ast)
  if (names.length === 0) continue

  for (const move of neighbours(ast)) {
    rewritesChecked += 1
    if (!sameFunction(ast, move.node, names)) {
      fail(`law "${move.law}" changed the function: ${formatExpression(ast)} became ${formatExpression(move.node)}`)
      break
    }
  }
  if (failures > 10) break
}
console.log(`  checked ${rewritesChecked} individual rewrites`)

// --- Full runs: every step preserves the function ----------------------------

let runs = 0
let reachedMinimum = 0
for (let trial = 0; trial < 700 && failures <= 10; trial += 1) {
  const vars = ['A', 'B', 'C', 'D'].slice(0, 2 + Math.floor(rand() * 3))
  const ast = randomAst(vars, 3)
  if (collectVariables(ast).length === 0) continue

  const run = simplify(ast)
  runs += 1
  if (run.reachedMinimum) reachedMinimum += 1

  // Step-by-step, not just end to end: two compensating bugs would survive an
  // end-to-end check.
  let previous = run.start
  for (const [i, step] of run.steps.entries()) {
    if (step.from !== previous) {
      fail(`trial ${trial} step ${i}: chain is broken, "${step.from}" does not follow "${previous}"`)
      break
    }
    let before
    let after
    try {
      before = parseExpression(step.from)
      after = parseExpression(step.to)
    } catch (err) {
      fail(`trial ${trial} step ${i}: rendered form does not re-parse (${err.message})`)
      break
    }
    if (!sameFunction(before, after)) {
      fail(`trial ${trial} step ${i} (${step.law}): "${step.from}" is not "${step.to}"`)
      break
    }
    previous = step.to
  }

  if (run.steps.length > 0 && previous !== run.result) {
    fail(`trial ${trial}: the last step does not land on the reported result`)
  }

  // The reported result must be the original function.
  assert(run.confirmed, `trial ${trial}: run reported itself unconfirmed`)
  assert(sameFunction(ast, parseExpression(run.result)), `trial ${trial}: result is a different function`)

  // The minimal form quoted from the K-map must be the same function.
  assert(sameFunction(ast, parseExpression(run.minimal)), `trial ${trial}: quoted minimal form is wrong`)

  // It must NOT be asserted that the rewrite chain never beats it. The K-map
  // gives the minimal SUM OF PRODUCTS, and Factoring and XOR go below that by
  // leaving SOP entirely: A(B + C) is three literals where the minimal SOP
  // AB + AC is four. So `reachedMinimum` means "matched or beat the SOP floor".
  const minimalCost = cost(parseExpression(run.minimal)).literals
  const resultCost = cost(parseExpression(run.result)).literals
  assert(run.reachedMinimum === (resultCost <= minimalCost),
    `trial ${trial}: reachedMinimum (${run.reachedMinimum}) disagrees with the costs (${resultCost} vs ${minimalCost})`)
}

console.log(`  ${runs} full runs, ${Math.round((reachedMinimum / runs) * 100)}% reached the K-map minimum algebraically`)

// --- Named cases -------------------------------------------------------------

function run(source) {
  return simplify(parseExpression(source))
}

function lawsUsed(result) {
  return new Set(result.steps.map(s => s.law))
}

{
  const r = run("AB + AB'")
  assert(r.result === 'A', `1: AB + AB' should be A, got ${r.result}`)
  assert(lawsUsed(r).has('Combining'), '1: and should name Combining')
}

{
  const r = run('A + AB')
  assert(r.result === 'A', `2: A + AB should be A, got ${r.result}`)
  assert(lawsUsed(r).has('Absorption law'), '2: and should name Absorption law')
}

{
  const r = run("A + A'B")
  assert(r.result === 'A + B', `3: A + A'B should be A + B, got ${r.result}`)
}

{
  const r = run("(AB)'")
  assert(r.confirmed, '4: De Morgan preserves the function')
  assert(sameFunction(parseExpression("(AB)'"), parseExpression(r.result)), '4: and the result matches')
}

{
  const r = run("A''")
  assert(r.result === 'A', `5: double complement folds, got ${r.result}`)
  assert(lawsUsed(r).has('Involution'), '5: and should name Involution')
}

{
  const r = run("AA'")
  assert(r.result === '0', `6: AA' is 0, got ${r.result}`)
}

{
  const r = run("A + A'")
  assert(r.result === '1', `7: A + A' is 1, got ${r.result}`)
}

{
  const r = run("AB + A'C + BC")
  assert(r.reachedMinimum, '8: the consensus case reaches the minimum')
  assert(cost(parseExpression(r.result)).literals === 4, `8: expected 4 literals, got ${r.result}`)
}

{
  // Already minimal: no steps, and it must not claim otherwise.
  const r = run("AB' + BC")
  assert(r.steps.length === 0, `9: an already-minimal expression needs no steps, got ${r.steps.length}`)
  assert(r.reachedMinimum, '9: and is reported as minimal')
}

{
  const r = run("A'B'C' + A'B'C + A'BC + ABC")
  assert(r.confirmed, '10: a four-term expression is preserved')
  assert(sameFunction(parseExpression("A'B'C' + A'B'C + A'BC + ABC"), parseExpression(r.minimal)),
    '10: and its K-map minimum is the same function')
}

// A constant expression.
{
  const r = run('A + 1')
  assert(r.result === '1', `11: A + 1 is 1, got ${r.result}`)
}

// Every step carries the fields the UI renders.
{
  const r = run("AB + AB' + A'B")
  for (const step of r.steps) {
    assert(typeof step.law === 'string' && step.law.length > 0, '12: every step names a law')
    assert(typeof step.statement === 'string' && step.statement.length > 0, '12: and states it')
    assert(typeof step.focusFrom === 'string' && typeof step.focusTo === 'string',
      '12: and marks what was rewritten')
  }
}

// Every law in the table is reachable by at least one input, so a rule that can
// never fire shows up here rather than sitting dead in the file.
{
  const probes = [
    'A · 1', 'A + 0', 'A · 0', 'A + 1', 'AA', 'A + A', "AA'", "A + A'", "A''",
    "AB + AB'", 'A + AB', "A + A'B", "AB + A'C + BC", "(AB)'", 'A(B + C)',
    'AB + AC', "AB' + A'B",
  ]
  const fired = new Set()
  for (const probe of probes) {
    for (const move of neighbours(parseExpression(probe))) fired.add(move.law)
  }
  for (const law of LAWS) {
    assert(fired.has(law.name), `13: law "${law.name}" never fires on any probe`)
  }
}

// `same()` is the structural comparison the laws lean on.
assert(same(parseExpression('AB'), parseExpression('BA')), '14: AND is compared commutatively')
assert(!same(parseExpression('AB'), parseExpression('AC')), '14: and still distinguishes operands')
assert(same(parseExpression("A'"), parseExpression("A'")), '14: complements compare equal')

// Termination: a deliberately awful input must still come back.
{
  const started = Date.now()
  const r = run("(A + B)(C + D)(A' + C)(B' + D')")
  const elapsed = Date.now() - started
  assert(elapsed < 15000, `15: a hard input finished in ${elapsed}ms`)
  assert(r.confirmed, '15: and is still correct')
}

if (failures === 0) console.log('algebraSimplifier: all tests passed')
else { console.error(`algebraSimplifier: ${failures} failure(s)`); process.exit(1) }
