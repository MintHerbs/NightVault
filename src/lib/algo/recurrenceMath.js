/**
 * recurrenceMath.js
 *
 * Asymptotic algebra shared by the tree solver and the substitution solver.
 * Two ideas carry the whole module:
 *
 * 1. Every f(n) we accept is a sum of terms of the form  c · n^p · log(n)^q.
 *    That covers 1, n, n^2, sqrt(n), log n, n log n, n log^2 n, n^1.5 and so on.
 *    Keeping p and q as numbers (never as strings like "n2") is what makes level
 *    costs, summations and substituted arguments exact instead of guessed.
 *
 * 2. A growth rate is either polylog { exp, logExp }, meaning n^exp · log^logExp n,
 *    or exponential { base }, meaning base^n. Comparison and formatting live here
 *    so the two solvers can never disagree about an answer.
 */

// ---------------------------------------------------------------------------
// Growth rates
// ---------------------------------------------------------------------------

/** n^exp · log^logExp(n) · (log log n)^logLogExp */
export function polylog(exp, logExp = 0, logLogExp = 0) {
  return { kind: 'polylog', exp, logExp, logLogExp };
}

/** base^n, for base > 1. Dominates every polylog growth. */
export function exponential(base) {
  return { kind: 'exp', base };
}

/** log log n, the answer to T(n) = T(√n) + 1. Sits between O(1) and O(log n). */
export function loglog() {
  return polylog(0, 0, 1);
}

const EPS = 1e-9;

/** Rank a growth as a comparable tuple so both kinds order consistently. */
function rank(g) {
  if (g.kind === 'exp') return [2, g.base, 0, 0];
  return [1, g.exp, g.logExp, g.logLogExp ?? 0];
}

/** -1 if a grows slower than b, 0 if same order, 1 if faster. */
export function compareGrowth(a, b) {
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < 4; i++) {
    const c = cmpNum(ra[i], rb[i]);
    if (c !== 0) return c;
  }
  return 0;
}

function cmpNum(x, y) {
  if (Math.abs(x - y) < EPS) return 0;
  return x < y ? -1 : 1;
}

export function maxGrowth(a, b) {
  return compareGrowth(a, b) >= 0 ? a : b;
}

const SUPERSCRIPT = { '-': '⁻', '.': '·', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

function toSuperscript(str) {
  return String(str).split('').map(ch => SUPERSCRIPT[ch] ?? ch).join('');
}

/** Snap values that are integers up to floating point noise, e.g. log_3(9). */
function snap(x) {
  const r = Math.round(x);
  return Math.abs(x - r) < 1e-6 ? r : x;
}

/** Trim a float for display: 1.5849625 -> "1.58", 2 -> "2". */
export function num(x, places = 2) {
  const v = snap(x);
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(places)));
}

/** Bare growth text, e.g. "n² log n", "√n", "2ⁿ", "1". */
export function formatGrowth(g) {
  if (g.kind === 'exp') {
    if (Math.abs(g.base - 1.618) < 0.01) return 'φⁿ';
    return `${num(g.base)}ⁿ`;
  }
  const parts = [];
  const p = formatPower('n', g.exp);
  if (p) parts.push(p);
  // A negative log power reads far better as a denominator: n/log n, not n log^-1 n.
  if (snap(g.logExp) > 0) parts.push(formatLogPower(g.logExp));
  if (snap(g.logLogExp ?? 0) > 0) {
    parts.push(Math.abs(snap(g.logLogExp) - 1) < EPS ? 'log log n' : `log^${num(g.logLogExp)} log n`);
  }
  const head = parts.length === 0 ? '1' : parts.join(' ');
  if (snap(g.logExp) < 0) return `${head}/${formatLogPower(-g.logExp)}`;
  return head;
}

function formatPower(base, rawExp) {
  const exp = snap(rawExp);
  if (Math.abs(exp) < EPS) return '';
  if (Math.abs(exp - 1) < EPS) return base;
  if (Math.abs(exp - 0.5) < EPS) return `√${base}`;
  if (Math.abs(exp - 1.5) < EPS) return `${base}√${base}`;
  if (Number.isInteger(exp) && exp >= 2 && exp <= 9) return `${base}${toSuperscript(exp)}`;
  return `${base}^${num(exp)}`;
}

