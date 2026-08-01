/**
 * Named Boolean algebra laws as rewrite rules (T-089 phase 4).
 *
 * The student needs the NAMES, not just the answer. A truth-table minimiser
 * gives the destination with no route, and the route is the marked part of the
 * exam question.
 *
 * Each rule takes an AST node and returns the rewritten node, or null when it
 * does not apply. Rules are pure and local: they look at one node and its
 * immediate children, and the search in algebraSimplifier.js is what walks the
 * tree and decides which rewrite to keep.
 *
 * Every rule here must preserve the truth table. `algebraSimplifier.fuzz.test.js`
 * checks exactly that, after every individual step, so a typo in a rule is
 * caught on the first seed rather than by a student.
 */

const isConst = (node, value) => node.type === 'const' && node.value === value
const nary = (type, operands) => (operands.length === 1 ? operands[0] : { type, operands })

/** Structural equality. Cheap because these trees are tiny. */
export function same(a, b) {
  if (a.type !== b.type) return false
  switch (a.type) {
    case 'var': return a.name === b.name
    case 'const': return a.value === b.value
    case 'not': return same(a.child, b.child)
    default:
      if (a.operands.length !== b.operands.length) return false
      // Commutative, so compare as multisets rather than in order.
      return a.operands.every(x => b.operands.some(y => same(x, y)))
        && b.operands.every(y => a.operands.some(x => same(x, y)))
  }
}

const isComplementOf = (a, b) => (
  (a.type === 'not' && same(a.child, b)) || (b.type === 'not' && same(b.child, a))
)

/** Removes the first operand matching `pred`, returning the rest. */
const without = (operands, index) => operands.filter((_, i) => i !== index)

