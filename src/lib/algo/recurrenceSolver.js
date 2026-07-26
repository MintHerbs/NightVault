/**
 * Recurrence Solver, tree method.
 *
 * The tree is not decoration: the complexity reported here is read off the
 * level costs that the drawing shows. For a divide-and-conquer recurrence the
 * cost of level k is a^k · f(n/b^k), so with f = c·n^p·log^q n the whole
 * analysis reduces to the ratio r = a/b^p between consecutive levels. That is
 * the same answer the Master Theorem gives, but derived from the tree rather
 * than looked up, which is what the step panel is meant to show.
 */

import {
  polylog,
  loglog,
  exponential,
  compareGrowth,
  formatGrowth,
  growthToKey,
  theta,
  bigO,
  num,
  renderF,
  arg,
  divideLevelSum,
  sumSubtractSeries,
  dominantRoot,
} from './recurrenceMath.js';
import {
  layoutTree,
  collectEdges,
  normalize,
  boundsOf,
  nodesAtDepth,
  measureNode,
  textWidth,
  LEVEL_HEIGHT,
  NODE_H,
} from './recurrenceTreeLayout.js';

export { solveBySubstitution } from './recurrenceSubstitution.js';

export const BREADTH_BUDGET = 16;

/**
 * How many levels to draw. A level is only worth drawing if it can be drawn in
 * full: a partly expanded level leaves one subtree far from its siblings and
 * reads as a layout bug rather than as elision. Beyond this the dots row and
 * the annotation column carry the pattern instead.
 */
const levelsFor = branching => (branching <= 3 ? 3 : 2);
const SUBSCRIPT = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const sub = v => String(v).split('').map(c => SUBSCRIPT[c] ?? c).join('');
const logOf = (b, x = 'n') => `log${sub(num(b))}(${x})`;

/**
 * @param {Object} parsed output of parseRecurrence
 * @returns {{ tree: Object, steps: Array, finalComplexity: string, finalLabel: string }}
 */
export function solveByTree(parsed) {
  if (!parsed || parsed.error) return failure(parsed?.error ?? 'No recurrence to solve');
  switch (parsed.type) {
    case 'divide':
      return divideTree(parsed);
    case 'subtract':
      return chainTree(parsed);
    case 'linear':
      return branchingTree(parsed);
    case 'sqrt':
      return sqrtTree(parsed);
    default:
      return failure(`Unsupported recurrence type "${parsed.type}"`);
  }
}

function failure(message) {
  return {
    tree: null,
    steps: [{ text: message, type: 'worst_case' }],
    finalComplexity: 'unknown',
    finalLabel: 'not solved',
    error: message,
  };
}

// ---------------------------------------------------------------------------
// Divide and conquer: T(n) = a·T(n/b) + f(n)
// ---------------------------------------------------------------------------

function divideTree(parsed) {
  const { a, b, fTerms } = parsed;
  const analysis = divideLevelSum(a, b, fTerms);
  const levelsShown = levelsFor(a);

  // With a = 1 there is one call per level, so the recursion is a path and the
  // work has to be drawn as a branch for the tree to have any shape at all.
  // With a >= 2 the recursive fan-out already provides the shape, and the cost
  // stays in the annotation column rather than multiplying the width by a + 1.
  const isChain = Math.abs(a - 1) < 1e-9;
  const sizeLabel = depth => (depth === 0 ? 'T(n)' : `T(n/${num(Math.pow(b, depth))})`);
  const levelArg = k => (k === 0 ? arg.symbol('n') : arg.over('n', num(Math.pow(b, k))));

  const root = isChain
    ? buildChainSpecs(levelsShown, sizeLabel, depth => renderF(fTerms, levelArg(depth)))
    : buildBranchingSpecs({
        levelsShown,
        rootState: { depth: 0 },
        expand: s => Array.from({ length: Math.round(a) }, () => ({ depth: s.depth + 1 })),
        labelOf: s => sizeLabel(s.depth),
      });

  const annotations = [];
  if (!isChain) {
    for (let k = 0; k < levelsShown; k++) {
      const count = Math.round(Math.pow(a, k));
      annotations.push({
        depth: k,
        countText: `${count} × ${renderF(fTerms, levelArg(k))}`,
        costText: divideLevelCost(parsed, k),
      });
    }
  }

  const leafCount = formatGrowth(polylog(analysis.logba, 0));
  const leafNote = leafCount === '1' ? '1 leaf' : `${leafCount} leaves`;
  const tree = assemble({
    root,
    annotations,
    baseLabel: 'T(1)',
    baseNote: leafNote,
    derivation: derivationLines(parsed, analysis),
  });

  return {
    tree,
    steps: divideSteps(parsed, analysis),
    finalComplexity: growthToKey(analysis.growth),
    finalLabel: bigO(analysis.growth),
    growth: analysis.growth,
  };
}

