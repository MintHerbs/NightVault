/**
 * Recurrence Solver, substitution method.
 *
 * This performs the substitution honestly: expand the recurrence into itself
 * three times showing the algebra, read off the pattern after k steps, solve
 * for k from the base case, put k back, then evaluate the sum that remains.
 * The previous implementation expanded twice and then handed the answer to a
 * Master Theorem helper, which is a different method wearing this one's label.
 */

import {
  exponential,
  polylog,
  loglog,
  akraLevelSum,
  fractionOfN,
  multiplyFraction,
  growthToKey,
  formatGrowthLatex,
  bigO,
  num,
  renderF,
  scaleBy,
  arg,
  divideLevelSum,
  sumSubtractSeries,
  dominantRoot,
} from './recurrenceMath.js';
import {
  divideWorking,
  chainWorking,
  exponentialWorking,
  akraWorking,
  sqrtWorking,
} from './recurrenceWorking.js';

const SUBSCRIPT = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const sub = v => String(v).split('').map(c => SUBSCRIPT[c] ?? c).join('');
const logOf = (b, x = 'n') => `log${sub(num(b))}(${x})`;

/**
 * @param {Object} parsed output of parseRecurrence
 * @returns {{ formulas: Array, steps: Array, finalComplexity: string, finalLabel: string }}
 */
export function solveBySubstitution(parsed) {
  if (!parsed || parsed.error) return failure(parsed?.error ?? 'No recurrence to solve');
  switch (parsed.type) {
    case 'divide':
      return divideSubstitution(parsed);
    case 'subtract':
      return chainSubstitution(parsed);
    case 'linear':
      return branchingSubstitution(parsed);
    case 'akra':
      return akraSubstitution(parsed);
    case 'sqrt':
      return sqrtSubstitution(parsed);
    default:
      return failure(`Unsupported recurrence type "${parsed.type}"`);
  }
}

function failure(message) {
  return {
    formulas: [],
    steps: [{ text: message, type: 'worst_case' }],
    finalComplexity: 'unknown',
    finalLabel: 'not solved',
    error: message,
  };
}

// ---------------------------------------------------------------------------
// T(n) = T(n − b) + f(n)
// ---------------------------------------------------------------------------

function chainSubstitution(parsed) {
  const { b, fTerms, fLatex } = parsed;
  const series = sumSubtractSeries(fTerms, b);
  const at = k => arg.minus('n', k * b);
  const fAt = (k, latex) => renderF(fTerms, k === 0 ? arg.symbol('n') : at(k), { latex, inSum: true });

  const formulas = [];
  const add = (latex, label) => formulas.push({ latex, label });

  add(`T(n) = T(n - ${b}) + ${fLatex}`, 'Given');
  add(`T(n-${b}) = T(n-${2 * b}) + ${fAt(1, true)}`, `Step 1: replace n with n−${b}`);
  add(`T(n) = T(n-${2 * b}) + ${fAt(1, true)} + ${fAt(0, true)}`, 'Substitute that back');
  add(`T(n-${2 * b}) = T(n-${3 * b}) + ${fAt(2, true)}`, `Step 2: replace n with n−${2 * b}`);
  add(`T(n) = T(n-${3 * b}) + ${fAt(2, true)} + ${fAt(1, true)} + ${fAt(0, true)}`, 'Substitute that back');
  add(`T(n) = T(n-${4 * b}) + ${fAt(3, true)} + ${fAt(2, true)} + ${fAt(1, true)} + ${fAt(0, true)}`, 'Step 3, same move again');
  add(`T(n) = T(n-k${b === 1 ? '' : `\\cdot ${b}`}) + \\sum_{i=0}^{k-1} f(n - i${b === 1 ? '' : `\\cdot ${b}`})`, 'Pattern after k steps');
  add(`n - k${b === 1 ? '' : `\\cdot ${b}`} = 0 \\implies k = ${b === 1 ? 'n' : `\\frac{n}{${b}}`}`, 'Stop at the base case');
  add(`T(n) = T(0) + \\sum_{i=0}^{${b === 1 ? 'n-1' : `\\frac{n}{${b}}-1`}} f(n - i${b === 1 ? '' : `\\cdot ${b}`})`, 'Put k back');
  add(`= T(0) + ${fAt(0, true)} + ${fAt(1, true)} + \\cdots + ${renderF(fTerms, arg.literal(String(b)), { latex: true })}`, 'Written out');
  add(`= ${series.closedLatex}`, `Known sum: ${series.name}`);
  add(`= \\Theta\\left(${formatGrowthLatex(series.growth)}\\right)`, 'Final complexity');

  const steps = [];
  info(steps, `Parsed: ${parsed.original}`);
  info(steps, 'Method: substitution (expand the recurrence into itself)');
  divider(steps);
  loop(steps, `Replace n with n−${b}:`);
  nest(steps, `T(n−${b}) = T(n−${2 * b}) + ${fAt(1)}`);
  loop(steps, 'Substitute back into T(n):');
  nest(steps, `T(n) = T(n−${2 * b}) + ${fAt(1)} + ${fAt(0)}`);
  loop(steps, `Replace n with n−${2 * b}:`);
  nest(steps, `T(n−${2 * b}) = T(n−${3 * b}) + ${fAt(2)}`);
  loop(steps, 'Substitute back again:');
  nest(steps, `T(n) = T(n−${3 * b}) + ${fAt(2)} + ${fAt(1)} + ${fAt(0)}`);
  divider(steps);
  special(steps, `Pattern after k steps:`);
  special(steps, `  T(n) = T(n−k${b === 1 ? '' : `·${b}`}) + Σ f(n−i${b === 1 ? '' : `·${b}`}) for i = 0..k−1`);
  special(steps, `Base case T(0) is reached when n − k${b === 1 ? '' : `·${b}`} = 0, so k = ${b === 1 ? 'n' : `n/${b}`}`);
  nest(steps, `T(n) = T(0) + ${fAt(0)} + ${fAt(1)} + … + ${renderF(fTerms, arg.literal(String(b)))}`);
  divider(steps);
  info(steps, `Recognised: ${series.name}`);
  pushWorking(steps, chainWorking(parsed, series));
  final(steps, series.growth);

  return {
    formulas,
    steps,
    finalComplexity: growthToKey(series.growth),
    finalLabel: bigO(series.growth),
    growth: series.growth,
  };
}

