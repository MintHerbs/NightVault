// src/lib/logic/tableauxEngine.js
// Semantic tableaux (truth tree) for propositional logic. Pure JS, no React imports.
//
// The tree is built branch-by-branch, depth first. A "branch" here is a root-to-leaf
// path, and every expansion appends to that path's *current leaf*, never to the node
// the expanded formula happens to sit on. That distinction is the whole ballgame: the
// previous implementation attached results to the formula's own node, which silently
// severed everything already hanging below it and produced wrong verdicts on any
// formula with two nested α-expansions (T-084).
//
// Animation data is carried on the nodes themselves (`revealAt` / `markAt`) rather than
// as a per-step deep clone of the tree. The canvas can therefore lay the finished tree
// out once and reveal it progressively, so nodes never shift under the viewer.

import { parseFormula } from './formulaParser.js';

const CONNECTIVES = { and: '∧', or: '∨', implies: '→', iff: '↔' };

const BINARY_TYPES = new Set(['and', 'or', 'implies', 'iff']);

/** Safety valves. Propositional tableaux always terminate; these only catch a bug. */
const MAX_NODES = 4000;
const MAX_STEPS = 4000;

function isBinary(node) {
  return BINARY_TYPES.has(node.type);
}

/**
 * Renders an AST as a display string.
 *
 * Parenthesises every binary sub-formula that is an operand of another connective, and
 * nothing else. That is more parentheses than precedence strictly requires but it is
 * how the formula is written in a textbook, and it round-trips what the user typed:
 * `¬(¬(P∧Q)↔(¬P∨¬Q))` prints back exactly as entered. Printing ¬ without wrapping a
 * binary operand (the old behaviour) turned `¬(P∧Q)` into `¬P∧Q`, a different formula.
 *
 * @param {object} node - AST node
 * @returns {string}
 */
export function astToString(node) {
  const operand = (child) => (isBinary(child) ? `(${astToString(child)})` : astToString(child));

  if (node.type === 'atom') return node.name;
  if (node.type === 'not') return `¬${operand(node.child)}`;

  const symbol = CONNECTIVES[node.type];
  if (!symbol) throw new Error(`Unknown node type: ${node.type}`);
  return `${operand(node.left)}${symbol}${operand(node.right)}`;
}

/** An atom or a negated atom: nothing left to expand. */
function isLiteral(node) {
  return node.type === 'atom' || (node.type === 'not' && node.child.type === 'atom');
}

/** Canonical key for a literal, e.g. 'P' or '¬P'. */
function literalKey(node) {
  if (node.type === 'atom') return node.name;
  if (node.type === 'not' && node.child.type === 'atom') return `¬${node.child.name}`;
  throw new Error('literalKey called on a non-literal');
}

/** The key that would contradict this one: 'P' <-> '¬P'. */
function complementKey(key) {
  return key.startsWith('¬') ? key.slice(1) : `¬${key}`;
}

const not = (child) => ({ type: 'not', child });

/**
 * Classifies a formula and returns what it expands to.
 *
 * α: one branch, formulas stack vertically.       { type: 'alpha', formulas: [...] }
 * β: two branches.                                { type: 'beta', branches: [[...], [...]] }
 * Literals expand to nothing.                     { type: 'literal' }
 *
 * `label` names the rule for the step narration.
 */
function classify(node) {
  if (isLiteral(node)) return { type: 'literal', label: 'literal' };

  if (node.type === 'not' && node.child.type === 'not') {
    return { type: 'alpha', label: 'double negation', formulas: [node.child.child] };
  }
  if (node.type === 'and') {
    return { type: 'alpha', label: 'conjunction', formulas: [node.left, node.right] };
  }
  if (node.type === 'not' && node.child.type === 'or') {
    return {
      type: 'alpha',
      label: 'negated disjunction',
      formulas: [not(node.child.left), not(node.child.right)]
    };
  }
  if (node.type === 'not' && node.child.type === 'implies') {
    return {
      type: 'alpha',
      label: 'negated implication',
      formulas: [node.child.left, not(node.child.right)]
    };
  }

  if (node.type === 'or') {
    return { type: 'beta', label: 'disjunction', branches: [[node.left], [node.right]] };
  }
  if (node.type === 'not' && node.child.type === 'and') {
    return {
      type: 'beta',
      label: 'negated conjunction',
      branches: [[not(node.child.left)], [not(node.child.right)]]
    };
  }
  if (node.type === 'implies') {
    return { type: 'beta', label: 'implication', branches: [[not(node.left)], [node.right]] };
  }
  // A↔B splits: both sides true, or both sides false. It is a β rule, not the α rule
  // that docs/specs/logic-tools.md used to list it as.
  if (node.type === 'iff') {
    return {
      type: 'beta',
      label: 'biconditional',
      branches: [
        [node.left, node.right],
        [not(node.left), not(node.right)]
      ]
    };
  }
  if (node.type === 'not' && node.child.type === 'iff') {
    return {
      type: 'beta',
      label: 'negated biconditional',
      branches: [
        [not(node.child.left), node.child.right],
        [node.child.left, not(node.child.right)]
      ]
    };
  }

  throw new Error(`Unknown formula type: ${node.type}`);
}

