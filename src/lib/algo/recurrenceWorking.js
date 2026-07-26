/**
 * recurrenceWorking.js
 *
 * The algebra behind each answer, written out the way a student would in a
 * notebook: the total in Σ form, the standard form it is massaged into, the
 * named identity WITH its general formula, that formula with this problem's
 * values substituted, the expansion, and finally dropping lower-order terms.
 *
 * Both the tree method and the substitution method reach the same summations,
 * so both pull their explanations from here. That is deliberate: an identity
 * should not be explained two different ways depending on which method asked.
 *
 * Every function returns an array of plain strings. The callers decide how to
 * style them, which keeps this module free of any presentation concern.
 */

import { num, renderF, arg, theta, formatGrowth, polylog } from './recurrenceMath.js';

const SUBSCRIPT = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const sub = v => String(v).split('').map(c => SUBSCRIPT[c] ?? c).join('');

/** "log₂(n)" */
export const logOf = (b, x = 'n') => `log${sub(num(b))}(${x})`;

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Superscript for a small integer exponent, so x^2 reads as x². */
const sup = v => String(v).split('').map(c => SUPERSCRIPT[c] ?? c).join('');

/** Drop a coefficient of 1 from a product: 1·n reads as n. */
const times = (coef, body) => (Math.abs(coef - 1) < 1e-9 ? body : `${num(coef)}·${body}`);

/** n^q using the same formatting as every other power in the app: n, n², n^0.58. */
const powerOfN = q => formatGrowth(polylog(q, 0));

/**
 * How many levels a subtract recurrence has. b = 1 is by far the common case
 * and "n/1 levels" reads as a rendering bug rather than as arithmetic.
 */
const levelsOf = b => (b === 1 ? 'n' : `n/${b}`);
/** The same count as an exponent, bracketed only when it is a fraction. */
const levelsExpOf = b => (b === 1 ? 'n' : `(n/${b})`);
/** The "·b" in f(n − k·b), dropped when b = 1 for the same reason. */
const stepOf = b => (b === 1 ? '' : `·${b}`);

// ---------------------------------------------------------------------------
// Divide and conquer: the level sum is geometric in ρ = a/b^q
// ---------------------------------------------------------------------------

/**
 * @param {Object} parsed  recurrence descriptor
 * @param {Object} analysis result of divideLevelSum
 * @returns {string[]} working lines
 */