// ---------------------------------------------------------------------------
// T(n) = a·T(n/b) + f(n)
// ---------------------------------------------------------------------------

function divideSubstitution(parsed) {
  const { a, b, fTerms, fLatex, fDominant: d } = parsed;
  const analysis = divideLevelSum(a, b, fTerms);
  const at = k => (k === 0 ? arg.symbol('n') : arg.over('n', num(Math.pow(b, k))));
  const fAt = (k, latex) => renderF(fTerms, at(k), { latex });
  const A = k => num(Math.pow(a, k));
  const B = k => num(Math.pow(b, k));
  const coef = k => (Math.abs(Math.pow(a, k) - 1) < 1e-9 ? '' : `${A(k)}`);
  const scaled = (k, latex) => scaleBy(Math.pow(a, k), fAt(k, latex), { latex });

  const formulas = [];
  const add = (latex, label) => formulas.push({ latex, label });

  add(`T(n) = ${a === 1 ? '' : A(1)}T\\left(\\frac{n}{${num(b)}}\\right) + ${fLatex}`, 'Given');
  add(`T\\left(\\frac{n}{${B(1)}}\\right) = ${a === 1 ? '' : A(1)}T\\left(\\frac{n}{${B(2)}}\\right) + ${fAt(1, true)}`, `Step 1: replace n with n/${num(b)}`);
  add(`T(n) = ${coef(2)}T\\left(\\frac{n}{${B(2)}}\\right) + ${scaled(1, true)} + ${fAt(0, true)}`, 'Substitute that back');
  add(`T\\left(\\frac{n}{${B(2)}}\\right) = ${a === 1 ? '' : A(1)}T\\left(\\frac{n}{${B(3)}}\\right) + ${fAt(2, true)}`, `Step 2: replace n with n/${B(2)}`);
  add(
    `T(n) = ${coef(3)}T\\left(\\frac{n}{${B(3)}}\\right) + ${scaled(2, true)} + ${scaled(1, true)} + ${fAt(0, true)}`,
    'Substitute that back'
  );
  add(`T(n) = a^{k}\\,T\\left(\\frac{n}{b^{k}}\\right) + \\sum_{i=0}^{k-1} a^{i} f\\left(\\frac{n}{b^{i}}\\right)`, 'Pattern after k steps');
  add(`\\frac{n}{${num(b)}^{k}} = 1 \\implies k = \\log_{${num(b)}} n`, 'Stop at the base case');
  add(
    `T(n) = n^{\\log_{${num(b)}} ${num(a)}}\\,T(1) + \\sum_{i=0}^{\\log_{${num(b)}} n - 1} ${num(a)}^{i} f\\left(\\frac{n}{${num(b)}^{i}}\\right)`,
    'Put k back'
  );
  add(
    `a^{i} f\\!\\left(\\frac{n}{b^{i}}\\right) = ${formatGrowthLatex(polylog(d.exp, d.logExp))} \\cdot r^{i}, \\quad r = \\frac{a}{b^{p}} = ${num(analysis.ratio)}`,
    'The sum is geometric with ratio r'
  );
  add(geometricLatex(analysis, b), analysis.caseNum === 2 ? 'r = 1, so every term is equal' : `r ${analysis.caseNum === 1 ? '<' : '>'} 1`);
  add(`= \\Theta\\left(${formatGrowthLatex(analysis.growth)}\\right)`, 'Final complexity');

  const steps = [];
  info(steps, `Parsed: ${parsed.original}`);
  info(steps, 'Method: substitution (expand the recurrence into itself)');
  divider(steps);
  loop(steps, `Replace n with n/${num(b)}:`);
  nest(steps, `T(n/${B(1)}) = ${a === 1 ? '' : A(1)}T(n/${B(2)}) + ${fAt(1)}`);
  loop(steps, 'Substitute back into T(n):');
  nest(steps, `T(n) = ${coef(2)}T(n/${B(2)}) + ${scaled(1)} + ${fAt(0)}`);
  loop(steps, `Replace n with n/${B(2)}:`);
  nest(steps, `T(n/${B(2)}) = ${a === 1 ? '' : A(1)}T(n/${B(3)}) + ${fAt(2)}`);
  loop(steps, 'Substitute back again:');
  nest(steps, `T(n) = ${coef(3)}T(n/${B(3)}) + ${scaled(2)} + ${scaled(1)} + ${fAt(0)}`);
  divider(steps);
  special(steps, 'Pattern after k steps:');
  special(steps, '  T(n) = a^k T(n/b^k) + Σ a^i f(n/b^i) for i = 0..k−1');
  special(steps, `Base case T(1) is reached when n/b^k = 1, so k = ${logOf(b)}`);
  nest(steps, `T(n) = n^${num(analysis.logba)}·T(1) + Σ a^i f(n/b^i)`);
  divider(steps);
  info(steps, 'Evaluating the sum that is left:');
  pushWorking(steps, divideWorking(parsed, analysis));
  final(steps, analysis.growth);

  return {
    formulas,
    steps,
    finalComplexity: growthToKey(analysis.growth),
    finalLabel: bigO(analysis.growth),
    growth: analysis.growth,
  };
}

