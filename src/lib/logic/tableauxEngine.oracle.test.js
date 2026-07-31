// Oracle test for the semantic tableaux engine.
// Run with: npm run test:logic
//
// The oracle is an exhaustive truth table: for a formula over n atoms it evaluates all
// 2^n assignments directly from the AST, which is slow but obviously correct. The engine
// has to agree with it on every formula, in both modes. This is what caught T-084: the
// previous engine called the hypothetical syllogism invalid and (P∧Q)∧(R∧S)
// unsatisfiable, and nothing in the codebase noticed.
//
// Structural invariants are checked alongside the verdicts, because a right answer drawn
// on a broken tree is still a broken teaching tool.

import { parseFormula } from './formulaParser.js';
import { runTableaux, astToString, collectLeaves } from './tableauxEngine.js';

const FUZZ_COUNT = 600;
const FUZZ_SEED = 20260730;

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 30) console.error(`  FAIL: ${msg}`); };
const assert = (cond, msg) => { if (!cond) fail(msg); };

// --- Oracle ------------------------------------------------------------------

function atomsOf(node, set = new Set()) {
  if (node.type === 'atom') set.add(node.name);
  else if (node.type === 'not') atomsOf(node.child, set);
  else { atomsOf(node.left, set); atomsOf(node.right, set); }
  return set;
}

function evaluate(node, env) {
  switch (node.type) {
    case 'atom': return env[node.name];
    case 'not': return !evaluate(node.child, env);
    case 'and': return evaluate(node.left, env) && evaluate(node.right, env);
    case 'or': return evaluate(node.left, env) || evaluate(node.right, env);
    case 'implies': return !evaluate(node.left, env) || evaluate(node.right, env);
    case 'iff': return evaluate(node.left, env) === evaluate(node.right, env);
    default: throw new Error(`bad node ${node.type}`);
  }
}

function truthTable(ast) {
  const names = [...atomsOf(ast)].sort();
  let satisfiable = false;
  let valid = true;
  for (let mask = 0; mask < (1 << names.length); mask++) {
    const env = {};
    names.forEach((name, i) => { env[name] = Boolean(mask & (1 << i)); });
    if (evaluate(ast, env)) satisfiable = true;
    else valid = false;
  }
  return { satisfiable, valid };
}

// --- Checks ------------------------------------------------------------------

function idsIn(node, set = new Set()) {
  set.add(node.id);
  node.children.forEach((child) => idsIn(child, set));
  return set;
}

