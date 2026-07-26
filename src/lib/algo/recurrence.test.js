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
import { findOverlaps, findTailCollisions } from './recurrenceTreeLayout.js';

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

  // Unequal splits, analysed by Akra-Bazzi (T-058)
  ['T(n) = T(n/3) + T(2n/3) + n', 'n log n'],
  ['T(n) = T(n/5) + T(7n/10) + n', 'n'],
  ['T(n) = T(n/2) + T(n/4) + n', 'n'],
  ['T(n) = T(n/3) + T(2n/3) + 1', 'n'],
  ['T(n) = T(n/3) + T(2n/3) + n^2', 'n²'],
  ['T(n) = 2T(n/4) + T(n/2) + n', 'n log n'],
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

  // The dashed "continues" tail must not be drawn through a label either.
  const throughNodes = findTailCollisions(tree.nodes, tree.tail);
  checkThat(
    `tail clears every box  ${input}`,
    throughNodes.length === 0,
    throughNodes.length ? `tail crosses ${throughNodes.join(', ')}` : ''
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

/** Cost labels drawn inside the tree, used by chains since T-056. */
const chainCosts = input =>
  solveByTree(parseRecurrence(input)).tree.nodes.filter(n => n.kind === 'cost').map(n => n.label);

/** Every user-visible cost string, wherever the shape happens to put it. */
const allCostText = input => {
  const { tree } = solveByTree(parseRecurrence(input));
  return [
    ...tree.nodes.filter(n => n.kind === 'cost').map(n => n.label),
    ...tree.annotations.map(a => `${a.countText} ${a.costText}`),
  ].join(' ; ');
};

check('4T(n/2)+n level costs grow', drawnCosts('T(n) = 4T(n/2) + n').join(' | '), 'n | 2n');
check('2T(n/2)+n level costs are equal', drawnCosts('T(n) = 2T(n/2) + n').join(' | '), 'n | n | n');
check('2T(n/2)+n^2 level costs shrink', drawnCosts('T(n) = 2T(n/2) + n^2').join(' | '), 'n² | (1/2)n² | (1/4)n²');
// Chains carry their cost in the tree now, not the column (T-056).
check('T(n-1)+n level costs', chainCosts('T(n) = T(n-1) + n').join(' | '), 'n | n−1 | n−2');

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
// T-056: a tree where every node has at most one child is a vertical line, not
// a recursion tree. Chains must branch into [work, next call].
console.log('=== 3c. No tree is a bare vertical line ===');
for (const [input] of CASES) {
  const parsed = parseRecurrence(input);
  if (parsed.error) continue;
  const { tree } = solveByTree(parsed);
  const childCount = new Map();
  tree.edges.forEach(e => childCount.set(e.from, (childCount.get(e.from) ?? 0) + 1));
  const maxChildren = Math.max(0, ...childCount.values());
  checkThat(`tree branches  ${input}`, maxChildren >= 2, `every node has <= 1 child (max ${maxChildren})`);
}

// Chains must show the work at each level as a labelled node.
for (const [input, levels] of [
  ['T(n) = T(n-1) + n', ['n', 'n−1', 'n−2']],
  ['T(n) = T(n/2) + log(n)', ['log(n)', 'log(n/2)', 'log(n/4)']],
  ['T(n) = T(n-2) + n^2', ['n²', '(n−2)²', '(n−4)²']],
]) {
  const { tree } = solveByTree(parseRecurrence(input));
  const costs = tree.nodes.filter(n => n.kind === 'cost').map(n => n.label);
  check(`chain cost nodes  ${input}`, costs.join(' | '), levels.join(' | '));
}

// T-061: branching subtract trees must put the work in the tree too, since the
// sum being built is the sum of the node labels. Any node that was expanded
// carries exactly one cost child; a node on the last drawn row was not
// expanded, so its own work belongs to the elided part and must not appear.
console.log('=== 3d. Branching trees carry their work as a leftmost child ===');
for (const input of [
  'T(n) = 2T(n-1) + 1',
  'T(n) = 3T(n-1) + n',
  'T(n) = T(n-1) + T(n-2)',
  'T(n) = 2T(n-2) + 1',
]) {
  const { tree } = solveByTree(parseRecurrence(input));
  const byId = new Map(tree.nodes.map(n => [n.id, n]));
  const kids = new Map();
  tree.edges.forEach(e => kids.set(e.from, [...(kids.get(e.from) ?? []), byId.get(e.to)]));

  const expanded = tree.nodes.filter(n => n.kind === 'recursive' && kids.has(n.id));
  const offenders = expanded.filter(
    n => (kids.get(n.id) ?? []).filter(k => k?.kind === 'cost').length !== 1
  );
  checkThat(
    `every expanded node has one cost child  ${input}`,
    offenders.length === 0 && expanded.length > 0,
    `${offenders.length} of ${expanded.length} expanded nodes lack exactly one cost child`
  );

  // Leftmost, the way it is written on the board.
  const notFirst = expanded.filter(n => (kids.get(n.id) ?? [])[0]?.kind !== 'cost');
  checkThat(
    `cost child is drawn first  ${input}`,
    notFirst.length === 0,
    `${notFirst.length} nodes put a call before their work`
  );
}

// An uneven recurrence has different sizes on one row, so the work drawn there
// has to differ too. One shared level cost would be the wrong reading.
check(
  'T(n-1)+T(n-2) costs follow each branch',
  solveByTree(parseRecurrence('T(n) = T(n-1) + T(n-2) + n'))
    .tree.nodes.filter(n => n.kind === 'cost')
    .map(n => n.label)
    .join(' | '),
  'n | n−1 | n−2'
);

// T-061: b = 1 must never render as a division or a multiplication by one.
console.log('=== 3e. b = 1 renders without /1 or ·1 ===');
for (const input of [
  'T(n) = 2T(n-1) + 1',
  'T(n) = T(n-1) + n',
  'T(n) = T(n-1) + log(n)',
  'T(n) = T(n-1) + T(n-2)',
  'T(n) = 3T(n-1) + n',
]) {
  const parsed = parseRecurrence(input);
  for (const [method, solve] of [['tree', solveByTree], ['substitution', solveBySubstitution]]) {
    const r = solve(parsed);
    const rendered = [
      ...(r.steps ?? []).map(s => s.text ?? ''),
      ...(r.tree?.derivation?.lines ?? []),
      ...(r.formulas ?? []).map(f => f.latex ?? f.text ?? ''),
    ];
    // "k·1" and "n/1" are the unit-step artefacts. A digit before the dot is a
    // real coefficient (2·1 is 2 times f(n) = 1), so it must not be caught here.
    const bad = rendered.filter(t => /\/1\b/.test(t) || /[a-z]·1\b/.test(t) || /[a-z]\\cdot 1\b/.test(t));
    checkThat(`no unit step  ${method}  ${input}`, bad.length === 0, bad.join(' // '));
  }
}

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
    // A chain puts the cost in the tree, a divide tree in the column; either is
    // user-visible, so check both places.
    const all = allCostText(input);
    checkThat(`label  ${input}`, all.includes(expectedFragment), `expected to find "${expectedFragment}" in: ${all}`);
  }
  // The old bug produced "n−1^2"; make sure that shape never comes back.
  for (const [input] of CASES) {
    const parsed = parseRecurrence(input);
    if (parsed.error) continue;
    const text = allCostText(input);
    checkThat(`no unbracketed power  ${input}`, !/n−\d\^/.test(text), `found in: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// 5. Unsupported input errors clearly instead of guessing
// ---------------------------------------------------------------------------

console.log('=== 5. Unsupported input reports an error ===');
const REJECTED = [
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
  'T(n) = T(n/3) + T(2n/3) + n',   // Akra-Bazzi, supported since T-058
  'T(n) = T(n/5) + T(7n/10) + n',  // median of medians
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
// 7. The step panel shows the working, not just the conclusion (T-060)
// ---------------------------------------------------------------------------

console.log('=== 7. Derivations show their working ===');

const panelText = (input, method) => {
  const parsed = parseRecurrence(input);
  const solve = method === 'tree' ? solveByTree : solveBySubstitution;
  return solve(parsed).steps.map(s => s.text).join('\n');
};

// [ input, fragments that must appear, why it matters ]
const WORKING = [
  // A named identity is useless without its general formula.
  ['T(n) = T(n-1) + n', ['Σ(i=1..m) i = m(m+1)/2', 'With m = n', 'n(n+1)/2', 'n²/2 + n/2', 'Θ(n²)']],
  ['T(n) = T(n-1) + n^2', ['Σ(i=1..m) i² = m(m+1)(2m+1)/6', 'With m = n']],
  ['T(n) = T(n-1) + log(n)', ['log(1 · 2 · … · m) = log(m!)', 'Stirling', 'log(n!)']],
  ['T(n) = T(n-1) + 1', ['Σ(i=1..m) c = c·m']],

  // The geometric sum formula, for each of the three cases.
  ['T(n) = 4T(n/2) + n', ['Σ(k=0..m) ρ^k = (ρ^(m+1) − 1)/(ρ − 1)', 'ρ = 2 > 1', 'Check the leaves']],
  ['T(n) = 2T(n/2) + n', ['ρ = 1 exactly', 'Σ(k=0..m) 1 = m + 1', 'Drop the lower-order term']],
  ['T(n) = 2T(n/2) + n^2', ['Σ(k≥0) ρ^k = 1/(1 − ρ)', 'the bound is tight']],

  // Σ notation and the factoring step that makes the series geometric.
  ['T(n) = 3T(n/2) + n', ['Total = Σ(k=0..log₂(n))', 'factor out n', 'where ρ = a/b^q']],

  // The exponential base must be derived, not asserted.
  ['T(n) = T(n-1) + T(n-2)', ['Try T(n) = x^n', 'x² = x + 1', 'dominant root']],
  ['T(n) = 2T(n-1) + 1', ['Σ(k=0..m) 2^k = (2^(m+1) − 1)/(2 − 1)']],

  // Akra-Bazzi shows the equation, the formula and the integral.
  ['T(n) = T(n/3) + T(2n/3) + n', ['Σ aᵢ·bᵢ^p = 1', '(1/3)^p + (2/3)^p = 1', '∫(1..n) du/u = log n']],
  ['T(n) = T(n/5) + T(7n/10) + n', ['the integral grows', 'T(n) = Θ(n^0.84']],

  // The n = 2^m substitution has to be spelled out.
  ['T(n) = T(sqrt(n)) + 1', ['Substitute n = 2^m', 'S(m) = S(m/2) + f(2^m)', 'depth log m']],
];

for (const [input, fragments] of WORKING) {
  for (const method of ['tree', 'substitution']) {
    const text = panelText(input, method);
    for (const fragment of fragments) {
      checkThat(
        `${method} working  ${input}  contains "${fragment}"`,
        text.includes(fragment),
        `not found in the ${method} panel`
      );
    }
  }
}

// Both methods must explain a shared identity with the same words, or the two
// panels teach subtly different things.
for (const input of ['T(n) = T(n-1) + n', 'T(n) = 4T(n/2) + n', 'T(n) = T(n/3) + T(2n/3) + n']) {
  const treeLines = new Set(panelText(input, 'tree').split('\n'));
  const substShared = panelText(input, 'substitution')
    .split('\n')
    .filter(l => l.includes('Σ(') || l.includes('ρ^k') || l.includes('aᵢ·bᵢ'));
  checkThat(
    `both methods share the identity wording  ${input}`,
    substShared.length > 0 && substShared.every(l => treeLines.has(l)),
    `substitution-only identity lines: ${substShared.filter(l => !treeLines.has(l)).join(' | ')}`
  );
}

// Every derivation must end at the same complexity it reports.
for (const [input, expected] of CASES) {
  const parsed = parseRecurrence(input);
  if (parsed.error) continue;
  for (const method of ['tree', 'substitution']) {
    const solve = method === 'tree' ? solveByTree : solveBySubstitution;
    const { steps, growth } = solve(parsed);
    const lines = steps.map(s => s.text).filter(t => t.trim().startsWith('= Θ('));
    checkThat(
      `${method} working ends at the reported answer  ${input}`,
      lines.length > 0 && lines[lines.length - 1].includes(`Θ(${expected})`),
      `last Θ line was "${lines[lines.length - 1] ?? '(none)'}", expected Θ(${expected})`
    );
  }
}

// ---------------------------------------------------------------------------
// 8. A coefficient in front of an f value must bind to all of it
// ---------------------------------------------------------------------------

// T-061: the expansion wrote a·f(n−1) by putting the two strings side by side,
// which produced "2n − 1" for 2(n−1) and "21" for 2·1. The first is a different
// quantity, not just harder to read.
console.log('=== 8. Coefficients bind to the whole f value ===');
{
  const rendered = input => {
    const r = solveBySubstitution(parseRecurrence(input));
    return [...r.steps.map(s => s.text ?? ''), ...r.formulas.map(f => f.latex ?? '')].join('\n');
  };

  for (const [input, wanted, forbidden] of [
    ['T(n) = 2T(n-1) + n', ['2·(n−1)', '4·(n−2)'], ['+ 2n−1', '+ 2n − 1', '+ 4n−2']],
    ['T(n) = 2T(n-1) + 1', ['2·1', '4·1'], ['+ 21', '+ 41']],
    ['T(n) = 2T(n/2) + 1', ['2\\cdot 1'], ['+ 21']],
    ['T(n) = 4T(n/2) + n', ['4·(n/2)', '16·(n/4)'], ['+ 4n/2', '+ 16n/4']],
    // Already grouped by its own brackets, so no second pair is added.
    ['T(n) = 3T(n-1) + log n', ['3·log(n−1)'], ['3·(log(n−1))']],
  ]) {
    const text = rendered(input);
    for (const w of wanted) {
      checkThat(`expansion writes ${w}  ${input}`, text.includes(w), `"${w}" is missing`);
    }
    for (const f of forbidden) {
      checkThat(`expansion avoids ${f}  ${input}`, !text.includes(f), `"${f}" was rendered`);
    }
  }
}

// ---------------------------------------------------------------------------
// 9. Every LaTeX string the substitution panel emits must actually render
// ---------------------------------------------------------------------------

// The panel renders with throwOnError, so a malformed string is a red error box
// where a step should be. Escaping is easy to get wrong by hand, and nothing
// else in this suite would notice.
console.log('=== 9. Substitution LaTeX renders ===');
{
  const { default: katex } = await import('katex');
  for (const [input] of CASES) {
    const parsed = parseRecurrence(input);
    if (parsed.error) continue;
    const { formulas = [] } = solveBySubstitution(parsed);
    const broken = [];
    for (const f of formulas) {
      try {
        katex.renderToString(f.latex, { throwOnError: true, displayMode: true });
      } catch (e) {
        broken.push(`${f.latex} → ${e.message.split('\n')[0]}`);
      }
    }
    checkThat(`LaTeX renders  ${input}`, broken.length === 0, broken.join(' // '));
  }
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