function formatLogPower(rawQ) {
  const q = snap(rawQ);
  if (Math.abs(q) < EPS) return '';
  if (Math.abs(q - 1) < EPS) return 'log n';
  if (Number.isInteger(q) && q >= 2 && q <= 9) return `log${toSuperscript(q)} n`;
  return `log^${num(q)} n`;
}

/** LaTeX growth text, e.g. "n^{2}\\log n". */
export function formatGrowthLatex(g) {
  if (g.kind === 'exp') {
    if (Math.abs(g.base - 1.618) < 0.01) return '\\varphi^{n}';
    return `${num(g.base)}^{n}`;
  }
  const parts = [];
  if (Math.abs(g.exp) > EPS) {
    if (Math.abs(g.exp - 1) < EPS) parts.push('n');
    else if (Math.abs(g.exp - 0.5) < EPS) parts.push('\\sqrt{n}');
    else parts.push(`n^{${num(g.exp)}}`);
  }
  if (g.logExp > EPS) {
    parts.push(Math.abs(g.logExp - 1) < EPS ? '\\log n' : `\\log^{${num(g.logExp)}} n`);
  }
  if ((g.logLogExp ?? 0) > EPS) parts.push('\\log\\log n');
  const head = parts.length === 0 ? '1' : parts.join(' \\, ');
  if (g.logExp < -EPS) {
    return `\\frac{${head}}{${Math.abs(g.logExp + 1) < EPS ? '\\log n' : `\\log^{${num(-g.logExp)}} n`}}`;
  }
  return head;
}

/** "Θ(n log n)" */
export const theta = g => `Θ(${formatGrowth(g)})`;
/** "O(n log n)" */
export const bigO = g => `O(${formatGrowth(g)})`;

/**
 * Map a growth onto a complexityTypes key so shared UI can colour it.
 * Returns 'unknown' when there is no exact key; callers pass an exact
 * display label alongside, so 'unknown' never reaches the user as text.
 */
export function growthToKey(g) {
  if (g.kind === 'exp') return 'exp_n';
  if ((g.logLogExp ?? 0) > EPS) return 'unknown';
  const key = `${num(g.exp, 4)}|${num(g.logExp, 4)}`;
  return {
    '0|0': '1',
    '0|1': 'log_n',
    '0|2': 'log2_n',
    '0.5|0': 'sqrt_n',
    '0.5|1': 'sqrt_n_log_n',
    '1|0': 'n',
    '1|1': 'n_log_n',
    '1.5|0': 'n_sqrt_n',
    '2|0': 'n2',
    '2|1': 'n2_log_n',
    '3|0': 'n3',
    '3|1': 'n3_log_n',
  }[key] ?? 'unknown';
}

// ---------------------------------------------------------------------------
// f(n) as a sum of c · arg^exp · log(arg)^logExp terms
// ---------------------------------------------------------------------------

const term = (coef, exp, logExp) => ({ coef, exp, logExp });

/**
 * Parse an f(n) string into terms. Returns { terms } or { error }.
 * Understands: numbers, n, n^k, n^0.5, sqrt(n), log(n), log n, lg/ln/log_2,
 * log^k(n), (log n)^k, products (explicit * or juxtaposed), division by a
 * constant or by a power of n, and sums/differences of all of the above.
 */
export function parseF(input) {
  const src = String(input ?? '').trim();
  if (src === '') return { terms: [term(1, 0, 0)] };

  const tokens = tokenizeF(src);
  if (tokens.error) return { error: tokens.error };

  const parser = { toks: tokens.toks, i: 0 };
  let terms;
  try {
    terms = parseSum(parser);
  } catch (err) {
    return { error: err.message };
  }
  if (parser.i < parser.toks.length) {
    return { error: `could not read "${parser.toks[parser.i].text}" in f(n)` };
  }
  const kept = terms.filter(t => Math.abs(t.coef) > EPS);
  return { terms: kept.length ? kept : [term(1, 0, 0)] };
}