/** "4·(n−2)" for a level of 4 nodes, but just "4" when each costs a constant. */
function levelCostText(count, fAtLevel) {
  if (count === 1) return fAtLevel;
  if (fAtLevel === '1') return String(count);
  return `${count}·${fAtLevel}`;
}

/**
 * Is a cancelled multiplier worth showing as a number? Integers and the simple
 * fractions read fine (2n, (3/2)n, (1/4)n^2); anything else does not, and
 * 1/2^100 rounds to a bare "0", which is worse than not cancelling at all.
 */
function isCleanMultiplier(m) {
  if (!Number.isFinite(m) || m === 0) return false;
  if (Number.isInteger(m)) return Math.abs(m) <= 1e6;
  // Round(m * den) must be non-zero, or a vanishing multiplier like 1/2^100
  // "matches" 0/2 and renders as the bare "0" this guard exists to avoid.
  return [2, 3, 4, 6, 8].some(
    den => Math.round(m * den) !== 0 && Math.abs(m * den - Math.round(m * den)) < 1e-9
  );
}

/** Cost of one whole level: a^k · f(n/b^k), with the powers cancelled. */
function divideLevelCost(parsed, k) {
  const { a, b, fTerms, fDominant: d } = parsed;
  const mult = d.coef * Math.pow(a, k) / Math.pow(b, k * d.exp);
  const argK = k === 0 ? arg.symbol('n') : arg.over('n', num(Math.pow(b, k)));

  // Fall back to the uncancelled a^k · f(n/b^k), which is exact and shorter.
  if (!isCleanMultiplier(mult)) {
    const count = Math.round(Math.pow(a, k));
    const at = renderF(fTerms, argK);
    return count === 1 ? at : `${count}·${at}`;
  }

  const poly = renderF([{ coef: mult, exp: d.exp, logExp: 0 }], arg.symbol('n'));
  if (Math.abs(d.logExp) < 1e-9) return poly;
  const logPart = renderF([{ coef: 1, exp: 0, logExp: d.logExp }], argK);
  return poly === '1' ? logPart : `${poly} ${logPart}`;
}

/** Compact text for a ratio that may be astronomically small or large. */
function ratioText(r) {
  if (r !== 0 && (Math.abs(r) < 0.01 || Math.abs(r) > 1e6)) return r.toExponential(1);
  return num(r);
}

function derivationLines(parsed, analysis) {
  const { a, b } = parsed;
  const costs = [0, 1, 2].map(k => divideLevelCost(parsed, k));
  const sum = `${costs.join(' + ')} + …`;
  if (analysis.caseNum === 2) {
    return [`Total = ${sum}`, `= ${costs[0]} × (${logOf(b)} + 1)`, `= ${theta(analysis.growth)}`];
  }
  if (analysis.caseNum === 1) {
    return [`Total = ${sum}`, `geometric, ratio r = ${ratioText(analysis.ratio)} < 1, so the root dominates`, `= ${theta(analysis.growth)}`];
  }
  return [
    `Total = ${sum}`,
    `geometric, ratio r = ${ratioText(analysis.ratio)} > 1, so the leaves dominate`,
    `= ${theta(analysis.growth)}`,
  ];
}

