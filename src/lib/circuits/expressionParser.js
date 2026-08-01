/**
 * Digital-logic expression parser (T-089).
 *
 * Deliberately NOT src/lib/logic/formulaParser.js. That one parses propositional
 * logic, where `AB` is a parse error and `+` is not an operator. Here `AB` means
 * A AND B and `+` means OR, so the two notations cannot share a tokenizer
 * without one of them being wrong. See docs/specs/digital-logic.md §2.
 *
 * A variable is one letter plus optional digits (A, B, Q0, X2). That restriction
 * is what makes implicit AND unambiguous: `ABQ0` tokenizes to A · B · Q0 with no
 * lookahead. Genuine multi-letter signal names are therefore NOT supported, and
 * cannot be: `IN` is indistinguishable from `I · N`. The safety net is
 * formatFullyParenthesised(), which the UI echoes back so a student sees how
 * their input was read before they trust the answer.
 *
 * Word operators (AND, OR, NOT, NAND, NOR, XOR, XNOR) ARE recognised, since
 * those are the only multi-letter tokens that appear in practice and reading
 * `A NAND B` as A·N·A·N·D·B would be absurd.
 */

/**
 * @typedef {Object} ExpressionErrorFields
 * @property {number} position - 0-based index into the original string
 * @property {number} length   - how many characters to underline
 * @property {string} hint     - a concrete next action, or '' when there isn't one
 */
export class ExpressionError extends Error {
  constructor(message, { position = 0, length = 1, hint = '' } = {}) {
    super(message)
    this.name = 'ExpressionError'
    this.position = position
    this.length = length
    this.hint = hint
  }
}

// Single characters that map to an operator. `.` is included because A.B is a
// common way to write AND on a keyboard; it never means a decimal point here
// since there are no numeric literals beyond 0 and 1.
const AND_CHARS = new Set(['·', '*', '&', '∧', '.', '×'])
const OR_CHARS = new Set(['+', '|', '∨'])
const XOR_CHARS = new Set(['^', '⊕'])
const XNOR_CHARS = new Set(['⊙', '⊻'])
const NOT_CHARS = new Set(['!', '~', '¬'])
// The typographic apostrophe is here because pasting from a word processor
// silently converts ' to ’, and rejecting that would be a baffling error.
const COMPLEMENT_CHARS = new Set(["'", '’', '′'])
const OPEN_CHARS = new Set(['(', '['])
const CLOSE_CHARS = new Set([')', ']'])

// Combining macron / overline following a letter, i.e. someone typed A then the
// overbar. Kept as separate code points so a character index still equals a
// display column, which the error card's underline depends on.
const OVERBAR_MARKS = new Set(['̄', '̅', '̲'])

// Precomposed macron letters, the realistic paste case. Only the ones Unicode
// actually defines; there is no precomposed overline for most letters.
const PRECOMPOSED_BAR = {
  'Ā': 'A', 'ā': 'A', 'Ē': 'E', 'ē': 'E', 'Ī': 'I', 'ī': 'I',
  'Ō': 'O', 'ō': 'O', 'Ū': 'U', 'ū': 'U', 'Ȳ': 'Y', 'ȳ': 'Y',
}

// Longest-first so NAND is not read as N followed by AND. The trailing boundary
// check is what keeps `ANDB` from matching AND: it falls through to A·N·D·B,
// which is the documented juxtaposition rule.
const KEYWORDS = [
  ['NAND', 'nand'], ['XNOR', 'xnor'], ['NOR', 'nor'],
  ['XOR', 'xor'], ['AND', 'and'], ['NOT', 'not'], ['OR', 'or'],
]

const isLetter = (ch) => /[A-Za-z]/.test(ch)
const isDigit = (ch) => /[0-9]/.test(ch)
const isWordChar = (ch) => /[A-Za-z0-9]/.test(ch)

/**
 * @param {string} source
 * @returns {Array<{type: string, value?: string|number, at: number, len: number}>}
 */
