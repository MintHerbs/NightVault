// Unit tests for truth-table construction and the minterm shorthand (T-089).
// Run with: npm run test:circuits

import { parseExpression, ExpressionError } from './expressionParser.js'
import {
  buildTruthTable,
  tableFromMinterms,
  parseMintermForm,
  isMintermForm,
  indexToInputs,
  analyse,
  MAX_VARIABLES,
} from './truthTable.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}
const outputs = (table) => table.rows.map(r => r.output).join('')

// --- Row order ---------------------------------------------------------------

const t1 = buildTruthTable(parseExpression('A'))
assert(t1.vars.join('') === 'A', '1: single variable')
assert(outputs(t1) === '01', '1: A truth table')

const t2 = buildTruthTable(parseExpression('AB'))
assert(t2.vars.join('') === 'AB', '2: sorted vars')
assert(outputs(t2) === '0001', '2: AND truth table')

// Row index must equal minterm index, with the first variable as MSB. Everything
// downstream depends on this.
const t3 = buildTruthTable(parseExpression("A B' C"))
assert(t3.minterms.join(',') === '5', "3: AB'C is minterm 5")
assert(t3.rows[5].inputs.join('') === '101', '3: row 5 is 101')
assert(t3.rows[5].minterm === 5, '3: minterm equals index')

// Variables are sorted even when they appear out of order in the source.
const t4 = buildTruthTable(parseExpression('C + A'))
assert(t4.vars.join('') === 'AC', '4: vars sorted regardless of source order')

// A constant has one row and no variables.
const t5 = buildTruthTable(parseExpression('1'))
assert(t5.vars.length === 0 && outputs(t5) === '1', '5: constant 1')

// varsOverride lets a caller add an input the expression never mentions.
const t6 = buildTruthTable(parseExpression('A'), ['A', 'B', 'C'])
assert(t6.vars.join('') === 'ABC', '6: override adds unused variables')
assert(outputs(t6) === '00001111', '6: A is the MSB')

// --- Term partitions ---------------------------------------------------------

const t7 = buildTruthTable(parseExpression('A+B'))
assert(t7.minterms.join(',') === '1,2,3', '7: minterms')
assert(t7.maxterms.join(',') === '0', '7: maxterms')
assert(t7.dontCares.length === 0, '7: no don\'t-cares from an expression')

// --- Variable limit ----------------------------------------------------------

try {
  buildTruthTable(parseExpression('ABCDEFGHI'))
  failures++
  console.error('  FAIL: 8: 9 variables should be refused')
} catch (err) {
  assert(err instanceof ExpressionError, '8: refusal is an ExpressionError')
  assert(err.message.includes(String(MAX_VARIABLES)), '8: message names the limit')
}

// --- Minterm form detection --------------------------------------------------

assert(isMintermForm('F(A,B,C) = Σm(0,2,5)'), '9: sigma form detected')
assert(isMintermForm('F(A,B,C) = Sm(0,2,5)'), '10: ASCII Sm detected')
assert(isMintermForm('ΠM(0,3)'), '11: pi form detected')
assert(isMintermForm('F(A,B) = m(1,2)'), '12: bare m() after = detected')
assert(isMintermForm('m(1,2,3)'), '13: bare m() at start detected')

// The disambiguation that matters: M(A+B) is an ordinary product, not a maxterm
// list. Reading it as one would silently produce a different function.
assert(!isMintermForm('M(A+B)'), '14: M(A+B) is an expression')
assert(!isMintermForm("AB' + CD"), '15: plain expression')
assert(!isMintermForm('A+B'), '16: plain sum')

// --- Minterm parsing ---------------------------------------------------------

const m1 = parseMintermForm('F(A,B,C) = Σm(0,2,5)')
assert(m1.vars.join('') === 'ABC', '17: vars from header')
assert(m1.minterms.join(',') === '0,2,5', '17: minterms')
assert(m1.form === 'sop', '17: sop form')
assert(m1.label === 'F', '17: label kept')

const m2 = parseMintermForm('F(A,B,C,D) = Σm(0,1,2,5) + Σd(8,10)')
assert(m2.minterms.join(',') === '0,1,2,5', "18: minterms separate from don't-cares")
assert(m2.dontCares.join(',') === '8,10', "18: don't-cares captured")

const m3 = parseMintermForm('F(A,B,C) = ΠM(0,3,5)')
assert(m3.form === 'pos', '19: maxterm form')
assert(m3.minterms.join(',') === '0,3,5', '19: listed indices are the zeros')