function divideSteps(parsed, analysis) {
  const { a, b, fText, fDominant: d } = parsed;
  const steps = [];
  push(steps, `Parsed: ${parsed.original}`, 'info');
  push(steps, `Divide and conquer: a = ${num(a)} subproblems of size n/${num(b)}, f(n) = ${fText}`, 'info');
  if (parsed.noWorkTerm) push(steps, 'No additive term given, so f(n) = 1 (constant work per call)', 'info');
  push(steps, 'Building the recursion tree, level by level:', 'info');
  divider(steps);

  const levelsShown = levelsFor(a);
  for (let k = 0; k < levelsShown; k++) {
    const argK = k === 0 ? arg.symbol('n') : arg.over('n', num(Math.pow(b, k)));
    const count = Math.round(Math.pow(a, k));
    push(
      steps,
      `Level ${k}: ${count} node${count === 1 ? '' : 's'} × ${renderF(parsed.fTerms, argK)} = ${divideLevelCost(parsed, k)}`,
      'loop'
    );
  }
  push(steps, '⋮', 'info');
  push(steps, `Depth: n/b^k = 1 when k = ${logOf(b)}, so the tree has ${logOf(b)} + 1 levels`, 'loop');
  push(steps, `Leaves: a^${logOf(b)} = n^${num(analysis.logba)}, each costing T(1)`, 'loop');

  divider(steps);
  push(steps, 'Summing the levels:', 'info');
  push(steps, `each level is ${ratioText(analysis.ratio)}× the one above it, since r = a/b^p = ${num(a)}/${num(b)}^${num(d.exp)}`, 'special');
  push(steps, analysis.reason, 'special');
  push(steps, analysis.seriesNote, 'special');

  divider(steps);
  derivationLines(parsed, analysis).forEach(line => push(steps, line, 'combine_nested'));
  final(steps, analysis.growth);
  return steps;
}

// ---------------------------------------------------------------------------
// Chain: T(n) = T(n − b) + f(n)
// ---------------------------------------------------------------------------

function chainTree(parsed) {
  const { b, fTerms } = parsed;
  const series = sumSubtractSeries(fTerms, b);
  const levelsShown = 3;

  const costAt = depth => renderF(fTerms, depth === 0 ? arg.symbol('n') : arg.minus('n', b * depth));
  const root = buildChainSpecs(
    levelsShown,
    depth => `T(n${depth === 0 ? '' : `−${b * depth}`})`,
    costAt
  );

  // The work is drawn in the tree now, so the annotation column would only
  // repeat it. One node per level means the level cost is the node cost.
  const terms = [
    renderF(fTerms, arg.symbol('n'), { inSum: true }),
    renderF(fTerms, arg.minus('n', b), { inSum: true }),
    renderF(fTerms, arg.minus('n', 2 * b), { inSum: true }),
  ];
  const derivation = [
    `Total = ${terms.join(' + ')} + … + ${renderF(fTerms, arg.literal(String(b)))}`,
    `= ${series.closedText}`,
    `= ${theta(series.growth)}`,
  ];

  const tree = assemble({
    root,
    annotations: [],
    baseLabel: 'T(0)',
    baseNote: b === 1 ? 'n levels' : `n/${b} levels`,
    derivation,
  });

  return {
    tree,
    steps: chainSteps(parsed, series, terms),
    finalComplexity: growthToKey(series.growth),
    finalLabel: bigO(series.growth),
    growth: series.growth,
  };
}

function chainSteps(parsed, series, terms) {
  const { b, fText } = parsed;
  const steps = [];
  push(steps, `Parsed: ${parsed.original}`, 'info');
  push(steps, `One subproblem per level, size falling by ${b} each time, f(n) = ${fText}`, 'info');
  push(steps, 'Building the recursion tree, level by level:', 'info');
  divider(steps);

  for (let k = 0; k < 3; k++) {
    const argK = k === 0 ? arg.symbol('n') : arg.minus('n', b * k);
    push(steps, `Level ${k}: 1 node × ${renderF(parsed.fTerms, argK)}`, 'loop');
  }
  push(steps, '⋮', 'info');
  push(steps, `Depth: n − k·${b} = 0 when k = ${b === 1 ? 'n' : `n/${b}`}, so the chain has ${b === 1 ? 'n' : `n/${b}`} levels`, 'loop');

  divider(steps);
  push(steps, 'Every level holds exactly one node, so the total is the plain sum:', 'info');
  push(steps, `${terms.join(' + ')} + … + ${renderF(parsed.fTerms, arg.literal(String(b)))}`, 'combine_nested');
  push(steps, `Recognised: ${series.name}`, 'special');
  push(steps, series.note, 'special');

  divider(steps);
  push(steps, `= ${series.closedText}`, 'combine_nested');
  push(steps, `= ${theta(series.growth)}`, 'combine_nested');
  final(steps, series.growth);
  return steps;
}

