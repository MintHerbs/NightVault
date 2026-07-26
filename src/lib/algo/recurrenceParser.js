/**
 * Recurrence Formula Parser
 *
 * Turns "T(n) = 2T(n/2) + n log n" into a structured recurrence:
 * the recursive terms (how many subproblems, and how the size shrinks) plus
 * f(n) as real algebra from recurrenceMath, never as a label string.
 *
 * The parser refuses input it cannot analyse rather than guessing, because a
 * confidently wrong complexity is worse than a clear "not supported".
 */

import { parseF, fGrowth, renderF, arg, dominantTerm } from './recurrenceMath.js';

/**
 * @param {string} formulaStr e.g. "T(n) = T(n-1) + log(n)"
 * @returns {Object} recurrence descriptor, or { error } if unsupported
 */
export function parseRecurrence(formulaStr) {
  const original = String(formulaStr ?? '').trim().replace(/\s+/g, ' ');
  if (!original) return { error: 'Enter a recurrence such as T(n) = 2T(n/2) + n' };

  const eq = original.split('=');
  if (eq.length !== 2) {
    return { error: 'Expected the form T(n) = ... with a single "=" sign' };
  }

  const lhs = eq[0].replace(/\s+/g, '').toLowerCase();
  if (!/^[a-z]\(n\)$/.test(lhs)) {
    return { error: `Left side should be T(n), got "${eq[0].trim()}"` };
  }
  const fnName = lhs[0].toUpperCase();

  const rhs = eq[1].trim();

  // "T(n) = 2T(n/2) +" is unfinished. Dropping the dangling operator would
  // silently answer a different question than the one being typed. This is
  // checked on the raw right side, because removing the T(...) calls later
  // legitimately leaves operators behind, as in "n + 2T(n/2)".
  if (/[+\-*/]$/.test(rhs)) {
    return { error: `The right side ends with "${rhs.slice(-1)}", so something is missing after it` };
  }

  // Pull out every recursive call, e.g. "3T(n/4)" or "T(n-2)". The lookbehind
  // keeps the "t(" inside "sqrt(n)" from being read as a recursive call.
  const callRegex = new RegExp(
    `(\\d*(?:\\.\\d+)?)\\s*\\*?\\s*(?<![a-zA-Z])${fnName}\\s*\\(([^()]*(?:\\([^()]*\\))?[^()]*)\\)`,
    'gi'
  );
  const calls = [];
  let rest = rhs;
  let m;
  while ((m = callRegex.exec(rhs)) !== null) {
    calls.push({ coef: m[1] ? parseFloat(m[1]) : 1, argText: m[2].trim(), raw: m[0] });
  }

  if (calls.length === 0) {
    return { error: `No recursive ${fnName}(...) term on the right side` };
  }

  for (const c of calls) rest = rest.replace(c.raw, ' ');

  // Whatever is left is f(n). Removing the calls leaves orphaned "+" signs
  // behind, so tidy those before handing the string to the algebra parser.
  const leftover = cleanLeftover(rest);
  const noWorkTerm = leftover === '';
  const fSource = noWorkTerm ? '1' : leftover;
  const parsedF = parseF(fSource);
  if (parsedF.error) {
    return { error: `Could not read the non-recursive part "${fSource.trim()}": ${parsedF.error}` };
  }
  const fTerms = parsedF.terms;

  // Classify each recursive call's argument.
  const recTerms = [];
  for (const c of calls) {
    const shape = classifyArgument(c.argText);
    if (shape.error) return { error: shape.error };
    recTerms.push({ coef: c.coef, ...shape });
  }

  const kinds = new Set(recTerms.map(t => t.kind));
  if (kinds.size > 1) {
    return {
      error: 'Mixing shrink styles in one recurrence (for example T(n/2) + T(n−1)) is not supported',
    };
  }
  const kind = recTerms[0].kind;

  const base = {
    original,
    fnName,
    fSource,
    fTerms,
    fText: renderF(fTerms, arg.symbol('n')),
    fLatex: renderF(fTerms, arg.symbol('n'), { latex: true }),
    fGrowth: fGrowth(fTerms),
    fDominant: dominantTerm(fTerms),
    recTerms,
    noWorkTerm,
  };

  if (kind === 'divide') {
    // Unequal subproblem sizes have no single ratio a/b^p, so they are analysed
    // by Akra-Bazzi instead of the Master-style level ratio.
    if (new Set(recTerms.map(t => t.b)).size > 1) {
      return {
        ...base,
        type: 'akra',
        a: recTerms.reduce((sum, t) => sum + t.coef, 0),
        parts: recTerms.map(t => ({ coef: t.coef, frac: 1 / t.b, num: t.num, den: t.den })),
      };
    }
    const b = recTerms[0].b;
    const a = recTerms.reduce((s, t) => s + t.coef, 0);
    if (b <= 1) return { error: 'The divisor must be greater than 1, otherwise the recursion never shrinks' };
    return { ...base, type: 'divide', a, b };
  }

  if (kind === 'subtract') {
    const a = recTerms.reduce((s, t) => s + t.coef, 0);
    const b = Math.min(...recTerms.map(t => t.shift));
    // One subproblem per level is a chain: the total is a plain sum of f values.
    // More than one is a linear recurrence and grows exponentially.
    const type = a > 1 ? 'linear' : 'subtract';
    return { ...base, type, a, b, shift: recTerms[0].shift };
  }

  if (kind === 'sqrt') {
    if (recTerms.length > 1 || recTerms[0].coef > 1) {
      return { error: 'Only a single T(√n) subproblem is supported' };
    }
    return { ...base, type: 'sqrt', a: 1, b: 2, root: recTerms[0].root };
  }

  return { error: 'Unsupported recurrence shape' };
}

