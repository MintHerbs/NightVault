/**
 * Numeric oracle for the recurrence solver.
 *
 * Run with: npm run test:recurrence:oracle
 *
 * recurrence.test.js checks the solver against answers a human wrote down. That
 * cannot catch a rule that is wrong in a region nobody thought to test, because
 * the same person picks the cases and writes the rule. This file instead
 * EVALUATES the recurrence and checks the claimed closed form against it.
 *
 * The method: compute log T(n) exactly at a ladder of n, then look at
 * log T(n) − log g(n) for the claimed growth g. If g is right that residual
 * settles to a constant (T = Θ(g) means the ratio is bounded above and below),
 * so its drift across the ladder tends to zero. If g is wrong the residual
 * grows without bound.
 *
 * Everything is done in log space, which matters twice over: it stops a^k from
 * overflowing for a = 1000, and it lets the ladder reach n = 2^400000. That
 * range is what makes log log n distinguishable at all. At n = 2^24 the wrong
 * rule Θ(n) and the right one Θ(n log log n) are indistinguishable, which is how
 * the bug this file exists to catch survived the hand-written suite.
 */

import { parseRecurrence } from './recurrenceParser.js';
import { solveByTree, solveBySubstitution } from './recurrenceSolver.js';
import { formatGrowth } from './recurrenceMath.js';

const DRIFT_TOLERANCE = 0.35; // log-space slack for lower-order terms

let passed = 0;
const failures = [];

// ---------------------------------------------------------------------------
// Log-space helpers
// ---------------------------------------------------------------------------

const logaddexp = (x, y) => {
  if (x === -Infinity) return y;
  if (y === -Infinity) return x;
  const hi = Math.max(x, y);
  return hi + Math.log1p(Math.exp(Math.min(x, y) - hi));
};

/** log f(n) for f = Σ c·n^p·log^q n, given ln n. Uses log2 n as "log n". */
function logF(terms, lnN) {
  const lg = Math.max(lnN / Math.LN2, 1e-12);
  let acc = -Infinity;
  for (const t of terms) {
    if (t.coef <= 0) continue;
    acc = logaddexp(acc, Math.log(t.coef) + t.exp * lnN + t.logExp * Math.log(lg));
  }
  return acc;
}

/** log g(n) for a claimed growth, given ln n. */
function logG(g, lnN) {
  const lg = Math.max(lnN / Math.LN2, 1e-12);
  if (g.kind === 'exp') return Math.exp(lnN) * Math.log(g.base);
  return (
    g.exp * lnN +
    g.logExp * Math.log(lg) +
    (g.logLogExp ?? 0) * Math.log(Math.max(Math.log(lg), 1e-12))
  );
}

/** Drift of the residual across the sampled ladder. */
function driftOf(residuals) {
  if (residuals.length < 2) return Infinity;
  return Math.abs(residuals[residuals.length - 1] - residuals[0]);
}

// ---------------------------------------------------------------------------
// One evaluator per recurrence family
// ---------------------------------------------------------------------------

/**
 * T(n) = a·T(n/b) + f(n), evaluated exactly at n = b^k so the division is
 * never approximated. The ladder runs to k = 400000, i.e. n = b^400000.
 */
function evaluateDivide({ a, b, fTerms }, g, { kMin = 500, kMax = 400000 } = {}) {
  const lnB = Math.log(b);
  const logA = Math.log(a);
  let logT = 0; // T(1) = 1
  const residuals = [];
  for (let k = 1; k <= kMax; k++) {
    const lnN = k * lnB;
    logT = logaddexp(logA + logT, logF(fTerms, lnN));
    if (k >= kMin && k % Math.ceil(kMax / 200) === 0) residuals.push(logT - logG(g, lnN));
  }
  return driftOf(residuals);
}

/**
 * T(n) = T(n−b) + f(n). One call per level, so this is a running sum. Stepping
 * by b keeps every evaluated n on the same residue class as the base case.
 */
