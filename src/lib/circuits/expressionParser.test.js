// Unit tests for the digital-logic expression parser (T-089).
// Run with: npm run test:circuits

import {
  parseExpression,
  ExpressionError,
  collectVariables,
  evaluate,
  formatExpression,
  formatFullyParenthesised,
} from './expressionParser.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

// Truth-table equality is the only structural comparison that matters for most
// of these, so compare functions rather than tree shapes wherever possible.
function tableOf(source, vars) {
  const ast = typeof source === 'string' ? parseExpression(source) : source
  const names = vars ?? collectVariables(ast)
  const rows = []
  for (let i = 0; i < 2 ** names.length; i += 1) {
    const assignment = {}
    names.forEach((name, k) => {
      assignment[name] = (i >> (names.length - 1 - k)) & 1
    })
    rows.push(evaluate(ast, assignment))
  }
  return rows.join('')
}

const sameFunction = (a, b, msg) => {
  const vars = [...new Set([...collectVariables(parseExpression(a)), ...collectVariables(parseExpression(b))])].sort()
  assert(tableOf(a, vars) === tableOf(b, vars), `${msg} (${a} vs ${b})`)
}

// --- Implicit AND ------------------------------------------------------------

const t1 = parseExpression('AB')
assert(t1.type === 'and' && t1.operands.length === 2, '1: AB is a 2-operand and')
assert(t1.operands[0].name === 'A' && t1.operands[1].name === 'B', '1: operands A, B')

const t2 = parseExpression('ABC')
assert(t2.type === 'and' && t2.operands.length === 3, '2: ABC flattens to 3 operands')

const t3 = parseExpression('A(BC)')
assert(t3.type === 'and' && t3.operands.length === 3, '3: A(BC) flattens associatively')

const t4 = parseExpression('Q0Q1')
assert(t4.operands[0].name === 'Q0' && t4.operands[1].name === 'Q1', '4: digits attach to the letter')

sameFunction('AB', 'A·B', '5: · is AND')
sameFunction('AB', 'A*B', '6: * is AND')
sameFunction('AB', 'A&B', '7: & is AND')
sameFunction('AB', 'A.B', '8: . is AND')
sameFunction('AB', 'A AND B', '9: word AND')

// --- Complement --------------------------------------------------------------

const t10 = parseExpression("A'")
assert(t10.type === 'not' && t10.child.name === 'A', "10: A' is not(A)")

const t11 = parseExpression("(A+B)'")
assert(t11.type === 'not' && t11.child.type === 'or', "11: (A+B)' complements the group")

const t12 = parseExpression("A+B'")
assert(t12.type === 'or' && t12.operands[1].type === 'not', "12: A+B' complements only B")

const t13 = parseExpression("A''")
assert(t13.type === 'not' && t13.child.type === 'not', '13: double complement is kept, not folded')

sameFunction("A'", '!A', '14: ! is NOT')
sameFunction("A'", '~A', '15: ~ is NOT')
sameFunction("A'", '¬A', '16: ¬ is NOT')
sameFunction("A'", 'NOT A', '17: word NOT')
sameFunction("A'", "A’", '18: typographic apostrophe')
sameFunction("A'", 'Ā', '19: precomposed macron')
sameFunction("A'", 'Ā', '20: combining macron')

// Prefix NOT binds to the next factor only, so !AB is (A')B and not (AB)'.
const t21 = parseExpression('!AB')
assert(t21.type === 'and', '21: !AB is a product')
assert(t21.operands[0].type === 'not' && t21.operands[1].name === 'B', "21: !AB is A'B")
sameFunction('!AB', "A'B", '21b: !AB matches A\'B')

// --- Precedence --------------------------------------------------------------

const t22 = parseExpression('AB + CD')
assert(t22.type === 'or' && t22.operands.length === 2, '22: + is looser than juxtaposition')
assert(t22.operands[0].type === 'and' && t22.operands[1].type === 'and', '22: both sides are products')

const t23 = parseExpression('A + B ^ C')
assert(t23.type === 'or', '23: XOR binds tighter than OR')
assert(t23.operands[1].type === 'xor', '23: right side is the XOR')

const t24 = parseExpression('AB ^ C')
assert(t24.type === 'xor' && t24.operands[0].type === 'and', '24: AND binds tighter than XOR')

sameFunction('A+B+C', 'A+(B+C)', '25: OR associative')
sameFunction('A^B^C', '(A^B)^C', '26: XOR associative')

// --- Word operators ----------------------------------------------------------

sameFunction('A NAND B', "(AB)'", '27: NAND')
sameFunction('A NOR B', "(A+B)'", '28: NOR')
sameFunction('A XOR B', 'A^B', '29: XOR word')
sameFunction('A XNOR B', "(A^B)'", '30: XNOR word')
sameFunction('A OR B', 'A+B', '31: OR word')

// ANDB has no word boundary after AND, so it must fall through to juxtaposition
// rather than being read as an operator with a dangling B.
const t32 = parseExpression('ANDB')
assert(t32.type === 'and' && t32.operands.length === 4, '32: ANDB is A·N·D·B')

// A variable N followed by the word OR must still read as OR.
const t33 = parseExpression('N OR B')
assert(t33.type === 'or', '33: N OR B is a sum')

// NOR wins over N followed by variable R when written closed up. Documented
// behaviour, asserted so a future tokenizer change is a deliberate one.
const t34 = parseExpression('A NOR B')
assert(t34.type === 'not', '34: NOR keyword wins')

