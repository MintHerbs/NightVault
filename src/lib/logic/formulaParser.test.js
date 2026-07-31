// Unit tests for the propositional logic parser.
// Run with: npm run test:logic
//
// These used to be a self-invoking IIFE at the bottom of formulaParser.js, which meant
// they ran on every page load in the shipped bundle (T-084).

import { parseFormula, FormulaError } from './formulaParser.js';

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`); }
};

// --- Structure ---------------------------------------------------------------

// De Morgan: ¬(P∧Q)↔(¬P∨¬Q)
const t1 = parseFormula('¬(P∧Q)↔(¬P∨¬Q)');
assert(t1.type === 'iff', '1: root iff');
assert(t1.left.type === 'not', '1: left not');
assert(t1.left.child.type === 'and', '1: left child and');
assert(t1.right.type === 'or', '1: right or');
assert(t1.right.left.type === 'not', '1: right.left not');
assert(t1.right.right.type === 'not', '1: right.right not');

// Negated De Morgan: ¬(¬(P∧Q)↔(¬P∨¬Q))
const t2 = parseFormula('¬(¬(P∧Q)↔(¬P∨¬Q))');
assert(t2.type === 'not', '2: root not');
assert(t2.child.type === 'iff', '2: child iff');

const t3 = parseFormula('P→Q');
assert(t3.type === 'implies', '3: implies');
assert(t3.left.name === 'P', '3: left P');
assert(t3.right.name === 'Q', '3: right Q');

const t4 = parseFormula('¬¬P');
assert(t4.type === 'not', '4: outer not');
assert(t4.child.type === 'not', '4: inner not');
assert(t4.child.child.name === 'P', '4: atom P');

const t5 = parseFormula('(P∨Q)→R');
assert(t5.type === 'implies', '5: implies');
assert(t5.left.type === 'or', '5: left or');
assert(t5.left.left.name === 'P', '5: P');
assert(t5.left.right.name === 'Q', '5: Q');
assert(t5.right.name === 'R', '5: right R');

// ASCII equivalents
const t6 = parseFormula('~(P&Q)<->(~P|~Q)');
assert(t6.type === 'iff', '6: iff');
assert(t6.left.type === 'not', '6: left not');
assert(t6.left.child.type === 'and', '6: left child and');
assert(t6.right.type === 'or', '6: right or');

// → is right-associative: P→Q→R parses as P→(Q→R)
const t7 = parseFormula('P->Q->R');
assert(t7.type === 'implies', '7: outer implies');
assert(t7.left.name === 'P', '7: left P');
assert(t7.right.type === 'implies', '7: right implies (right-assoc)');
assert(t7.right.left.name === 'Q', '7: Q');
assert(t7.right.right.name === 'R', '7: R');

// ∧ binds tighter than ∨
const t8 = parseFormula('P|Q&R');
assert(t8.type === 'or', '8: or at root');
assert(t8.right.type === 'and', '8: and under or');

// Whitespace is insignificant
assert(JSON.stringify(parseFormula('P -> Q')) === JSON.stringify(parseFormula('P->Q')),
  '9: whitespace ignored');

// --- Errors ------------------------------------------------------------------

// Each case: input, the 0-based index the caret should land on, and a fragment the
// message must contain. Positions are what the error card underlines.
const ERROR_CASES = [
  ['P∧',      1, 'stops early'],
  ['',        0, 'Enter a formula'],
  ['   ',     0, 'Enter a formula'],
  ['(P∧Q',    0, 'never closed'],
  ['P∧Q)',    3, 'no opening bracket'],
  ['P Q',     2, 'already complete'],
  ['PQ',      1, 'already complete'],
  ['∧P',      0, 'needs a proposition before it'],
  ['()',      1, 'nothing in it'],
  ['p→q',     0, 'capital letters'],
  ['P∴Q',     1, 'cannot be used here'],
  ['⊤',       0, 'cannot be used here'],
  ['⊥',       0, 'cannot be used here'],
  ['P,Q',     1, 'cannot be used here'],
  ['1+1',     0, 'not a logic symbol'],
  ['P<-Q',    1, 'not a logic symbol']
];

for (const [input, position, fragment] of ERROR_CASES) {
  let err = null;
  try { parseFormula(input); } catch (e) { err = e; }
  const shown = JSON.stringify(input);
  if (!err) { assert(false, `error ${shown}: expected a throw, got a parse`); continue; }
  assert(err instanceof FormulaError, `error ${shown}: expected FormulaError, got ${err.name}`);
  assert(err.position === position,
    `error ${shown}: position ${err.position}, expected ${position}`);
  assert(err.message.includes(fragment),
    `error ${shown}: message "${err.message}" missing "${fragment}"`);
  assert(typeof err.hint === 'string' && err.hint.length > 0,
    `error ${shown}: missing hint`);
}

// A multi-character operator is underlined whole, not just its first character.
const MULTI_CHAR = [
  ['->P', 2],
  ['<->P', 3]
];
for (const [input, length] of MULTI_CHAR) {
  let err = null;
  try { parseFormula(input); } catch (e) { err = e; }
  assert(err !== null, `multi-char ${input}: expected a throw`);
  assert(err && err.length === length,
    `multi-char ${input}: underlines ${err && err.length} chars, expected ${length}`);
}

// A caret must never point past the end of the input.
for (const [input] of ERROR_CASES) {
  let err = null;
  try { parseFormula(input); } catch (e) { err = e; }
  if (err) {
    assert(err.position >= 0 && err.position <= Math.max(0, input.length),
      `caret in range for ${JSON.stringify(input)}: got ${err.position}`);
  }
}

if (failures > 0) {
  console.error(`[formulaParser] ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('[formulaParser] all tests passed');