function geometricLatex(analysis, b) {
  if (analysis.caseNum === 2) {
    return `\\sum_{i=0}^{\\log_{${num(b)}} n - 1} 1 = \\log_{${num(b)}} n`;
  }
  if (analysis.caseNum === 1) {
    return `\\sum_{i\\ge 0} r^{i} = \\frac{1}{1-r} = O(1)`;
  }
  return `\\sum_{i=0}^{k-1} r^{i} = \\Theta\\!\\left(r^{k}\\right) = \\Theta\\!\\left(n^{\\log_{${num(b)}} a - p}\\right)`;
}

// ---------------------------------------------------------------------------
// T(n) = a·T(n − b) + f(n), branching
// ---------------------------------------------------------------------------

function branchingSubstitution(parsed) {
  const { recTerms, b, fTerms, fLatex } = parsed;
  const base = dominantRoot(recTerms);
  const growth = exponential(base);
  const totalBranch = recTerms.reduce((s, t) => s + t.coef, 0);
  const single = recTerms.length === 1;
  const at = k => arg.minus('n', k * b);
  const fAt = (k, latex) => renderF(fTerms, k === 0 ? arg.symbol('n') : at(k), { latex });

  const formulas = [];
  const add = (latex, label) => formulas.push({ latex, label });

  add(
    `T(n) = ${recTerms.map(t => `${t.coef === 1 ? '' : num(t.coef)}T(n - ${t.shift})`).join(' + ')} + ${fLatex}`,
    'Given'
  );

  if (single) {
    const a = totalBranch;
    add(`T(n-${b}) = ${num(a)}T(n-${2 * b}) + ${fAt(1, true)}`, `Step 1: replace n with n−${b}`);
    add(`T(n) = ${num(a * a)}T(n-${2 * b}) + ${scaleBy(a, fAt(1, true), { latex: true })} + ${fAt(0, true)}`, 'Substitute that back');
    add(
      `T(n) = ${num(a ** 3)}T(n-${3 * b}) + ${scaleBy(a * a, fAt(2, true), { latex: true })} + ${scaleBy(a, fAt(1, true), { latex: true })} + ${fAt(0, true)}`,
      'Step 2, same move again'
    );
    add(`T(n) = ${num(a)}^{k}\\,T(n-k${b === 1 ? '' : `\\cdot ${b}`}) + \\sum_{i=0}^{k-1} ${num(a)}^{i} f(n - i${b === 1 ? '' : `\\cdot ${b}`})`, 'Pattern after k steps');
    add(`n - k${b === 1 ? '' : `\\cdot ${b}`} = 0 \\implies k = ${b === 1 ? 'n' : `\\frac{n}{${b}}`}`, 'Stop at the base case');
    add(`T(n) = ${num(a)}^{${b === 1 ? 'n' : `n/${b}`}}\\,T(0) + \\sum_{i=0}^{k-1} ${num(a)}^{i} f(n - i${b === 1 ? '' : `\\cdot ${b}`})`, 'Put k back');
    add(`\\sum_{i=0}^{k-1} ${num(a)}^{i} = \\frac{${num(a)}^{k} - 1}{${num(a)} - 1} = \\Theta\\!\\left(${num(a)}^{k}\\right)`, 'Geometric series, last term dominates');
  } else {
    const maxShift = Math.max(...recTerms.map(t => t.shift));
    add(`T(n) = ${recTerms.map(t => `T(n-${t.shift})`).join(' + ')} + ${fLatex}`, 'Two different shifts, so expansion branches');
    add(`T(n) = ${'T(n-2) + 2T(n-3) + T(n-4)'} + \\ldots`, 'Expanding twice already doubles the terms');
    add(`T(n) = \\Theta(x^{n}) \\text{ for some base } x`, 'So try an exponential solution');
    add(
      `x^{${maxShift}} = ${recTerms.map(t => `${t.coef === 1 ? '' : num(t.coef)}x^{${maxShift - t.shift}}`).join(' + ')}`,
      'Substituting x^n gives the characteristic equation'
    );
    add(`x \\approx ${num(base)}${Math.abs(base - 1.618) < 0.01 ? ' = \\varphi' : ''}`, 'Its dominant root');
  }
  add(`= \\Theta\\left(${formatGrowthLatex(growth)}\\right)`, 'Final complexity');

  const steps = [];
  info(steps, `Parsed: ${parsed.original}`);
  info(steps, 'Method: substitution (expand the recurrence into itself)');
  divider(steps);

  if (single) {
    const a = totalBranch;
    loop(steps, `Replace n with n−${b}:`);
    nest(steps, `T(n−${b}) = ${num(a)}T(n−${2 * b}) + ${fAt(1)}`);
    loop(steps, 'Substitute back into T(n):');
    nest(steps, `T(n) = ${num(a * a)}T(n−${2 * b}) + ${scaleBy(a, fAt(1))} + ${fAt(0)}`);
    loop(steps, 'Substitute back again:');
    nest(steps, `T(n) = ${num(a ** 3)}T(n−${3 * b}) + ${scaleBy(a * a, fAt(2))} + ${scaleBy(a, fAt(1))} + ${fAt(0)}`);
    divider(steps);
    special(steps, 'Pattern after k steps:');
    special(steps, `  T(n) = ${num(a)}^k T(n−k${b === 1 ? '' : `·${b}`}) + Σ ${num(a)}^i f(n−i${b === 1 ? '' : `·${b}`})`);
    special(steps, `Base case reached when k = ${b === 1 ? 'n' : `n/${b}`}`);
    nest(steps, `T(n) = ${num(a)}^${b === 1 ? 'n' : `n/${b}`}·T(0) + Σ ${num(a)}^i f(n−i${b === 1 ? '' : `·${b}`})`);
  } else {
    loop(steps, 'Expanding once:');
    nest(steps, `T(n) = ${recTerms.map(t => `T(n−${t.shift})`).join(' + ')} + ${fAt(0)}`);
    loop(steps, 'Expanding again doubles the number of terms:');
    nest(steps, 'T(n) = T(n−2) + 2T(n−3) + T(n−4) + …');
  }

  divider(steps);
  info(steps, 'Working out the growth:');
  pushWorking(steps, exponentialWorking(parsed, base, growth));
  final(steps, growth);

  return {
    formulas,
    steps,
    finalComplexity: growthToKey(growth),
    finalLabel: bigO(growth),
    growth,
  };
}