function tokenize(source) {
  const tokens = []
  let i = 0

  while (i < source.length) {
    const ch = source[i]

    if (/\s/.test(ch)) { i += 1; continue }

    // Word operators, checked before single letters so `A AND B` does not
    // tokenize as A · A · N · D · B.
    const keyword = matchKeyword(source, i)
    if (keyword) {
      tokens.push({ type: keyword.type, at: i, len: keyword.len })
      i += keyword.len
      continue
    }

    if (isLetter(ch) || PRECOMPOSED_BAR[ch]) {
      const barred = Boolean(PRECOMPOSED_BAR[ch])
      const letter = (PRECOMPOSED_BAR[ch] ?? ch).toUpperCase()
      let j = i + 1
      let digits = ''
      while (j < source.length && isDigit(source[j])) { digits += source[j]; j += 1 }

      tokens.push({ type: 'var', value: letter + digits, at: i, len: j - i })

      // An overbar reads as a complement on the name it sits over, which is
      // exactly what a postfix ' does, so emit the same token.
      let bars = barred ? 1 : 0
      while (j < source.length && OVERBAR_MARKS.has(source[j])) { bars += 1; j += 1 }
      for (let k = 0; k < bars; k += 1) {
        tokens.push({ type: 'complement', at: Math.min(j, source.length - 1), len: 1 })
      }

      i = j
      continue
    }

    if (ch === '0' || ch === '1') {
      tokens.push({ type: 'const', value: Number(ch), at: i, len: 1 })
      i += 1
      continue
    }

    if (isDigit(ch)) {
      throw new ExpressionError(`'${ch}' is not a logic value.`, {
        position: i,
        hint: 'Only 0 and 1 are constants. Digits after a letter make a name like Q0.',
      })
    }

    const simple = simpleToken(ch)
    if (simple) {
      tokens.push({ type: simple, at: i, len: 1 })
      i += 1
      continue
    }

    // Two characters that mean the student is in the wrong input box entirely.
    if (ch === 'Σ' || ch === 'Π' || ch === '=') {
      throw new ExpressionError(`'${ch}' belongs to the minterm form, not an expression.`, {
        position: i,
        hint: 'Write it as F(A,B,C) = Σm(0,2,5) on its own, or drop the Σ and type the expression.',
      })
    }

    throw new ExpressionError(`'${ch}' is not a logic symbol.`, {
      position: i,
      hint: "Use letters for variables with ' + · ⊕ and brackets.",
    })
  }

  return tokens
}

function matchKeyword(source, i) {
  for (const [word, lower] of KEYWORDS) {
    const slice = source.slice(i, i + word.length)
    if (slice !== word && slice.toLowerCase() !== lower) continue
    const after = source[i + word.length]
    if (after !== undefined && isWordChar(after)) continue
    const before = source[i - 1]
    if (before !== undefined && isWordChar(before)) continue
    return { type: lower, len: word.length }
  }
  return null
}

function simpleToken(ch) {
  if (AND_CHARS.has(ch)) return 'and'
  if (OR_CHARS.has(ch)) return 'or'
  if (XOR_CHARS.has(ch)) return 'xor'
  if (XNOR_CHARS.has(ch)) return 'xnor'
  if (NOT_CHARS.has(ch)) return 'not'
  if (COMPLEMENT_CHARS.has(ch)) return 'complement'
  if (OPEN_CHARS.has(ch)) return 'lparen'
  if (CLOSE_CHARS.has(ch)) return 'rparen'
  return null
}

// AND, OR and XOR are associative, so a nested node of the same type can always
// be spliced into its parent. Doing it at construction time is what lets the
// simplification rules match a whole product term at once instead of walking a
// right-leaning binary chain first.
function nary(type, operands) {
  const flat = []
  for (const node of operands) {
    if (node.type === type) flat.push(...node.operands)
    else flat.push(node)
  }
  return flat.length === 1 ? flat[0] : { type, operands: flat }
}

const not = (child) => ({ type: 'not', child })

/**
 * Parses a digital-logic expression into an AST.
 *
 * AST shapes:
 *   { type: 'var',   name: 'A' }
 *   { type: 'const', value: 0 | 1 }
 *   { type: 'not',   child: node }
 *   { type: 'and' | 'or' | 'xor', operands: [node, ...] }   // n-ary, >= 2
 *
 * @param {string} input
 * @returns {Object} AST root
 * @throws {ExpressionError} carrying position / length / hint
 */