// ---------------------------------------------------------------------------
// Branching subtract: T(n) = a·T(n − b) + f(n), and Fibonacci-shaped variants
// ---------------------------------------------------------------------------

function branchingTree(parsed) {
  const { recTerms, fTerms, b } = parsed;
  const rootBase = dominantRoot(recTerms);
  const growth = exponential(rootBase);
  const totalBranchFactor = recTerms.reduce((s, t) => s + t.coef, 0);
  const levelsShown = levelsFor(totalBranchFactor);

  // Each child carries its own accumulated shift, so T(n−1) + T(n−2) expands
  // into T(n−2), T(n−3) under the first child and T(n−3), T(n−4) under the second.
  const root = buildBranchingSpecs({
    levelsShown,
    rootState: { shift: 0 },
    expand: s =>
      recTerms.flatMap(t =>
        Array.from({ length: Math.round(t.coef) }, () => ({ shift: s.shift + t.shift }))
      ),
    labelOf: s => (s.shift === 0 ? 'T(n)' : `T(n−${s.shift})`),
  });

  const totalBranch = recTerms.reduce((s, t) => s + t.coef, 0);
  const annotations = [];
  for (let k = 0; k < levelsShown; k++) {
    const count = Math.round(Math.pow(totalBranch, k));
    annotations.push({
      depth: k,
      countText: `${count} × ${renderF(fTerms, k === 0 ? arg.symbol('n') : arg.minus('n', b * k))}`,
      costText: levelCostText(count, renderF(fTerms, k === 0 ? arg.symbol('n') : arg.minus('n', b * k))),
    });
  }

  const counts = [0, 1, 2].map(k => Math.round(Math.pow(totalBranch, k)));

  // With one shift the tree is uniform, so the node count really is a plain
  // geometric series. With several shifts the branches bottom out at different
  // depths, which is exactly why the base is the characteristic root and not
  // the branching factor: T(n−1) + T(n−2) grows as φⁿ, not 2ⁿ.
  const derivation =
    recTerms.length === 1
      ? [
          `Total = ${counts.join(' + ')} + … + ${num(totalBranch)}^(n/${b})`,
          `geometric with ratio ${num(totalBranch)}, so the last level dominates`,
          `= ${theta(growth)}`,
        ]
      : [
          `Node count obeys the same recurrence: N(n) = ${recTerms.map(t => `N(n−${t.shift})`).join(' + ')}`,
          `branches end at different depths, so the base is the root of x^${Math.max(...recTerms.map(t => t.shift))} = ${recTerms
            .map(t => `${t.coef === 1 ? '' : num(t.coef)}x^${Math.max(...recTerms.map(u => u.shift)) - t.shift}`)
            .join(' + ')}`,
          `= ${theta(growth)}`,
        ];

  const tree = assemble({
    root,
    annotations,
    baseLabel: 'T(0)',
    baseNote: `${formatGrowth(growth)} leaves`,
    derivation,
  });

  return {
    tree,
    steps: branchingSteps(parsed, rootBase, growth, counts),
    finalComplexity: growthToKey(growth),
    finalLabel: bigO(growth),
    growth,
  };
}