// ---------------------------------------------------------------------------
// T(n) = Σ aᵢ·T(bᵢn) + f(n), unequal splits
// ---------------------------------------------------------------------------

const fracText = part => (part.num == null ? num(part.frac) : `${part.num}/${part.den}`);
/** Subproblem size as a multiple of n, e.g. "n/3", "4n/9". */
const sizeText = frac => fractionOfN(frac);
const sizeLatex = frac => fractionOfN(frac, { latex: true });

function akraSubstitution(parsed) {
  const { parts, fTerms, fLatex, fDominant: d } = parsed;
  const analysis = akraLevelSum(parts, fTerms);
  const p = analysis.p;
  const q = d.exp;
  const r = d.logExp;

  const callsLatex = parts
    .map(t => `${t.coef === 1 ? '' : num(t.coef)}T\\!\\left(${sizeLatex(t)}\\right)`)
    .join(' + ');

  const formulas = [];
  const add = (latex, label) => formulas.push({ latex, label });

  add(`T(n) = ${callsLatex} + ${fLatex}`, 'Given');

  // Expanding each call once shows why this cannot collapse the usual way: the
  // sizes multiply out to different fractions rather than a common n/b^k.
  const oneDeeper = parts
    .flatMap(outer => parts.map(inner => `T\\!\\left(${sizeLatex(multiplyFraction(outer, inner))}\\right)`))
    .join(' + ');
  add(
    `T(n) = ${oneDeeper} + ${parts.map(t => `f\\!\\left(${sizeLatex(t)}\\right)`).join(' + ')} + ${fLatex}`,
    'Expand every call once'
  );
  add(
    `\\text{the sizes no longer share one } b^{k}\\text{, so } \\sum a^{k}f(n/b^{k}) \\text{ does not apply}`,
    'Why this needs Akra-Bazzi'
  );
  add(`${akraEquationLatex(parts)} \\implies p = ${num(p, 4)}`, 'Find p, the exponent of the leaf count');
  add(
    `T(n) = \\Theta\\!\\left(n^{p}\\left(1 + \\int_{1}^{n} \\frac{f(u)}{u^{p+1}}\\,du\\right)\\right)`,
    'Akra-Bazzi formula'
  );
  add(akraIntegralLatex(q, r, p, analysis), 'Evaluate the integral');
  add(`= \\Theta\\left(${formatGrowthLatex(analysis.growth)}\\right)`, 'Final complexity');

  const steps = [];
  info(steps, `Parsed: ${parsed.original}`);
  info(steps, 'Method: substitution (expand the recurrence into itself)');
  divider(steps);
  loop(steps, 'Expanding every call once:');
  parts.forEach(t => {
    const kids = parts.map(i => `T(${sizeText(multiplyFraction(t, i))})`).join(' + ');
    nest(steps, `T(${sizeText(t)}) = ${kids} + f(${sizeText(t)})`);
  });
  divider(steps);
  info(steps, 'Each branch shrinks by a different factor, so the sizes never collect');
  info(steps, 'into a single n/b^k and the geometric sum does not apply.');
  divider(steps);
  pushWorking(steps, akraWorking(parsed, analysis));
  final(steps, analysis.growth);

  return {
    formulas,
    steps,
    finalComplexity: growthToKey(analysis.growth),
    finalLabel: bigO(analysis.growth),
    growth: analysis.growth,
  };
}