function evaluateChain({ b, fTerms }, g, { nMax = 4e6 } = {}) {
  let logT = 0; // T(0) = 1
  const residuals = [];
  // Sampling has to span a wide range of log n, not just of n: telling
  // Θ(n log n) from Θ(n) means watching log log n move, and that needs orders
  // of magnitude. Starting at nMax/2000 gives log2 n room to roughly double.
  const from = nMax / 2000;
  const sampleEvery = Math.ceil(nMax / (200 * b));
  let step = 0;
  for (let n = b; n <= nMax; n += b) {
    logT = logaddexp(logT, logF(fTerms, Math.log(n)));
    if (n >= from && step++ % sampleEvery === 0) residuals.push(logT - logG(g, Math.log(n)));
  }
  return driftOf(residuals);
}

/**
 * T(n) = Σ aᵢ·T(n−bᵢ) + f(n). Exponential, so it must stay in log space, and
 * the ladder stays short because the answer is a growth base rather than a
 * polynomial: the residual settles quickly.
 */
function evaluateBranching({ recTerms, fTerms }, g, { nMax = 4000 } = {}) {
  const maxShift = Math.max(...recTerms.map(t => t.shift));
  const logT = new Array(nMax + 1).fill(0); // T(n) = 1 for n <= maxShift
  const residuals = [];
  for (let n = maxShift + 1; n <= nMax; n++) {
    let acc = logF(fTerms, Math.log(n));
    for (const t of recTerms) acc = logaddexp(acc, Math.log(t.coef) + logT[n - t.shift]);
    logT[n] = acc;
    if (n > nMax / 2 && n % Math.ceil(nMax / 200) === 0) residuals.push(logT[n] - logG(g, Math.log(n)));
  }
  return driftOf(residuals);
}

/**
 * T(n) = Σ aᵢ·T(bᵢn) + f(n).
 *
 * The sizes are not powers of a common b, so there is no exact ladder to walk.
 * Instead solve the recurrence numerically on a grid that is uniform in ln n:
 * each grid point's children sit at ln n + ln bᵢ, a fixed offset down the grid,
 * reached by linear interpolation. log T is close to linear in log n (T ~ n^p),
 * so that interpolation is accurate.
 *
 * Working on a log grid rather than over the integers is what lets the ladder
 * reach n = 2^1000. A first version evaluated integers up to 2e6 and could not
 * reject a spurious log factor on T(n/5) + T(7n/10) + n, because log log n
 * barely moves over that range. This is the same trap the chain evaluator hit.
 */
function evaluateAkra({ parts, fTerms }, g, { lnMax = 1000 * Math.LN2, points = 20000 } = {}) {
  const dx = lnMax / points;
  const logT = new Float64Array(points + 1);
  const residuals = [];

  // log T at ln n = x, with the base case T(n) = 1 for n <= 1.
  const at = x => {
    if (x <= 0) return 0;
    const j = x / dx;
    const lo = Math.floor(j);
    if (lo >= points) return logT[points];
    const frac = j - lo;
    return logT[lo] * (1 - frac) + logT[lo + 1] * frac;
  };

  const sampleEvery = Math.ceil(points / 200);
  for (let i = 1; i <= points; i++) {
    const lnN = i * dx;
    let acc = logF(fTerms, lnN);
    for (const part of parts) {
      acc = logaddexp(acc, Math.log(part.coef) + at(lnN + Math.log(part.frac)));
    }
    logT[i] = acc;
    if (i > points / 50 && i % sampleEvery === 0) residuals.push(acc - logG(g, lnN));
  }
  return driftOf(residuals);
}

/**
 * T(n) = T(√n) + f(n). Substituting n = 2^m gives S(m) = S(m/2) + f(2^m), so
 * iterate on m and report the residual against g evaluated at n = 2^m.
 */
