// Complexity algebra: combines complexity values under multiplication (nesting),
// dominance (sequential composition / worst-case branches), and power (sqrt/log).
//
// A complexity VALUE is one of:
//   - a sentinel string: '1', 'exp_n', 'unknown'
//   - a legacy flat key naming a canonical single-symbol-'n' shape (e.g. 'n2', 'log_n')
//   - { compound: 'product', vars: {sym: power}, logVars: {sym: power} }  -- one term, any symbol(s)
//   - { compound: 'sum', terms: [value, ...] }                            -- incomparable terms (e.g. O(n)+O(m))
//
// This lets loop bounds be named anything (m, k, size, arr via len(arr)) instead of
// only ever recognising the literal character 'n', while still rendering the common
// single-'n' cases exactly as the original fixed vocabulary did.

import { shortComplexity } from './complexityTypes.js';

// Canonical single-symbol-'n' shapes, as (polynomial power, log power) pairs.
const FLAT_TERM_MAP = {
  'n':            { pow: 1,   logPow: 0 },
  'n2':           { pow: 2,   logPow: 0 },
  'n3':           { pow: 3,   logPow: 0 },
  'sqrt_n':       { pow: 0.5, logPow: 0 },
  'n_sqrt_n':     { pow: 1.5, logPow: 0 },
  'log_n':        { pow: 0,   logPow: 1 },
  'log2_n':       { pow: 0,   logPow: 2 },
  'n_log_n':      { pow: 1,   logPow: 1 },
  'n2_log_n':     { pow: 2,   logPow: 1 },
  'n3_log_n':     { pow: 3,   logPow: 1 },
  'sqrt_n_log_n': { pow: 0.5, logPow: 1 },
};

function matchFlatKey(pow, logPow) {
  for (const key in FLAT_TERM_MAP) {
    const t = FLAT_TERM_MAP[key];
    if (t.pow === pow && t.logPow === logPow) return key;
  }
  return null;
}

// ============================================================================
// TERM CONSTRUCTION / DECOMPOSITION
// ============================================================================

// Build a complexity value for `sym` raised to `pow` with an optional log factor.
// Collapses to a legacy flat string when sym === 'n' and the shape is canonical,
// so existing single-symbol behaviour and display strings are unchanged.
export function symbolTerm(sym, pow, logPow = 0) {
  if (!pow && !logPow) return '1';
  if (sym === 'n') {
    const flat = matchFlatKey(pow, logPow);
    if (flat) return flat;
  }
  return {
    compound: 'product',
    vars: pow ? { [sym]: pow } : {},
    logVars: logPow ? { [sym]: logPow } : {},
  };
}

// Decompose ANY complexity value into a flat array of raw {vars, logVars} terms.
// Sentinels ('1' -> [], 'exp_n'/'unknown' -> [] handled by caller) are not terms.
export function sumTermsOf(value) {
  if (value === '1' || value === undefined) return [];
  if (value === 'exp_n' || value === 'unknown') return [];
  if (typeof value === 'string') {
    const t = FLAT_TERM_MAP[value];
    return t ? [{ vars: t.pow ? { n: t.pow } : {}, logVars: t.logPow ? { n: t.logPow } : {} }] : [];
  }
  if (value.compound === 'sum') return value.terms.flatMap(sumTermsOf);
  if (value.compound === 'product') return [{ vars: { ...value.vars }, logVars: { ...value.logVars } }];
  return [];
}

function encodeTerm(term) {
  const varSyms = Object.keys(term.vars).filter(s => term.vars[s]);
  const logSyms = Object.keys(term.logVars).filter(s => term.logVars[s]);
  if (varSyms.length === 0 && logSyms.length === 0) return '1';
  if (varSyms.every(s => s === 'n') && logSyms.every(s => s === 'n')) {
    const flat = matchFlatKey(term.vars.n || 0, term.logVars.n || 0);
    if (flat) return flat;
  }
  return { compound: 'product', vars: { ...term.vars }, logVars: { ...term.logVars } };
}

