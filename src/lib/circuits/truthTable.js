/**
 * Truth tables for digital-logic expressions (T-089).
 *
 * Two entry points, because a student arrives with one of two things: an
 * expression, or the exam shorthand F(A,B,C,D) = Σm(0,2,5) + Σd(7). There is no
 * expression syntax for a don't-care, so the minterm form is the only way they
 * enter the system, and don't-cares are what make the K-map interesting.
 *
 * Variables are sorted and the first is the MSB. That is not cosmetic: it is
 * what makes a row's index equal its minterm number, which every downstream
 * module (Quine-McCluskey, the K-map, the cross-highlight) assumes.
 */

import { parseExpression, collectVariables, evaluate, ExpressionError, compareVariables } from './expressionParser.js'

// 256 rows. Past this a K-map is meaningless and the table is a wall of digits,
// so refuse with a number in the message rather than rendering something useless.
export const MAX_VARIABLES = 8

/**
 * @typedef {Object} TruthTable
 * @property {string[]} vars                     MSB first
 * @property {Array<{minterm: number, inputs: number[], output: 0|1|'x'}>} rows
 * @property {number[]} minterms                 indices where output is 1
 * @property {number[]} dontCares                indices where output is 'x'
 * @property {number[]} maxterms                 indices where output is 0
 */

/**
 * Builds a truth table by evaluating an AST over every input combination.
 * @param {Object} ast
 * @param {string[]} [varsOverride] - use when the caller knows variables the
 *   expression does not mention (e.g. F(A,B,C) = A, where C is still an input)
 * @returns {TruthTable}
 */
export function buildTruthTable(ast, varsOverride) {
  const vars = varsOverride ? [...varsOverride].sort(compareVariables) : collectVariables(ast)

  if (vars.length === 0) {
    // A constant expression still has a truth table, it just has one row.
    const value = evaluate(ast, {})
    return finish([], [{ minterm: 0, inputs: [], output: value }])
  }

  assertVariableCount(vars.length)

  const rows = []
  for (let index = 0; index < 2 ** vars.length; index += 1) {
    const inputs = indexToInputs(index, vars.length)
    const assignment = {}
    vars.forEach((name, i) => { assignment[name] = inputs[i] })
    rows.push({ minterm: index, inputs, output: evaluate(ast, assignment) })
  }

  return finish(vars, rows)
}

/**
 * Builds a truth table directly from minterm / don't-care lists.
 * @param {{vars: string[], minterms: number[], dontCares?: number[], form?: 'sop'|'pos'}} spec
 * @returns {TruthTable}
 */
export function tableFromMinterms({ vars, minterms, dontCares = [], form = 'sop', presorted = false }) {
  assertVariableCount(vars.length)

  const size = 2 ** vars.length
  const ones = new Set(minterms)
  const cares = new Set(dontCares)

  const overlap = [...ones].filter(m => cares.has(m))
  if (overlap.length > 0) {
    throw new ExpressionError(
      `${overlap.length === 1 ? 'Index' : 'Indices'} ${overlap.join(', ')} listed as both a term and a don't-care.`,
      { position: 0, length: 0, hint: 'Each index belongs in one list only.' }
    )
  }

  const rows = []
  for (let index = 0; index < size; index += 1) {
    let output
    if (cares.has(index)) output = 'x'
    // ΠM lists the indices where the function is ZERO, so the sense inverts.
    else if (form === 'pos') output = ones.has(index) ? 0 : 1
    else output = ones.has(index) ? 1 : 0
    rows.push({ minterm: index, inputs: indexToInputs(index, vars.length), output })
  }

  // Sorting is the convention for a student's own expression, where nobody has
  // an opinion about which variable is the MSB. FSM synthesis does: the state
  // bits must stay above the inputs, and re-sorting them to Q0 < Q1 < X would
  // silently renumber every state. `presorted` is how that caller keeps the
  // order it built.
  return finish(presorted ? [...vars] : [...vars].sort(compareVariables), rows)
}

function finish(vars, rows) {
  return {
    vars,
    rows,
    minterms: rows.filter(r => r.output === 1).map(r => r.minterm),
    dontCares: rows.filter(r => r.output === 'x').map(r => r.minterm),
    maxterms: rows.filter(r => r.output === 0).map(r => r.minterm),
  }
}

