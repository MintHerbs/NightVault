---
id: T-056
title: Chain recursion trees render as a straight line instead of branching
status: in-progress
severity: high
area: recurrence
epic: E-007
created: 2026-07-26
---

## Summary

For any recurrence with a = 1 (`T(n) = T(n-1) + n`, `T(n) = T(n/2) + log n`,
`T(n) = T(√n) + 1`) the tree draws as a bare vertical line of `T(...)` boxes.
It should branch at every level into the work done at that node and the next
recursive call, which is how the recursion tree is taught and how this repo
drew it before T-052.

## Evidence

Measured max children per node on the current code:

```
T(n) = T(n/2) + log(n)     max children/node: 1   <- LINEAR
T(n) = T(n-1) + n          max children/node: 1   <- LINEAR
T(n) = 2T(n/2) + n         max children/node: 2
```

T-052 moved f(n) into a right-hand annotation column. With a = 1 there is
exactly one recursive child per node, so once the cost left the tree there was
nothing left to branch. The pre-T-052 code did hang the cost off each chain node
as a green leaf (`X_LEAF_OFFSET = 115`, `type: 'leaf'` at
`git show HEAD~1:src/lib/algo/recurrenceSolver.js` lines 130-171), so this is a
regression introduced by T-052, not a pre-existing gap.

Note the maths is not wrong: with a = 1 the recursion genuinely is a path, and
no convention makes the recursive *calls* fan out (CLRS's cost-labelled trees
are also a straight line here). What makes it read as a tree is drawing the
**work** as a branch.

## Impact

A student enters the single most common textbook example, `T(n) = T(n-1) + n`,
and gets a vertical line of three boxes. It does not look like a recursion tree,
so the drawing teaches nothing about where the n(n+1)/2 comes from, even though
the derivation printed underneath is correct.

## Suggested fix

Add a `cost` node kind to the spec tree and give chain builders children
`[cost, nextRecursiveCall]`, so every level branches. Applies to a = 1 subtract,
a = 1 divide, and `T(√n)`. Branching trees (a >= 2) keep the annotation column,
because the recursive fan-out already gives them their shape and cost children
would multiply width by (a+1) per level for no extra insight.

Drop the now-redundant `1 ×` prefix on chain annotations, and hang the dots and
base-case row off the deepest *recursive* node rather than the deepest node of
any kind (a cost leaf sits one level below the last recursive call).

## Acceptance criteria

- [ ] No supported recurrence produces a tree where every node has <= 1 child
- [ ] Chain trees show the work at each level as a node, labelled with f at that
      level: `n`, `n−1`, `n−2` / `log(n)`, `log(n/2)`, `log(n/4)`
- [ ] Divide trees with a >= 2 are unchanged, byte for byte where possible
- [ ] The existing guarantees still hold: no overlapping boxes, nothing clipped
      by the viewBox, dots then base case then derived formula
- [ ] A test asserts the tree is never a bare path, so this cannot regress again

## References

- [T-052](T-052-recurrence-solver-correctness-and-tree-layout.md) introduced the regression
- [E-007](../epics/E-007-recurrence-tree-fidelity-and-verification.md)
