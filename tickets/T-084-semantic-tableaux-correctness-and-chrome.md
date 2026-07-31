---
id: T-084
title: Rewrite the semantic tableaux engine (wrong verdicts) and rebuild the page chrome
status: done
severity: critical
area: logic
epic: none
created: 2026-07-30
---

## Summary

The semantic tableaux solver at `/logic/tableaux` returns the **wrong
answer** on a large class of formulas, and the tree it draws is missing
nodes on almost every non-trivial input. Separately, the page around it
starts paused behind a Play button, shows a redundant "New Formula"
button, never tells the visitor the verdict, renders negation without
parentheses, and falls back to a bare unstyled "Error" card on malformed
input.

## Evidence

### Engine correctness

Cross-checked `runTableaux` against a brute-force truth-table oracle over
436 formulas (36 curated + 400 seeded-random, atoms P/Q/R, depth 3), each
run in both `satisfiability` and `validity` mode (872 runs):

```
=== VERDICT FAILURES: 49 ===
  [VERDICT] validity        (P->Q)&(Q->R)->(P->R)          -> got invalid,        want valid
  [VERDICT] satisfiability  (P&Q)&(R&S)                    -> got unsatisfiable,  want satisfiable
  [VERDICT] satisfiability  (P|Q)&(~P|R)&(~Q|~R)&(P|~R)    -> got unsatisfiable,  want satisfiable
  [VERDICT] validity        ((P|Q)&(P|R))<->(P|(Q&R))      -> got invalid,        want valid
  [VERDICT] validity        (P&(Q|R))<->((P&Q)|(P&R))      -> got invalid,        want valid
  [VERDICT] satisfiability  (P<->Q)&(Q<->R)&(R<->P)        -> got unsatisfiable,  want satisfiable
  ... 43 more
=== STRUCTURAL PROBLEMS: 432 ===
{ UNMARKED_LEAF: 212, DANGLING_CLOSEDBY: 220 }
```

Hypothetical syllogism and both distributivity laws, textbook
tautologies, are reported **invalid**. `(P∧Q)∧(R∧S)` is reported
**unsatisfiable**.

Minimal repro, `runTableaux('(P&Q)&(R&S)', 'satisfiability')`:

```
result: unsatisfiable          <- wrong, it is plainly satisfiable
n0 (P∧Q)∧(R∧S)
  n1 P∧Q
    n3 P
      n4 Q                     <- leaf, neither open nor closed
steps: ... "Apply α-rule to R∧S: add R" / "add S"   <- n2, n5, n6 never appear in the tree
```

Root causes, all in [tableauxEngine.js](src/lib/logic/tableauxEngine.js):