function assertVariableCount(count) {
  if (count > MAX_VARIABLES) {
    throw new ExpressionError(
      `${count} variables is too many. The limit is ${MAX_VARIABLES}.`,
      { position: 0, length: 0, hint: `${MAX_VARIABLES} variables is already ${2 ** MAX_VARIABLES} rows.` }
    )
  }
}

/** MSB first, matching the variable order. */
export function indexToInputs(index, width) {
  const bits = []
  for (let i = width - 1; i >= 0; i -= 1) bits.push((index >> i) & 1)
  return bits
}

// ---------------------------------------------------------------------------
// Minterm shorthand
// ---------------------------------------------------------------------------

// Only treat input as the minterm form when the bracket contains nothing but
// index-list characters. Without that check `M(A+B)` in an ordinary expression
// (M AND the group) would be misread as a maxterm list.
const INDEX_LIST = String.raw`[\d\s,;\-–]+`
const SIGMA_PI = /[ΣΠ∑∏]/
const WORD_FORM = new RegExp(String.raw`\b(sm|sum\s*m|pm|prod\s*m|sd|sum\s*d)\s*\(`, 'i')
const BARE_FORM = new RegExp(String.raw`(^|=)\s*[mMdD]\s*\(\s*${INDEX_LIST}\)`)

/**
 * Cheap check so the page can route input to the right parser without throwing.
 * @param {string} input
 */
export function isMintermForm(input) {
  const text = String(input ?? '')
  return SIGMA_PI.test(text) || WORD_FORM.test(text) || BARE_FORM.test(text)
}

/**
 * Parses F(A,B,C,D) = Σm(0,1,2,5) + Σd(8,10) and its ASCII spellings.
 *
 * Accepts: Σm / Sm / sum m / m  for minterms
 *          ΠM / PM / prod M / M for maxterms
 *          Σd / Sd / d          for don't-cares
 * Index lists may use ranges: Σm(0-3, 7).
 *
 * @param {string} input
 * @returns {{vars: string[], minterms: number[], dontCares: number[], form: 'sop'|'pos', label: string}}
 * @throws {ExpressionError}
 */
export function parseMintermForm(input) {
  const source = String(input ?? '').trim()
  if (!source) {
    throw new ExpressionError('Enter a minterm list first.', {
      position: 0, length: 0, hint: 'For example: F(A,B,C) = Σm(0,2,5)',
    })
  }

  const { vars, label, body, headerLength } = splitHeader(source)

  // Each group is a marker (m / M / d) plus its bracketed index list. Scanned
  // rather than split on '+', because the '+' between Σm(...) and Σd(...) is a
  // separator here, not an OR.
  const groupPattern = new RegExp(
    String.raw`(?:[ΣΠ∑∏]|\b(?:sum|prod|s|p)\s*)?\s*([mMdD])\s*\(\s*(${INDEX_LIST})?\s*\)`,
    'g'
  )

  const minterms = new Set()
  const maxterms = new Set()
  const dontCares = new Set()
  let matched = 0
  let match

  while ((match = groupPattern.exec(body)) !== null) {
    matched += 1
    const marker = match[1]
    const indices = parseIndexList(match[2] ?? '', headerLength + match.index)

    // Case is the only thing separating minterms from maxterms in the ASCII
    // spellings, so m and M genuinely mean different things here.
    if (marker === 'd' || marker === 'D') indices.forEach(n => dontCares.add(n))
    else if (marker === 'M') indices.forEach(n => maxterms.add(n))
    else indices.forEach(n => minterms.add(n))
  }

  if (matched === 0) {
    throw new ExpressionError('No minterm list found.', {
      position: headerLength, length: Math.max(1, body.length),
      hint: 'Write it as Σm(0,2,5), or drop the Σ and type an ordinary expression.',
    })
  }

  if (minterms.size > 0 && maxterms.size > 0) {
    throw new ExpressionError('Give either minterms or maxterms, not both.', {
      position: 0, length: source.length,
      hint: 'Σm(...) lists where the function is 1; ΠM(...) lists where it is 0.',
    })
  }

  const form = maxterms.size > 0 ? 'pos' : 'sop'
  const listed = form === 'pos' ? [...maxterms] : [...minterms]

  // Checked here as well as in tableFromMinterms: this is the entry point a
  // student's typing reaches, so it is where the message needs to point at
  // their input rather than at a constructed spec.
  const overlap = listed.filter(n => dontCares.has(n))
  if (overlap.length > 0) {
    throw new ExpressionError(
      `${overlap.length === 1 ? 'Index' : 'Indices'} ${overlap.join(', ')} appear in both lists.`,
      {
        position: 0, length: source.length,
        hint: "An index is either a term or a don't-care, not both.",
      }
    )
  }

  const all = [...listed, ...dontCares]
  const resolvedVars = vars ?? inferVariables(all)

  assertVariableCount(resolvedVars.length)

  const limit = 2 ** resolvedVars.length
  const outOfRange = all.filter(n => n >= limit)
  if (outOfRange.length > 0) {
    throw new ExpressionError(
      `Index ${outOfRange[0]} is out of range for ${resolvedVars.length} variables.`,
      {
        position: 0, length: source.length,
        hint: `${resolvedVars.length} variables means indices 0 to ${limit - 1}.`,
      }
    )
  }

  return {
    vars: resolvedVars,
    minterms: listed.sort((a, b) => a - b),
    dontCares: [...dontCares].sort((a, b) => a - b),
    form,
    label: label ?? 'F',
  }
}

