// Helper functions for complexityEngine.js

import { shortComplexity, COMPLEXITY_DISPLAY } from './complexityTypes.js';
import { multiplyStepStr, logOfComplexity, powerOfComplexity } from './complexityAlgebra.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Complexity keys are themselves valid identifier strings ('exp_n', 'log_n', 'n2'...),
// so they must never be mistaken for a program variable and promoted to a symbol.
const RESERVED_COMPLEXITY_KEYS = new Set(Object.keys(COMPLEXITY_DISPLAY));

export function logOf(bound) {
  return logOfComplexity(bound);
}

export function sqrtOf(bound) {
  return powerOfComplexity(bound, 0.5);
}

export function resolveExpr(expr, ctx, promote) {
  if (typeof expr === 'string' && /^[A-Za-z_]\w*$/.test(expr)) {
    if (RESERVED_COMPLEXITY_KEYS.has(expr)) return expr;
    if (ctx[expr]) return ctx[expr].bound;
    return promote ? promote(expr) : expr;
  }
  return expr;
}

export function findBodyIndent(lines, headerIdx) {
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].kind !== 'empty') {
      return lines[i].indent;
    }
  }
  return -1;
}

export function collectBodyLines(lines, headerIdx, bodyIndent) {
  const body = [];
  for (let j = headerIdx + 1; j < lines.length; j++) {
    if (lines[j].indent < bodyIndent) break;
    body.push(lines[j]);
  }
  return body;
}

export function findUpdate(bodyLines, varName) {
  const shrink = findLoopVarShrink(bodyLines, varName);
  if (!shrink) return null;
  return { op: shrink.op, isMultiplicative: shrink.kind === 'multiplicative' };
}

// How `varName` changes inside the loop body, which sets the iteration count:
//   additive       i += c        -> linear in the starting magnitude
//   multiplicative i *= c, i //= c -> logarithmic
//   selfsquare     i *= i       -> doubly logarithmic
//   modulo         b = a % b    -> logarithmic (Euclid's algorithm)
export function findLoopVarShrink(bodyLines, varName) {
  for (const line of bodyLines) {
    if (line.kind === 'update' && line.meta.var === varName) {
      const op = line.meta.op;
      const value = (line.meta.value || '').replace(/\s+/g, '');
      if (op === '*=' && value === varName) return { kind: 'selfsquare', op };
      if (op === '*=' || op === '/=' || op === '//=') return { kind: 'multiplicative', op };
      return { kind: 'additive', op };
    }
    if (line.kind === 'assign' && line.meta.var === varName && line.meta.value.includes('%')) {
      return { kind: 'modulo', op: '%' };
    }
  }
  return null;
}

export function checkBuiltinCall(stripped) {
  if (stripped.includes('.sort(') || stripped.startsWith('sorted(')) {
    return 'n_log_n';
  }
  if (stripped.startsWith('heapq.')) {
    return 'log_n';
  }
  return '1';
}

// Finds calls to `funcName(...)` inside `stripped`, returning each call's raw
// (unsplit) argument string. Used for both interprocedural call credit and
// self-recursion detection.
export function findCalls(stripped, funcName) {
  const calls = [];
  let idx = stripped.indexOf(funcName + '(');
  while (idx !== -1) {
    const before = idx === 0 ? '' : stripped[idx - 1];
    if (!/[A-Za-z0-9_]/.test(before)) {
      const argsStr = extractParenArgs(stripped, idx + funcName.length);
      if (argsStr !== null) calls.push(argsStr);
    }
    idx = stripped.indexOf(funcName + '(', idx + 1);
  }
  return calls;
}

function extractParenArgs(str, openIdx) {
  if (str[openIdx] !== '(') return null;
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return str.slice(openIdx + 1, i);
    }
  }
  return null;
}

// Credits a call to a previously-analyzed user function at this line, if any.
// Excludes `excludeName` (the function currently being analyzed) so self-recursive
// calls are left for the dedicated recursion classifier instead of being
// double-counted here.
export function checkFunctionCall(stripped, funcComplexities, excludeName) {
  for (const name in funcComplexities) {
    if (name === excludeName) continue;
    if (findCalls(stripped, name).length > 0) {
      return funcComplexities[name];
    }
  }
  return '1';
}

export function makeAnnotation(id, lineStart, lineEnd, complexity, label, depth, kind) {
  return { id, lineStart, lineEnd, complexity, label, depth, kind };
}

export function makeStep(text, type, complexity = undefined, indent = undefined) {
  const step = { text, type };
  if (complexity !== undefined) step.complexity = complexity;
  if (indent !== undefined) step.indent = indent;
  return step;
}

export function formatLoopStep(varName, rangeOrIterable, iterC, depth) {
  return makeStep(
    `for ${varName} in ${rangeOrIterable}: → O(${shortComplexity(iterC)}) iterations`,
    'loop',
    iterC,
    depth
  );
}

export function formatCombineStep(bodyC, iterC, totalC, depth) {
  return makeStep(
    `  └─ body: O(${shortComplexity(bodyC)})  →  ${multiplyStepStr(iterC, bodyC, totalC)}`,
    'combine_nested',
    undefined,
    depth
  );
}

export function formatWhileStep(condition, loopC, depth) {
  return makeStep(
    `while ${condition}: → O(${shortComplexity(loopC)}) iterations`,
    'loop',
    loopC,
    depth
  );
}
