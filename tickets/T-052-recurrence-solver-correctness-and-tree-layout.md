---
id: T-052
title: Rewrite the recurrence solver for correct complexities, genuine per-method derivations, and a collision-free tree
status: done
severity: high
area: recurrence
epic: none
created: 2026-07-25
---

## Summary

The recurrence relation tool returns the wrong complexity for 8 of 20 canonical
textbook recurrences, and several of the 12 it gets right are right by accident.
Neither advertised method actually runs: for divide-and-conquer input both the
"Tree" and the "Substitution" paths call `applyMasterTheorem` and print
`Applying Master Theorem:` in the step panel. The recursion tree itself is drawn
from hardcoded coordinates, so node boxes provably overlap for a ≥ 3, the
per-level cost annotations show the same value on every level, and the drawing
never ends in the dots-then-derived-formula the tree method is supposed to
produce.

## Evidence

All results below come from running the committed solvers directly over a
20-case battery.

**Wrong complexities:**

| Input | Correct | Tool returns |
|---|---|---|
| `T(n) = T(n-1) + n` | Θ(n²) | O(n) |
| `T(n) = T(n-2) + n` | Θ(n²) | O(n) |
| `T(n) = 2T(n-1) + 1` | Θ(2ⁿ) | O(n) |
| `T(n) = 3T(n/2) + n` | Θ(n^1.58) | O(n) |
| `T(n) = 7T(n/2) + n²` | Θ(n^2.81) | O(n) |
| `T(n) = T(n/2) + log n` | Θ(log² n) | O(log n) |
| `T(n) = 2T(n/2) + n log n` | Θ(n log² n) | O(n log n) |
| `T(n) = T(n-1) + T(n-2)` | Θ(φⁿ) | O(n) |

**Root causes, each traced to a line:**