export function divideWorking(parsed, analysis) {
  const { a, b, fTerms, fDominant: d } = parsed;
  const q = d.exp;
  const r = d.logExp;
  const c = d.coef;
  const rho = analysis.ratio;
  const L = logOf(b);
  const lines = [];

  lines.push(`Level k has a^k = ${num(a)}^k nodes, each costing f(n/${num(b)}^k).`);
  lines.push(`Total = Σ(k=0..${L}) ${num(a)}^k · ${renderF(fTerms, arg.overPow('n', num(b), 'k'))}`);

  // Pull the size-independent part out, leaving a pure geometric series in ρ.
  if (Math.abs(r) < 1e-9) {
    lines.push(`      = ${times(c, powerOfN(q))} · Σ(k=0..${L}) (${num(a)}/${num(b)}^${num(q)})^k     (factor out ${times(c, powerOfN(q))})`);
    lines.push(`      = ${times(c, powerOfN(q))} · Σ(k=0..${L}) ρ^k          where ρ = a/b^q = ${num(rho)}`);
  } else {
    lines.push(`      = ${times(c, powerOfN(q))} · Σ(k=0..${L}) ρ^k · log^${num(r)}(n/${num(b)}^k)`);
    lines.push(`        where ρ = a/b^q = ${num(a)}/${num(b)}^${num(q)} = ${num(rho)}`);
  }

  if (analysis.caseNum === 3) {
    lines.push('');
    lines.push(`ρ = ${num(rho)} > 1, so this is an increasing geometric series:`);
    lines.push('  Σ(k=0..m) ρ^k = (ρ^(m+1) − 1)/(ρ − 1) = Θ(ρ^m)     dominated by its last term');
    lines.push(`With m = ${L}:  ρ^${L} = (a/b^q)^${L} = n^log${sub(num(b))}(a) / ${powerOfN(q)}`);
    lines.push(`      = ${times(c, powerOfN(q))} · Θ(${powerOfN(analysis.leavesExp)} / ${powerOfN(q)})`);
    lines.push(`      = ${theta(analysis.growth)}`);
    lines.push('');
    lines.push(`Check the leaves: a^${L} · T(1) = n^log${sub(num(b))}(${num(a)}) = ${powerOfN(analysis.leavesExp)}, the same order.`);
    return lines;
  }

  if (analysis.caseNum === 1) {
    lines.push('');
    lines.push(`ρ = ${num(rho)} < 1, so this is a decreasing geometric series:`);
    lines.push('  Σ(k=0..m) ρ^k < Σ(k≥0) ρ^k = 1/(1 − ρ)     a constant, independent of n');
    lines.push(`  1/(1 − ${num(rho)}) = ${num(1 / (1 - rho))}`);
    lines.push(`      = ${times(c, powerOfN(q))} · O(1)`);
    lines.push(`And T(n) ≥ f(n) = ${parsed.fText}, so the bound is tight:`);
    lines.push(`      = ${theta(analysis.growth)}`);
    lines.push('');
    lines.push(`Check the leaves: ${powerOfN(analysis.leavesExp)} grows slower than ${powerOfN(q)}, so f(n) wins.`);
    return lines;
  }

  // ρ = 1: every level costs the same, so the count of levels is the whole story.
  lines.push('');
  lines.push(`ρ = 1 exactly, so every level costs the same and the geometric formula degenerates:`);
  lines.push(`  Σ(k=0..m) 1 = m + 1`);

  if (Math.abs(r) < 1e-9) {
    lines.push(`With m = ${L}:  = ${times(c, powerOfN(q))} · (${L} + 1)`);
    lines.push(`      = ${times(c, `${powerOfN(q)} ${L}`)} + ${times(c, powerOfN(q))}`);
    lines.push(`Drop the lower-order term:`);
    lines.push(`      = ${theta(analysis.growth)}`);
  } else if (Math.abs(r + 1) < 1e-9) {
    lines.push(`The log factor is log^-1, so substituting j = ${L} − k gives the harmonic series:`);
    lines.push(`  Σ(j=1..${L}) 1/j = H(${L}) = Θ(log ${L}) = Θ(log log n)`);
    lines.push(`      = ${theta(analysis.growth)}`);
  } else if (r < -1) {
    lines.push(`With j = ${L} − k the log factor gives Σ(j≥1) j^${num(r)}, which converges,`);
    lines.push(`so the number of levels drops out entirely:`);
    lines.push(`      = ${theta(analysis.growth)}`);
  } else {
    lines.push(`Substituting j = ${L} − k turns the log factor into a power sum:`);
    lines.push(`  Σ(j=1..${L}) j^${num(r)} = Θ(${L}^${num(r + 1)})`);
    lines.push(`      = ${times(c, powerOfN(q))} · Θ(log^${num(r + 1)} n)`);
    lines.push(`      = ${theta(analysis.growth)}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Chains: T(n) = T(n − b) + f(n), one node per level
// ---------------------------------------------------------------------------

/**
 * @param {Object} parsed
 * @param {Object} series result of sumSubtractSeries
 * @returns {string[]}
 */
export function chainWorking(parsed, series) {
  const { b, fTerms, fDominant: d } = parsed;
  const q = d.exp;
  const r = d.logExp;
  const c = d.coef;
  const levels = levelsOf(b);
  const lines = [];

  lines.push(`Every level holds one node, so the total is a plain sum over the ${levels} levels:`);
  lines.push(`Total = Σ(k=0..${levels}−1) f(n − k${stepOf(b)})`);
  lines.push(`      = ${renderF(fTerms, arg.symbol('n'), { inSum: true })} + ${renderF(fTerms, arg.minus('n', b), { inSum: true })} + … + ${renderF(fTerms, arg.literal(String(b)))}`);

  // Reindexing to count upward is what turns it into a textbook identity.
  const idxVar = b === 1 ? 'i' : `i (in steps of ${b})`;
  lines.push(`Reading the terms in increasing order, with ${idxVar}:`);
  lines.push(`      = Σ(i=${b}..n) ${renderF(fTerms, arg.literal('i'))}`);
  lines.push('');

  if (series.name === 'sum of constants') {
    lines.push(`Sum of ${levels} copies of the same constant:`);
    lines.push(`  Σ(i=1..m) c = c·m`);
    lines.push(`With m = ${levels}:  = ${series.closedText}`);
  } else if (series.name === 'arithmetic series') {
    lines.push('Arithmetic series:');
    lines.push('  Σ(i=1..m) i = m(m+1)/2');
    if (b === 1) {
      lines.push(`With m = n:  = ${times(c, 'n(n+1)/2')}`);
      lines.push(`      = ${times(c, 'n²/2')} + ${times(c, 'n/2')}`);
    } else {
      lines.push(`Only every ${b}th term is present, so the sum is scaled by 1/${b}:`);
      lines.push(`      = ${series.closedText}`);
    }
    lines.push('Drop the lower-order term:');
  } else if (series.name === 'sum of squares') {
    lines.push('Sum of squares:');
    lines.push('  Σ(i=1..m) i² = m(m+1)(2m+1)/6');
    lines.push(`With m = n:  = ${series.closedText}`);
    lines.push('Expanding the numerator gives 2n³ + 3n² + n, so the n³ term leads:');
  } else if (series.name === 'log of a factorial') {
    lines.push('Sum of logs, by the log product rule:');
    lines.push('  Σ(i=1..m) log i = log(1 · 2 · … · m) = log(m!)');
    lines.push(`With m = n:  = ${series.closedText}`);
    lines.push("Stirling's approximation gives log(n!) = n log n − n·log(e) + O(log n),");
    lines.push('so the n log n term leads:');
  } else {
    // Generic power sum, bounded by the integral of the same power.
    lines.push(`Power sum with exponent ${num(q)}, bounded by the matching integral:`);
    lines.push(`  Σ(i=1..m) i^${num(q)} ≈ ∫₀^m x^${num(q)} dx = m^${num(q + 1)}/${num(q + 1)}`);
    lines.push(`With m = n:  = ${series.closedText}`);
    if (Math.abs(r) > 1e-9) lines.push(`The log^${num(r)} factor is carried along unchanged.`);
  }

  lines.push(`      = ${theta(series.growth)}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Branching subtract: T(n) = Σ aᵢ·T(n − bᵢ) + f(n), exponential
// ---------------------------------------------------------------------------

/**
 * @param {Object} parsed
 * @param {number} base the growth base (dominant characteristic root)
 * @param {Object} growth
 * @returns {string[]}
 */
export function exponentialWorking(parsed, base, growth) {
  const { recTerms, b, fText } = parsed;
  const lines = [];
  const single = recTerms.length === 1;

  if (single) {
    const a = recTerms[0].coef;
    const levels = levelsOf(b);
    lines.push(`Level k holds ${num(a)}^k nodes, and the depth is ${levels}.`);
    lines.push(`Total = Σ(k=0..${levels}) ${num(a)}^k · f(n − k${stepOf(b)})`);
    lines.push(`Every f value is at most f(n) = ${fText}, so the node count sets the order:`);
    lines.push(`  Σ(k=0..m) ${num(a)}^k = (${num(a)}^(m+1) − 1)/(${num(a)} − 1) = Θ(${num(a)}^m)`);
    lines.push(`With m = ${levels}:  = Θ(${num(a)}^${levelsExpOf(b)})`);
    if (b > 1) {
      lines.push(`  ${num(a)}^${levelsExpOf(b)} = (${num(a)}^(1/${b}))^n = ${num(base)}^n`);
    }
    lines.push(`      = ${theta(growth)}`);
    return lines;
  }

  // Several different shifts: the branches bottom out at different depths, so
  // the node count is not a plain geometric series. Solve the characteristic
  // equation instead, which is the standard route for a linear recurrence.
  const maxShift = Math.max(...recTerms.map(t => t.shift));
  lines.push('The branches end at different depths, so the node count is not a plain');
  lines.push('geometric series. Look for an exponential solution instead.');
  lines.push('');
  lines.push('Try T(n) = x^n:');
  lines.push(`  x^n = ${recTerms.map(t => `${t.coef === 1 ? '' : `${num(t.coef)}·`}x^(n−${t.shift})`).join(' + ')}`);
  lines.push(`Divide through by x^(n−${maxShift}):`);
  lines.push(`  x${sup(maxShift)} = ${recTerms.map(t => {
    const e = maxShift - t.shift;
    const p = e === 0 ? '1' : e === 1 ? 'x' : `x${sup(e)}`;
    return `${t.coef === 1 ? '' : `${num(t.coef)}·`}${p}`;
  }).join(' + ')}`);
  lines.push(`Its dominant root is x = ${num(base, 4)}${Math.abs(base - 1.618) < 0.01 ? ' = (1+√5)/2 = φ' : ''}`);
  lines.push(`T(n) grows like that root raised to n:`);
  lines.push(`      = ${theta(growth)}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Unequal splits: Akra-Bazzi
// ---------------------------------------------------------------------------

/**
 * @param {Object} parsed
 * @param {Object} analysis result of akraLevelSum
 * @returns {string[]}
 */
export function akraWorking(parsed, analysis) {
  const { parts, fDominant: d, fText } = parsed;
  const q = d.exp;
  const r = d.logExp;
  const p = analysis.p;
  const lines = [];
  const fracText = t => (t.num == null ? num(t.frac) : `${t.num}/${t.den}`);

  lines.push('First find p, the exponent of the leaf count, by solving:');
  lines.push(`  Σ aᵢ·bᵢ^p = 1`);
  lines.push(`  ${parts.map(t => `${t.coef === 1 ? '' : `${num(t.coef)}·`}(${fracText(t)})^p`).join(' + ')} = 1`);
  lines.push(`  p = ${num(p, 4)}`);
  lines.push('');
  lines.push('Then apply the formula:');
  lines.push('  T(n) = Θ(n^p · (1 + ∫(1..n) f(u)/u^(p+1) du))');
  lines.push(`  f(u)/u^(p+1) = u^${num(q)}${Math.abs(r) > 1e-9 ? `·log^${num(r)}(u)` : ''} / u^${num(p + 1, 4)} = u^${num(q - p - 1, 4)}${Math.abs(r) > 1e-9 ? `·log^${num(r)}(u)` : ''}`);
  lines.push('');

  if (analysis.caseNum === 1) {
    lines.push(`q = ${num(q)} > p = ${num(p, 3)}, so the exponent ${num(q - p - 1, 3)} > −1 and the integral grows:`);
    lines.push(`  ∫(1..n) u^${num(q - p - 1, 3)} du = Θ(n^${num(q - p, 3)})`);
    lines.push(`  T(n) = Θ(n^${num(p, 3)} · n^${num(q - p, 3)}) = Θ(${fText})`);
  } else if (analysis.caseNum === 3) {
    lines.push(`q = ${num(q)} < p = ${num(p, 3)}, so the exponent ${num(q - p - 1, 3)} < −1 and the integral converges:`);
    lines.push('  ∫(1..n) u^(q−p−1) du = O(1)');
    lines.push(`  T(n) = Θ(n^p · (1 + O(1))) = Θ(n^${num(p, 3)})`);
  } else if (Math.abs(r + 1) < 1e-9) {
    lines.push(`q = p exactly, and the log power is −1, so the integrand is 1/(u log u):`);
    lines.push('  ∫(1..n) du/(u log u) = log log n');
  } else if (Math.abs(r) < 1e-9) {
    lines.push(`q = p exactly, so the exponent is −1 and the integral is a logarithm:`);
    lines.push('  ∫(1..n) du/u = log n');
    lines.push(`  T(n) = Θ(n^p · log n)`);
  } else {
    lines.push(`q = p exactly, so the integrand is log^${num(r)}(u)/u:`);
    lines.push(`  ∫(1..n) log^${num(r)}(u)/u du = log^${num(r + 1)}(n)/${num(r + 1)}`);
  }

  lines.push(`      = ${theta(analysis.growth)}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Root shrink: T(n) = T(√n) + f(n)
// ---------------------------------------------------------------------------

export function sqrtWorking(parsed, growth) {
  const { fDominant: d, fText } = parsed;
  const lines = [];

  lines.push('Substitute n = 2^m, so √n becomes 2^(m/2) and the size halves in m:');
  lines.push('  S(m) = T(2^m)  gives  S(m) = S(m/2) + f(2^m)');
  lines.push('');

  if (d.exp > 1e-9) {
    lines.push(`f(2^m) = ${fText} with n = 2^m is exponential in m, so the very first`);
    lines.push('term dominates every later one and the root carries the whole cost:');
    lines.push(`      = ${theta(growth)}`);
    return lines;
  }

  if (Math.abs(d.logExp) < 1e-9) {
    lines.push('f is constant, so S(m) = S(m/2) + c, a halving recurrence with constant work.');
    lines.push('  That has depth log m, so S(m) = Θ(log m).');
    lines.push('  Substituting back m = log n:');
    lines.push(`      = ${theta(growth)}`);
    return lines;
  }

  lines.push(`f(n) = log^${num(d.logExp)}(n) becomes m^${num(d.logExp)}, so S(m) = S(m/2) + m^${num(d.logExp)}.`);
  lines.push(`  Level costs shrink geometrically, so the root dominates: S(m) = Θ(m^${num(d.logExp)}).`);
  lines.push('  Substituting back m = log n:');
  lines.push(`      = ${theta(growth)}`);
  return lines;
}