export function parseExpression(input) {
  const source = String(input ?? '')
  if (!source.trim()) {
    throw new ExpressionError('Enter an expression first.', {
      position: 0,
      length: 0,
      hint: "For example: AB' + BC",
    })
  }

  const tokens = tokenize(source)
  if (tokens.length === 0) {
    throw new ExpressionError('There is nothing to read here.', {
      position: 0,
      length: source.length,
      hint: "For example: AB' + BC",
    })
  }

  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  function span(tok) {
    if (!tok) {
      const at = Math.max(0, source.length - 1)
      return { position: at, length: source.length > 0 ? 1 : 0 }
    }
    return { position: tok.at, length: tok.len }
  }

  function fail(tok, message, hint) {
    throw new ExpressionError(message, { ...span(tok), hint })
  }

  // Precedence, loosest first: OR/NOR < XOR/XNOR < AND/NAND < NOT < postfix '.
  // Textbooks disagree about where XOR sits, which is why the UI echoes the
  // fully parenthesised reading back rather than relying on the student and the
  // parser having read the same book.

  function parseOr() {
    let operands = [parseXor()]
    while (peek() && (peek().type === 'or' || peek().type === 'nor')) {
      const op = next()
      const right = parseXor()
      if (op.type === 'or') {
        operands.push(right)
      } else {
        // A NOR B is (A + B)'. Everything accumulated so far is its left side,
        // so close the chain before wrapping rather than letting the complement
        // swallow only the nearest operand.
        operands = [not(nary('or', [nary('or', operands), right]))]
      }
    }
    return nary('or', operands)
  }

  function parseXor() {
    let operands = [parseAnd()]
    while (peek() && (peek().type === 'xor' || peek().type === 'xnor')) {
      const op = next()
      const right = parseAnd()
      if (op.type === 'xor') {
        operands.push(right)
      } else {
        operands = [not(nary('xor', [nary('xor', operands), right]))]
      }
    }
    return nary('xor', operands)
  }

  function parseAnd() {
    let operands = [parseUnary()]
    for (;;) {
      const tok = peek()
      if (!tok) break

      if (tok.type === 'and' || tok.type === 'nand') {
        next()
        const right = parseUnary()
        if (tok.type === 'and') operands.push(right)
        else operands = [not(nary('and', [nary('and', operands), right]))]
        continue
      }

      // Juxtaposition: AB, A(B+C), A!B, A0 all mean AND with no operator
      // written. Only tokens that can *start* a factor count, so `A + B` ends
      // the product here rather than trying to multiply by '+'.
      if (startsFactor(tok)) {
        operands.push(parseUnary())
        continue
      }

      break
    }
    return nary('and', operands)
  }

  function startsFactor(tok) {
    return tok.type === 'var' || tok.type === 'const'
      || tok.type === 'lparen' || tok.type === 'not'
  }

  function parseUnary() {
    const tok = peek()
    if (tok && tok.type === 'not') {
      next()
      const operand = peek()
      if (!operand || !startsFactor(operand)) {
        fail(operand ?? tok, 'This NOT has nothing to negate.',
          "Put a variable or a bracketed group after it, for example !A or !(A+B).")
      }
      return not(parseUnary())
    }
    return parsePostfix()
  }

  function parsePostfix() {
    let node = parsePrimary()
    while (peek() && peek().type === 'complement') {
      next()
      node = not(node)
    }
    return node
  }

  function parsePrimary() {
    const tok = next()

    if (!tok) {
      fail(tok, 'The expression stops early.', 'Finish it with a variable, for example A.')
    }

    if (tok.type === 'lparen') {
      const inner = parseOr()
      const close = peek()
      if (!close || close.type !== 'rparen') {
        throw new ExpressionError('This bracket is never closed.', {
          position: tok.at,
          length: 1,
          hint: 'Add a matching ) to the end of the group.',
        })
      }
      next()
      return inner
    }

    if (tok.type === 'var') return { type: 'var', name: tok.value }
    if (tok.type === 'const') return { type: 'const', value: tok.value }

    if (tok.type === 'rparen') {
      fail(tok, 'This bracket was never opened.', 'Remove it, or add a matching ( earlier.')
    }
    if (tok.type === 'complement') {
      fail(tok, "This ' has nothing to complement.", "Put it after a variable or a group, for example A' or (A+B)'.")
    }

    fail(tok, `${describe(tok.type)} needs a value before it.`,
      'Write something like A + B rather than starting with the operator.')
  }

  const ast = parseOr()

  const leftover = peek()
  if (leftover) {
    fail(leftover, `'${source.slice(leftover.at, leftover.at + leftover.len)}' does not belong here.`,
      'Check for a missing operator or an extra bracket.')
  }

  return ast
}

function describe(type) {
  const names = {
    and: 'AND', or: 'OR', xor: 'XOR', xnor: 'XNOR',
    nand: 'NAND', nor: 'NOR', not: 'NOT',
  }
  return names[type] ?? 'That operator'
}

/**
 * Every variable in the AST, sorted. Sorting is what makes the truth-table row
 * index equal the minterm index, so it is not cosmetic.
 * @returns {string[]}
 */