function tokenizeF(src) {
  const toks = [];
  // Strip whitespace: juxtaposition ("n log n") still tokenizes correctly
  // because the scanner below matches longest-first on names.
  const s = src.replace(/\s+/g, '').toLowerCase();
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let m;
    if ((m = /^\d+(\.\d+)?/.exec(rest))) {
      toks.push({ kind: 'num', value: parseFloat(m[0]), text: m[0] });
      i += m[0].length;
    } else if ((m = /^(log_\d+|log2|log|lg|ln)/.exec(rest))) {
      toks.push({ kind: 'log', text: m[0] });
      i += m[0].length;
    } else if ((m = /^sqrt/.exec(rest))) {
      toks.push({ kind: 'sqrt', text: m[0] });
      i += 4;
    } else if ('+-*/^()'.includes(rest[0])) {
      toks.push({ kind: rest[0], text: rest[0] });
      i += 1;
    } else if (rest[0] === 'n') {
      toks.push({ kind: 'n', text: 'n' });
      i += 1;
    } else {
      return { error: `unexpected "${rest[0]}" in f(n)` };
    }
  }
  return { toks };
}

const peek = p => p.toks[p.i];
const eat = (p, kind) => (peek(p)?.kind === kind ? p.toks[p.i++] : null);

function parseSum(p) {
  let sign = 1;
  if (eat(p, '+')) sign = 1;
  else if (eat(p, '-')) sign = -1;

  let terms = parseProduct(p).map(t => term(t.coef * sign, t.exp, t.logExp));
  for (;;) {
    let s;
    if (eat(p, '+')) s = 1;
    else if (eat(p, '-')) s = -1;
    else break;
    terms = terms.concat(parseProduct(p).map(t => term(t.coef * s, t.exp, t.logExp)));
  }
  return terms;
}

function parseProduct(p) {
  let acc = parseFactor(p);
  for (;;) {
    if (eat(p, '*')) {
      acc = multiplyTermLists(acc, parseFactor(p));
    } else if (eat(p, '/')) {
      acc = divideTermLists(acc, parseFactor(p));
    } else if (['num', 'n', 'log', 'sqrt', '('].includes(peek(p)?.kind)) {
      acc = multiplyTermLists(acc, parseFactor(p)); // juxtaposition: "n log n"
    } else {
      return acc;
    }
  }
}

function parseFactor(p) {
  const base = parseAtom(p);
  if (eat(p, '^')) {
    const e = parseExponent(p);
    return base.map(t => term(Math.pow(t.coef, e), t.exp * e, t.logExp * e));
  }
  return base;
}

function parseExponent(p) {
  const neg = !!eat(p, '-');
  if (eat(p, '(')) {
    const inner = parseExponent(p);
    if (!eat(p, ')')) throw new Error('unbalanced ( in exponent');
    return neg ? -inner : inner;
  }
  const t = eat(p, 'num');
  if (!t) throw new Error('exponent must be a number');
  return neg ? -t.value : t.value;
}

function parseAtom(p) {
  const t = peek(p);
  if (!t) throw new Error('f(n) ended unexpectedly');

  if (t.kind === 'num') {
    p.i++;
    return [term(t.value, 0, 0)];
  }
  if (t.kind === 'n') {
    p.i++;
    return [term(1, 1, 0)];
  }
  if (t.kind === '(') {
    p.i++;
    const inner = parseSum(p);
    if (!eat(p, ')')) throw new Error('unbalanced ( in f(n)');
    return inner;
  }
  if (t.kind === 'sqrt') {
    p.i++;
    const arg = parseAtomOrCall(p);
    return arg.map(a => term(Math.sqrt(Math.abs(a.coef)) || 1, a.exp / 2, a.logExp / 2));
  }
  if (t.kind === 'log') {
    p.i++;
    // Accept both log^2(n) and log(n)^2 spellings.
    let power = 1;
    if (eat(p, '^')) power = parseExponent(p);
    const arg = parseAtomOrCall(p);
    const inner = dominantTerm(arg);
    // log(n^p · log^q n) = p·log n + q·log log n  ->  Θ(log n) when p > 0.
    // log of a constant contributes nothing.
    if (Math.abs(inner.exp) < EPS && Math.abs(inner.logExp) < EPS) {
      return [term(1, 0, 0)];
    }
    const coef = Math.abs(inner.exp) > EPS ? Math.pow(Math.abs(inner.exp), power) : 1;
    return [term(coef, 0, power)];
  }
  throw new Error(`unexpected "${t.text}" in f(n)`);
}

/** Argument of sqrt/log: a parenthesised expression or a single factor. */
function parseAtomOrCall(p) {
  if (peek(p)?.kind === '(') return parseFactor(p);
  const base = parseAtom(p);
  if (eat(p, '^')) {
    const e = parseExponent(p);
    return base.map(t => term(Math.pow(t.coef, e), t.exp * e, t.logExp * e));
  }
  return base;
}