1. **α-expansion clobbers the branch below it.**
   [tableauxEngine.js:341](src/lib/logic/tableauxEngine.js#L341)
   does `currentParent.children = [newNode]`, discarding whatever
   subtree already hung off that node. In the repro, expanding `n1`
   (`P∧Q`) severs `n2` (`R∧S`) and everything under it.
2. **Formulas are expanded at their own node, not at the branch's open
   leaves.** [tableauxEngine.js:335](src/lib/logic/tableauxEngine.js#L335)
   uses `expandNode`, the node the formula sits on, as the parent.
   Tableau semantics require the results to be appended to *every* open
   leaf below that formula. This is what makes (1) possible at all.
3. **β branches share tree-node references.**
   `Branch.clone()` at [tableauxEngine.js:238](src/lib/logic/tableauxEngine.js#L238)
   shallow-copies `unexpanded`, so both children of a β split carry the
   same `{ node }` objects and each writes `node.children`, the second
   overwriting the first.
4. **Leaves are left unmarked.** `branch.leafNode` can point at a node
   that (1) detached, so the leaf actually rendered gets neither ✗ nor ○
   (212 occurrences). The verdict is then computed from
   [tableauxEngine.js:405-413](src/lib/logic/tableauxEngine.js#L405-L413)
   as `allLeaves.some(l => l.isOpen)`, which is `false` for an unmarked
   open leaf, hence "unsatisfiable" for a satisfiable formula.
5. **`closedBy` cites nodes that are not in the tree** (220 occurrences).
   This is the caption in the current UI: "Branch closed: contradiction
   between n11 and n14" where neither id is drawn anywhere.
6. **Contradiction detection is deferred.** `checkContradiction` at
   [tableauxEngine.js:264](src/lib/logic/tableauxEngine.js#L264) only
   runs when a branch is popped off the work queue, so a branch keeps
   expanding for several steps after it should already have closed.
   It also scans a `literals` Map rather than the branch's actual path,
   so entries leaked in by (3) can close a branch that has no
   contradiction on it.

### Notation

7. `astToString` at [tableauxEngine.js:13](src/lib/logic/tableauxEngine.js#L13)
   never parenthesises the operand of a negation, and always
   parenthesises non-atomic operands of a binary connective. So
   `¬(P∧Q)` prints as `¬P∧Q`, a different formula, while `¬P∨¬Q`
   prints as the noisy `(¬P)∨(¬Q)`. Both are visible on the current
   page: the root of the example tableau renders as
   `¬(¬P∧Q)↔((¬P)∨(¬Q))`, which reads as a biconditional when the
   formula entered was a negation.

### Page chrome

8. **Verdict is never shown.** [TableauxPage.jsx:84](src/pages/logic/tableaux/TableauxPage.jsx#L84)
   passes `resultText={result.conclusion}`, but the engine returns
   `{ tree, steps, result }`, which has no `conclusion` key. `Navbar`
   renders the badge only `{showResult && resultText}`, so it is always
   suppressed and the visitor never learns whether the formula was
   satisfiable/valid.
9. **Construction starts paused.** `useAnimationPlayer` initialises
   `isPlaying: false` ([useAnimationPlayer.js:13](src/hooks/useAnimationPlayer.js#L13))
   and `speed: 1`; nothing calls `play()`, so the tree appears fully
   built at step 1 of N and waits for a click.
10. **Dynamic island never shows thinking.** [TableauxPage.jsx:38-50](src/pages/logic/tableaux/TableauxPage.jsx#L38-L50)
    sets `'thinking'` and then `'idle'` 500 ms later. The solve is
    synchronous and takes under a millisecond; the *animation* is the
    part that takes time, and the island is idle throughout it. ERD
    holds its island state for the duration of the real work
    ([ERDPage.jsx:113-119](src/pages/erd/ERDPage.jsx#L113-L119)).
11. **Error state is unstyled.** [TableauxPage.jsx:109-129](src/pages/logic/tableaux/TableauxPage.jsx#L109-L129)
    renders `<h2>Error</h2>` in raw `#ef4444`
    ([TableauxPage.module.css](src/pages/logic/tableaux/TableauxPage.module.css)),
    the raw parser exception prefixed with `Parse error:`, and a
    `← Try Again` button that discards what was typed. Messages are
    parser-internal ("Unexpected token 'AND': expected atom or '('") with
    no indication of *where* in the input the problem is.
12. **The symbol bar offers symbols the parser rejects.** `SymbolBar`
    ([SymbolBar.jsx:12-21](src/features/logic/components/SymbolBar.jsx#L12-L21))
    includes `∴`, `⊤`, `⊥`; `tokenize`
    ([formulaParser.js:10-39](src/lib/logic/formulaParser.js#L10-L39))
    throws `Unexpected character '⊤' at position 0` on all three. Same
    for lowercase atoms.
13. **Speed slider caps at 2.0×** ([LogicStepControls.jsx:72](src/features/logic/components/LogicStepControls.jsx#L72)),
    so a 2.0× default sits pinned at the end of its range with no
    headroom.
14. **Hardcoded colours break the theme system.**
    `TableauxCanvas.module.css` uses `#e0e0e0`, `#ef4444`, `#22c55e`,
    `#332100`; `LogicStepControls.module.css` uses `#7c4ee4`, a purple
    that exists in no palette. The app has 9 themes × light/dark
    ([global.css](src/styles/global.css)); these are illegible in light
    mode and violate the token rule in [docs/design.md](docs/design.md).
15. **Layout drifts off-centre.** `calculateLayout`
    ([TableauxCanvas.jsx:16-146](src/features/logic/components/TableauxCanvas/TableauxCanvas.jsx#L16-L146))
    positions β children at a fixed `±availableWidth / 3` regardless of
    how wide each subtree actually is, then tries to repair overlaps
    with 20 iterations of pairwise repulsion that moves nodes without
    moving their descendants. The result is the tree hanging left of its
    own root with branches at inconsistent spacing.
16. **The `?` drawer is unstyled chrome.** `RulesPanel` is a 40 px circle
    pinned at `top: 70px; right: 16px` over a plain full-height panel
    with `border-radius: 12px 0 0 12px`, no focus trap, no Escape key,
    no scrim blur.
17. **Test IIFEs execute in the production bundle.** Both
    [formulaParser.js:161](src/lib/logic/formulaParser.js#L161) and
    [tableauxEngine.js:432](src/lib/logic/tableauxEngine.js#L432) end in
    a self-invoking test block that runs on import and logs to the
    console on every page load.

### Doc drift

18. [docs/specs/logic-tools.md](docs/specs/logic-tools.md) lists `P↔Q`
    in the **α-rules** table with "left branch"/"right branch" columns.
    `P↔Q` is a β rule. The code already ignores the doc: see the
    comment "despite spec table label" at
    [tableauxEngine.js:141](src/lib/logic/tableauxEngine.js#L141).

## Impact

A student checks whether `(P→Q)∧(Q→R)→(P→R)` is valid, the hypothetical
syllogism, one of the first tautologies taught in the course this tool
serves. The page answers **invalid** and draws a tree with a dangling
unmarked leaf and a closure caption pointing at node ids that are not on
screen. There is no signal that anything went wrong; the tool is
confidently, silently wrong on roughly 6% of formulas, concentrated in
exactly the nested-conjunction and distributivity shapes that appear in
coursework. Anyone revising from it learns the wrong answer.

## Suggested fix

**Engine: rewrite around branches-as-paths.** Model a branch as
`{ leaf, literals, unexpanded }` where `unexpanded` holds *AST formulas*,
not references to tree nodes, and every expansion appends to
`branch.leaf`, never to the node the formula came from. β splits create
two fresh leaves under the current leaf and two independent branch
records with copied queues. Check for a contradiction after each literal
is added, not once per pop, and close the branch immediately at the leaf
that introduced it. Keep node ids stable so `closedBy` always resolves.

**Oracle test.** Add `src/lib/logic/tableauxEngine.oracle.test.js`
following the `recurrence.oracle.test.js` convention: brute-force truth
table vs engine verdict, curated tautologies plus seeded fuzz, with the
structural invariants (every leaf marked, `closedBy` ids present in the
tree, final snapshot equals final tree) asserted too. Wire it to
`npm run test:logic`. Move the inline IIFE tests out of the shipped
modules.

**Notation.** Rewrite `astToString` to a precedence-aware printer:
parenthesise a negation's operand when it is not an atom, and drop
parentheses that precedence already implies.

**Page.** Autoplay at 2.0× on mount (raise the slider ceiling so it is
not pinned; respect `prefers-reduced-motion` by jumping to the final
tree). Drop "New Formula" from the navbar; keep the `?`. Hold the island
in `thinking` for the length of the construction and release it on the
final step. Show the verdict, fixing the `conclusion`/`result` mismatch.

**Errors.** Attach `position`/`length` to parser errors, and render a
Material 3 error card: icon, plain-language title, the input echoed with
the offending span marked, and the typed formula preserved for editing.
Restrict the symbol bar to symbols this parser accepts, or teach the
parser `⊤`/`⊥`.

**Canvas.** Replace the repulsion pass with a proper tidy layout that
reserves each subtree's measured width. Move every hardcoded hex onto
the `--md-*` / `--color-*` tokens.

## Acceptance criteria

- [x] `npm run test:logic` passes: 0 verdict mismatches against the
      truth-table oracle over the curated set plus ≥500 fuzzed formulas,
      in both modes
- [x] Every leaf in a completed tableau is marked open or closed, and
      every `closedBy` id resolves to a node present in the tree
- [x] `(P→Q)∧(Q→R)→(P→R)` reports **valid**; `(P∧Q)∧(R∧S)` reports
      **satisfiable**; both draw complete trees with no detached nodes
- [x] `¬(P∧Q)` renders as `¬(P∧Q)`, and `¬P∨¬Q` renders as `¬P∨¬Q`
- [x] Submitting a formula starts the construction animation
      automatically at 2.0× with no click
- [x] The dynamic island shows `thinking` for the duration of the
      construction and returns to idle when it completes
- [x] The verdict (satisfiable / unsatisfiable / valid / invalid) is
      visible on the result screen, in the transport bar next to the
      sentence that explains it
- [x] "← New Formula" is gone from the navbar; the `?` opens a restyled
      MD3 drawer that closes on Escape and on scrim click
- [x] A malformed formula produces an MD3 error card naming the problem
      in plain language and marking its position in the input, with the
      typed formula preserved
- [x] No raw hex colours remain in the tableaux page, canvas, controls,
      or drawer stylesheets; the page is legible in light mode
- [x] No test IIFE runs at import time in the shipped bundle
- [x] `docs/specs/logic-tools.md` lists `P↔Q` as a β rule

## What shipped

Engine, `src/lib/logic/tableauxEngine.js`: rewritten. A branch is now a
root-to-leaf path (`{ leaf, literals, unexpanded, seen }`) holding AST
formulas rather than tree-node references, and every expansion appends to
`branch.leaf`. β splits fork the record with copied bookkeeping, so the
two sides can no longer write over each other. Contradictions are checked
as each literal is written and close the branch at that literal. Open
leaves carry the `model` their branch witnesses, which surfaces as a
witness (satisfiable) or a counter-example (invalid) in the final step.

Animation data moved onto the nodes (`revealAt` / `markAt`) instead of a
deep-cloned tree snapshot per step, so the canvas lays the finished tree
out once and reveals it; nothing shifts under the viewer mid-run.

Notation, same file: `astToString` parenthesises every binary operand of
another connective and nothing else, which round-trips what the user
typed.

Parser, `src/lib/logic/formulaParser.js`: errors are now a `FormulaError`
carrying `position` / `length` / `hint`; tokens record their source span
so `<->` underlines whole. `∴`, `⊤`, `⊥`, lowercase atoms and commas get
their own explanations rather than "Unexpected character".

Layout, `src/lib/logic/tableauxLayout.js` (new): two-pass tidy layout
that reserves a disjoint band per subtree, replacing the repulsion loop.
Extracted from the canvas so it can be tested.

Tests, `npm run test:logic`: `formulaParser.test.js`,
`tableauxEngine.oracle.test.js`, `tableauxLayout.test.js`. The oracle run
also passed a one-off 20,000-formula sweep at depth 3-4 over 2-5 atoms
with zero mismatches.

UI: `TableauxPage` autoplays at 2.0× and holds the island in `thinking`
until the tree is drawn; the back arrow returns to the input in place of
the removed "New Formula" button, leaving the top right to the rules
drawer alone; `RulesPanel` is an M3 modal
drawer drawing each rule as the shape it makes in the tree;
`LogicStepControls` is an M3 transport with a scrubber, a segmented speed
control (0.5×/1×/2×/4×), and the verdict chip, revealed only once the
animation finishes. The chip is deliberately not colour-coded: in validity
mode every branch closing (all ✗, all red on the canvas) is exactly what
makes the formula valid, so red/green would read backwards half the time; `FormulaErrorCard` (new) is the M3 error
state. `useAnimationPlayer` gained `autoPlay`, speed bounds, reduced-motion
handling, `skipToEnd`, and adaptive pacing so a thousand-step run still
fits in ~30s.

Publishing: the tool was only reachable from the unlisted `/experimental`
directory, because it is filed under the Artificial Intelligence Subject and
`sidebar_modules.hidden` is per Subject, not per tool. Rather than un-hide the
whole Subject (a prod DB write that would surface everything else under it), it
is now an entry in `TOOLS`, so it gets an ASCII card on every course landing
page alongside B+ Tree and ERD, and its `EXPERIMENTAL_TOOLS` entry is gone.
`/logic/truth-tree` and `/logic/tableaux` stay unlisted aliases of the same
page.

`src/lib/asciiArt/fields/truthTree.js` (new) is that card's cover: a trunk
descending from a root formula, two levels of forks, then each leaf closing in
turn. The ✗ a real tableau ends on is unreadable at the card's 56 columns (its
two arms land on separate cells and read as loose dots), so a closed leaf gets
a solid stop instead.

## Out of scope, found while working here

Not fixed, because they belong to `/logic/proof`, not this ticket:

- `src/lib/logic/proofEngine.js:43-45` has its own copy of the old
  `astToString`, with the same missing-parentheses bug: it prints
  `¬(P∧Q)` as `¬P∧Q`.
- `src/lib/logic/proofEngine.js:420` still ends in a self-invoking test
  block that runs on import in the production bundle.
- `src/engine/logic/TableauxEngine.js` is an empty stub class that
  nothing imports.

## References

- [docs/specs/logic-tools.md](docs/specs/logic-tools.md): tableaux spec
  (α/β rule tables, node structure, step array)
- [docs/rules.md](docs/rules.md) §10: motion bands, `prefers-reduced-motion`
- [docs/design.md](docs/design.md): colour tokens
- `src/lib/algo/recurrence.oracle.test.js`: oracle-test convention
- T-079: dynamic island states (`observing`/`thinking`/`generating`)