/**
 * Exact shrink fraction for a call, so nested sizes stay rational: two levels of
 * T(2n/3) is T(4n/9), not T(0.444n).
 */
function rational(numer, denom) {
  if (!Number.isInteger(numer) || !Number.isInteger(denom)) return { num: null, den: null };
  const g = gcd(numer, denom);
  return { num: numer / g, den: denom / g };
}

function gcd(x, y) {
  let a = Math.abs(x);
  let b = Math.abs(y);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Collapse the operator debris left where the T(...) calls used to be. */
function cleanLeftover(rest) {
  let s = rest.replace(/\s+/g, ' ').trim();
  let prev = null;
  while (prev !== s) {
    prev = s;
    s = s
      .replace(/([+-])\s*([+-])/g, (_, a, b) => (a === b ? '+' : '-'))
      .replace(/^\+\s*/, '')
      .replace(/[+\-*]\s*$/, '')
      .trim();
  }
  return s;
}

/**
 * Work out how one T(...) argument shrinks the problem.
 * Lower-order offsets are ignored on purpose: T(n/2 + 7) is Θ-identical to
 * T(n/2), and floors and ceilings do not change the asymptotics either.
 */
function classifyArgument(argText) {
  const s = argText.replace(/[⌊⌋⌈⌉]/g, '').replace(/\s+/g, '').toLowerCase();
  if (!s) return { error: 'Empty recursive call argument' };

  // Square-root shrink: sqrt(n), n^(1/2), n^0.5
  if (/^sqrt\(n\)$/.test(s) || /^n\^\(1\/2\)$/.test(s) || /^n\^0?\.5$/.test(s)) {
    return { kind: 'sqrt', root: 2 };
  }
  if (/^n\^\(1\/(\d+)\)$/.test(s)) {
    return { kind: 'sqrt', root: parseInt(/^n\^\(1\/(\d+)\)$/.exec(s)[1], 10) };
  }

  // Divide shrink: n/b, with an optional additive offset we can ignore.
  const div = /^n\/(\d+(?:\.\d+)?)(?:[+-]\d+)?$/.exec(s);
  if (div) {
    const b = parseFloat(div[1]);
    if (b <= 1) return { error: `T(n/${div[1]}) does not shrink the problem` };
    return { kind: 'divide', b, shift: 0, ...rational(1, b) };
  }

  // Fractional shrink written as a coefficient: 2n/3, 0.5n
  const frac = /^(\d+(?:\.\d+)?)n\/(\d+(?:\.\d+)?)$/.exec(s) || /^(0?\.\d+)n$/.exec(s);
  if (frac) {
    const numer = parseFloat(frac[1]);
    const denom = frac[2] ? parseFloat(frac[2]) : 1;
    const ratio = numer / denom;
    if (ratio >= 1) return { error: `T(${argText.trim()}) does not shrink the problem` };
    return { kind: 'divide', b: 1 / ratio, shift: 0, ...rational(numer, denom) };
  }

  // Subtract shrink: n-c
  const sub = /^n-(\d+)$/.exec(s);
  if (sub) {
    const shift = parseInt(sub[1], 10);
    if (shift < 1) return { error: 'T(n−0) does not shrink the problem' };
    return { kind: 'subtract', shift, b: shift };
  }

  if (s === 'n') return { error: `${'T(n)'} cannot call itself on the same size n` };
  if (/^n\+/.test(s)) return { error: `T(${argText.trim()}) grows the problem, so the recursion never ends` };

  return { error: `Could not read the recursive call argument "${argText.trim()}"` };
}

/**
 * Convert a plain-text formula to LaTeX for the input preview.
 * @param {string} text
 * @returns {string}
 */
export function textToLatex(text) {
  let latex = String(text ?? '');

  // sqrt(x) -> \sqrt{x}
  latex = latex.replace(/sqrt\s*\(([^()]*)\)/gi, '\\sqrt{$1}');

  // log(x), log_2(x), log^2(x) -> \log ...
  latex = latex.replace(/log_(\d+)/gi, '\\log_{$1}');
  latex = latex.replace(/log\^(\d+)/gi, '\\log^{$1}');
  latex = latex.replace(/(?<!\\)\blog\b/gi, '\\log');

  // n/2 and 3/4 -> \frac{..}{..} (single operands only, so T(n)/f(n) survive)
  latex = latex.replace(/([a-zA-Z0-9]+)\s*\/\s*([a-zA-Z0-9]+)/g, '\\frac{$1}{$2}');

  // Exponents
  latex = latex.replace(/\^\(([^()]+)\)/g, '^{$1}');
  latex = latex.replace(/\^([0-9a-zA-Z.]+)/g, '^{$1}');

  latex = latex.replace(/\*/g, ' \\cdot ');
  latex = latex.replace(/\.\.\./g, '\\cdots');
  latex = latex.replace(/>=/g, '\\geq').replace(/<=/g, '\\leq');
  latex = latex.replace(/−/g, '-');

  return latex.replace(/\s+/g, ' ').trim();
}
