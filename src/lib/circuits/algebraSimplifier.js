/**
 * Step-by-step Boolean simplification (T-089 phase 4).
 *
 * Best-first search over the rewrite rules in booleanLaws.js, scored by
 * (literal count, node count), with a node budget.
 *
 * **The search is not guaranteed to reach the algebraic minimum**, and the tool
 * says so rather than pretending. Every run also computes the true minimal SOP
 * with Quine-McCluskey; if the rewrite path reached it, the result is marked
 * confirmed, and if it did not, the steps that were found are shown AND the
 * minimal form is shown separately, labelled as coming from the K-map.
 *
 * Never present a non-minimal result as final, and never invent a step. The
 * tableaux engine set the precedent for checking a derived answer against an
 * independent method; the same applies here, at runtime rather than only in
 * tests.
 */

import { LAWS } from './booleanLaws.js'
import { collectVariables, evaluate, formatExpression } from './expressionParser.js'
import { buildTruthTable } from './truthTable.js'
import { minimize, coverToExpression } from './quineMcCluskey.js'

const NODE_BUDGET = 4000
const MAX_STEPS = 40

/** Literal count, then node count. Fewer literals is the goal; fewer nodes
 *  breaks ties toward the flatter of two equal-literal forms. */
export function cost(node) {
  return { literals: countLiterals(node), nodes: countNodes(node) }
}

function countLiterals(node) {
  switch (node.type) {
    case 'var': return 1
    case 'const': return 0
    case 'not': return countLiterals(node.child)
    default: return node.operands.reduce((n, o) => n + countLiterals(o), 0)
  }
}

function countNodes(node) {
  switch (node.type) {
    case 'var':
    case 'const': return 1
    case 'not': return 1 + countNodes(node.child)
    default: return 1 + node.operands.reduce((n, o) => n + countNodes(o), 0)
  }
}

const better = (a, b) => a.literals < b.literals || (a.literals === b.literals && a.nodes < b.nodes)

/**
 * The smallest node count an expression of `literals` literals can have: each
 * literal is a node, plus one operator node joining every pair. Used only to
 * decide when the search has nothing left worth finding.
 */
const nodeFloor = (literals) => Math.max(1, literals * 2 - 1)

/** Stable identity for a tree, so the search does not revisit shapes. */
function signature(node) {
  switch (node.type) {
    case 'var': return node.name
    case 'const': return String(node.value)
    case 'not': return `!(${signature(node.child)})`
    default: return `${node.type}(${node.operands.map(signature).sort().join(',')})`
  }
}

/**
 * Every rewrite reachable in one rule application anywhere in the tree.
 * @returns {Array<{node: Object, law: string, statement: string, before: Object, after: Object}>}
 */
export function neighbours(root) {
  const out = []

  const visit = (node, rebuild) => {
    for (const law of LAWS) {
      const rewritten = law.apply(node)
      if (!rewritten) continue
      if (signature(rewritten) === signature(node)) continue
      out.push({
        node: rebuild(rewritten),
        law: law.name,
        statement: law.statement,
        before: node,
        after: rewritten,
      })
    }

    if (node.type === 'not') {
      visit(node.child, child => rebuild({ ...node, child }))
    } else if (node.operands) {
      node.operands.forEach((operand, i) => {
        visit(operand, replacement => rebuild({
          ...node,
          operands: node.operands.map((o, k) => (k === i ? replacement : o)),
        }))
      })
    }
  }

  visit(root, n => n)
  return out
}

/**
 * @typedef {Object} Step
 * @property {string} from      expression before this rewrite
 * @property {string} to        expression after
 * @property {string} law       the law's name
 * @property {string} statement the law in symbols
 * @property {string} focusFrom the sub-expression that was rewritten
 * @property {string} focusTo   what it became
 */

/**
 * @param {Object} ast
 * @returns {{steps: Step[], start: string, result: string, minimal: string,
 *   reachedMinimum: boolean, confirmed: boolean, exhausted: boolean, vars: string[]}}
 */
export function simplify(ast) {
  const vars = collectVariables(ast)

  // The independent answer, computed first so the search can be checked against
  // it rather than trusted.
  const table = buildTruthTable(ast)
  const solution = minimize(table)
  const minimal = coverToExpression(solution.covers[0], solution.vars, 'sop')

  // The target is the minimal SOP's FULL cost, not just its literal count.
  // Stopping on literals alone exits before exploring anything whenever the
  // input already has that many: A'' has one literal, so a literal-only test
  // declared it finished and never applied Involution.
  const targetCost = { literals: solution.covers[0].literals, nodes: Infinity }

  const startSignature = signature(ast)
  const seen = new Map([[startSignature, { node: ast, cost: cost(ast), from: null }]])
  let frontier = [startSignature]
  let best = startSignature
  let expanded = 0
  let exhausted = false

  while (frontier.length > 0) {
    // Best-first: always expand the cheapest unexpanded shape.
    frontier.sort((a, b) => {
      const ca = seen.get(a).cost
      const cb = seen.get(b).cost
      return ca.literals - cb.literals || ca.nodes - cb.nodes
    })

    const current = frontier.shift()
    const entry = seen.get(current)

    if (better(entry.cost, seen.get(best).cost)) best = current

    // The K-map gives the minimal SOP, which is the floor for a sum of
    // products but NOT for an expression: factoring and XOR legitimately go
    // below it, so this is a good place to stop rather than a proof that
    // nothing better exists. Only stop once the shape is also compact, or a
    // one-literal input like A'' would count as finished before unfolding.
    if (entry.cost.literals <= targetCost.literals && entry.cost.nodes <= nodeFloor(entry.cost.literals)) {
      best = current
      break
    }

    expanded += 1
    if (expanded > NODE_BUDGET) { exhausted = true; break }

    for (const move of neighbours(entry.node)) {
      const key = signature(move.node)
      if (seen.has(key)) continue
      seen.set(key, {
        node: move.node,
        cost: cost(move.node),
        from: { key: current, law: move.law, statement: move.statement, before: move.before, after: move.after },
      })
      frontier.push(key)
    }
  }

  // Walk back from the best shape to the start.
  const chain = []
  let cursor = best
  while (seen.get(cursor).from) {
    const entry = seen.get(cursor)
    chain.unshift({ node: entry.node, ...entry.from })
    cursor = entry.from.key
  }

  const steps = chain.slice(-MAX_STEPS).map((link) => ({
    from: formatExpression(seen.get(link.key).node),
    to: formatExpression(link.node),
    law: link.law,
    statement: link.statement,
    focusFrom: formatExpression(link.before),
    focusTo: formatExpression(link.after),
  }))

  const resultNode = seen.get(best).node
  const result = formatExpression(resultNode)
  const reachedMinimum = cost(resultNode).literals <= targetCost.literals

  return {
    steps,
    start: formatExpression(ast),
    result,
    minimal,
    reachedMinimum,
    // Independent confirmation that the rewrite chain did not change the
    // function, checked at runtime and not only in tests.
    confirmed: sameFunction(ast, resultNode, vars),
    exhausted,
    vars,
    solution,
  }
}

/** Truth-table equality over the union of both expressions' variables. */
export function sameFunction(a, b, vars) {
  const names = vars ?? [...new Set([...collectVariables(a), ...collectVariables(b)])].sort()
  if (names.length > 12) return true

  for (let i = 0; i < 2 ** names.length; i += 1) {
    const assignment = {}
    names.forEach((name, k) => { assignment[name] = (i >> (names.length - 1 - k)) & 1 })
    if (evaluate(a, assignment) !== evaluate(b, assignment)) return false
  }
  return true
}
