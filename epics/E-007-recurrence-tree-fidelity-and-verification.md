---
id: E-007
title: Recurrence tool — tree fidelity, self-verification, and the last unsupported family
status: done
created: 2026-07-26
---

## Goal

[T-052](../tickets/T-052-recurrence-solver-correctness-and-tree-layout.md) fixed
the recurrence solver's maths (8 of 20 canonical recurrences were returning the
wrong complexity) and rebuilt the tree layout so node boxes can no longer
overlap. Two things it did **not** get right, both surfaced by the user testing
the result:

1. It moved f(n) out of the tree and into a right-hand annotation column. For
   a = 1 recurrences that leaves nothing to branch, so `T(n) = T(n-1) + n`
   draws as a bare vertical line instead of the tree a lecturer draws on a
   board. The pre-T-052 code hung the cost off each node as a green leaf; that
   was a real regression on my part.
2. Its correctness rests on cases a human thought to test. The stress round
   found `T(n) = 2T(n/2) + n/log n` returning Θ(n) instead of Θ(n log log n),
   because the case-2 rule assumed the level sum always gains a log factor.
   More hand-written cases cannot fix that class of problem, since the same
   person picks the cases and writes the rule.

This epic closes both, adds the one remaining recurrence family the tool
refuses, and does the UX pass the feature has never had.

## Tickets

- [x] T-056 — Chain recursion trees render as a straight line instead of branching (high)
- [x] T-057 — Verify solver output against the numerically evaluated recurrence (high)
- [x] T-058 — Support unequal subproblem splits via Akra-Bazzi (medium)
- [x] T-059 — Recurrence input and error-state UX pass (low)
- [x] T-060 — Show the full working in the step panel, not just the recognised identity (medium)

## Non-goals

- **f(n) outside `c·n^p·log^q n`.** `2^n`, `n!` and `n/log log n` stay refused
  with an explanatory message. Widening the model is a bigger change than the
  demand justifies.
- **Renaming the "Substitution" method.** Confirmed with the user that their
  course calls back-substitution the substitution method, so the current label
  and implementation are correct for this audience. No CLRS-style
  guess-and-verify-by-induction mode.
- **Mobile layout for the split panel.** Already tracked in
  [T-020](../tickets/T-020-split-panel-pages-force-unstackable-two-columns.md).
