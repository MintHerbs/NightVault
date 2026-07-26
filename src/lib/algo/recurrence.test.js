/**
 * Recurrence solver test suite.
 *
 * Run with: npm run test:recurrence
 *
 * Every canonical recurrence is checked through BOTH methods, because the
 * whole point of the rewrite is that the tree method and the substitution
 * method each derive the answer independently and must still agree.
 * The tree geometry is checked programmatically rather than by eye.
 */

import { parseRecurrence } from './recurrenceParser.js';
import { solveByTree, solveBySubstitution, annotationRightEdge, BREADTH_BUDGET } from './recurrenceSolver.js';
import { formatGrowth } from './recurrenceMath.js';
import { findOverlaps } from './recurrenceTreeLayout.js';

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failures.push(`${name}\n      expected: ${expected}\n      actual:   ${actual}`);
  }
}

function checkThat(name, condition, detail = '') {
  if (condition) {
    passed++;
  } else {
    failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Complexity, via both methods
// ---------------------------------------------------------------------------

// [ input, expected growth ]
const CASES = [
  // chain: T(n) = T(n-b) + f(n)
  ['T(n) = T(n-1) + 1', 'n'],
  ['T(n) = T(n-1) + n', 'n²'],
  ['T(n) = T(n-1) + n^2', 'n³'],
  ['T(n) = T(n-1) + log(n)', 'n log n'],
  ['T(n) = T(n-1) + n*log(n)', 'n² log n'],
  ['T(n) = T(n-1) + sqrt(n)', 'n√n'],
  ['T(n) = T(n-2) + n', 'n²'],
  ['T(n) = T(n-2) + 1', 'n'],
  ['T(n) = T(n-5) + n', 'n²'],

  // branching subtract: exponential
  ['T(n) = 2T(n-1) + 1', '2ⁿ'],
  ['T(n) = 2T(n-1) + n', '2ⁿ'],
  ['T(n) = 3T(n-1) + 1', '3ⁿ'],
  ['T(n) = T(n-1) + T(n-2)', 'φⁿ'],
  ['T(n) = T(n-1) + T(n-2) + 1', 'φⁿ'],

  // divide and conquer, case 1 (root dominates)
  ['T(n) = T(n/2) + n', 'n'],
  ['T(n) = 2T(n/2) + n^2', 'n²'],
  ['T(n) = 3T(n/4) + n*log(n)', 'n log n'],
  ['T(n) = T(n/2) + n^2', 'n²'],

  // divide and conquer, case 2 (all levels equal)
  ['T(n) = 2T(n/2) + n', 'n log n'],
  ['T(n) = T(n/2) + 1', 'log n'],
  ['T(n) = T(n/2) + log(n)', 'log² n'],
  ['T(n) = 2T(n/2) + n*log(n)', 'n log² n'],
  ['T(n) = 2T(n/4) + sqrt(n)', '√n log n'],
  ['T(n) = 8T(n/2) + n^3', 'n³ log n'],
  ['T(n) = 4T(n/2) + n^2', 'n² log n'],

  // divide and conquer, case 3 (leaves dominate)
  ['T(n) = 2T(n/2) + 1', 'n'],
  ['T(n) = 4T(n/2) + n', 'n²'],
  ['T(n) = 3T(n/2) + n', 'n^1.58'],
  ['T(n) = 7T(n/2) + n^2', 'n^2.81'],
  ['T(n) = 9T(n/3) + n', 'n²'],
  ['T(n) = 16T(n/2) + n^2', 'n⁴'],
  ['T(n) = 2T(n/2)', 'n'],

  // root shrink
  ['T(n) = T(sqrt(n)) + 1', 'log log n'],
  ['T(n) = T(sqrt(n)) + log(n)', 'log n'],

  // Case 2 is only "one more log" when q > -1. At q = -1 the level costs form
  // a harmonic series, and below that the sum converges and the level count
  // drops out. Assuming the first branch made n/log n come back as Theta(n).
  ['T(n) = 2T(n/2) + n/log(n)', 'n log log n'],
  ['T(n) = 4T(n/2) + n^2/log(n)', 'n² log log n'],
  ['T(n) = 2T(n/2) + n/log^2(n)', 'n'],
  ['T(n) = 2T(n/2) + n^2/log(n)', 'n²/log n'],
  ['T(n) = 2T(n/2) + n*log^2(n)', 'n log³ n'],
  ['T(n) = T(n/2) + log^2(n)', 'log³ n'],

  // Named algorithms
  ['T(n) = T(9n/10) + n', 'n'],
  ['T(n) = 100T(n/10) + n^2', 'n² log n'],
  ['T(n) = 1000T(n/2) + n', 'n^9.97'],
  ['T(n) = T(n/1000) + n', 'n'],
  ['T(n) = T(n/2) + n^100', 'n^100'],

  // Non-integer exponents on both sides
  ['T(n) = 2T(n/2) + n^1.5', 'n√n'],
  ['T(n) = 5T(n/3) + n^1.5', 'n√n'],
  ['T(n) = 2T(n/2) + n^0.5', 'n'],

  // Multi-term and higher-order linear recurrences
  ['T(n) = T(n-1) + T(n-3)', '1.47ⁿ'],
  ['T(n) = 2T(n-1) + T(n-2)', '2.41ⁿ'],
  ['T(n) = 2T(n-2) + 1', '1.41ⁿ'],
  ['T(n) = T(n-10) + n', 'n²'],

  // Coefficients split across several calls of the same size
  ['T(n) = T(n/2) + T(n/2) + n', 'n log n'],
  ['T(n) = T(n/3) + T(n/3) + T(n/3) + n', 'n log n'],
];

// Spelling and spacing must not change the answer.
const FORMAT_EQUIVALENTS = [
  ['T(n)=2T(n/2)+n', 'n log n'],
  ['T(n)   =   2T( n / 2 )  +  n', 'n log n'],
  ['t(n) = 2t(n/2) + n', 'n log n'],
  ['T(n) = n + 2T(n/2)', 'n log n'],
  ['T(n) = 2*T(n/2) + n', 'n log n'],
  ['T(n) = 2T(n/2) + 3n + 5', 'n log n'],
  ['T(n) = 2T(n/2 + 17) + n', 'n log n'],
  ['T(n) = 2T(n/2) + n lg n', 'n log² n'],
  ['T(n) = 2T(n/2) + n ln n', 'n log² n'],
  ['T(n) = T(n/2) + log_2(n)', 'log² n'],
  ['T(n) = 2T(n/2) + n^1', 'n log n'],
  ['T(n) = T(n-1) + 100', 'n'],
];

console.log('=== 1. Complexity via tree and substitution ===');
for (const [input, expected] of CASES) {
  const parsed = parseRecurrence(input);
  if (parsed.error) {
    failures.push(`${input}\n      unexpected parse error: ${parsed.error}`);
    continue;
  }
  const tree = solveByTree(parsed);
  const subst = solveBySubstitution(parsed);

  check(`tree   ${input}`, tree.growth ? formatGrowth(tree.growth) : 'no result', expected);
  check(`subst  ${input}`, subst.growth ? formatGrowth(subst.growth) : 'no result', expected);
}

console.log('=== 1b. Formatting variants give the same answer ===');
for (const [input, expected] of FORMAT_EQUIVALENTS) {
  const parsed = parseRecurrence(input);
  if (parsed.error) {
    failures.push(`${input}\n      unexpected parse error: ${parsed.error}`);
    continue;
  }
  check(`format  ${input}`, formatGrowth(solveByTree(parsed).growth), expected);
  check(`format  ${input} (subst)`, formatGrowth(solveBySubstitution(parsed).growth), expected);
}

// ---------------------------------------------------------------------------
// 2. Tree geometry: no overlapping boxes, on every supported case
// ---------------------------------------------------------------------------

console.log('=== 2. Tree layout has no overlapping node boxes ===');
for (const [input] of CASES) {
  const parsed = parseRecurrence(input);
  if (parsed.error) continue;
  const { tree } = solveByTree(parsed);
  if (!tree) {
    failures.push(`${input}: no tree produced`);
    continue;
  }
  const clashes = findOverlaps(tree.nodes);
  checkThat(
    `no overlap  ${input}`,
    clashes.length === 0,
    clashes.length ? `${clashes.length} overlapping pair(s), e.g. ${clashes[0].a} / ${clashes[0].b}` : ''
  );
}

// ---------------------------------------------------------------------------
// 3. Tree structure: dots, base case, derived formula, honest annotations
// ---------------------------------------------------------------------------

console.log('=== 3. Tree ends with dots, a base case and the derived formula ===');
for (const [input] of CASES) {
  const parsed = parseRecurrence(input);
  if (parsed.error) continue;
  const { tree } = solveByTree(parsed);
  checkThat(`has tail dots  ${input}`, !!tree.tail && Number.isFinite(tree.tail.dotsY));
  checkThat(`has base node  ${input}`, tree.nodes.some(n => n.kind === 'base'));
  checkThat(
    `ends with the derived result  ${input}`,
    tree.derivation.lines.length > 0 && /^= Θ\(/.test(tree.derivation.lines[tree.derivation.lines.length - 1]),
    `last line was "${tree.derivation.lines[tree.derivation.lines.length - 1]}"`
  );
  // Everything drawn must fit: nodes, the annotation column and the derived
  // formula. Checking only the nodes let a clipped annotation box through.
  const right = tree.viewBox.x + tree.viewBox.width;
  const bottom = tree.viewBox.y + tree.viewBox.height;
  const outside = [
    ...tree.nodes.map(n => ({ what: `node ${n.id}`, l: n.x - n.w / 2, r: n.x + n.w / 2, t: n.y - n.h / 2, b: n.y + n.h / 2 })),
    ...tree.annotations.map(a => ({
      what: `annotation L${a.depth}`,
      l: a.x,
      r: annotationRightEdge(a),
      t: a.y - 13,
      b: a.y + 13,
    })),
    {
      what: 'derivation',
      l: tree.derivation.x - tree.derivation.width / 2,
      r: tree.derivation.x + tree.derivation.width / 2,
      t: tree.derivation.y - 22,
      b: tree.derivation.y + 24 * tree.derivation.lines.length,
    },
  ].filter(box => box.l < tree.viewBox.x - 1 || box.r > right + 1 || box.t < tree.viewBox.y - 1 || box.b > bottom + 1);

  checkThat(
    `viewBox covers content  ${input}`,
    tree.viewBox.width > 0 && tree.viewBox.height > 0 && outside.length === 0,
    outside.length ? `clipped: ${outside.map(o => o.what).join(', ')}` : ''
  );
}

// Level costs must actually differ per level when a != b^p. (The old solver
// printed f(n) unchanged on every level.) Only levels that were drawn carry a
// count; the base-case row is annotated with its leaf count instead.
const drawnCosts = input =>
  solveByTree(parseRecurrence(input)).tree.annotations.filter(a => a.countText).map(a => a.costText);

check('4T(n/2)+n level costs grow', drawnCosts('T(n) = 4T(n/2) + n').join(' | '), 'n | 2n');
check('2T(n/2)+n level costs are equal', drawnCosts('T(n) = 2T(n/2) + n').join(' | '), 'n | n | n');
check('2T(n/2)+n^2 level costs shrink', drawnCosts('T(n) = 2T(n/2) + n^2').join(' | '), 'n² | (1/2)n² | (1/4)n²');
check('T(n-1)+n level costs', drawnCosts('T(n) = T(n-1) + n').join(' | '), 'n | n−1 | n−2');

// The derivation must still show the level the drawing elided.
{
  const { tree } = solveByTree(parseRecurrence('T(n) = 4T(n/2) + n'));
  checkThat(
    '4T(n/2)+n derivation shows the elided level',
    tree.derivation.lines[0].includes('n + 2n + 4n'),
    tree.derivation.lines[0]
  );
}

// Every drawn level must be complete, otherwise one subtree sits far from its
// siblings and the tree reads as broken. The exception is a branching factor
// too large to draw at all (a = 1000), where a single ellipsis is the honest
// fallback and the annotation must still report the true count.
console.log('=== 3b. Drawn levels are fully expanded ===');
for (const [input] of CASES) {
  const parsed = parseRecurrence(input);
  if (parsed.error) continue;
  const { tree } = solveByTree(parsed);
  const elided = tree.nodes.some(n => n.kind === 'ellipsis');
  const branching = parsed.a ?? 1;

  if (branching <= BREADTH_BUDGET) {
    checkThat(`no partial level  ${input}`, !elided, 'an ellipsis node was drawn');
  } else {
    checkThat(
      `elided level reports its true count  ${input}`,
      tree.annotations.some(a => a.countText.startsWith(`${Math.round(branching)} `)),
      `no annotation stated the true count of ${branching}`
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Substituted labels must be mathematically correct text
// ---------------------------------------------------------------------------

console.log('=== 4. Substituted f(n) labels are correctly bracketed ===');
{
  const cases = [
    ['T(n) = T(n-1) + n^2', '(n−1)²'],
    ['T(n) = T(n-1) + n*log(n)', '(n−1) log(n−1)'],
    ['T(n) = T(n-1) + sqrt(n)', '√(n−1)'],
    ['T(n) = 2T(n/2) + n^2', '(n/2)²'],
    ['T(n) = 2T(n/2) + n*log(n)', 'log(n/2)'],
  ];
  for (const [input, expectedFragment] of cases) {
    const { tree } = solveByTree(parseRecurrence(input));
    // Both columns are user-visible, so either may carry the substituted form.
    const all = tree.annotations.map(a => `${a.countText} ${a.costText}`).join(' ; ');
    checkThat(`label  ${input}`, all.includes(expectedFragment), `expected to find "${expectedFragment}" in: ${all}`);
  }
  // The old bug produced "n−1^2"; make sure that shape never comes back.
  for (const [input] of CASES) {
    const parsed = parseRecurrence(input);
    if (parsed.error) continue;
    const { tree } = solveByTree(parsed);
    const text = tree.annotations.map(a => `${a.countText} ${a.costText}`).join(' ');
    checkThat(`no unbracketed power  ${input}`, !/n−\d\^/.test(text), `found in: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// 5. Unsupported input errors clearly instead of guessing
// ---------------------------------------------------------------------------

console.log('=== 5. Unsupported input reports an error ===');
const REJECTED = [
  'T(n) = T(n/3) + T(2n/3) + n',   // Akra-Bazzi
  'T(n) = T(n/5) + T(7n/10) + n',  // median of medians
  'T(n) = T(n) + 1',
  'T(n) = T(n+1) + 1',
  'T(n) = T(n/1) + n',
  'T(n) = n + 1',
  'x = 3',
  'T(n) = T(n/2) + T(n-1)',
  'T(n) = 2T(n/2) +',              // dangling operator: do not answer 2T(n/2)
  'T(n) =',
  '2T(n/2) + n',
  'hello world',
  'T(n) = T(n-1) + 2^n',           // f outside the c·n^p·log^q n model
  'T(n) = 2T(n/2) + n!',
  '',
];
for (const input of REJECTED) {
  const parsed = parseRecurrence(input);
  checkThat(`rejects "${input}"`, !!parsed.error, `parsed instead as ${JSON.stringify(parsed.type)}`);
}

// Accepted-but-unusual input must still parse.
const ACCEPTED = [
  'T(n) = T(n/2 + 1) + n',
  'T(n) = 2T(n/2) + n log n',
  'T(n) = 2T(n/2) + 4n',
  'T(n) = T(n-1) + 100',
  't(n) = 2t(n/2) + n',
];
for (const input of ACCEPTED) {
  const parsed = parseRecurrence(input);
  checkThat(`accepts "${input}"`, !parsed.error, `rejected with: ${parsed.error}`);
}

// ---------------------------------------------------------------------------
// 6. Neither method leans on the Master Theorem for its answer
// ---------------------------------------------------------------------------

console.log('=== 6. Step panels show the method that was actually used ===');
for (const input of ['T(n) = 2T(n/2) + n', 'T(n) = T(n-1) + n']) {
  const parsed = parseRecurrence(input);
  const treeText = solveByTree(parsed).steps.map(s => s.text).join('\n');
  const substText = solveBySubstitution(parsed).steps.map(s => s.text).join('\n');
  checkThat(`tree steps avoid Master Theorem  ${input}`, !/master theorem/i.test(treeText));
  checkThat(`subst steps avoid Master Theorem  ${input}`, !/master theorem/i.test(substText));
  checkThat(`tree steps show level sums  ${input}`, /Level 0:/.test(treeText));
  checkThat(`subst steps show back-substitution  ${input}`, /Substitute back/i.test(substText));
  checkThat(`subst steps solve for k  ${input}`, /so k =/.test(substText));
}

// Substitution must also produce renderable formulas for the left panel.
for (const [input] of CASES) {
  const parsed = parseRecurrence(input);
  if (parsed.error) continue;
  const { formulas } = solveBySubstitution(parsed);
  checkThat(`substitution formulas  ${input}`, formulas.length >= 5, `only ${formulas.length} formulas`);
  checkThat(
    `no undefined in formulas  ${input}`,
    !formulas.some(f => /undefined|NaN/.test(f.latex)),
    formulas.find(f => /undefined|NaN/.test(f.latex))?.latex ?? ''
  );
}

// ---------------------------------------------------------------------------

console.log('');
if (failures.length === 0) {
  console.log(`All ${passed} assertions passed.`);
  process.exit(0);
} else {
  console.log(`${passed} passed, ${failures.length} FAILED:\n`);
  failures.forEach(f => console.log(`  ✗ ${f}`));
  process.exit(1);
}