/** Splits an optional `F(A,B,C) =` header from the index lists that follow. */
function splitHeader(source) {
  const eq = source.indexOf('=')
  if (eq === -1) return { vars: null, label: null, body: source, headerLength: 0 }

  const header = source.slice(0, eq).trim()
  const body = source.slice(eq + 1)
  const headerLength = eq + 1

  const withArgs = /^([A-Za-z][A-Za-z0-9]*)\s*\(([^)]*)\)$/.exec(header)
  if (withArgs) {
    const names = withArgs[2].split(/[,;\s]+/).filter(Boolean)
    const bad = names.find(n => !/^[A-Za-z][0-9]*$/.test(n))
    if (bad) {
      throw new ExpressionError(`"${bad}" is not a variable name.`, {
        position: header.indexOf(bad), length: bad.length,
        hint: 'A variable is one letter with optional digits, like A or Q0.',
      })
    }
    if (names.length === 0) {
      throw new ExpressionError('List the variables inside the brackets.', {
        position: 0, length: header.length, hint: 'For example: F(A,B,C) = Σm(0,2,5)',
      })
    }
    const upper = names.map(n => n[0].toUpperCase() + n.slice(1))
    const seen = new Set()
    for (const name of upper) {
      if (seen.has(name)) {
        throw new ExpressionError(`${name} is listed twice.`, {
          position: 0, length: header.length, hint: 'Each variable appears once.',
        })
      }
      seen.add(name)
    }
    return { vars: upper.sort(compareVariables), label: withArgs[1].toUpperCase(), body, headerLength }
  }

  // `F = Σm(...)` with no argument list: keep the label, infer the variables.
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(header)) {
    return { vars: null, label: header.toUpperCase(), body, headerLength }
  }

  throw new ExpressionError('The part before "=" should name the function.', {
    position: 0, length: Math.max(1, header.length),
    hint: 'For example: F(A,B,C) = Σm(0,2,5)',
  })
}

/**
 * Infers a variable count from the largest index. Only reachable when the
 * student omitted the F(...) header; the count is the smallest that can address
 * every index they listed, which is the reading that makes their input valid.
 */
function inferVariables(indices) {
  const max = indices.length > 0 ? Math.max(...indices) : 0
  let count = 1
  while (2 ** count <= max) count += 1
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i))
}

function parseIndexList(raw, offset) {
  const text = raw.trim()
  if (!text) return []

  const out = []
  for (const chunk of text.split(/[,;]+/)) {
    const piece = chunk.trim()
    if (!piece) continue

    const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(piece)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (to < from) {
        throw new ExpressionError(`Range ${piece} counts backwards.`, {
          position: offset, length: piece.length, hint: `Write ${to}-${from} instead.`,
        })
      }
      for (let n = from; n <= to; n += 1) out.push(n)
      continue
    }

    if (!/^\d+$/.test(piece)) {
      throw new ExpressionError(`"${piece}" is not an index.`, {
        position: offset, length: piece.length,
        hint: 'Indices are whole numbers, optionally as a range like 0-3.',
      })
    }
    out.push(Number(piece))
  }
  return out
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

/**
 * One call for either input style, so the page does not branch on it.
 * @param {string} input
 * @returns {{table: TruthTable, ast: Object|null, spec: Object|null}}
 */
export function analyse(input) {
  if (isMintermForm(input)) {
    const spec = parseMintermForm(input)
    return { table: tableFromMinterms(spec), ast: null, spec }
  }
  const ast = parseExpression(input)
  return { table: buildTruthTable(ast), ast, spec: null }
}
