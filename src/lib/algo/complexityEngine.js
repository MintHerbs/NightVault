// Main complexity analysis engine

import { displayComplexity, shortComplexity } from './complexityTypes.js';
import {
  multiplyComplexities, sumComplexities, worstCase,
  symbolTerm, bumpDegree, polyDegreeOf, logPowerOf,
} from './complexityAlgebra.js';
import { parseLines, analyzeExpression, analyzeRangeArgs, parseWhileCondition, splitArgs } from './complexityParser.js';
import {
  logOf, sqrtOf, resolveExpr, findBodyIndent, collectBodyLines, findUpdate, findLoopVarShrink,
  checkBuiltinCall, checkFunctionCall, findCalls,
  makeAnnotation, makeStep, formatLoopStep, formatCombineStep, formatWhileStep
} from './complexityEngineHelpers.js';

let annotationCounter = 0;

// A "size" symbol term, used to resolve bare identifiers (loop bounds, range args)
// that aren't a tracked loop variable -- i.e. genuine input-size parameters,
// whatever they happen to be named ('n', 'm', 'arr', ...).
const promoteToSymbol = sym => symbolTerm(sym, 1);

export function analyzeComplexity(code) {
  try {
    const allLines = parseLines(code);
    const lines = allLines.filter(l => l.kind !== 'empty');

    if (lines.length === 0) {
      return { finalComplexity: '1', annotations: [], steps: [] };
    }

    const minIndent = Math.min(...lines.map(l => l.indent));

    // Pass 1: walk once to learn every top-level function's own complexity, so
    // Pass 2 can credit a call to it (from another function, in either
    // definition order) with its real cost instead of silently treating the
    // call as O(1).
    const funcComplexities = {};
    annotationCounter = 0;
    analyzeBlock(lines, 0, minIndent, {}, [], [], 0, { funcComplexities, currentFunc: null });

    // Pass 2: the real analysis, with every top-level function's complexity known.
    const steps = [];
    const annotations = [];
    annotationCounter = 0;
    const { complexity } = analyzeBlock(lines, 0, minIndent, {}, steps, annotations, 0, { funcComplexities, currentFunc: null });

    steps.push(makeStep('─────────────────────────────────', 'divider'));
    steps.push(makeStep('FINAL COMPLEXITY: ' + displayComplexity(complexity), 'final', complexity));

    return { finalComplexity: complexity, annotations, steps };
  } catch (err) {
    return { error: err.message };
  }
}

function analyzeBlock(lines, startIdx, minIndent, ctx, steps, annotations, depth, fctx) {
  const seqComplexities = [];
  let i = startIdx;
  // Local copy so assignments seen here inform later lines in this block
  // (e.g. `hi = n - 1` before `while lo <= hi`) without leaking outward.
  let localCtx = { ...ctx };

  while (i < lines.length && lines[i].indent >= minIndent) {
    const line = lines[i];

    if (line.indent > minIndent) {
      i++;
      continue;
    }

    if (line.kind === 'for_range') {
      const result = handleForRange(lines, i, line.meta, localCtx, steps, annotations, depth, fctx);
      seqComplexities.push(result.complexity);
      i = result.nextIdx;
    } else if (line.kind === 'for_iter') {
      const result = handleForIter(lines, i, line.meta, localCtx, steps, annotations, depth, fctx);
      seqComplexities.push(result.complexity);
      i = result.nextIdx;
    } else if (line.kind === 'while') {
      const result = handleWhile(lines, i, line.meta, localCtx, steps, annotations, depth, fctx);
      seqComplexities.push(result.complexity);
      i = result.nextIdx;
    } else if (line.kind === 'if') {
      const result = handleIfElse(lines, i, localCtx, steps, annotations, depth, fctx);
      seqComplexities.push(result.complexity);
      i = result.nextIdx;
    } else if (line.kind === 'def') {
      const result = analyzeDefBlock(lines, i, localCtx, steps, annotations, depth, fctx);
      seqComplexities.push(result.complexity);
      if (fctx && fctx.funcComplexities && result.name) {
        fctx.funcComplexities[result.name] = result.complexity;
      }
      i = result.nextIdx;
    } else {
      if (line.kind === 'assign') {
        localCtx = {
          ...localCtx,
          [line.meta.var]: {
            kind: 'assigned',
            bound: resolveExpr(analyzeExpression(line.meta.value), localCtx, promoteToSymbol),
          },
        };
      }
      const builtinC = checkBuiltinCall(line.stripped);
      let contributed = builtinC;
      if (contributed === '1' && fctx && fctx.funcComplexities) {
        contributed = checkFunctionCall(line.stripped, fctx.funcComplexities, fctx.currentFunc);
      }
      if (contributed !== '1') {
        seqComplexities.push(contributed);
      }
      i++;
    }
  }

  const complexity = seqComplexities.reduce(sumComplexities, '1');
  return { complexity, nextIdx: i };
}