const akraEquationLatex = parts =>
  parts.map(t => `${t.coef === 1 ? '' : num(t.coef)}\\left(\\tfrac{${t.num ?? 1}}{${t.den ?? 1}}\\right)^{p}`).join(' + ') + ' = 1';

function akraIntegralLatex(q, r, p, analysis) {
  if (analysis.caseNum === 1) {
    return `\\int_{1}^{n} u^{${num(q - p - 1)}}\\log^{${num(r)}} u\\,du = \\Theta\\!\\left(n^{${num(q - p)}}\\log^{${num(r)}} n\\right)`;
  }
  if (analysis.caseNum === 3) return `\\int_{1}^{n} \\frac{f(u)}{u^{p+1}}\\,du = O(1)`;
  if (Math.abs(r + 1) < 1e-9) return `\\int_{1}^{n} \\frac{du}{u\\log u} = \\log\\log n`;
  if (r < -1) return `\\int_{1}^{n} \\frac{\\log^{${num(r)}} u}{u}\\,du = O(1)`;
  if (Math.abs(r) < 1e-9) return `\\int_{1}^{n} \\frac{du}{u} = \\log n`;
  return `\\int_{1}^{n} \\frac{\\log^{${num(r)}} u}{u}\\,du = \\frac{\\log^{${num(r + 1)}} n}{${num(r + 1)}}`;
}