export const LAWS = [
  // --- Constants -----------------------------------------------------------
  {
    name: 'Identity law',
    statement: 'X · 1 = X   and   X + 0 = X',
    apply(node) {
      if (node.type === 'and') {
        const kept = node.operands.filter(o => !isConst(o, 1))
        if (kept.length !== node.operands.length) return kept.length === 0 ? { type: 'const', value: 1 } : nary('and', kept)
      }
      if (node.type === 'or') {
        const kept = node.operands.filter(o => !isConst(o, 0))
        if (kept.length !== node.operands.length) return kept.length === 0 ? { type: 'const', value: 0 } : nary('or', kept)
      }
      return null
    },
  },
  {
    name: 'Null law',
    statement: 'X · 0 = 0   and   X + 1 = 1',
    apply(node) {
      if (node.type === 'and' && node.operands.some(o => isConst(o, 0))) return { type: 'const', value: 0 }
      if (node.type === 'or' && node.operands.some(o => isConst(o, 1))) return { type: 'const', value: 1 }
      return null
    },
  },
  {
    name: 'Idempotent law',
    statement: 'X · X = X   and   X + X = X',
    apply(node) {
      if (node.type !== 'and' && node.type !== 'or') return null
      const kept = []
      for (const operand of node.operands) {
        if (!kept.some(k => same(k, operand))) kept.push(operand)
      }
      return kept.length === node.operands.length ? null : nary(node.type, kept)
    },
  },
  {
    // Named "Inverse law" rather than "Complement" to match the table the
    // course actually teaches from (Identity/Null/Idempotent/Inverse/
    // Commutative/Associative/Distributive/Absorption/De Morgan's) — a
    // student citing a step needs the name their notes use, not a synonym.
    name: 'Inverse law',
    statement: "X · X' = 0   and   X + X' = 1",
    apply(node) {
      if (node.type !== 'and' && node.type !== 'or') return null
      for (let i = 0; i < node.operands.length; i += 1) {
        for (let j = i + 1; j < node.operands.length; j += 1) {
          if (isComplementOf(node.operands[i], node.operands[j])) {
            return { type: 'const', value: node.type === 'and' ? 0 : 1 }
          }
        }
      }
      return null
    },
  },
  {
    name: 'Involution',
    statement: "(X')' = X",
    apply(node) {
      if (node.type === 'not' && node.child.type === 'not') return node.child.child
      return null
    },
  },

  // --- The ones that actually shrink an expression -------------------------
  {
    name: 'Combining',
    statement: "XY + XY' = X",
    apply(node) {
      if (node.type !== 'or') return null
      for (let i = 0; i < node.operands.length; i += 1) {
        for (let j = i + 1; j < node.operands.length; j += 1) {
          const merged = combineTerms(node.operands[i], node.operands[j])
          if (!merged) continue
          const rest = node.operands.filter((_, k) => k !== i && k !== j)
          return nary('or', [merged, ...rest])
        }
      }
      return null
    },
  },
  {
    name: 'Absorption law',
    statement: 'X + XY = X   and   X(X + Y) = X',
    apply(node) {
      if (node.type !== 'or' && node.type !== 'and') return null
      const inner = node.type === 'or' ? 'and' : 'or'

      for (let i = 0; i < node.operands.length; i += 1) {
        for (let j = 0; j < node.operands.length; j += 1) {
          if (i === j) continue
          const outer = node.operands[i]
          const product = node.operands[j]
          if (product.type !== inner) continue
          if (product.operands.some(o => same(o, outer))) {
            return nary(node.type, without(node.operands, j))
          }
        }
      }
      return null
    },
  },
  {
    name: 'Redundancy',
    statement: "X + X'Y = X + Y",
    apply(node) {
      if (node.type !== 'or' && node.type !== 'and') return null
      const inner = node.type === 'or' ? 'and' : 'or'

      for (let i = 0; i < node.operands.length; i += 1) {
        for (let j = 0; j < node.operands.length; j += 1) {
          if (i === j) continue
          const outer = node.operands[i]
          const product = node.operands[j]
          if (product.type !== inner) continue

          const hit = product.operands.findIndex(o => isComplementOf(o, outer))
          if (hit < 0) continue

          const reduced = without(product.operands, hit)
          if (reduced.length === 0) continue
          const replaced = [...node.operands]
          replaced[j] = nary(inner, reduced)
          return nary(node.type, replaced)
        }
      }
      return null
    },
  },
  {
    name: 'Consensus',
    statement: "XY + X'Z + YZ = XY + X'Z",
    apply(node) {
      if (node.type !== 'or') return null
      const terms = node.operands.map(literalsOf)

      for (let i = 0; i < terms.length; i += 1) {
        for (let j = 0; j < terms.length; j += 1) {
          if (i === j) continue
          const consensus = consensusOf(terms[i], terms[j])
          if (!consensus) continue

          for (let k = 0; k < terms.length; k += 1) {
            if (k === i || k === j || !terms[k]) continue
            if (sameLiteralSet(terms[k], consensus)) {
              return nary('or', without(node.operands, k))
            }
          }
        }
      }
      return null
    },
  },

  // --- Shape changers ------------------------------------------------------
  {
    name: "De Morgan's law",
    statement: "(XY)' = X' + Y'   and   (X + Y)' = X'Y'",
    apply(node) {
      if (node.type !== 'not') return null
      const child = node.child
      if (child.type !== 'and' && child.type !== 'or') return null
      return nary(child.type === 'and' ? 'or' : 'and',
        child.operands.map(o => (o.type === 'not' ? o.child : { type: 'not', child: o })))
    },
  },
  {
    name: 'Distributive law',
    statement: 'X(Y + Z) = XY + XZ',
    apply(node) {
      if (node.type !== 'and') return null
      const at = node.operands.findIndex(o => o.type === 'or')
      if (at < 0) return null

      const rest = without(node.operands, at)
      if (rest.length === 0) return null
      return nary('or', node.operands[at].operands.map(o => nary('and', [...rest, o])))
    },
  },
  {
    name: 'Factoring',
    statement: 'XY + XZ = X(Y + Z)',
    apply(node) {
      if (node.type !== 'or') return null

      // Any literal shared by two or more product terms can come out front.
      const counts = new Map()
      node.operands.forEach((operand, index) => {
        const factors = operand.type === 'and' ? operand.operands : [operand]
        for (const factor of factors) {
          const key = keyOf(factor)
          if (!counts.has(key)) counts.set(key, { node: factor, indices: [] })
          counts.get(key).indices.push(index)
        }
      })

      for (const { node: factor, indices } of counts.values()) {
        if (indices.length < 2) continue
        const inside = indices.map((index) => {
          const operand = node.operands[index]
          const factors = operand.type === 'and' ? operand.operands : [operand]
          const at = factors.findIndex(f => same(f, factor))
          const remaining = without(factors, at)
          return remaining.length === 0 ? { type: 'const', value: 1 } : nary('and', remaining)
        })
        const untouched = node.operands.filter((_, i) => !indices.includes(i))
        return nary('or', [nary('and', [factor, nary('or', inside)]), ...untouched])
      }
      return null
    },
  },
  {
    name: 'XOR',
    statement: "XY' + X'Y = X ⊕ Y",
    apply(node) {
      if (node.type !== 'or' || node.operands.length < 2) return null
      for (let i = 0; i < node.operands.length; i += 1) {
        for (let j = i + 1; j < node.operands.length; j += 1) {
          const pair = xorPair(node.operands[i], node.operands[j])
          if (!pair) continue
          const rest = node.operands.filter((_, k) => k !== i && k !== j)
          return nary('or', [pair, ...rest])
        }
      }
      return null
    },
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function keyOf(node) {
  switch (node.type) {
    case 'var': return `v:${node.name}`
    case 'const': return `c:${node.value}`
    case 'not': return `n:${keyOf(node.child)}`
    default: return `${node.type}:${node.operands.map(keyOf).sort().join(',')}`
  }
}

/**
 * A product term as a literal list, or null if it is not one.
 *
 * A variable appearing twice (AA, or AA') disqualifies the term. Combining and
 * consensus both match literals by name, so a repeated name makes `find` return
 * the wrong occurrence and the rule fires on a pairing that is not there: BB'
 * and C'B were "combined" into 1, which is a different function. Idempotent and
 * Complement clean those terms up first, and the rules that need a well-formed
 * product term simply decline until they have.
 */
function literalsOf(node) {
  const factors = node.type === 'and' ? node.operands : [node]
  const literals = []
  const seen = new Set()

  for (const factor of factors) {
    let literal
    if (factor.type === 'var') literal = { name: factor.name, negated: false }
    else if (factor.type === 'not' && factor.child.type === 'var') {
      literal = { name: factor.child.name, negated: true }
    } else return null

    if (seen.has(literal.name)) return null
    seen.add(literal.name)
    literals.push(literal)
  }
  return literals
}

/** XY + XY' -> X, when the two terms differ in exactly one literal's sense. */
function combineTerms(a, b) {
  const left = literalsOf(a)
  const right = literalsOf(b)
  if (!left || !right || left.length !== right.length || left.length === 0) return null

  let differing = null
  for (const literal of left) {
    const match = right.find(r => r.name === literal.name)
    if (!match) return null
    if (match.negated !== literal.negated) {
      if (differing) return null
      differing = literal.name
    }
  }
  if (!differing) return null

  const kept = left.filter(l => l.name !== differing)
  if (kept.length === 0) return { type: 'const', value: 1 }
  return nary('and', kept.map(toNode))
}

/** XY' + X'Y -> X ⊕ Y, for single-variable X and Y. */
function xorPair(a, b) {
  const left = literalsOf(a)
  const right = literalsOf(b)
  if (!left || !right || left.length !== 2 || right.length !== 2) return null

  const names = left.map(l => l.name).sort()
  if (names.join() !== right.map(r => r.name).sort().join()) return null

  const senseOf = (literals, name) => literals.find(l => l.name === name).negated
  const [x, y] = names
  const opposite = senseOf(left, x) !== senseOf(right, x) && senseOf(left, y) !== senseOf(right, y)
  const mixed = senseOf(left, x) !== senseOf(left, y)
  if (!opposite || !mixed) return null

  return { type: 'xor', operands: [{ type: 'var', name: x }, { type: 'var', name: y }] }
}

/** The consensus term of XY and X'Z, i.e. YZ. */
function consensusOf(a, b) {
  if (!a || !b) return null

  let pivot = null
  for (const literal of a) {
    const opposed = b.find(r => r.name === literal.name && r.negated !== literal.negated)
    if (opposed) {
      if (pivot) return null
      pivot = literal.name
    }
  }
  if (!pivot) return null

  const merged = []
  for (const literal of [...a, ...b]) {
    if (literal.name === pivot) continue
    if (merged.some(m => m.name === literal.name && m.negated === literal.negated)) continue
    // A variable appearing with both senses makes the consensus zero.
    if (merged.some(m => m.name === literal.name)) return null
    merged.push(literal)
  }
  return merged.length > 0 ? merged : null
}

function sameLiteralSet(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every(x => b.some(y => y.name === x.name && y.negated === x.negated))
}

const toNode = (literal) => (
  literal.negated
    ? { type: 'not', child: { type: 'var', name: literal.name } }
    : { type: 'var', name: literal.name }
)
