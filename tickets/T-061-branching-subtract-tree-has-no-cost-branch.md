---
id: T-061
title: Branching subtract trees draw no cost branch, so they do not match the board
status: done
severity: medium
area: recurrence
epic: E-007
created: 2026-07-26
---

## Summary

[T-056](T-056-recursion-tree-branching-and-verification.md) gave chain
recurrences (`a = 1`) a cost branch, so `T(n) = T(n-1) + n` draws as a tree
instead of a vertical line. It deliberately left the branching cases alone,
reasoning that the recursive fan-out already gives those trees their shape and
that a cost child would multiply the width by a + 1.

That reasoning was wrong about what the drawing is for. A lecturer drawing
`T(n) = 2T(n-1) + 1` puts the `1` in the tree as the leftmost child of every
node, because the sum being built is the sum of the node labels. With the cost
in a side column instead, the tree shows where the calls go but not what is
being added up, and it does not match the tree the student is copying from the
board.

## Evidence

For `T(n) = 2T(n-1) + 1` the board tree is

```
              T(n)
          /    |     \
         1   T(n-1)  T(n-1)
             / | \    / | \
            1 T(n-2) T(n-2)  1 T(n-2) T(n-2)
```

The tool draws the same recursive skeleton but with no `1` children, and puts
`1 × 1`, `2 × 1`, `4 × 1` in the right-hand annotation column.

Second, smaller defect found while reading the same output: the branching path
prints the level count as `n/1` where the chain path prints `n`.

```
Depth: n/1 levels before reaching the base case
Total = Σ(k=0..n/1) 2^k · f(n − k·1)
      = Θ(2^(n/1))
```

`recurrenceWorking.js` already has `const levels = b === 1 ? 'n' : n/${b}` for
the chain path; the branching path interpolates `b` unguarded.

## Scope

- Give every expanded node in a branching subtract tree a cost child, leftmost,
  labelled with f evaluated at that node's own size. Fibonacci-shaped
  recurrences must therefore show different cost labels down different branches.
- Keep the annotation column for branching trees. Unlike a chain, where
  `1 × f(n−k)` only repeats the cost leaf, the branching count `2^k × f(...)` is
  the fact the summation is built from.
- Suppress `/1` in the branching level count, summation bound and exponent.

## Non-goals

- **Divide trees.** `a·T(n/b)` with a >= 2 keeps the annotation column. The user
  confirmed that rendering is what they wanted, and the board convention for
  divide trees labels nodes with costs rather than adding cost children, which
  is a different change from this one.

## Verification

- Tree-shape assertions: a cost child under every expanded node, cost labels
  differing per branch for `T(n-1) + T(n-2)`, and the existing no-overlap and
  tail-collision checks still clean at the new widths.
- No `/1` anywhere in the rendered steps, derivation band or working for any
  `b = 1` recurrence.

## Also fixed here

Reading the branching output line by line turned up a third defect that is not
cosmetic. The substitution expansion built `a·f(n−1)` by putting the coefficient
and the f text side by side:

```
T(n) = 4T(n−2) + 2n - 1 + n        <- wrong: 2n − 1 is not 2(n−1)
T(n) = 4T(n−2) + 21 + 1            <- and with f(n) = 1, "2" met "1"
```

`2n − 1 + n` is 3n − 1; the quantity meant is 2(n−1) + n = 3n − 2. T-060 had
fixed exactly this for the divide path's plain text (`16·(n/4)`) but the fix was
a local helper, so the divide LaTeX and both branching renderings kept the bug.
Replaced with one `scaleBy` used by every site, which brackets only when an
operator is loose at the top level, so `log(n−1)` is not double-bracketed.

Added a KaTeX pass over every emitted formula while in here. The panel renders
with `throwOnError`, so a malformed string is a red box where a step should be,
and nothing in the suite would have caught it. 60 formulas across the case list.