function mergeAdd(m1, m2) {
  const out = { ...m1 };
  for (const k in m2) out[k] = (out[k] || 0) + m2[k];
  return out;
}

// Per-symbol (polyPower, logPower) compared lexicographically -- a polynomial
// degree edge always outweighs a log-factor edge, matching real asymptotic growth.
function rankGTE(a, b) {
  if (a[0] !== b[0]) return a[0] > b[0];
  return a[1] >= b[1];
}
function rankGT(a, b) {
  if (a[0] !== b[0]) return a[0] > b[0];
  return a[1] > b[1];
}
function symbolRank(term, sym) {
  return [term.vars[sym] || 0, term.logVars[sym] || 0];
}

function dominatesOrEqual(a, b) {
  const syms = new Set([...Object.keys(a.vars), ...Object.keys(b.vars), ...Object.keys(a.logVars), ...Object.keys(b.logVars)]);
  for (const s of syms) {
    if (!rankGTE(symbolRank(a, s), symbolRank(b, s))) return false;
  }
  return true;
}

function strictlyDominates(a, b) {
  if (!dominatesOrEqual(a, b)) return false;
  const syms = new Set([...Object.keys(a.vars), ...Object.keys(b.vars), ...Object.keys(a.logVars), ...Object.keys(b.logVars)]);
  for (const s of syms) {
    if (rankGT(symbolRank(a, s), symbolRank(b, s))) return true;
  }
  return false;
}

// Reduce a list of raw terms down to the Pareto-maximal set: drop any term that's
// dominated (or exactly duplicated) by another. What's left is the honest
// "worst case" set -- a single term when one dominates, several when genuinely
// incomparable (e.g. an m-only term next to an n-only term).
function reduceToMaximalTerms(terms) {
  let kept = [];
  for (const t of terms) {
    if (kept.some(k => dominatesOrEqual(k, t) && !strictlyDominates(t, k))) continue;
    kept = kept.filter(k => !strictlyDominates(t, k));
    if (!kept.some(k => dominatesOrEqual(k, t))) kept.push(t);
  }
  return kept;
}

function encodeTerms(terms) {
  if (terms.length === 0) return '1';
  if (terms.length === 1) return encodeTerm(terms[0]);
  return { compound: 'sum', terms: terms.map(encodeTerm) };
}

// ============================================================================
// CORE OPERATIONS
// ============================================================================

// log log n has no (polyPower, logPower) representation, so it can't ride the
// term machinery -- it's carried as a sentinel. Combining it with anything
// bigger falls back to the log n it is bounded by, which keeps results valid
// upper bounds; on its own it stays exact.
const LOG_LOG = 'log_log_n';

// Multiply -- used for nested loops/blocks.
export function multiplyComplexities(a, b) {
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  if (a === 'exp_n' || b === 'exp_n') return 'exp_n';
  if (a === '1') return b;
  if (b === '1') return a;
  if (a === LOG_LOG && b === LOG_LOG) return LOG_LOG;
  if (a === LOG_LOG) return multiplyComplexities('log_n', b);
  if (b === LOG_LOG) return multiplyComplexities(a, 'log_n');

  const aTerms = sumTermsOf(a);
  const bTerms = sumTermsOf(b);
  const products = [];
  for (const at of aTerms) {
    for (const bt of bTerms) {
      products.push({ vars: mergeAdd(at.vars, bt.vars), logVars: mergeAdd(at.logVars, bt.logVars) });
    }
  }
  return encodeTerms(reduceToMaximalTerms(products));
}