1. **`f(n)` is silently downgraded to a constant.**
   [recurrenceParser.js:46](../src/lib/algo/recurrenceParser.js#L46) strips a
   leading `+` with `/^\+\s*/`, but the string left after removing the `T(...)`
   terms is `" + n"` with a leading *space*, so the anchor never matches and `f`
   stays `"+ n"`. `fToTermShape` then tests `normalized === 'n'`
   ([recurrenceParser.js:220](../src/lib/algo/recurrenceParser.js#L220)), gets
   `"+n"`, misses, and falls through to its silent
   `return { fn: 'const', value: 1 }` at
   [line 230](../src/lib/algo/recurrenceParser.js#L230). `classifyFComplexity`
   has the same silent `return '1'` default at
   [line 137](../src/lib/algo/recurrenceParser.js#L137). This single bug explains
   the first two rows of the table.

2. **Complexity is a string drawn from a fixed 14-entry vocabulary**
   ([complexityTypes.js](../src/lib/algo/complexityTypes.js)), so any answer
   outside that list cannot be represented. `exponentToComplexity`
   ([recurrenceSolver.js:59-66](../src/lib/algo/recurrenceSolver.js#L59-L66))
   ends in `return 'n'`, collapsing n^1.58 and n^2.81 to O(n).

3. **Master Theorem case 2 is detected with fudge factors.** The `fExponent`
   table hardcodes `'log_n': 0.05` and `'n_log_n': 1.05`
   ([recurrenceSolver.js:23-31](../src/lib/algo/recurrenceSolver.js#L23-L31))
   and tests `Math.abs(fExponent - logba) < 0.1`. Case 2 fires, but
   `addLogFactor('1')` returns `'log_n'`, dropping the accumulated log power, so
   log n never becomes log² n.

4. **Neither method uses its own method.**
   [recurrenceSolver.js:274](../src/lib/algo/recurrenceSolver.js#L274) and
   [recurrenceSubstitution.js:312](../src/lib/algo/recurrenceSubstitution.js#L312)
   both delegate to `applyMasterTheorem`. The tree is drawn but never summed;
   the substitution expands twice and then hands off.

5. **Subtract-type ignores the branching factor.** `solveSubtractTree`
   destructures `a` at
   [recurrenceSolver.js:115](../src/lib/algo/recurrenceSolver.js#L115) and never
   reads it, so `2T(n-1)` draws a single chain. The `'fibonacci'` branch at
   [recurrenceParser.js:70](../src/lib/algo/recurrenceParser.js#L70) is
   unreachable because `firstArg.includes('-')` catches `n-1` eight lines
   earlier, and `solveByTree` has no fibonacci case regardless.

**Tree drawing defects:**

6. **Overlap is guaranteed, not intermittent.** `getNodeX`
   ([recurrenceSolver.js:209-212](../src/lib/algo/recurrenceSolver.js#L209-L212))
   spreads aᵏ nodes across a fixed 800px canvas. For `4T(n/2)` level 2 holds 16
   nodes at 50px pitch while each box is `label.length * 8 + 24` = 72px wide
   ([RecurrenceTreeView.jsx:93](../src/features/recurrence/components/RecurrenceTreeView/RecurrenceTreeView.jsx#L93)),
   so every box overlaps its neighbour by 22px. Dumped x positions:
   `25, 75, 125, 175, …`.

7. **Level costs are wrong and collide.** `levelCosts.push({ level, label: f })`
   pushes the same `f` for all three levels
   ([recurrenceSolver.js:224](../src/lib/algo/recurrenceSolver.js#L224),
   [241](../src/lib/algo/recurrenceSolver.js#L241),
   [260](../src/lib/algo/recurrenceSolver.js#L260)), so `4T(n/2)+n` reads
   "n, n, n" when the true level costs are n, 2n, 4n. They are drawn at a fixed
   `svgWidth - 20` = 780
   ([RecurrenceTreeView.jsx:173](../src/features/recurrence/components/RecurrenceTreeView/RecurrenceTreeView.jsx#L173)),
   on top of the rightmost node at x = 775.

8. **Node labels are produced by regex string replacement.**
   `f.replace(/n/g, 'n−1')` turns `n^2` into `n−1^2` and `n*log(n)` into
   `n−1*log(n−1)` (verified), so every label and substitution line for a
   non-trivial f is mathematically wrong text. Used throughout
   [recurrenceSolver.js](../src/lib/algo/recurrenceSolver.js) and
   [recurrenceSubstitution.js](../src/lib/algo/recurrenceSubstitution.js).

9. **Geometry is hardcoded rather than computed.** Fixed 3 levels and magic
   offsets (105, 115, 80, 55, 45) at
   [recurrenceSolver.js:122-178](../src/lib/algo/recurrenceSolver.js#L122-L178),
   ending in a hardcoded `T(2), T(1), T(0)` tail that is simply wrong for
   `T(n-2)`, whose chain n, n−2, n−4 … never lands on all three.

10. **Viewport bugs.** The viewBox ignores content width whenever `levelCosts`
    exists ([RecurrenceTreeView.jsx:34-37](../src/features/recurrence/components/RecurrenceTreeView/RecurrenceTreeView.jsx#L34-L37)),
    clipping wide trees, and the zoom transform
    `translate(panX / zoom, …) scale(zoom)`
    ([RecurrenceTreeView.jsx:256](../src/features/recurrence/components/RecurrenceTreeView/RecurrenceTreeView.jsx#L256))
    scales about the SVG origin, so zooming walks the tree off-canvas.

## Impact

A student enters `T(n) = T(n-1) + n`, the textbook example whose answer is
Θ(n²), and the tool confidently reports O(n) with a step-by-step derivation
that looks authoritative. There is no error state and nothing signals that the
answer is unreliable, so the failure mode is silent mislearning. For
`4T(n/2) + n` the tree additionally renders as a row of overlapping boxes with
three identical and incorrect cost annotations.

## Suggested fix

Stop representing f(n) and complexity as labels from a fixed vocabulary.

**New `recurrenceMath.js`** models f(n) as a sum of terms `c · n^p · log^q(n)`
with p and q as *numbers*, and an answer as either `{exp, logExp}` or `{base}`
for exponential growth. Everything else follows from that:

- **Divide, by real tree summation:** level cost is
  aᵏ·f(n/bᵏ) = c·n^p·(a/b^p)ᵏ·log^q(n/bᵏ), so the analysis reduces to the ratio
  **r = a/b^p**. r < 1 → root dominates → Θ(f(n)); r = 1 → all levels equal →
  Θ(n^p log^(q+1) n); r > 1 → leaves dominate → Θ(n^log_b a). This is the tree
  method carried out honestly and it reproduces the Master Theorem including the
  log-power cases the textbook statement omits.
- **Subtract chain:** Σ f(n−ib) over n/b levels = Θ(n^(p+1) log^q n), with exact
  closed forms for arithmetic series, sum of squares, and log(n!) → Stirling.
- **a ≥ 2 subtract:** linear recurrence; growth is the dominant root of
  x^B = Σ aᵢ x^(B−bᵢ), found by bisection (gives exactly 2 for `2T(n-1)` and φ
  for Fibonacci).
- **Substituted labels** render a term against an *argument object* that knows
  whether it needs brackets, yielding (n−1)², log(n/4), √(n−1).

**Tree layout** moves to a bottom-up tidy algorithm: measure each label, place
leaves left to right at a fixed gap, centre each parent over its children, and
shift a subtree right when its parent box would collide at that depth, so
non-overlap is a property of the algorithm rather than of the chosen constants.
Breadth is capped honestly by expanding children while the level fits a budget
of about 6 nodes, then attaching one ellipsis node and labelling the level with
its true count aᵏ. Annotations sit in a column at `contentMaxX + gap` so
collision is impossible. The drawing ends with the dots row, the base-case row,
and a derivation band carrying the summation and the Θ result.

**Substitution** performs genuine back-substitution: three expansions of real
algebra, the general form after k steps, k solved from the base case,
substituted back, then the resulting sum evaluated by a named identity. No
Master Theorem call on either path.

Recurrences outside the supported families (notably unequal splits such as
`T(n/3) + T(2n/3) + n`, which needs Akra-Bazzi) must return a clear "not
supported" error rather than a wrong answer.

## Acceptance criteria

- [x] All 8 rows in the Evidence table return the correct complexity
- [x] A test file at `src/lib/algo/recurrence.test.js` asserts ~30 canonical
      recurrences against known answers, exits non-zero on failure, and is
      wired into an npm script (`npm run test:recurrence`)
- [x] Neither `solveByTree` nor `solveBySubstitution` references a Master
      Theorem helper; the tree panel derives its answer from level sums and the
      substitution panel from back-substitution
- [x] Substituted labels are mathematically correct text: `(n−1)²`, not `n−1^2`
- [x] No two node boxes overlap for any supported input, verified
      programmatically over the test battery rather than by eye
- [x] Per-level annotations show the true per-level cost aᵏ·f(n/bᵏ), which
      differs per level whenever a ≠ b^p
- [x] The tree ends with a dots row and then the derived formula
- [x] Unsupported input produces an explicit error message, never a silent
      default to O(1) or O(n)
- [x] The right panel shows the step-by-step derivation for both methods

## Resolution

**New modules**
- `src/lib/algo/recurrenceMath.js` — growth algebra (`c·n^p·log^q n`, plus
  exponential and log-log kinds), the f(n) parser, bracket-correct rendering
  against a substituted argument, and the summation rules.
- `src/lib/algo/recurrenceTreeLayout.js` — bottom-up tidy layout plus
  `findOverlaps`, which the suite uses to check the drawing.
- `src/lib/algo/recurrence.test.js` — 406 assertions.

**Rewritten:** `recurrenceParser.js`, `recurrenceSolver.js`,
`recurrenceSubstitution.js`, `RecurrenceTreeView.jsx`.
**Deleted:** `recurrenceTypes.js` (its identity table is superseded by the
summation rules in `recurrenceMath.js`; nothing imported it afterwards).
**Touched:** `ComplexityTerminal.jsx` gained an optional
`finalComplexityLabel` prop, because complexities such as O(n^1.58), O(log² n)
and O(φⁿ) cannot be named by the fixed key list. Default behaviour is
unchanged for `ComplexityPage`.

**Verified**
- 406 assertions pass; every case is checked through *both* methods, which
  must agree.
- Every substitution formula renders under KaTeX with `throwOnError: true`.
- Production build succeeds; the page was driven end to end in a browser for
  tree, substitution and unsupported input with no console errors.

### Stress-test round (76 additional cases)

A second battery covering named algorithms, Master-case boundaries, log-power
edge cases, format abuse and adversarial input found **two more real defects**,
both now fixed:

1. **Case 2 assumed the level sum always gains a log factor.** It is
   Θ(log^(q+1) n) only for q > −1. At q = −1 the level costs form a harmonic
   series (Θ(log log n)), and below that the sum converges so the level count
   drops out. `T(n) = 2T(n/2) + n/log n` returned Θ(n) instead of Θ(n log log n).
   Fixed by splitting case 2 three ways; `polylog` gained a `logLogExp`
   component, and negative log powers now display as `n²/log n` rather than
   `n² log^-1 n`.
2. **A dangling trailing operator was silently dropped.** `T(n) = 2T(n/2) +`
   was answered as `2T(n/2)`, which is a different question. Now refused.

Three apparent failures in that round were the test's expectations being wrong,
not the solver: `2T(n/2) + n^0.5` really is Θ(n) (leaves dominate),
`2T(n/2) + n^1.5` is Θ(n^1.5) shown as `n√n`, and `5T(n/3) + n^1.5` is Θ(n^1.5)
because log₃5 = 1.465 < 1.5.

Final: 76/76 stress cases, 658 suite assertions, zero cross-method
disagreements, zero geometry failures, zero KaTeX failures.

**Known limits (deliberate):** unequal splits (Akra-Bazzi), mixed shrink
styles, and more than one T(√n) term are refused with an explanatory message
rather than approximated. Trees with a > 3 draw two full levels instead of
three, and the elided level's cost still appears in the annotation column and
the derivation.

## References

- [docs/specs/complexity.md](../docs/specs/complexity.md) — sibling analyser feature
- [docs/architecture-update.md](../docs/architecture-update.md) §5.3 — `src/lib/algo/`
  is slated to move to `src/features/complexity/lib/`; that migration is its own
  PR, so this ticket touches the files in place