// ============================================================================
// FUNCTION DEFINITIONS + RECURSION
// ============================================================================

function extractParamNames(paramsStr) {
  if (!paramsStr.trim()) return [];
  return splitArgs(paramsStr).map(p => p.split('=')[0].split(':')[0].trim()).filter(Boolean);
}

// Any variable assigned a "...//2" / ".../2" expression -- covers both the
// lo/hi bisection idiom (mid = (lo+hi)//2) and direct array halving
// (mid = len(arr)//2), under whatever name the code actually uses.
const HALVING_VALUE_RE = /\/\/?2$/;

function findHalvingVars(bodyLines) {
  const vars = new Set();
  for (const line of bodyLines) {
    if (line.kind !== 'assign') continue;
    if (HALVING_VALUE_RE.test(line.meta.value.replace(/\s+/g, ''))) vars.add(line.meta.var);
  }
  return vars;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Classifies how a single recursive call's arguments relate to the function's
// own parameters: does the size shrink by a constant subtraction (n-1), by
// division (n//2), or via a halving variable computed earlier in the body
// (mid = ...//2, then passed or sliced on directly)?
function classifyCallArgs(argsStr, paramNames, halvingVars) {
  const args = splitArgs(argsStr).map(a => a.replace(/\s+/g, ''));

  for (const a of args) {
    for (const p of paramNames) {
      const m = a.match(new RegExp(`^${p}\\/\\/?(\\d+)$`));
      if (m) return { kind: 'divide', by: Number(m[1]) };
    }
  }
  for (const hv of halvingVars) {
    const hvRe = escapeRe(hv);
    for (const a of args) {
      if (new RegExp(`^${hvRe}([+-]\\d+)?$`).test(a)) return { kind: 'divide', by: 2 };
      for (const p of paramNames) {
        if (new RegExp(`^${p}\\[:?${hvRe}([+-]\\d+)?:?\\]$`).test(a)) return { kind: 'divide', by: 2 };
      }
    }
  }
  for (const a of args) {
    for (const p of paramNames) {
      if (new RegExp(`^${p}\\[.*\\/\\/?2.*\\]$`).test(a)) return { kind: 'divide', by: 2 };
    }
  }
  for (const a of args) {
    for (const p of paramNames) {
      const m = a.match(new RegExp(`^${p}-(\\d+)$`));
      if (m) return { kind: 'subtract', amount: Number(m[1]) };
    }
  }
  return { kind: 'unknown' };
}

function findBlockEnd(lines, startIdx, blockIndent) {
  let i = startIdx;
  while (i < lines.length && lines[i].indent >= blockIndent) i++;
  return i;
}

// Walks one straight-line execution path through the function body, honouring
// early-return control flow: branches of an if/elif/[else] that end in a
// `return` are mutually exclusive with whatever follows the if-statement (the
// ubiquitous Python guard-clause idiom), so their calls must NOT be summed
// with the fallthrough code -- only the single worst path is kept. A
// recursive call found inside a loop is deliberately flagged 'unknown' rather
// than modelled, since a loop multiplies the effective branching factor in a
// way this Master-theorem-lite classifier doesn't attempt to capture.
function walkRecursivePaths(lines, idx, blockIndent, funcName, paramNames, halvingVars) {
  if (idx >= lines.length || lines[idx].indent < blockIndent) {
    return { calls: [], terminates: false };
  }
  const line = lines[idx];
  if (line.indent > blockIndent) {
    return walkRecursivePaths(lines, idx + 1, blockIndent, funcName, paramNames, halvingVars);
  }

  if (line.kind === 'if') {
    const branches = [];
    let j = idx;
    let hasElse = false;
    while (j < lines.length && lines[j].indent === blockIndent && ['if', 'elif', 'else'].includes(lines[j].kind)) {
      if (lines[j].kind === 'else') hasElse = true;
      const bIndent = findBodyIndent(lines, j);
      if (bIndent === -1) {
        branches.push({ calls: [], terminates: false });
        j++;
      } else {
        branches.push(walkRecursivePaths(lines, j + 1, bIndent, funcName, paramNames, halvingVars));
        j = findBlockEnd(lines, j + 1, bIndent);
      }
    }

    const rest = walkRecursivePaths(lines, j, blockIndent, funcName, paramNames, halvingVars);

    const candidates = branches.map(b => (b.terminates ? b.calls : [...b.calls, ...rest.calls]));
    if (!hasElse) candidates.push(rest.calls);

    let worst = candidates[0] || [];
    for (const c of candidates) if (c.length > worst.length) worst = c;

    const allBranchesTerminate = hasElse && branches.every(b => b.terminates);
    return { calls: worst, terminates: allBranchesTerminate || rest.terminates };
  }

  if (['for_range', 'for_iter', 'while'].includes(line.kind)) {
    const bIndent = findBodyIndent(lines, idx);
    let loopCalls = [];
    let afterIdx = idx + 1;
    if (bIndent !== -1) {
      const sub = walkRecursivePaths(lines, idx + 1, bIndent, funcName, paramNames, halvingVars);
      if (sub.calls.length > 0) loopCalls = [{ kind: 'unknown' }];
      afterIdx = findBlockEnd(lines, idx + 1, bIndent);
    }
    const rest = walkRecursivePaths(lines, afterIdx, blockIndent, funcName, paramNames, halvingVars);
    return { calls: [...loopCalls, ...rest.calls], terminates: rest.terminates };
  }

  if (line.kind === 'def') {
    const bIndent = findBodyIndent(lines, idx);
    const afterIdx = bIndent === -1 ? idx + 1 : findBlockEnd(lines, idx + 1, bIndent);
    return walkRecursivePaths(lines, afterIdx, blockIndent, funcName, paramNames, halvingVars);
  }

  const lineCalls = findCalls(line.stripped, funcName).map(argsStr => classifyCallArgs(argsStr, paramNames, halvingVars));
  if (line.kind === 'return') {
    return { calls: lineCalls, terminates: true };
  }
  const rest = walkRecursivePaths(lines, idx + 1, blockIndent, funcName, paramNames, halvingVars);
  return { calls: [...lineCalls, ...rest.calls], terminates: rest.terminates };
}

// Scans a function body for self-calls and classifies the overall recurrence
// shape: null (not recursive), 'subtract' (T(n)=a·T(n-c)+f(n)), 'divide'
// (T(n)=a·T(n/b)+f(n)), or 'unknown' (a real recursive call whose argument
// pattern -- or branching structure -- we can't confidently classify).
function analyzeRecursion(bodyLines, funcName, paramNames) {
  if (bodyLines.length === 0) return null;
  const halvingVars = findHalvingVars(bodyLines);
  const bodyIndent = bodyLines[0].indent;
  const { calls: classifications } = walkRecursivePaths(bodyLines, 0, bodyIndent, funcName, paramNames, halvingVars);

  if (classifications.length === 0) return null;
  if (classifications.some(c => c.kind === 'unknown')) return { kind: 'unknown' };

  const divides = classifications.filter(c => c.kind === 'divide');
  const subtracts = classifications.filter(c => c.kind === 'subtract');

  if (divides.length > 0 && subtracts.length === 0) {
    const divisors = new Set(divides.map(c => c.by));
    if (divisors.size > 1) return { kind: 'unknown' };
    return { kind: 'divide', a: divides.length, b: divides[0].by };
  }
  if (subtracts.length > 0 && divides.length === 0) {
    return { kind: 'subtract', a: subtracts.length };
  }
  return { kind: 'unknown' };
}

function roundNice(x) {
  const nice = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  for (const v of nice) if (Math.abs(x - v) < 1e-6) return v;
  return Math.round(x * 100) / 100;
}

// The symbol the recursion's own size is actually measured in. Flat keys are
// always relative to 'n' by construction; a compound extraWork (e.g. a loop
// over range(len(arr))) reveals the real symbol -- often not literally 'n'
// (recursing via array slicing on a param named `arr` has no numeric 'n'
// anywhere). Falls back to 'n' when extraWork is O(1)/O(?)/etc, matching the
// textbook-default label for e.g. plain binary search.
function dominantSymbolOf(value) {
  if (value && value.compound === 'product') {
    const syms = [...Object.keys(value.vars || {}), ...Object.keys(value.logVars || {})];
    return syms[0] || 'n';
  }
  if (value && value.compound === 'sum' && value.terms.length) {
    return dominantSymbolOf(value.terms[0]);
  }
  return 'n';
}

// Master-theorem-lite: combines the recursion shape with the per-call "extra
// work" (the function's own non-recursive cost) into an overall complexity.
function applyMasterTheorem(recursion, extraWork) {
  if (recursion.kind === 'unknown' || extraWork === 'unknown') return 'unknown';

  const sym = dominantSymbolOf(extraWork);

  if (recursion.kind === 'subtract') {
    if (recursion.a === 1) return bumpDegree(extraWork, sym, 1);
    return 'exp_n'; // branching, non-shrinking recursion (e.g. naive fibonacci)
  }

  if (recursion.kind === 'divide') {
    const { a, b } = recursion;
    const critExp = Math.log(a) / Math.log(b);
    const fDeg = polyDegreeOf(extraWork, sym);

    if (fDeg < critExp - 1e-9) return symbolTerm(sym, roundNice(critExp));
    if (Math.abs(fDeg - critExp) < 1e-9) {
      return symbolTerm(sym, roundNice(critExp), logPowerOf(extraWork, sym) + 1);
    }
    return extraWork; // f(n) dominates (regularity condition assumed)
  }

  return 'unknown';
}

function describeRecursion(r) {
  if (r.kind === 'subtract') return `T(n) = ${r.a}·T(n−c) + f(n)`;
  if (r.kind === 'divide') return `T(n) = ${r.a}·T(n/${r.b}) + f(n)`;
  return 'unrecognised recurrence';
}

// Detects the standard memoization idiom: a `key in cache` guard that returns
// early, plus writes back into that same cache. With memoization the recursion
// evaluates each distinct subproblem once, so cost is (number of states) x
// (work per state) rather than the raw branching recurrence.
function detectMemoization(bodyLines, paramNames) {
  let cache = null;
  let keyParam = null;
  for (const line of bodyLines) {
    if (line.kind !== 'if') continue;
    const m = line.meta.condition.match(/^(\w+)\s+in\s+(\w+)$/);
    if (m && paramNames.includes(m[1])) {
      keyParam = m[1];
      cache = m[2];
    }
  }
  if (!cache) return null;
  const writesBack = bodyLines.some(l => new RegExp(`^${escapeRe(cache)}\\s*\\[`).test(l.stripped));
  return writesBack ? { cache, keyParam } : null;
}

function analyzeDefBlock(lines, idx, ctx, steps, annotations, depth, fctx) {
  const line = lines[idx];
  const bodyIndent = findBodyIndent(lines, idx);

  if (bodyIndent === -1) {
    return { complexity: '1', nextIdx: idx + 1, name: null };
  }

  steps.push(makeStep(`def ${line.meta.name}(${line.meta.params}):`, 'info', undefined, depth));

  const funcName = line.meta.name;
  const paramNames = extractParamNames(line.meta.params);
  const bodyLines = collectBodyLines(lines, idx, bodyIndent);
  const recursion = analyzeRecursion(bodyLines, funcName, paramNames);

  // Self-calls are excluded from interprocedural credit here -- the recursion
  // classifier (or, if unrecognised, honest 'unknown') handles them instead,
  // so this walk naturally yields the function's own non-recursive "extra work".
  const bodyFctx = { ...fctx, currentFunc: funcName };
  const bodyResult = analyzeBlock(lines, idx + 1, bodyIndent, ctx, steps, annotations, depth + 1, bodyFctx);

  let complexity = bodyResult.complexity;
  const memo = recursion ? detectMemoization(bodyLines, paramNames) : null;

  if (recursion && memo) {
    // States x work-per-state. The state space is linear in the memo key.
    complexity = bumpDegree(bodyResult.complexity, memo.keyParam, 1);
    steps.push(makeStep(
      `⚡ memoized on ${memo.cache}[${memo.keyParam}] → each subproblem solved once → O(${shortComplexity(complexity)})`,
      'special', complexity, depth
    ));
  } else if (recursion && recursion.kind !== 'unknown') {
    complexity = applyMasterTheorem(recursion, bodyResult.complexity);
    steps.push(makeStep(
      `⚡ recursive: ${describeRecursion(recursion)}, extra work O(${shortComplexity(bodyResult.complexity)}) → O(${shortComplexity(complexity)})`,
      'special', complexity, depth
    ));
  } else if (recursion && recursion.kind === 'unknown') {
    complexity = 'unknown';
    steps.push(makeStep('⚠ recursive call pattern not recognised → complexity unknown', 'special', 'unknown', depth));
  }

  // Bracket the whole function with its total. Without this the derivation is
  // invisible for recursive functions: the inner brackets only show the work
  // done in ONE call (often O(1)), and the step that multiplies it by the number
  // of levels happens here, at the def, where nothing was being drawn.
  if (complexity !== '1') {
    const lineEnd = bodyResult.nextIdx > 0 ? lines[bodyResult.nextIdx - 1].lineNum : line.lineNum;
    let label = `${funcName}(): O(${shortComplexity(complexity)})`;
    if (recursion && memo) {
      label = `${funcName}(): memoized on ${memo.cache}[${memo.keyParam}] → O(${shortComplexity(bodyResult.complexity)}) per state × O(${memo.keyParam}) states = O(${shortComplexity(complexity)})`;
    } else if (recursion && recursion.kind !== 'unknown') {
      label = `${funcName}(): ${describeRecursion(recursion)} with f(n) = O(${shortComplexity(bodyResult.complexity)}) → O(${shortComplexity(complexity)})`;
    } else if (recursion) {
      label = `${funcName}(): recursive, call pattern not recognised → O(?)`;
    }
    const isDuplicate = annotations.some(
      a => a.lineStart === line.lineNum && a.lineEnd === lineEnd
        && JSON.stringify(a.complexity) === JSON.stringify(complexity)
    );
    if (!isDuplicate) {
      annotations.push(makeAnnotation(`a${annotationCounter++}`, line.lineNum, lineEnd, complexity, label, depth, 'def'));
    }
  }

  return { complexity, nextIdx: bodyResult.nextIdx, name: funcName };
}

// ============================================================================
// LOOPS / BRANCHES
// ============================================================================

// Finds an inner `range(start, stop, step)` whose step IS the enclosing loop
// variable. The inner loop then runs stop/i times, and summing that over
// i = 1..stop is the harmonic series: stop · H(stop) = O(stop · log stop).
// Returns the inner loop's stop expression, or null.
function findHarmonicInner(lines, idx, bodyIndent, outerVar) {
  for (const line of collectBodyLines(lines, idx, bodyIndent)) {
    if (line.kind !== 'for_range') continue;
    const args = splitArgs(line.meta.rangeArgs);
    if (args.length === 3 && args[2].trim() === outerVar) return args[1].trim();
  }
  return null;
}

function handleForRange(lines, idx, meta, ctx, steps, annotations, depth, fctx) {
  const iterC = resolveExpr(analyzeRangeArgs(meta.rangeArgs), ctx, promoteToSymbol);

  const bodyIndentEarly = findBodyIndent(lines, idx);
  if (bodyIndentEarly !== -1) {
    const harmonicStop = findHarmonicInner(lines, idx, bodyIndentEarly, meta.var);
    if (harmonicStop) {
      const stopC = resolveExpr(analyzeExpression(harmonicStop), ctx, promoteToSymbol);
      const totalC = multiplyComplexities(stopC, logOf(stopC));
      steps.push(formatLoopStep(meta.var, `range(${meta.rangeArgs})`, iterC, depth));
      steps.push(makeStep(`⚡ Harmonic series: inner range step is ${meta.var} → Σ(${shortComplexity(stopC)}/i) = O(${shortComplexity(totalC)})`, 'special', totalC, depth));
      const bodyResult = analyzeBlock(lines, idx + 1, bodyIndentEarly, ctx, steps, annotations, depth + 1, fctx);
      const lineEnd = bodyResult.nextIdx > 0 ? lines[bodyResult.nextIdx - 1].lineNum : lines[idx].lineNum;
      annotations.push(makeAnnotation(`a${annotationCounter++}`, lines[idx].lineNum, lineEnd, totalC, `for ${meta.var} in range(${meta.rangeArgs}) [harmonic]`, depth, 'for'));
      return { complexity: totalC, nextIdx: bodyResult.nextIdx };
    }
  }

  steps.push(formatLoopStep(meta.var, `range(${meta.rangeArgs})`, iterC, depth));

  const bodyIndent = findBodyIndent(lines, idx);
  if (bodyIndent === -1) {
    annotations.push(makeAnnotation(`a${annotationCounter++}`, lines[idx].lineNum, lines[idx].lineNum, iterC, `for ${meta.var} in range(${meta.rangeArgs})`, depth, 'for'));
    return { complexity: iterC, nextIdx: idx + 1 };
  }

  const newCtx = { ...ctx, [meta.var]: { kind: 'additive', bound: iterC } };
  const bodyResult = analyzeBlock(lines, idx + 1, bodyIndent, newCtx, steps, annotations, depth + 1, fctx);

  const totalC = multiplyComplexities(iterC, bodyResult.complexity);
  steps.push(formatCombineStep(bodyResult.complexity, iterC, totalC, depth));

  const lineEnd = bodyResult.nextIdx > 0 ? lines[bodyResult.nextIdx - 1].lineNum : lines[idx].lineNum;
  annotations.push(makeAnnotation(`a${annotationCounter++}`, lines[idx].lineNum, lineEnd, totalC, `for ${meta.var} in range(${meta.rangeArgs})`, depth, 'for'));

  return { complexity: totalC, nextIdx: bodyResult.nextIdx };
}

function handleForIter(lines, idx, meta, ctx, steps, annotations, depth, fctx) {
  let iterC = resolveExpr(analyzeExpression(meta.iterable), ctx, promoteToSymbol);
  if (iterC === '1') iterC = 'n';

  steps.push(formatLoopStep(meta.var, meta.iterable, iterC, depth));

  const bodyIndent = findBodyIndent(lines, idx);
  if (bodyIndent === -1) {
    annotations.push(makeAnnotation(`a${annotationCounter++}`, lines[idx].lineNum, lines[idx].lineNum, iterC, `for ${meta.var} in ${meta.iterable}`, depth, 'for'));
    return { complexity: iterC, nextIdx: idx + 1 };
  }

  const newCtx = { ...ctx, [meta.var]: { kind: 'additive', bound: iterC } };
  const bodyResult = analyzeBlock(lines, idx + 1, bodyIndent, newCtx, steps, annotations, depth + 1, fctx);

  const totalC = multiplyComplexities(iterC, bodyResult.complexity);
  steps.push(formatCombineStep(bodyResult.complexity, iterC, totalC, depth));

  const lineEnd = bodyResult.nextIdx > 0 ? lines[bodyResult.nextIdx - 1].lineNum : lines[idx].lineNum;
  annotations.push(makeAnnotation(`a${annotationCounter++}`, lines[idx].lineNum, lineEnd, totalC, `for ${meta.var} in ${meta.iterable}`, depth, 'for'));

  return { complexity: totalC, nextIdx: bodyResult.nextIdx };
}

// Detects the classic iterative bisection idiom: a two-pointer while condition
// (e.g. `lo <= hi`) whose body computes a midpoint by halving and reassigns one
// of the pointers from that midpoint -- the range halves every iteration
// regardless of what the pointers are literally compared against.
function isBisectionWhile(meta, bodyLines) {
  const parsed = parseWhileCondition(meta.condition);
  if (!parsed || parsed.kind !== 'compare') return false;
  const { left, right } = parsed;
  if (!/^[A-Za-z_]\w*$/.test(left) || !/^[A-Za-z_]\w*$/.test(right)) return false;
  const halvingVars = findHalvingVars(bodyLines);
  if (halvingVars.size === 0) return false;
  return bodyLines.some(line =>
    line.kind === 'assign' &&
    (line.meta.var === left || line.meta.var === right) &&
    [...halvingVars].some(hv => new RegExp(`\\b${escapeRe(hv)}\\b`).test(line.meta.value))
  );
}

function handleWhile(lines, idx, meta, ctx, steps, annotations, depth, fctx) {
  const bodyIndent = findBodyIndent(lines, idx);
  const bodyLines = bodyIndent !== -1 ? collectBodyLines(lines, idx, bodyIndent) : [];

  if (bodyIndent !== -1 && isBisectionWhile(meta, bodyLines)) {
    steps.push(makeStep(`while ${meta.condition}: bisection (range halves each iteration) → O(log n) iterations`, 'loop', 'log_n', depth));
    const bodyResult = analyzeBlock(lines, idx + 1, bodyIndent, ctx, steps, annotations, depth + 1, fctx);
    const totalC = multiplyComplexities('log_n', bodyResult.complexity);
    steps.push(formatCombineStep(bodyResult.complexity, 'log_n', totalC, depth));
    const lineEnd = bodyResult.nextIdx > 0 ? lines[bodyResult.nextIdx - 1].lineNum : lines[idx].lineNum;
    annotations.push(makeAnnotation(`a${annotationCounter++}`, lines[idx].lineNum, lineEnd, totalC, `while ${meta.condition} [bisection]`, depth, 'while'));
    return { complexity: totalC, nextIdx: bodyResult.nextIdx };
  }

  const parsed = parseWhileCondition(meta.condition);

  if (!parsed) {
    steps.push(makeStep(`while ${meta.condition}: → O(n) iterations (assumed)`, 'loop', 'n', depth));
    if (bodyIndent === -1) {
      return { complexity: 'n', nextIdx: idx + 1 };
    }
    const bodyResult = analyzeBlock(lines, idx + 1, bodyIndent, ctx, steps, annotations, depth + 1, fctx);
    const totalC = multiplyComplexities('n', bodyResult.complexity);
    return { complexity: totalC, nextIdx: bodyResult.nextIdx };
  }

  const isNumeric = s => /^\d+(\.\d+)?$/.test(s);
  const isIdent = s => /^[A-Za-z_]\w*$/.test(s);

  let loopVar, otherSide, shrink;

  if (parsed.kind === 'sqrt_product') {
    loopVar = parsed.var;
    otherSide = parsed.bound;
    shrink = findLoopVarShrink(bodyLines, loopVar);
  } else {
    const { left, right } = parsed;
    // Whichever side the body actually updates is the loop variable. Only if
    // neither is updated do we fall back to "the non-literal side".
    const leftShrink = isIdent(left) ? findLoopVarShrink(bodyLines, left) : null;
    const rightShrink = isIdent(right) ? findLoopVarShrink(bodyLines, right) : null;

    if (leftShrink) { loopVar = left; otherSide = right; shrink = leftShrink; }
    else if (rightShrink) { loopVar = right; otherSide = left; shrink = rightShrink; }
    else if (isNumeric(right)) { loopVar = left; otherSide = right; shrink = null; }
    else if (isNumeric(left)) { loopVar = right; otherSide = left; shrink = null; }
    else { loopVar = left; otherSide = right; shrink = null; }
  }

  // When the loop counts toward a constant (`while j >= 0`, `while i > 1`), the
  // iteration count comes from the loop variable's own starting magnitude, not
  // from the literal. Otherwise it comes from the opposite side of the compare.
  const magnitude = isNumeric(otherSide)
    ? resolveExpr(loopVar, ctx, promoteToSymbol)
    : resolveExpr(analyzeExpression(otherSide), ctx, promoteToSymbol);

  const effectiveBound = parsed.kind === 'sqrt_product' ? sqrtOf(magnitude) : magnitude;

  if (bodyIndent === -1) {
    return { complexity: effectiveBound, nextIdx: idx + 1 };
  }

  const update = shrink ? { op: shrink.op, isMultiplicative: shrink.kind === 'multiplicative' } : null;

  // Geometric series detection
  if (update && update.isMultiplicative) {
    const hasInnerForWithVar = bodyLines.some(
      line => line.kind === 'for_range' && line.meta.rangeArgs.includes(loopVar)
    );

    if (hasInnerForWithVar) {
      steps.push(makeStep(`while ${meta.condition}: multiplicative → O(log n) iterations`, 'loop', 'log_n', depth));
      steps.push(makeStep(`⚠ Geometric series: inner for range(${loopVar}) with ${loopVar} doubling`, 'special', undefined, depth));
      steps.push(makeStep(`Σ(k=1,2,4,...,n) = 2n−1 → combined while+for = O(${shortComplexity(magnitude)})`, 'special', undefined, depth));

      const bodyResult = analyzeBlock(lines, idx + 1, bodyIndent, ctx, steps, annotations, depth + 1, fctx);

      const lineEnd = bodyResult.nextIdx > 0 ? lines[bodyResult.nextIdx - 1].lineNum : lines[idx].lineNum;
      annotations.push(makeAnnotation(`a${annotationCounter++}`, lines[idx].lineNum, lineEnd, magnitude, `while ${meta.condition} [geometric series]`, depth, 'while'));

      return { complexity: magnitude, nextIdx: bodyResult.nextIdx };
    }
  }

  // Normal path -- the shrink pattern sets how the iteration count relates to
  // the loop's starting magnitude.
  let loopC;
  if (shrink && shrink.kind === 'selfsquare') {
    loopC = 'log_log_n';
    steps.push(makeStep(`${loopVar} squares each iteration → O(log log n) iterations`, 'special', 'log_log_n', depth));
  } else if (shrink && shrink.kind === 'modulo') {
    loopC = logOf(effectiveBound);
    steps.push(makeStep(`${loopVar} = ... % ${loopVar} (Euclid) → O(${shortComplexity(loopC)}) iterations`, 'special', loopC, depth));
  } else if (update && update.isMultiplicative) {
    loopC = logOf(effectiveBound);
  } else {
    loopC = effectiveBound;
  }
  if (!shrink || (shrink.kind !== 'selfsquare' && shrink.kind !== 'modulo')) {
    steps.push(formatWhileStep(meta.condition, loopC, depth));
  }

  const bodyResult = analyzeBlock(lines, idx + 1, bodyIndent, ctx, steps, annotations, depth + 1, fctx);
  const totalC = multiplyComplexities(loopC, bodyResult.complexity);
  steps.push(formatCombineStep(bodyResult.complexity, loopC, totalC, depth));

  const lineEnd = bodyResult.nextIdx > 0 ? lines[bodyResult.nextIdx - 1].lineNum : lines[idx].lineNum;
  annotations.push(makeAnnotation(`a${annotationCounter++}`, lines[idx].lineNum, lineEnd, totalC, `while ${meta.condition}`, depth, 'while'));

  return { complexity: totalC, nextIdx: bodyResult.nextIdx };
}

function handleIfElse(lines, idx, ctx, steps, annotations, depth, fctx) {
  const branchComplexities = [];
  const startLine = lines[idx].lineNum;
  const baseIndent = lines[idx].indent;
  let i = idx;

  while (i < lines.length && lines[i].indent === baseIndent && ['if', 'elif', 'else'].includes(lines[i].kind)) {
    const line = lines[i];
    const label = line.kind === 'else' ? 'else' : `${line.kind} ${line.meta.condition}`;

    steps.push(makeStep(`${label}:`, 'info', undefined, depth));

    const bodyIndent = findBodyIndent(lines, i);
    if (bodyIndent === -1) {
      branchComplexities.push('1');
      i++;
      continue;
    }

    const bodyResult = analyzeBlock(lines, i + 1, bodyIndent, ctx, steps, annotations, depth + 1, fctx);
    branchComplexities.push(bodyResult.complexity);
    i = bodyResult.nextIdx;
  }

  const worst = worstCase(branchComplexities);
  steps.push(makeStep(`if/else: worst-case branch → O(${shortComplexity(worst)})`, 'worst_case', worst, depth));

  const endLine = i > 0 ? lines[i - 1].lineNum : lines[idx].lineNum;
  annotations.push(makeAnnotation(`a${annotationCounter++}`, startLine, endLine, worst, 'if/else branches', depth, 'if'));

  return { complexity: worst, nextIdx: i };
}
