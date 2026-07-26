---
id: T-058
title: Support unequal subproblem splits via Akra-Bazzi
status: done
severity: medium
area: recurrence
epic: E-007
created: 2026-07-26
---

## Summary

Recurrences whose subproblems differ in size are refused. Two of them are
standard curriculum: `T(n) = T(n/3) + T(2n/3) + n` and the median-of-medians
selection bound `T(n) = T(n/5) + T(7n/10) + n`.

## Evidence

The parser rejects them deliberately rather than approximating:

```
T(n) = T(n/3) + T(2n/3) + n     ERROR   Unequal subproblem sizes ... Akra-Bazzi
T(n) = T(n/5) + T(7n/10) + n    ERROR   (median of medians)
```

Refusing is correct today, since the Master-style ratio r = a/b^p assumes one
common b. But the machinery needed is already present: `dominantRoot` in
`recurrenceMath.js` solves for a root by bisection, which is the same numeric
step Akra-Bazzi needs.

## Impact

A student analysing quickselect or the 1:2 split recursion is told the tool
cannot help, with no derivation and no tree, on a problem their course expects
them to solve.

## Suggested fix

Find p such that Σ aᵢ bᵢ^p = 1 by bisection, then apply
T(n) = Θ(n^p (1 + ∫₁ⁿ f(u)/u^(p+1) du)). For f = c·n^q·log^r n that integral
collapses into the same three-case shape the divide path already uses, with p in
place of log_b a:

- q < p → integral converges → Θ(n^p)
- q = p → Θ(n^p log^(r+1) n), with the same q = -1 harmonic subtlety as T-057
- q > p → Θ(f(n))

So extract the three-case growth decision from `divideLevelSum` and share it.
The parser keeps each call's fraction bᵢ = 1/b; the tree draws children with
their own labels and differing subtree sizes, which the tidy layout already
handles.

## Acceptance criteria

- [x] `T(n) = T(n/3) + T(2n/3) + n` gives Θ(n log n)
- [x] `T(n) = T(n/5) + T(7n/10) + n` gives Θ(n)
- [x] The unbalanced tree draws with correct per-branch labels and no overlap
- [x] Confirmed by the T-057 oracle, not only by hand-written expectations
- [x] Genuinely unsupported shapes still refuse with a clear message

## Resolution

The key observation kept the tree narrative intact rather than bolting on a
separate formula: for unequal splits the level ratio generalises from a/b^q to
**ρ = Σ aᵢbᵢ^q**, and ρ = 1 exactly when q = p. So the same three-case decision
the divide path already used applies unchanged, with the Akra-Bazzi p in place of
log_b(a). That decision is now `levelSumGrowth` in `recurrenceMath.js`, shared by
both paths, and `divideLevelSum` became a thin wrapper over it. The refactor was
verified behaviour-preserving before Akra-Bazzi was added.

`akraBazziExponent` finds p by bisection on Σ aᵢbᵢ^p = 1, which is monotone
because every bᵢ is in (0, 1). Subproblem sizes are tracked as exact rationals,
so nested levels label as T(n/9), T(2n/9), T(4n/9) rather than T(0.444n).

Results, all confirmed numerically:

| Recurrence | p | ρ | Case | Result |
|---|---|---|---|---|
| `T(n/3) + T(2n/3) + n` | 1 | 1 | 2 | Θ(n log n) |
| `T(n/5) + T(7n/10) + n` | 0.8398 | 0.9 | 1 | Θ(n) |
| `T(n/2) + T(n/4) + n` | 0.6942 | 0.75 | 1 | Θ(n) |
| `T(n/3) + T(2n/3) + 1` | 1 | 2 | 3 | Θ(n) |
| `T(n/3) + T(2n/3) + n²` | 1 | 0.556 | 1 | Θ(n²) |

The oracle needed a new evaluator, and the first attempt repeated the mistake
T-057 documented: evaluating integers to 2e6 could not reject a spurious log
factor on the median-of-medians case (drift 0.291, under tolerance). Solving on a
grid uniform in ln n instead lets the ladder reach n = 2^1000, and the drift for
that same wrong answer is 3.641. 94 oracle checks, 847 assertions.

## References

- [E-007](../epics/E-007-recurrence-tree-fidelity-and-verification.md)