function multiplyTermLists(as, bs) {
  const out = [];
  for (const a of as) for (const b of bs) out.push(term(a.coef * b.coef, a.exp + b.exp, a.logExp + b.logExp));
  return out;
}

function divideTermLists(as, bs) {
  const d = dominantTerm(bs);
  if (Math.abs(d.coef) < EPS) throw new Error('division by zero in f(n)');
  return as.map(a => term(a.coef / d.coef, a.exp - d.exp, a.logExp - d.logExp));
}

/** The asymptotically largest term of a sum. */
export function dominantTerm(terms) {
  return terms.reduce((best, t) => (compareGrowth(termGrowth(t), termGrowth(best)) > 0 ? t : best), terms[0]);
}

export function termGrowth(t) {
  return polylog(t.exp, t.logExp);
}

/** Growth of a whole f(n). */
export function fGrowth(terms) {
  return termGrowth(dominantTerm(terms));
}

// ---------------------------------------------------------------------------
// Rendering f(<argument>) without string mangling
// ---------------------------------------------------------------------------

/**
 * An argument is a value substituted for n, carrying its own text, LaTeX and
 * whether it needs brackets when raised to a power. This is what stops
 * "n^2" from becoming "n-1^2".
 */
export const arg = {
  symbol: (name = 'n') => ({ text: name, latex: name, atomic: true }),
  minus: (name, k) => (k === 0 ? arg.symbol(name) : { text: `${name}−${k}`, latex: `${name} - ${k}`, atomic: false }),
  minusExpr: (name, kText, kLatex) => ({ text: `${name}−${kText}`, latex: `${name} - ${kLatex ?? kText}`, atomic: false }),
  over: (name, d) => (d === 1 ? arg.symbol(name) : { text: `${name}/${d}`, latex: `\\frac{${name}}{${d}}`, atomic: false }),
  overPow: (name, base, expText) => ({
    text: `${name}/${base}${toSuperscript(expText)}`,
    latex: `\\frac{${name}}{${base}^{${expText}}}`,
    atomic: false,
  }),
  literal: (text, latex) => ({ text, latex: latex ?? text, atomic: /^[a-z0-9]+$/i.test(text) }),
};

/**
 * Render one term applied to an argument. The sign is applied by renderF.
 * A compound argument such as n−1 gets brackets as soon as anything sits
 * beside it, so "n log n" at n−1 reads (n−1) log(n−1), never n−1 log(n−1).
 */
function renderTerm(t, a, latex, neighbours = false) {
  const mag = Math.abs(t.coef);
  const hasLog = Math.abs(t.logExp) > EPS;
  const hasPow = Math.abs(t.exp) > EPS;
  const crowded = neighbours || hasLog || Math.abs(mag - 1) > EPS;

  const factors = [];
  if (hasPow) factors.push(renderPow(a, t.exp, latex, crowded));
  if (hasLog) factors.push(renderLog(a, t.logExp, latex));

  if (factors.length === 0) return formatCoef(mag, latex, false);

  const body = factors.join(latex ? ' \\, ' : ' ');
  if (Math.abs(mag - 1) < EPS) return body;
  const head = formatCoef(mag, latex, true);
  return latex ? `${head} \\, ${body}` : `${head}${body}`;
}

/** @param {boolean} beforeFactor bracket a text fraction so "1/2n" cannot be misread */
function formatCoef(c, latex, beforeFactor) {
  if (Number.isInteger(snap(c))) return String(snap(c));
  const denom = [2, 3, 4, 6, 8].find(d => Math.abs(c * d - Math.round(c * d)) < EPS);
  if (denom) {
    const numer = Math.round(c * denom);
    if (latex) return `\\frac{${numer}}{${denom}}`;
    return beforeFactor ? `(${numer}/${denom})` : `${numer}/${denom}`;
  }
  return num(c);
}

function renderPow(a, exp, latex, crowded) {
  if (Math.abs(exp - 1) < EPS) {
    if (crowded && !a.atomic) return wrap(a, latex);
    return latex ? a.latex : a.text;
  }
  if (Math.abs(exp - 0.5) < EPS) return latex ? `\\sqrt{${a.latex}}` : `√${wrap(a, false)}`;
  const base = wrap(a, latex);
  if (latex) return `${base}^{${num(exp)}}`;
  const e = snap(exp);
  // Superscripts read better in the tree than a caret, where space is tight.
  return Number.isInteger(e) && e >= 2 && e <= 9 ? `${base}${toSuperscript(e)}` : `${base}^${num(e)}`;
}