export function collectVariables(ast) {
  const found = new Set()
  const walk = (node) => {
    if (node.type === 'var') found.add(node.name)
    else if (node.type === 'not') walk(node.child)
    else if (node.operands) node.operands.forEach(walk)
  }
  walk(ast)
  return [...found].sort(compareVariables)
}

// A1 before A10 before B, rather than the string order that puts A10 before A2.
export function compareVariables(a, b) {
  const [, aLetter, aDigits] = /^([A-Z])(\d*)$/.exec(a) ?? [null, a, '']
  const [, bLetter, bDigits] = /^([A-Z])(\d*)$/.exec(b) ?? [null, b, '']
  if (aLetter !== bLetter) return aLetter < bLetter ? -1 : 1
  return (Number(aDigits || 0)) - (Number(bDigits || 0))
}

/**
 * Evaluates the AST under an assignment.
 * @param {Object} ast
 * @param {Record<string, 0|1>} assignment
 * @returns {0|1}
 */
export function evaluate(ast, assignment) {
  switch (ast.type) {
    case 'const': return ast.value
    case 'var': {
      const value = assignment[ast.name]
      if (value === undefined) {
        throw new ExpressionError(`No value given for ${ast.name}.`, { position: 0, length: 0, hint: '' })
      }
      return value ? 1 : 0
    }
    case 'not': return evaluate(ast.child, assignment) ? 0 : 1
    case 'and': return ast.operands.every(n => evaluate(n, assignment)) ? 1 : 0
    case 'or': return ast.operands.some(n => evaluate(n, assignment)) ? 1 : 0
    case 'xor': return ast.operands.reduce((acc, n) => acc ^ evaluate(n, assignment), 0) ? 1 : 0
    default:
      throw new ExpressionError(`Unknown node type "${ast.type}".`, { position: 0, length: 0, hint: '' })
  }
}

const PRECEDENCE = { or: 1, xor: 2, and: 3, not: 4, var: 5, const: 5 }

/**
 * Joins the factors of a product, inserting an explicit `·` only where
 * juxtaposition would be ambiguous.
 *
 * A variable is a letter plus optional digits, so writing `and(A, 0)` as `A0`
 * produces something this very parser reads back as a variable NAMED A0. The
 * formatter must not emit text it cannot itself read, so a factor starting with
 * a digit gets a separator. Everything else keeps the compact `AB'C` form the
 * notation exists for.
 */
function joinProduct(parts) {
  return parts.reduce((out, part, i) => {
    if (i === 0) return part
    return /^\d/.test(part) ? `${out}·${part}` : out + part
  }, '')
}

/**
 * Canonical display form: AB' + CD. Brackets only where precedence needs them.
 */
export function formatExpression(ast) {
  return render(ast, 0)
}

function render(node, parentPrecedence) {
  switch (node.type) {
    case 'const': return String(node.value)
    case 'var': return node.name
    case 'not': {
      // A complemented atom reads better postfix (A'), a complemented group
      // reads better with the bar shown as a trailing quote on the bracket.
      const inner = node.child
      if (inner.type === 'var' || inner.type === 'const') return `${render(inner, PRECEDENCE.not)}'`
      return `(${render(inner, 0)})'`
    }
    case 'and': {
      const body = joinProduct(node.operands.map(n => render(n, PRECEDENCE.and)))
      return PRECEDENCE.and < parentPrecedence ? `(${body})` : body
    }
    case 'or': {
      const body = node.operands.map(n => render(n, PRECEDENCE.or)).join(' + ')
      return PRECEDENCE.or < parentPrecedence ? `(${body})` : body
    }
    case 'xor': {
      const body = node.operands.map(n => render(n, PRECEDENCE.xor)).join(' ⊕ ')
      return PRECEDENCE.xor < parentPrecedence ? `(${body})` : body
    }
    default: return '?'
  }
}

/**
 * Fully parenthesised reading, shown back to the student so an unexpected
 * precedence is visible before they trust the answer rather than after.
 */
export function formatFullyParenthesised(ast) {
  switch (ast.type) {
    case 'const': return String(ast.value)
    case 'var': return ast.name
    case 'not': return `(${formatFullyParenthesised(ast.child)})'`
    case 'and': return `(${ast.operands.map(formatFullyParenthesised).join(' · ')})`
    case 'or': return `(${ast.operands.map(formatFullyParenthesised).join(' + ')})`
    case 'xor': return `(${ast.operands.map(formatFullyParenthesised).join(' ⊕ ')})`
    default: return '?'
  }
}