function branchingSteps(parsed, rootBase, growth, counts) {
  const { recTerms, fText, b } = parsed;
  const steps = [];
  const totalBranch = recTerms.reduce((s, t) => s + t.coef, 0);

  push(steps, `Parsed: ${parsed.original}`, 'info');
  push(steps, `Each call spawns ${num(totalBranch)} more, and the size only falls by ${b}`, 'info');
  push(steps, `f(n) = ${fText}`, 'info');
  divider(steps);

  counts.forEach((count, k) => {
    push(steps, `Level ${k}: ${count} node${count === 1 ? '' : 's'} × ${fText === '1' ? '1' : renderF(parsed.fTerms, k === 0 ? arg.symbol('n') : arg.minus('n', b * k))}`, 'loop');
  });
  push(steps, '⋮', 'info');
  push(steps, `Depth: n/${b} levels before reaching the base case`, 'loop');

  divider(steps);
  push(steps, 'The node count multiplies every level, so this is a geometric series:', 'info');
  push(steps, `${counts.join(' + ')} + … dominated by its last term`, 'combine_nested');

  if (recTerms.length > 1) {
    push(steps, `Different shifts, so the growth base solves x^${Math.max(...recTerms.map(t => t.shift))} = ${recTerms.map(t => `${t.coef === 1 ? '' : num(t.coef)}x^${Math.max(...recTerms.map(u => u.shift)) - t.shift}`).join(' + ')}`, 'special');
    push(steps, `Dominant root ≈ ${num(rootBase)}`, 'special');
  } else {
    push(steps, `${num(totalBranch)} branches with the size falling by ${b} gives ${num(totalBranch)}^(n/${b}) = ${formatGrowth(growth)} leaves`, 'special');
  }
  push(steps, 'The leaves dominate every level above them', 'special');

  divider(steps);
  push(steps, `= ${theta(growth)}`, 'combine_nested');
  final(steps, growth);
  return steps;
}

// ---------------------------------------------------------------------------
// Root shrink: T(n) = T(√n) + f(n)
// ---------------------------------------------------------------------------

function sqrtTree(parsed) {
  const { fTerms, fDominant: d } = parsed;
  const growth = sqrtGrowth(d);
  const levelsShown = 3;

  const sqrtArg = k => (k === 0 ? arg.symbol('n') : arg.literal(`n^(1/${Math.pow(2, k)})`, `n^{1/${Math.pow(2, k)}}`));
  const root = buildChainSpecs(
    levelsShown,
    depth => (depth === 0 ? 'T(n)' : `T(n^(1/${Math.pow(2, depth)}))`),
    depth => renderF(fTerms, sqrtArg(depth))
  );

  const derivation =
    d.exp > 1e-9
      ? [`Total = ${parsed.fText} + ${renderF(fTerms, arg.literal('√n'))} + …`, 'the first term dominates the rest', `= ${theta(growth)}`]
      : [
          'Substituting n = 2^m gives S(m) = S(m/2) + f(2^m)',
          `there are log log n levels, each costing ${d.logExp > 0 ? `log^${num(d.logExp)} n` : 'a constant'}`,
          `= ${theta(growth)}`,
        ];

  const tree = assemble({
    root,
    annotations: [],
    baseLabel: 'T(2)',
    baseNote: 'log log n levels',
    derivation,
  });

  return {
    tree,
    steps: sqrtSteps(parsed, growth, derivation),
    finalComplexity: growthToKey(growth),
    finalLabel: bigO(growth),
    growth,
  };
}

/**
 * Substituting n = 2^m turns T(√n) into S(m/2), a halving recurrence in m,
 * where f(n) = c·n^p·log^q n becomes c·2^(pm)·m^q.
 *   p > 0  the work is exponential in m, so the root dominates: Θ(f(n))
 *   p = 0, q = 0  constant work over log log n levels: Θ(log log n)
 *   p = 0, q > 0  Σ m^q over halvings is Θ(m^q) = Θ(log^q n)
 */
function sqrtGrowth(d) {
  if (d.exp > 1e-9) return polylog(d.exp, d.logExp);
  if (Math.abs(d.logExp) < 1e-9) return loglog();
  return polylog(0, d.logExp);
}