// Returns the higher-order (dominant) of two complexity values. When neither
// dominates the other (different symbols, e.g. O(n) vs O(m)) both are kept as
// an explicit sum rather than one silently overwriting the other.
export function dominantOf(a, b) {
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  if (a === 'exp_n' || b === 'exp_n') return 'exp_n';
  // log log n is dominated by every real term, and only beats O(1).
  if (a === LOG_LOG && b === LOG_LOG) return LOG_LOG;
  if (a === LOG_LOG) return b === '1' ? LOG_LOG : b;
  if (b === LOG_LOG) return a === '1' ? LOG_LOG : a;
  return encodeTerms(reduceToMaximalTerms([...sumTermsOf(a), ...sumTermsOf(b)]));
}

// Sum -- used for sequential blocks (keep only the dominant/incomparable terms).
export function sumComplexities(a, b) {
  return dominantOf(a, b);
}

// Worst case -- used for if/elif/else branches.
export function worstCase(arr) {
  return arr.reduce(dominantOf, '1');
}

// Raise a complexity value to a fractional/integer power (e.g. 0.5 for sqrt).
export function powerOfComplexity(value, exponent) {
  if (value === 'unknown') return 'unknown';
  if (value === 'exp_n') return 'exp_n';
  const terms = sumTermsOf(value);
  if (terms.length === 0) return '1';
  const scaled = terms.map(t => ({
    vars: Object.fromEntries(Object.entries(t.vars).map(([s, p]) => [s, p * exponent])),
    logVars: Object.fromEntries(Object.entries(t.logVars).map(([s, p]) => [s, p * exponent])),
  }));
  return encodeTerms(reduceToMaximalTerms(scaled));
}

// log(value) -- strips the polynomial part of the dominant term down to a bare
// log factor per symbol involved. log(exp_n) = n (defined for the 2**n case).
export function logOfComplexity(value) {
  if (value === 'unknown') return 'unknown';
  if (value === 'exp_n') return 'n';
  if (value === '1') return '1';
  const terms = reduceToMaximalTerms(sumTermsOf(value));
  if (terms.length === 0) return '1';
  const dominant = terms[0];
  const syms = new Set([...Object.keys(dominant.vars), ...Object.keys(dominant.logVars)]);
  if (syms.size === 0) return '1';
  const logVars = {};
  for (const s of syms) logVars[s] = 1;
  return encodeTerm({ vars: {}, logVars });
}

// Polynomial degree of `value` in `sym` (0 for O(1) or log-only, Infinity for exp_n/unknown).
export function polyDegreeOf(value, sym) {
  if (value === 'unknown' || value === 'exp_n') return Infinity;
  const terms = sumTermsOf(value);
  if (terms.length === 0) return 0;
  return Math.max(0, ...terms.map(t => t.vars[sym] || 0));
}

// Log power of `value` in `sym` (0 if there's no log factor on that symbol).
export function logPowerOf(value, sym) {
  const terms = sumTermsOf(value);
  if (terms.length === 0) return 0;
  return Math.max(0, ...terms.map(t => t.logVars[sym] || 0));
}

// Bump the polynomial degree of `value` in `sym` by `delta` (used for T(n)=T(n-1)+f(n) recursions).
export function bumpDegree(value, sym, delta) {
  if (value === 'unknown') return 'unknown';
  if (value === 'exp_n') return 'exp_n';
  const terms = sumTermsOf(value);
  const base = terms.length ? terms : [{ vars: {}, logVars: {} }];
  const bumped = base.map(t => ({ vars: { ...t.vars, [sym]: (t.vars[sym] || 0) + delta }, logVars: { ...t.logVars } }));
  return encodeTerms(reduceToMaximalTerms(bumped));
}

// Human-readable step string, e.g. "O(n) x O(log n) = O(n log n)".
export function multiplyStepStr(a, b, result) {
  if (a === '1') return `O(${shortComplexity(b)})`;
  if (b === '1') return `O(${shortComplexity(a)})`;
  return `O(${shortComplexity(a)}) × O(${shortComplexity(b)}) = O(${shortComplexity(result)})`;
}