function checkFormula(formula) {
  const ast = parseFormula(formula);
  const oracle = truthTable(ast);

  for (const mode of ['satisfiability', 'validity']) {
    let run;
    try {
      run = runTableaux(formula, mode);
    } catch (err) {
      fail(`${mode} ${formula}: threw ${err.message}`);
      continue;
    }

    // 1. Verdict matches the truth table.
    const expected = mode === 'satisfiability'
      ? (oracle.satisfiable ? 'satisfiable' : 'unsatisfiable')
      : (oracle.valid ? 'valid' : 'invalid');
    assert(run.result === expected, `${mode} ${formula}: got ${run.result}, want ${expected}`);

    const leaves = collectLeaves(run.tree);
    const ids = idsIn(run.tree);

    // 2. Every leaf is decided. An unmarked leaf is what made the old engine report
    //    satisfiable formulas as unsatisfiable.
    for (const leaf of leaves) {
      assert(leaf.isOpen !== leaf.isClosed,
        `${mode} ${formula}: leaf ${leaf.id} (${leaf.formula}) is ${leaf.isOpen ? 'both' : 'neither'} open nor closed`);
      assert(leaf.markAt !== null, `${mode} ${formula}: leaf ${leaf.id} has no marker step`);
    }

    // 2b. Only leaves are decided. An open or closed mark on an internal node would mean
    //     a branch was extended past its own conclusion.
    ;(function walk(node) {
      if (node.children.length > 0) {
        assert(!node.isOpen && !node.isClosed && node.markAt === null,
          `${mode} ${formula}: internal node ${node.id} carries a leaf marker`)
      }
      node.children.forEach(walk)
    })(run.tree)

    // 3. No node is detached: ids referenced by closedBy must be drawn.
    for (const leaf of leaves) {
      if (!leaf.closedBy) continue;
      for (const id of leaf.closedBy) {
        assert(ids.has(id), `${mode} ${formula}: closedBy cites ${id}, which is not in the tree`);
      }
    }

    // 4. Reveal indices are consistent: a child never appears before its parent, and
    //    every index addresses a real step.
    (function walk(node) {
      assert(node.revealAt >= 0 && node.revealAt < run.steps.length,
        `${mode} ${formula}: node ${node.id} revealAt ${node.revealAt} out of range`);
      if (node.markAt !== null) {
        assert(node.markAt >= node.revealAt,
          `${mode} ${formula}: node ${node.id} marked before it appears`);
      }
      for (const child of node.children) {
        assert(child.revealAt >= node.revealAt,
          `${mode} ${formula}: child ${child.id} appears before parent ${node.id}`);
        walk(child);
      }
    })(run.tree);

    // 5. Splits are binary, chains are unary.
    (function walk(node) {
      assert(node.children.length <= 2,
        `${mode} ${formula}: node ${node.id} has ${node.children.length} children`);
      node.children.forEach(walk);
    })(run.tree);

    // 6. A closed branch really does contain a contradiction, and an open branch really
    //    does not. Verified against the path, not the engine's own bookkeeping.
    for (const { leaf, path } of pathsOf(run.tree)) {
      const literals = new Set(path.filter(isLiteralString));
      const clash = [...literals].some((key) => literals.has(key.startsWith('¬') ? key.slice(1) : `¬${key}`));
      if (leaf.isClosed) {
        assert(clash, `${mode} ${formula}: branch closed at ${leaf.id} but its path has no contradiction`);
      } else {
        assert(!clash, `${mode} ${formula}: branch open at ${leaf.id} but its path contradicts itself`);
      }
    }

    // 7. An open branch's model must actually satisfy the tableau's root formula.
    for (const leaf of leaves) {
      if (!leaf.isOpen) continue;
      const rootAst = mode === 'validity' ? { type: 'not', child: ast } : ast;
      const env = {};
      for (const name of atomsOf(rootAst)) env[name] = leaf.model[name] ?? false;
      assert(evaluate(rootAst, env) === true,
        `${mode} ${formula}: open leaf ${leaf.id} reports a model that does not satisfy the root`);
    }

    // 8. The reported model comes from an open branch, and only from one.
    assert((run.model !== null) === (run.result === 'satisfiable' || run.result === 'invalid'),
      `${mode} ${formula}: model presence does not match verdict ${run.result}`);

    // 9. Steps are well formed.
    assert(run.steps.length > 0, `${mode} ${formula}: no steps produced`);
    assert(run.steps[run.steps.length - 1].kind === 'result',
      `${mode} ${formula}: last step is not the verdict`);
    for (const step of run.steps) {
      assert(typeof step.description === 'string' && step.description.length > 0,
        `${mode} ${formula}: step ${step.id} has no description`);
      assert(step.highlightNodeId === null || ids.has(step.highlightNodeId),
        `${mode} ${formula}: step ${step.id} highlights ${step.highlightNodeId}, not in the tree`);
    }
  }
}

function isLiteralString(text) {
  return /^¬?[A-Z]$/.test(text);
}

function pathsOf(node, acc = [], out = []) {
  const path = [...acc, node.formula];
  if (node.children.length === 0) out.push({ leaf: node, path });
  else node.children.forEach((child) => pathsOf(child, path, out));
  return out;
}

// --- Curated cases -----------------------------------------------------------