function sqrtSteps(parsed, growth, derivation) {
  const steps = [];
  push(steps, `Parsed: ${parsed.original}`, 'info');
  push(steps, `The size is square-rooted each level, f(n) = ${parsed.fText}`, 'info');
  divider(steps);
  for (let k = 0; k < 3; k++) {
    const argK = k === 0 ? arg.symbol('n') : arg.literal(`n^(1/${Math.pow(2, k)})`);
    push(steps, `Level ${k}: 1 node × ${renderF(parsed.fTerms, argK)}`, 'loop');
  }
  push(steps, '⋮', 'info');
  push(steps, 'Depth: n^(1/2^k) = 2 when k = log log n', 'loop');
  divider(steps);
  push(steps, 'Substituting n = 2^m turns the square root into a halving:', 'special');
  push(steps, 'S(m) = S(m/2) + f(2^m), which is the divide case in m', 'special');
  divider(steps);
  derivation.forEach(line => push(steps, line, 'combine_nested'));
  final(steps, growth);
  return steps;
}

// ---------------------------------------------------------------------------
// Spec building and assembly
// ---------------------------------------------------------------------------

/**
 * A chain, where each call branches into the work it does and the one call it
 * makes. When a = 1 the recursion itself is a path, so the work branch is what
 * makes the drawing a tree rather than a vertical line. Left child is the cost,
 * right child continues the recursion, which produces the staircase a lecturer
 * draws for T(n) = T(n−1) + f(n).
 *
 * @param {number} levelsShown how many recursive calls to draw
 * @param {(depth: number) => string} labelAt   label for the call at a depth
 * @param {(depth: number) => string} costAt    label for the work at a depth
 */
function buildChainSpecs(levelsShown, labelAt, costAt) {
  const root = { id: 'n0', kind: 'recursive', label: labelAt(0), children: [] };
  let current = root;
  for (let depth = 0; depth < levelsShown; depth++) {
    current.children.push({ id: `c${depth}`, kind: 'cost', label: costAt(depth), children: [] });
    if (depth < levelsShown - 1) {
      const kid = { id: `n${depth + 1}`, kind: 'recursive', label: labelAt(depth + 1), children: [] };
      current.children.push(kid);
      current = kid;
    } else {
      // Where the next call would go. Making it a real sibling of the cost lets
      // the layout reserve the space, so the "continues" dots cannot be drawn
      // through the cost box no matter how wide its label is.
      current.children.push({ id: 'continues', kind: 'continues', label: '', children: [] });
    }
  }
  return root;
}

/**
 * A branching tree, expanded breadth-first while the level still fits the
 * budget. Once it does not, the remaining subtrees collapse into a single
 * ellipsis node and the level annotation reports the true count.
 *
 * Children are derived from their own parent's state rather than from the
 * depth alone, so T(n−1) + T(n−2) correctly draws T(n−3), T(n−4) under its
 * second child instead of repeating the first subtree.
 */