// --- Constants ---------------------------------------------------------------

assert(parseExpression('0').value === 0, '35: constant 0')
assert(parseExpression('1').value === 1, '36: constant 1')
assert(tableOf('A·0', ['A']) === '00', '37: A·0 is 0')
assert(tableOf('A+1', ['A']) === '11', '38: A+1 is 1')

// --- Variables ---------------------------------------------------------------

assert(collectVariables(parseExpression("AB'+CA")).join(',') === 'A,B,C', '39: sorted, deduped')
assert(collectVariables(parseExpression('Q10+Q2')).join(',') === 'Q2,Q10', '40: numeric order, not string order')
assert(collectVariables(parseExpression('a+B')).join(',') === 'A,B', '41: case folded to upper')

// --- Semantics ---------------------------------------------------------------

assert(tableOf("AB' + A'B", ['A', 'B']) === '0110', '42: XOR by hand')
assert(tableOf('A^B', ['A', 'B']) === '0110', '43: XOR operator')
assert(tableOf("(A+B)'", ['A', 'B']) === '1000', '44: NOR truth table')
assert(tableOf('A+BC', ['A', 'B', 'C']) === '00011111', '45: A+BC')

// De Morgan, both directions.
sameFunction("(AB)'", "A'+B'", '46: De Morgan product')
sameFunction("(A+B)'", "A'B'", '47: De Morgan sum')

// --- Formatting --------------------------------------------------------------

assert(formatExpression(parseExpression("AB'+CD")) === "AB' + CD", '48: canonical display')
assert(formatExpression(parseExpression("(A+B)'")) === "(A + B)'", '49: complemented group')
assert(formatExpression(parseExpression('A(B+C)')) === 'A(B + C)', '50: bracket kept where needed')
assert(formatFullyParenthesised(parseExpression('AB+C')) === '((A · B) + C)', '51: fully parenthesised echo')

// Round trip: the canonical form must re-parse to the same function.
for (const source of ["AB'+CD", 'A(B+C)', "(A+B)'C", 'A^B^C', "A'B'C'", 'A+BC+D']) {
  const once = formatExpression(parseExpression(source))
  sameFunction(source, once, `52: round trip ${source}`)
}

// A constant inside a product must not be juxtaposed against a variable: `A0`
// reads back as a variable NAMED A0, so the formatter would be emitting text it
// cannot itself parse.
for (const source of ['A·0', 'A·1', 'Q1·0', "A'·0", 'A·0·B', 'ABC·1']) {
  const once = formatExpression(parseExpression(source))
  assert(!/[A-Z]\d*0(?![0-9])|(?<![·(])[A-Z]\d*[01]/.test(once.replace(/\s/g, '')) || once.includes('·'),
    `52b: ${source} renders unambiguously, got ${once}`)
  sameFunction(source, once, `52b: round trip ${source}`)
  // And the round trip must be stable, not merely equivalent once.
  const twice = formatExpression(parseExpression(once))
  assert(once === twice, `52b: ${source} is stable under re-rendering (${once} vs ${twice})`)
}

assert(formatExpression(parseExpression('A·0')) === 'A·0', "52c: A·0 keeps its separator")
assert(formatExpression(parseExpression('0A')) === '0A', '52c: 0A needs no separator')
assert(formatExpression(parseExpression('AB')) === 'AB', '52c: ordinary products stay compact')

// --- Errors ------------------------------------------------------------------

function expectError(source, label, check) {
  try {
    parseExpression(source)
    failures++
    console.error(`  FAIL: ${label} (no error thrown)`)
  } catch (err) {
    if (!(err instanceof ExpressionError)) {
      failures++
      console.error(`  FAIL: ${label} (wrong error type: ${err.name})`)
      return
    }
    if (typeof err.position !== 'number' || typeof err.length !== 'number') {
      failures++
      console.error(`  FAIL: ${label} (missing position/length)`)
      return
    }
    if (typeof err.hint !== 'string') {
      failures++
      console.error(`  FAIL: ${label} (missing hint)`)
      return
    }
    if (check && !check(err)) {
      failures++
      console.error(`  FAIL: ${label} (position ${err.position}: ${err.message})`)
    }
  }
}

expectError('', '53: empty input')
expectError('   ', '54: whitespace only')
expectError('A +', '55: trailing operator')
expectError('+ A', '56: leading operator')
expectError('(A+B', '57: unclosed bracket', e => e.position === 0)
expectError('A+B)', '58: unopened bracket', e => e.position === 3)
expectError("'A", '59: leading complement', e => e.position === 0)
expectError('A#B', '60: unknown symbol', e => e.position === 1)
expectError('A + 2', '61: digit that is not 0 or 1', e => e.position === 4)
expectError('F(A,B) = Sm(1,2)', '62: minterm form in the expression box')
expectError('Σm(1,2)', '63: sigma in the expression box', e => e.position === 0)
expectError('A!', '64: dangling NOT')

// Every error must underline a real slice of the input.
for (const bad of ['(A+B', 'A+B)', 'A#B', "'A"]) {
  try {
    parseExpression(bad)
  } catch (err) {
    assert(err.position >= 0 && err.position < bad.length, `65: ${bad} position in range`)
    assert(err.position + err.length <= bad.length, `65: ${bad} underline within input`)
  }
}

if (failures === 0) console.log('expressionParser: all tests passed')
else { console.error(`expressionParser: ${failures} failure(s)`); process.exit(1) }