// ---------------------------------------------------------------------------
// T(n) = T(√n) + f(n)
// ---------------------------------------------------------------------------

function sqrtSubstitution(parsed) {
  const { fTerms, fDominant: d, fLatex } = parsed;
  const growth = d.exp > 1e-9 ? polylog(d.exp, d.logExp) : d.logExp < 1e-9 ? loglog() : polylog(0, d.logExp);
  const fAt = (k, latex) =>
    renderF(fTerms, k === 0 ? arg.symbol('n') : arg.literal(`n^(1/${Math.pow(2, k)})`, `n^{1/${Math.pow(2, k)}}`), { latex });

  const formulas = [];
  const add = (latex, label) => formulas.push({ latex, label });

  add(`T(n) = T(\\sqrt{n}) + ${fLatex}`, 'Given');
  add(`T(\\sqrt{n}) = T(n^{1/4}) + ${fAt(1, true)}`, 'Step 1: replace n with √n');
  add(`T(n) = T(n^{1/4}) + ${fAt(1, true)} + ${fAt(0, true)}`, 'Substitute that back');
  add(`T(n) = T\\left(n^{1/2^{k}}\\right) + \\sum_{i=0}^{k-1} f\\left(n^{1/2^{i}}\\right)`, 'Pattern after k steps');
  add(`\\text{let } n = 2^{m} \\implies S(m) = S\\!\\left(\\frac{m}{2}\\right) + f(2^{m})`, 'Substitute n = 2^m to turn the root into a halving');
  add(`n^{1/2^{k}} = 2 \\implies k = \\log\\log n`, 'Stop at the base case');
  add(`= \\Theta\\left(${formatGrowthLatex(growth)}\\right)`, 'Final complexity');

  const steps = [];
  info(steps, `Parsed: ${parsed.original}`);
  info(steps, 'Method: substitution (expand the recurrence into itself)');
  divider(steps);
  loop(steps, 'Replace n with √n:');
  nest(steps, `T(√n) = T(n^(1/4)) + ${fAt(1)}`);
  loop(steps, 'Substitute back into T(n):');
  nest(steps, `T(n) = T(n^(1/4)) + ${fAt(1)} + ${fAt(0)}`);
  divider(steps);
  special(steps, 'Pattern after k steps:');
  special(steps, '  T(n) = T(n^(1/2^k)) + Σ f(n^(1/2^i))');
  special(steps, 'Base case at n^(1/2^k) = 2, so k = log log n');
  divider(steps);
  pushWorking(steps, sqrtWorking(parsed, growth));
  final(steps, growth);

  return {
    formulas,
    steps,
    finalComplexity: growthToKey(growth),
    finalLabel: bigO(growth),
    growth,
  };
}

// ---------------------------------------------------------------------------

/**
 * Emit the detailed algebra. Shared with the tree method, so an identity is
 * always explained the same way whichever method reached it.
 */
function pushWorking(steps, lines) {
  for (const line of lines) {
    if (line === '') steps.push({ text: '', type: 'divider' });
    else if (line.endsWith(':')) steps.push({ text: line, type: 'special' });
    else steps.push({ text: line, type: 'combine_nested' });
  }
}

const info = (steps, text) => steps.push({ text, type: 'info' });
const loop = (steps, text) => steps.push({ text, type: 'loop' });
const nest = (steps, text) => steps.push({ text: `  ${text}`, type: 'combine_nested' });
const special = (steps, text) => steps.push({ text, type: 'special' });
const divider = steps => steps.push({ text: '', type: 'divider' });

function final(steps, growth) {
  steps.push({ text: '─────────────────────────────────', type: 'divider' });
  steps.push({
    text: `FINAL COMPLEXITY: ${bigO(growth)}`,
    type: 'final',
    complexity: growthToKey(growth),
    label: bigO(growth),
  });
}