function buildBranchingSpecs({ levelsShown, rootState, expand, labelOf, budget = BREADTH_BUDGET }) {
  const root = { id: 'n0', kind: 'recursive', label: labelOf(rootState), state: rootState, children: [] };
  let frontier = [root];

  for (let depth = 1; depth < levelsShown; depth++) {
    const next = [];

    for (const parent of frontier) {
      const childStates = expand(parent.state);
      const room = budget - next.length;

      // No room left for a whole sibling group: mark and stop.
      if (room < 1) {
        parent.children.push(ellipsis(depth, parent.id));
        break;
      }
      const take = childStates.length <= room ? childStates.length : Math.max(1, room - 1);
      for (let i = 0; i < take; i++) {
        const kid = {
          id: `n${depth}_${next.length}`,
          kind: 'recursive',
          label: labelOf(childStates[i]),
          state: childStates[i],
          children: [],
        };
        parent.children.push(kid);
        next.push(kid);
      }
      if (take < childStates.length) {
        parent.children.push(ellipsis(depth, parent.id));
        break;
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return root;
}

const ellipsis = (depth, parentId) => ({
  id: `e${depth}_${parentId}`,
  kind: 'ellipsis',
  label: '…',
  children: [],
});

/**
 * Position the spec tree, then append the dots, the base-case row, the
 * per-level annotation column and the derived formula, and compute the
 * viewBox from the real content rather than a fixed canvas.
 */
function assemble({ root, annotations, baseLabel, baseNote, derivation }) {
  const nodes = layoutTree(root);
  const edges = collectEdges(root);
  normalize(nodes, 0);

  const deepest = Math.max(...nodes.map(n => n.depth));

  // The recursion continues from the deepest *call*, not the deepest node: in a
  // chain the work leaf hangs one level below the last call, and dangling the
  // dots off it would imply the work recurses.
  const calls = nodes.filter(n => n.kind === 'recursive');
  const deepestCallDepth = Math.max(...calls.map(n => n.depth));
  const lastRow = nodesAtDepth(nodes, deepestCallDepth).filter(n => n.kind === 'recursive');

  // Chains reserve a slot for the call that would come next, so the dots have
  // somewhere to go that the layout has already kept clear of the cost box.
  // Branching trees have no such slot and converge on the centre of the row.
  const slot = nodes.find(n => n.kind === 'continues');
  const centerX = slot
    ? slot.x
    : (Math.min(...lastRow.map(n => n.x)) + Math.max(...lastRow.map(n => n.x))) / 2;

  // Clear the whole drawing, including any cost leaf below the last call.
  const lastY = Math.max(...nodes.map(n => n.y + n.h / 2)) - NODE_H / 2;

  const dotsY = slot ? slot.y : lastY + 58;
  const baseY = dotsY + 66;
  const baseSize = measureNode(baseLabel, 'base');
  nodes.push({
    id: 'base',
    kind: 'base',
    label: baseLabel,
    x: centerX,
    y: baseY,
    w: baseSize.w,
    h: baseSize.h,
    depth: deepest + 1,
  });

  const tail = {
    x: centerX,
    dotsY,
    toY: baseY - NODE_H / 2,
    // Branching trees converge one dashed line per still-expanding node. On a
    // chain the parent-to-slot edge already draws that link.
    from: slot ? [] : lastRow.map(n => ({ x: n.x, y: n.y + n.h / 2 })),
  };

  // Annotation column sits clear of the widest node, so it cannot collide.
  const nodeBounds = boundsOf(nodes);
  const columnX = nodeBounds.maxX + 52;
  const placedAnnotations = annotations.map(a => ({
    ...a,
    x: columnX,
    y: a.depth * LEVEL_HEIGHT,
    countWidth: textWidth(a.countText),
    costWidth: textWidth(a.costText) + 18,
  }));
  const columnGutter = Math.max(0, ...placedAnnotations.map(a => a.countWidth));
  const baseAnnotation = baseNote
    ? {
        depth: deepest + 1,
        x: columnX,
        y: baseY,
        countText: '',
        costText: baseNote,
        countWidth: columnGutter,
        costWidth: textWidth(baseNote) + 18,
      }
    : null;

  const allAnnotations = baseAnnotation ? [...placedAnnotations, baseAnnotation] : placedAnnotations;
  const annotationRight = Math.max(columnX, ...allAnnotations.map(annotationRightEdge));

  const derivationY = baseY + 74;
  const derivationWidth = Math.max(...derivation.map(textWidth)) + 44;
  const derivationX = centerX;

  const padding = 26;
  const minX = Math.min(nodeBounds.minX, derivationX - derivationWidth / 2) - padding;
  const maxX = Math.max(annotationRight, derivationX + derivationWidth / 2) + padding;
  const minY = nodeBounds.minY - padding;
  const maxY = derivationY + 26 * derivation.length + padding;

  return {
    nodes,
    edges,
    tail,
    annotations: allAnnotations,
    derivation: { lines: derivation, x: derivationX, y: derivationY, width: derivationWidth },
    viewBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  };
}

// ---------------------------------------------------------------------------

/**
 * Right-hand edge of an annotation row. The view lays these out as a count
 * label, a gap, then the cost box, so the viewBox has to account for all three
 * or the last box gets clipped.
 */
export function annotationRightEdge(a) {
  return a.x + a.countWidth + 12 + a.costWidth;
}

function push(steps, text, type) {
  steps.push({ text, type });
}

function divider(steps) {
  steps.push({ text: '', type: 'divider' });
}

function final(steps, growth) {
  steps.push({ text: '─────────────────────────────────', type: 'divider' });
  steps.push({
    text: `FINAL COMPLEXITY: ${bigO(growth)}`,
    type: 'final',
    complexity: growthToKey(growth),
    label: bigO(growth),
  });
}

export { compareGrowth, formatGrowth, theta };