const CASES = [
  // Bare literals and the smallest possible trees
  'P', '~P', '~~P', '~~~P',
  'P&~P', 'P|~P', 'P->P', 'P->Q', 'P<->P', 'P<->~P',

  // Textbook tautologies. Every one of these must come out valid.
  '(P&(P->Q))->Q',                       // modus ponens
  '((P->Q)&~Q)->~P',                     // modus tollens
  '((P|Q)&~P)->Q',                       // disjunctive syllogism
  '(P->Q)&(Q->R)->(P->R)',               // hypothetical syllogism (was reported invalid)
  '((P->Q)->P)->P',                      // Peirce's law
  '(P->(Q->R))->((P->Q)->(P->R))',       // K axiom
  '((P&Q)->R)<->(P->(Q->R))',            // exportation
  '~(P&Q)<->(~P|~Q)',                    // De Morgan
  '~(P|Q)<->(~P&~Q)',                    // De Morgan
  '((P|Q)&(P|R))<->(P|(Q&R))',           // distributivity (was reported invalid)
  '(P&(Q|R))<->((P&Q)|(P&R))',           // distributivity (was reported invalid)
  '(P<->Q)<->(Q<->P)',                   // commutativity of ↔
  '~(P<->Q)<->(P<->~Q)',
  '(P->Q)<->(~Q->~P)',                   // contraposition
  '(~(~(Q)))->(Q|~Q)',

  // Contradictions. Every one must come out unsatisfiable.
  '(P|Q)&(~P)&(~Q)',
  '(P->Q)&(Q->R)&P&~R',
  '~((P->Q)|(Q->P))',
  '(P<->Q)&(Q<->R)&(P<->~R)',
  '~(~(P&Q)<->(~P|~Q))',                 // negation of De Morgan, the page's example

  // Satisfiable but not valid. These are the shapes the old engine got wrong: nested
  // α-expansions, where expanding the first conjunct severed the second.
  '(P&Q)&(R&S)',
  '(A&B)&(C&D)',
  '(P&Q)&(~P&S)',
  '(P|Q)&(~P|R)&(~Q|~R)&(P|~R)',
  '(P<->Q)&(Q<->R)&(R<->P)',
  '(P&Q)|(~P&~Q)',
  '(P|Q)|(R|S)',
  '(P&Q)|(R&S)',
  '~((R|P)|(Q<->P))',
  '((P&P)&(R<->R))&(~R<->(~P|P))'
];

for (const formula of CASES) checkFormula(formula);

// --- Fuzz --------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPS = ['&', '|', '->', '<->'];

function randomFormula(depth, rng, names) {
  if (depth <= 0 || rng() < 0.25) {
    const atom = names[Math.floor(rng() * names.length)];
    return rng() < 0.3 ? `~${atom}` : atom;
  }
  if (rng() < 0.15) return `~(${randomFormula(depth - 1, rng, names)})`;
  const op = OPS[Math.floor(rng() * OPS.length)];
  return `(${randomFormula(depth - 1, rng, names)}${op}${randomFormula(depth - 1, rng, names)})`;
}

const rng = mulberry32(FUZZ_SEED);
for (let i = 0; i < FUZZ_COUNT; i++) {
  // Mixed depth and arity so both wide β-splits and deep α-chains get exercised.
  const names = ['P', 'Q', 'R', 'S'].slice(0, 2 + Math.floor(rng() * 3));
  checkFormula(randomFormula(2 + Math.floor(rng() * 2), rng, names));
}

// --- Printer round-trip ------------------------------------------------------
// astToString must produce something that parses back to the same formula, and must not
// drop the parentheses around a negated compound (¬(P∧Q) is not ¬P∧Q).

const PRINTER_CASES = [
  ['~(P&Q)', '¬(P∧Q)'],
  ['~P|~Q', '¬P∨¬Q'],
  ['~(~(P&Q)<->(~P|~Q))', '¬(¬(P∧Q)↔(¬P∨¬Q))'],
  ['~~P', '¬¬P'],
  ['P->Q->R', 'P→(Q→R)'],
  ['(P&Q)|R', '(P∧Q)∨R'],
  ['P', 'P']
];

for (const [input, expected] of PRINTER_CASES) {
  const printed = astToString(parseFormula(input));
  assert(printed === expected, `printer ${input}: got ${printed}, want ${expected}`);
  const reprinted = astToString(parseFormula(printed));
  assert(reprinted === printed, `printer ${input}: does not round-trip (${printed} -> ${reprinted})`);
}

// Round-trip over the fuzz corpus too.
const rng2 = mulberry32(FUZZ_SEED + 1);
for (let i = 0; i < 200; i++) {
  const formula = randomFormula(3, rng2, ['P', 'Q', 'R']);
  const printed = astToString(parseFormula(formula));
  const reprinted = astToString(parseFormula(printed));
  assert(printed === reprinted, `printer round-trip: ${formula} -> ${printed} -> ${reprinted}`);
}

if (failures > 0) {
  console.error(`[tableauxEngine] ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log(`[tableauxEngine] all tests passed (${CASES.length} curated + ${FUZZ_COUNT} fuzzed formulas, 2 modes each)`);