function evaluateSqrt({ fTerms }, g, { mMax = 1 << 22 } = {}) {
  // S(m) = S(m/2) + f(2^m): walk m upward through powers of two.
  const residuals = [];
  let logS = 0;
  for (let e = 1; (1 << e) <= mMax; e++) {
    const m = 1 << e;
    const lnN = m * Math.LN2; // n = 2^m
    logS = logaddexp(logS, logF(fTerms, lnN));
    if (e >= 6) residuals.push(logS - logG(g, lnN));
  }
  return driftOf(residuals);
}

/** Dispatch to the right evaluator, or null when the family has none. */
function evaluate(parsed, g) {
  switch (parsed.type) {
    case 'divide':
      return evaluateDivide(parsed, g);
    case 'subtract':
      return evaluateChain(parsed, g);
    case 'linear':
      return evaluateBranching(parsed, g);
    case 'akra':
      return evaluateAkra(parsed, g);
    case 'sqrt':
      return evaluateSqrt(parsed, g);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Every solver answer must survive numeric evaluation
// ---------------------------------------------------------------------------

const CASES = [
  // divide, all three cases
  'T(n) = 2T(n/2) + n',
  'T(n) = T(n/2) + 1',
  'T(n) = T(n/2) + n',
  'T(n) = 2T(n/2) + 1',
  'T(n) = 4T(n/2) + n',
  'T(n) = 4T(n/2) + n^2',
  'T(n) = 3T(n/2) + n',
  'T(n) = 7T(n/2) + n^2',
  'T(n) = 9T(n/3) + n',
  'T(n) = 8T(n/2) + n^3',
  'T(n) = 2T(n/2) + n^2',
  'T(n) = 1000T(n/2) + n',

  // divide with log powers, including the three q branches of case 2
  'T(n) = T(n/2) + log(n)',
  'T(n) = T(n/2) + log^2(n)',
  'T(n) = 2T(n/2) + n*log(n)',
  'T(n) = 2T(n/2) + n*log^2(n)',
  'T(n) = 3T(n/4) + n*log(n)',
  'T(n) = 2T(n/2) + n/log(n)',
  'T(n) = 4T(n/2) + n^2/log(n)',
  'T(n) = 2T(n/2) + n/log^2(n)',
  'T(n) = 2T(n/4) + sqrt(n)',

  // chains
  'T(n) = T(n-1) + 1',
  'T(n) = T(n-1) + n',
  'T(n) = T(n-1) + n^2',
  'T(n) = T(n-1) + log(n)',
  'T(n) = T(n-1) + n*log(n)',
  'T(n) = T(n-1) + sqrt(n)',
  'T(n) = T(n-2) + n',
  'T(n) = T(n-5) + n',

  // branching subtract
  'T(n) = 2T(n-1) + 1',
  'T(n) = 3T(n-1) + 1',
  'T(n) = T(n-1) + T(n-2)',
  'T(n) = 2T(n-2) + 1',

  // root shrink
  'T(n) = T(sqrt(n)) + 1',
  'T(n) = T(sqrt(n)) + log(n)',

  // unequal splits, analysed by Akra-Bazzi
  'T(n) = T(n/3) + T(2n/3) + n',
  'T(n) = T(n/5) + T(7n/10) + n',
  'T(n) = T(n/2) + T(n/4) + n',
  'T(n) = T(n/3) + T(2n/3) + 1',
  'T(n) = T(n/3) + T(2n/3) + n^2',
];

console.log('=== 1. Solver answers confirmed by numeric evaluation ===');
console.log(`${'recurrence'.padEnd(30)}${'solver says'.padEnd(16)}${'drift'.padEnd(9)}verdict`);
console.log('-'.repeat(72));

for (const input of CASES) {
  const parsed = parseRecurrence(input);
  if (parsed.error) {
    failures.push(`${input}: unexpected parse error: ${parsed.error}`);
    continue;
  }
  const { growth } = solveByTree(parsed);
  const drift = evaluate(parsed, growth);

  if (drift === null) {
    failures.push(`${input}: no evaluator for type "${parsed.type}"`);
    continue;
  }
  const ok = drift < DRIFT_TOLERANCE;
  if (ok) passed++;
  else failures.push(`${input}\n      solver claims ${formatGrowth(growth)}, but the residual drifts by ${drift.toFixed(3)}`);

  console.log(
    input.padEnd(30) + formatGrowth(growth).padEnd(16) + drift.toFixed(3).padEnd(9) +
    (ok ? 'confirmed' : '<<< CONTRADICTED')
  );

  // Both methods claim the same growth, so the oracle validates both at once,
  // but assert the agreement here too rather than assuming it.
  const substGrowth = solveBySubstitution(parsed).growth;
  if (formatGrowth(substGrowth) !== formatGrowth(growth)) {
    failures.push(`${input}: methods disagree, tree=${formatGrowth(growth)} subst=${formatGrowth(substGrowth)}`);
  } else {
    passed++;
  }
}

// ---------------------------------------------------------------------------
// 2. The oracle must reject wrong answers, or it proves nothing
// ---------------------------------------------------------------------------

console.log('\n=== 2. Deliberately wrong closed forms are contradicted ===');

const P = (exp, logExp = 0, logLogExp = 0) => ({ kind: 'polylog', exp, logExp, logLogExp });

// [ recurrence, wrong growth, why it is plausible ]
const WRONG = [
  ['T(n) = 2T(n/2) + n/log(n)', P(1, 0, 0), 'the pre-fix case-2 rule: Θ(n)'],
  ['T(n) = 2T(n/2) + n/log(n)', P(1, 1, 0), 'assuming a full extra log: Θ(n log n)'],
  ['T(n) = 2T(n/2) + n', P(1, 0, 0), 'dropping the log factor: Θ(n)'],
  ['T(n) = 2T(n/2) + n', P(2, 0, 0), 'overshooting to Θ(n²)'],
  ['T(n) = T(n/2) + log(n)', P(0, 1, 0), 'the old answer: Θ(log n)'],
  ['T(n) = 3T(n/2) + n', P(1, 0, 0), 'the old collapse to Θ(n)'],
  ['T(n) = T(n-1) + n', P(1, 0, 0), 'the old constant-f bug: Θ(n)'],
  ['T(n) = T(n-1) + log(n)', P(1, 0, 0), 'forgetting Stirling: Θ(n)'],
  ['T(n) = T(sqrt(n)) + 1', P(0, 1, 0), 'confusing log log n with log n'],
  ['T(n) = 2T(n-1) + 1', { kind: 'exp', base: 3 }, 'wrong exponential base: Θ(3ⁿ)'],
  ['T(n) = T(n-1) + T(n-2)', { kind: 'exp', base: 2 }, 'branching factor instead of φ'],
  ['T(n) = T(n/3) + T(2n/3) + n', P(1, 0, 0), 'missing the log on the balanced split'],
  ['T(n) = T(n/5) + T(7n/10) + n', P(1, 1, 0), 'adding a log that Akra-Bazzi does not give'],
  ['T(n) = T(n/3) + T(2n/3) + 1', P(0, 1, 0), 'Θ(log n) instead of the leaf count Θ(n)'],
];

for (const [input, wrongGrowth, why] of WRONG) {
  const parsed = parseRecurrence(input);
  const drift = evaluate(parsed, wrongGrowth);
  const rejected = drift >= DRIFT_TOLERANCE;
  if (rejected) passed++;
  else failures.push(`${input}: oracle FAILED to reject ${formatGrowth(wrongGrowth)} (${why}), drift only ${drift.toFixed(3)}`);
  console.log(
    `${input.padEnd(30)}${formatGrowth(wrongGrowth).padEnd(16)}${drift.toFixed(3).padEnd(9)}` +
    `${rejected ? 'rejected' : '<<< WRONGLY ACCEPTED'}   (${why})`
  );
}

// ---------------------------------------------------------------------------

console.log('');
if (failures.length === 0) {
  console.log(`All ${passed} oracle checks passed.`);
  process.exit(0);
} else {
  console.log(`${passed} passed, ${failures.length} FAILED:\n`);
  failures.forEach(f => console.log(`  ✗ ${f}`));
  process.exit(1);
}