/**
 * Turns a branch's literal set into a readable assignment, e.g. "P = true, Q = false".
 * An open branch is a model of the formula, so this is the countermodel/witness.
 */
export function formatModel(model) {
  const names = Object.keys(model).sort();
  if (names.length === 0) return 'any assignment';
  return names.map((name) => `${name} = ${model[name] ? 'true' : 'false'}`).join(', ');
}

function modelFromLiterals(literals) {
  const model = {};
  for (const key of literals.keys()) {
    if (key.startsWith('¬')) model[key.slice(1)] = false;
    else model[key] = true;
  }
  return model;
}

/** Every leaf of the finished tree. */
export function collectLeaves(tree) {
  if (tree.children.length === 0) return [tree];
  return tree.children.flatMap(collectLeaves);
}

/**
 * Runs the semantic tableaux algorithm.
 *
 * @param {string} formulaString - propositional logic formula
 * @param {'satisfiability'|'validity'} mode
 * @returns {{tree: object, steps: Array, result: string, model: object|null,
 *            rootFormula: string, mode: string, totalNodes: number}}
 */
export function runTableaux(formulaString, mode = 'satisfiability') {
  const parsed = parseFormula(formulaString);

  // Validity is decided by refutation: a formula is valid exactly when its negation has
  // no model, i.e. when every branch of the tableau for ¬formula closes.
  const rootFormula = mode === 'validity' ? not(parsed) : parsed;

  let nextId = 0;
  const steps = [];
  const nodes = [];

  function createNode(ast) {
    if (nodes.length >= MAX_NODES) {
      throw new Error('This formula produces a tableau too large to draw. Try a shorter one.');
    }
    const node = {
      id: `n${nextId++}`,
      formula: astToString(ast),
      formulaNode: ast,
      children: [],
      isClosed: false,
      isOpen: false,
      closedBy: null,
      model: null,
      // Step index at which this node appears, and at which its ✗ / ○ marker appears.
      revealAt: steps.length,
      markAt: null
    };
    nodes.push(node);
    return node;
  }

  function record(description, kind, highlightNodeId, extra = {}) {
    if (steps.length >= MAX_STEPS) {
      throw new Error('This formula takes too many steps to visualise. Try a shorter one.');
    }
    steps.push({ id: steps.length, description, kind, highlightNodeId, ...extra });
    return steps.length - 1;
  }

  const root = createNode(rootFormula);
  record(
    mode === 'validity'
      ? `Assume ${astToString(parsed)} is false. Start from its negation, ${root.formula}.`
      : `Start from ${root.formula} and look for a satisfying assignment.`,
    'start',
    root.id
  );

  /**
   * A branch is one root-to-leaf path under construction.
   *  leaf       - the node new formulas attach beneath
   *  literals   - literal key -> id of the node that first introduced it, for this path only
   *  unexpanded - AST formulas still to expand on this path
   *  seen       - display strings already written on this path, so a formula is not
   *               expanded twice
   */
  function forkBranch(branch, leaf) {
    return {
      leaf,
      literals: new Map(branch.literals),
      unexpanded: [...branch.unexpanded],
      seen: new Set(branch.seen)
    };
  }

  /**
   * Writes `formulas` down the branch as a vertical chain and updates its bookkeeping.
   * Returns true if the branch closed partway, in which case the caller must not queue
   * it: everything below a contradiction is irrelevant.
   */
  function extendBranch(branch, formulas, describe) {
    for (const ast of formulas) {
      const node = createNode(ast);
      branch.leaf.children.push(node);
      branch.leaf = node;

      const description = describe(ast, node);
      record(description, 'expand', node.id);

      if (isLiteral(ast)) {
        const key = literalKey(ast);
        const clash = branch.literals.get(complementKey(key));
        // Keep the earliest node for a repeated literal so closedBy points at the
        // formula that actually introduced it.
        if (!branch.literals.has(key)) branch.literals.set(key, node.id);

        if (clash !== undefined) {
          node.isClosed = true;
          node.closedBy = [clash, node.id];
          node.markAt = record(
            `Branch closes: ${complementKey(key)} and ${key} cannot both hold.`,
            'close',
            node.id,
            { closedBy: [clash, node.id] }
          );
          return true;
        }
      } else if (!branch.seen.has(node.formula)) {
        branch.unexpanded.push(ast);
      }

      branch.seen.add(node.formula);
    }
    return false;
  }

  // Seed the root branch.
  const rootBranch = { leaf: root, literals: new Map(), unexpanded: [], seen: new Set([root.formula]) };
  if (isLiteral(rootFormula)) {
    rootBranch.literals.set(literalKey(rootFormula), root.id);
  } else {
    rootBranch.unexpanded.push(rootFormula);
  }

  // Depth first, so the animation finishes one branch before starting the next.
  const stack = [rootBranch];

  while (stack.length > 0) {
    const branch = stack.pop();

    if (branch.unexpanded.length === 0) {
      const model = modelFromLiterals(branch.literals);
      branch.leaf.isOpen = true;
      branch.leaf.model = model;
      branch.leaf.markAt = record(
        `Branch stays open: ${formatModel(model)} satisfies every formula on it.`,
        'open',
        branch.leaf.id,
        { model }
      );
      continue;
    }

    // α before β: expanding without splitting keeps the tree narrow, and often closes a
    // branch before a split is ever needed.
    let index = branch.unexpanded.findIndex((ast) => classify(ast).type === 'alpha');
    if (index === -1) index = 0;
    const [formula] = branch.unexpanded.splice(index, 1);
    const rule = classify(formula);
    const source = astToString(formula);

    // Unreachable: only non-literals are ever queued. Re-queue rather than drop the
    // branch, so a leaf can never end up unmarked.
    if (rule.type === 'literal') {
      stack.push(branch);
      continue;
    }

    if (rule.type === 'alpha') {
      const closed = extendBranch(
        branch,
        rule.formulas,
        (ast) => `α ${rule.label}: ${source} puts ${astToString(ast)} on this branch.`
      );
      if (!closed) stack.push(branch);
      continue;
    }

    // β: the current leaf becomes a fork, and each side continues as its own branch.
    const forkPoint = branch.leaf;
    record(`β ${rule.label}: ${source} splits the branch in two.`, 'split', forkPoint.id);

    const sides = ['Left', 'Right'];
    const pending = [];
    for (let i = 0; i < rule.branches.length; i++) {
      const side = forkBranch(branch, forkPoint);
      const closed = extendBranch(
        side,
        rule.branches[i],
        (ast) => `${sides[i]} branch: add ${astToString(ast)}.`
      );
      if (!closed) pending.push(side);
    }
    // Reversed, so popping the stack walks the left branch first.
    for (let i = pending.length - 1; i >= 0; i--) stack.push(pending[i]);
  }

  const leaves = collectLeaves(root);
  const openLeaves = leaves.filter((leaf) => leaf.isOpen);
  const model = openLeaves.length > 0 ? openLeaves[0].model : null;

  const result =
    mode === 'validity'
      ? openLeaves.length === 0
        ? 'valid'
        : 'invalid'
      : openLeaves.length > 0
        ? 'satisfiable'
        : 'unsatisfiable';

  record(summarise(result, model, astToString(parsed)), 'result', null, { result, model });

  return {
    tree: root,
    steps,
    result,
    model,
    rootFormula: root.formula,
    mode,
    totalNodes: nodes.length
  };
}

function summarise(result, model, formula) {
  switch (result) {
    case 'valid':
      return `Every branch closed, so ${formula} is valid: it holds under every assignment.`;
    case 'invalid':
      return `A branch stayed open, so ${formula} is not valid. Counter-example: ${formatModel(model)}.`;
    case 'satisfiable':
      return `A branch stayed open, so ${formula} is satisfiable. Witness: ${formatModel(model)}.`;
    default:
      return `Every branch closed, so ${formula} is unsatisfiable: no assignment makes it true.`;
  }
}