function renderLog(a, q, latex) {
  const inner = latex ? `\\left(${a.latex}\\right)` : `(${a.text})`;
  if (Math.abs(q - 1) < EPS) return latex ? `\\log${inner}` : `log${inner}`;
  return latex ? `\\log^{${num(q)}}${inner}` : `log^${num(q)}${inner}`;
}

function wrap(a, latex) {
  if (a.atomic) return latex ? a.latex : a.text;
  return latex ? `\\left(${a.latex}\\right)` : `(${a.text})`;
}

/** Render a full f(argument), e.g. renderF(terms, arg.minus('n', 2)) -> "(n−2)²". */
export function renderF(terms, a, { latex = false, inSum = false } = {}) {
  const parts = terms.map((t, idx) => {
    // In a sum, a bare compound argument would blur into the next "+": render
    // "(n−1)³ + (n−1)", never "(n−1)³ + n−1". `inSum` extends that to callers
    // that join several f(...) values, so a chain reads "n + (n−1) + (n−2)".
    const body = renderTerm(t, a, latex, inSum || terms.length > 1);
    if (idx === 0) return t.coef < 0 ? `−${body}` : body;
    return `${t.coef < 0 ? ' − ' : ' + '}${body}`;
  });
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Exact shrink fractions, so nested subproblem sizes stay rational
// ---------------------------------------------------------------------------

function gcd(x, y) {
  let a = Math.abs(x);
  let b = Math.abs(y);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Reduced { num, den }, or { num: null } when the inputs are not rational. */
export function reduceFraction(numer, denom) {
  if (!Number.isInteger(numer) || !Number.isInteger(denom) || denom === 0) {
    return { num: null, den: null, value: numer / denom };
  }
  const g = gcd(numer, denom);
  return { num: numer / g, den: denom / g, value: numer / denom };
}

/** Product of two shrink fractions, kept exact: 2/3 of 2/3 is 4/9, not 0.444. */
export function multiplyFraction(a, b) {
  if (a.num == null || b.num == null) {
    return { num: null, den: null, value: (a.value ?? a.num / a.den) * (b.value ?? b.num / b.den) };
  }
  return reduceFraction(a.num * b.num, a.den * b.den);
}

/**
 * A subproblem size as a multiple of n: "n", "n/3", "2n/3", "4n/9".
 * Falls back to a decimal when the fraction is not rational.
 */
export function fractionOfN(frac, { latex = false } = {}) {
  if (frac.num == null) return `${num(frac.value)}n`;
  const { num: p, den: q } = frac;
  if (q === 1) return p === 1 ? 'n' : `${p}n`;
  if (latex) return `\\frac{${p === 1 ? '' : p}n}{${q}}`;
  return `${p === 1 ? '' : p}n/${q}`;
}

/** Multiply every term by a scalar, for level costs like 4 · f(n/2). */
export function scaleTerms(terms, k) {
  return terms.map(t => term(t.coef * k, t.exp, t.logExp));
}

// ---------------------------------------------------------------------------
// Summation rules used by both methods
// ---------------------------------------------------------------------------

/**
 * Σ_{i=0}^{n/b − 1} f(n − i·b) for f = c · n^p · log^q n.
 *
 * There are ~n/b terms and the terms shrink linearly, so the sum is
 * Θ(n^(p+1) · log^q n). Exact leading terms are given for the textbook cases
 * so the derivation shows a real closed form rather than a hand wave.
 */
export function sumSubtractSeries(terms, b) {
  const d = dominantTerm(terms);
  const growth = polylog(d.exp + 1, d.logExp);
  const id = subtractIdentity(d, b);
  return { growth, ...id };
}

function subtractIdentity(d, b) {
  const { exp: p, logExp: q, coef: c } = d;
  const one = Math.abs(c - 1) < EPS;
  const cText = one ? '' : `${formatCoef(c, false, true)}·`;
  const cLatex = one ? '' : `${formatCoef(c, true, true)} \\cdot `;
  const levels = b === 1 ? 'n' : `n/${b}`;
  const levelsLatex = b === 1 ? 'n' : `\\frac{n}{${b}}`;

  if (Math.abs(q) < EPS && Math.abs(p) < EPS) {
    return {
      name: 'sum of constants',
      closedText: `${cText}${levels}`,
      closedLatex: `${cLatex}${levelsLatex}`,
      note: `the same constant on each of the ${levels} levels`,
    };
  }
  if (Math.abs(q) < EPS && Math.abs(p - 1) < EPS) {
    return {
      name: 'arithmetic series',
      closedText: `${cText}n(n+${b})/${2 * b}`,
      closedLatex: `${cLatex}\\frac{n(n+${b})}{${2 * b}}`,
      note: `n + (n−${b}) + (n−${2 * b}) + … + ${b}`,
    };
  }
  if (Math.abs(q) < EPS && Math.abs(p - 2) < EPS) {
    return {
      name: 'sum of squares',
      closedText: `${cText}n(n+${b})(2n+${b})/${6 * b}`,
      closedLatex: `${cLatex}\\frac{n(n+${b})(2n+${b})}{${6 * b}}`,
      note: `n² + (n−${b})² + … + ${b}²`,
    };
  }
  if (Math.abs(p) < EPS && Math.abs(q - 1) < EPS) {
    return {
      name: 'log of a factorial',
      closedText: b === 1 ? `${cText}log(n!)` : `${cText}log(n!)/${b}`,
      closedLatex: b === 1 ? `${cLatex}\\log(n!)` : `${cLatex}\\tfrac{1}{${b}}\\log(n!)`,
      note: 'log n + log(n−1) + … + log 1 = log(n!), and log(n!) = Θ(n log n) by Stirling',
    };
  }
  // Generic: n/b terms whose sizes fall off linearly, so the integral of n^p
  // gives the leading term n^(p+1)/(p+1), divided by the step size b.
  const logPart = Math.abs(q) > EPS ? ` ${formatLogPower(q)}` : '';
  const logLatex = Math.abs(q) > EPS ? ` \\, \\log^{${num(q)}} n` : '';
  return {
    name: 'power sum',
    closedText: `${cText}n^${num(p + 1)}/${num((p + 1) * b)}${logPart}`,
    closedLatex: `${cLatex}\\frac{n^{${num(p + 1)}}}{${num((p + 1) * b)}}${logLatex}`,
    note: `${levels} terms whose sizes fall off linearly, so the sum is Θ(n^${num(p + 1)}${logPart})`,
  };
}

/**
 * The divide-and-conquer level sum: Σ_{k=0}^{log_b n} a^k · f(n/b^k).
 *
 * With f = c·n^p·log^q n the level cost is c·n^p·log^q(n/b^k)·(a/b^p)^k, so the
 * whole analysis turns on the ratio r = a / b^p. This reproduces the Master
 * Theorem, including the log-power cases it is usually stated without.
 */
export function divideLevelSum(a, b, terms) {
  const d = dominantTerm(terms);
  const logba = Math.log(a) / Math.log(b);
  const ratio = a / Math.pow(b, d.exp);
  const decision = levelSumGrowth(logba, terms, {
    levelsText: `log_${b}(n)`,
    ratioText: 'r = a/b^p',
    leavesText: `Θ(a^log_${b}(n)) = Θ(n^log_${b}(a))`,
  });
  return { ...decision, ratio, logba };
}

/**
 * Exponent p solving Σ aᵢ·bᵢ^p = 1, the Akra-Bazzi exponent. Σ aᵢ·bᵢ^p is
 * strictly decreasing in p because every bᵢ is in (0, 1), so bisection is safe.
 * This is the same role log_b(a) plays for equal splits: it is the exponent of
 * the leaf count.
 *
 * @param {Array<{coef: number, frac: number}>} parts shrink fractions bᵢ = 1/b
 */
export function akraBazziExponent(parts) {
  const g = p => parts.reduce((sum, t) => sum + t.coef * Math.pow(t.frac, p), 0);
  let lo = 0;
  let hi = 1;
  while (g(hi) > 1 && hi < 1e6) hi *= 2;
  while (g(lo) < 1 && lo > -1e6) lo = lo === 0 ? -1 : lo * 2;
  for (let i = 0; i < 400; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 1) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The level sum for unequal splits: T(n) = Σ aᵢ·T(bᵢn) + f(n).
 *
 * The tree is lopsided, so "the cost of level k" is a sum over differently
 * sized nodes rather than one term. It still collapses: with f = c·n^q·log^r n
 * the polynomial part of level k is f(n)·ρ^k where ρ = Σ aᵢ·bᵢ^q. And ρ = 1
 * exactly when q = p, so the same three-way decision as the equal-split case
 * applies, with p in place of log_b(a).
 */
export function akraLevelSum(parts, terms) {
  const d = dominantTerm(terms);
  const p = akraBazziExponent(parts);
  const ratio = parts.reduce((sum, t) => sum + t.coef * Math.pow(t.frac, d.exp), 0);
  const decision = levelSumGrowth(p, terms, {
    levelsText: 'log(n)',
    ratioText: 'ρ = Σ aᵢbᵢ^q',
    leavesText: 'Θ(n^p)',
  });
  return { ...decision, ratio, logba: p, p };
}

/**
 * Shared three-case decision for every divide-style recurrence.
 *
 * Compare the exponent of the leaf count (log_b(a), or the Akra-Bazzi p) with
 * the exponent q of f(n):
 *   q > leaves   the root's own work dominates          Θ(f(n))
 *   q = leaves   every level costs the same             Θ(f(n) · levels)
 *   q < leaves   the leaf level dominates               Θ(n^leaves)
 *
 * @param {number} leavesExp exponent of the leaf count
 * @param {Array} terms f(n) as terms
 */
export function levelSumGrowth(leavesExp, terms, labels = {}) {
  const d = dominantTerm(terms);
  const q = d.exp;
  const r = d.logExp;
  const { levelsText = 'log(n)', ratioText = 'r', leavesText = `Θ(n^${num(leavesExp)})` } = labels;

  if (q > leavesExp + 1e-6) {
    return {
      caseNum: 1,
      leavesExp,
      dominatedBy: 'root',
      growth: polylog(q, r),
      reason: `${ratioText} < 1, so level costs shrink geometrically and the root dominates`,
      seriesNote: 'a decreasing geometric series sums to a constant times its first term',
    };
  }

  if (q >= leavesExp - 1e-6) {
    // Every level costs the same power of n, so the total is that power times
    // Σ_k log^r(n/b^k). Writing j for the remaining depth turns that into
    // Σ_j j^r, and the sum behaves in three different ways:
    //   r > −1   Σ j^r = Θ(log^(r+1) n)   the familiar "one more log" case
    //   r = −1   Σ 1/j is harmonic        = Θ(log log n)
    //   r < −1   Σ j^r converges          so the level count drops out entirely
    // Assuming the first case unconditionally is what made
    // T(n) = 2T(n/2) + n/log n come back as Θ(n) instead of Θ(n log log n).
    let growth;
    let seriesNote;
    if (r > -1 + 1e-9) {
      growth = polylog(q, r + 1);
      seriesNote = `equal level costs × ${levelsText} levels adds one log factor`;
    } else if (Math.abs(r + 1) < 1e-9) {
      growth = polylog(q, 0, 1);
      seriesNote = 'the level costs form a harmonic series, which sums to Θ(log log n)';
    } else {
      growth = polylog(q, 0);
      seriesNote = `Σ log^${num(r)} over the levels converges, so the level count drops out`;
    }
    return {
      caseNum: 2,
      leavesExp,
      dominatedBy: 'all levels',
      growth,
      reason: `${ratioText} = 1, so every level costs the same and there are ${levelsText} + 1 of them`,
      seriesNote,
    };
  }

  return {
    caseNum: 3,
    leavesExp,
    dominatedBy: 'leaves',
    growth: polylog(leavesExp, 0),
    reason: `${ratioText} > 1, so level costs grow geometrically and the leaf level dominates`,
    seriesNote: `an increasing geometric series is Θ(last term) = ${leavesText}`,
  };
}

/**
 * Dominant root of x^B = Σ aᵢ x^(B − bᵢ) for T(n) = Σ aᵢT(n − bᵢ) + f(n).
 * Gives 2 for 2T(n−1), and φ for T(n−1) + T(n−2).
 */
export function dominantRoot(recTerms) {
  // g(x) = Σ aᵢ x^(−bᵢ) is strictly decreasing for x > 0; the root of g(x) = 1
  // is the growth base.
  const g = x => recTerms.reduce((s, t) => s + t.coef * Math.pow(x, -t.shift), 0);
  let lo = 1;
  let hi = 2;
  while (g(hi) > 1 && hi < 1e6) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 1) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export { term as makeTerm };
