---
id: T-058
title: Support unequal subproblem splits via Akra-Bazzi
status: backlog
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

- [ ] `T(n) = T(n/3) + T(2n/3) + n` gives Θ(n log n)
- [ ] `T(n) = T(n/5) + T(7n/10) + n` gives Θ(n)
- [ ] The unbalanced tree draws with correct per-branch labels and no overlap
- [ ] Confirmed by the T-057 oracle, not only by hand-written expectations
- [ ] Genuinely unsupported shapes still refuse with a clear message

## References

- [E-007](../epics/E-007-recurrence-tree-fidelity-and-verification.md)