// Case is the only thing separating m from M in ASCII, so it has to matter.
assert(parseMintermForm('F(A,B) = Sm(1)').form === 'sop', '20: lowercase m is sop')
assert(parseMintermForm('F(A,B) = PM(1)').form === 'pos', '21: uppercase M is pos')

// Ranges.
const m4 = parseMintermForm('F(A,B,C) = Σm(0-3, 7)')
assert(m4.minterms.join(',') === '0,1,2,3,7', '22: range expanded')

// Variable count inferred when the header is omitted.
const m5 = parseMintermForm('Σm(0,2,5)')
assert(m5.vars.join('') === 'ABC', '23: 3 variables inferred from index 5')
const m6 = parseMintermForm('Σm(0,1)')
assert(m6.vars.join('') === 'A', '24: 1 variable inferred from index 1')

// --- Minterm table -----------------------------------------------------------

const tm1 = tableFromMinterms({ vars: ['A', 'B'], minterms: [1, 2] })
assert(outputs(tm1) === '0110', '25: XOR from minterms')

const tm2 = tableFromMinterms({ vars: ['A', 'B'], minterms: [0], form: 'pos' })
assert(outputs(tm2) === '0111', '26: maxterm 0 means row 0 is the only zero')

const tm3 = tableFromMinterms({ vars: ['A', 'B'], minterms: [1], dontCares: [2] })
assert(outputs(tm3) === '01x0', "27: don't-care row marked x")
assert(tm3.dontCares.join(',') === '2', "27: don't-care indexed")
assert(tm3.maxterms.join(',') === '0,3', "27: don't-cares are not maxterms")

// --- Minterm errors ----------------------------------------------------------

function expectError(fn, label, check) {
  try {
    fn()
    failures++
    console.error(`  FAIL: ${label} (no error thrown)`)
  } catch (err) {
    if (!(err instanceof ExpressionError)) {
      failures++
      console.error(`  FAIL: ${label} (wrong error type: ${err.name})`)
      return
    }
    if (check && !check(err)) {
      failures++
      console.error(`  FAIL: ${label} (${err.message})`)
    }
  }
}

expectError(() => parseMintermForm('F(A,B,C) = Σm(9)'), '28: index out of range',
  e => e.message.includes('out of range'))
expectError(() => parseMintermForm('F(A,B) = Σm(1) + Σd(1)'), "29: index in both lists",
  e => e.message.includes('both'))
expectError(() => parseMintermForm('F(A,B) = Σm(1) + ΠM(2)'), '30: minterms and maxterms together',
  e => e.message.includes('not both'))
expectError(() => parseMintermForm('F(A,B) = Σm(x)'), '31: non-numeric index')
expectError(() => parseMintermForm('F(A,B) = Σm(3-1)'), '32: backwards range',
  e => e.message.includes('backwards'))
expectError(() => parseMintermForm('F(A,B) ='), '33: no list at all')
expectError(() => parseMintermForm('F(AB,C) = Σm(1)'), '34: invalid variable name')
expectError(() => parseMintermForm('F(A,A) = Σm(1)'), '35: duplicate variable')
expectError(() => parseMintermForm(''), '36: empty input')

// tableFromMinterms enforces the overlap rule too, since it is a public entry
// point and a caller could build the spec by hand.
expectError(() => tableFromMinterms({ vars: ['A'], minterms: [1], dontCares: [1] }),
  '37: overlap rejected at table construction')

// --- indexToInputs -----------------------------------------------------------

assert(indexToInputs(0, 3).join('') === '000', '38: index 0')
assert(indexToInputs(5, 3).join('') === '101', '39: index 5')
assert(indexToInputs(5, 4).join('') === '0101', '40: width respected')

// --- analyse() routing -------------------------------------------------------

const a1 = analyse("AB' + CD")
assert(a1.ast !== null && a1.spec === null, '41: expression routed to the parser')
assert(a1.table.vars.join('') === 'ABCD', '41: table built')

const a2 = analyse('F(A,B,C) = Σm(1,3) + Σd(5)')
assert(a2.ast === null && a2.spec !== null, '42: shorthand routed to the minterm parser')
assert(a2.table.dontCares.join(',') === '5', "42: don't-care survives routing")

if (failures === 0) console.log('truthTable: all tests passed')
else { console.error(`truthTable: ${failures} failure(s)`); process.exit(1) }
