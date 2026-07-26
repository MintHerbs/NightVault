---
id: T-060
title: Show the full working in the step panel, not just the recognised identity
status: done
severity: medium
area: recurrence
epic: E-007
created: 2026-07-26
---

## Summary

The step panel names the identity it recognised and then jumps to the answer. A
student cannot use it as a written solution, because the actual algebra (the
summation in Σ form, the identity's general formula, the substitution, the
simplification, and dropping lower-order terms) is never shown.

## Evidence

`T(n) = T(n-1) + n`, tree method, current output:

```
Every level holds exactly one node, so the total is the plain sum:
  n + (n−1) + (n−2) + … + 1
Recognised: arithmetic series
n + (n−1) + (n−2) + … + 1          <- repeats the line above
= n(n+1)/2                          <- appears with no derivation
= Θ(n²)
```

Nothing states `Σ(i=1..m) i = m(m+1)/2`, nothing substitutes m = n, and the
`n²/2 + n/2 → Θ(n²)` step is missing.

`T(n) = 4T(n/2) + n`, tree method:

```
an increasing geometric series is Θ(last term) = Θ(a^log_2(n)) = Θ(n^log_2(a))
Total = n + 2n + 4n + …
geometric, ratio r = 2 > 1, so the leaves dominate
= Θ(n²)
```

The geometric sum formula `Σ(k=0..m) r^k = (r^(m+1) − 1)/(r − 1)` is never
stated or applied, so "the leaves dominate" is an assertion rather than a
derivation.

`T(n) = 2T(n/2) + n`, substitution method, goes from "each term is r = 1 times
the one before it" directly to `= Θ(n log n)` with no intermediate algebra at
all.

## Impact

The feature's whole purpose is the step-by-step panel. As it stands a student can
read the answer but cannot reproduce it, and cannot copy it into a notebook as a
solution, which is what the panel looks like it is offering.

## Suggested fix

A shared working module used by both methods, so an identity is always explained
the same way regardless of which method invoked it. Each derivation should show:

1. the total in Σ notation,
2. the algebra that puts it in a standard form (factoring `c·n^q` out, or
   reindexing a chain sum),
3. the named identity **with its general formula**,
4. that formula with this problem's values substituted in,
5. the expanded result, then dropping lower-order terms to reach Θ.

Both methods share the identities, so both should share these lines.

## Acceptance criteria

- [x] Every summation identity states its general formula before applying it
- [x] The geometric case shows the sum formula, substitutes the ratio, and
      simplifies, for all three of ρ < 1, ρ = 1 and ρ > 1
- [x] Chain sums show the reindex and the closed form's expansion
- [x] The exponential case derives its base from the characteristic equation
- [x] Both methods show working, and explain shared identities identically
- [x] A test asserts the working is present rather than just the conclusion

## Resolution

New `src/lib/algo/recurrenceWorking.js`, one generator per recurrence family,
returning plain strings so it holds no presentation concern. **Both solvers pull
from it**, which is the point: an identity is now explained the same way whichever
method reached it, and a test asserts that the shared identity lines are
byte-identical across the two panels.

`T(n) = 2T(n/2) + n`, tree method, now reads:

```
Level k has a^k = 2^k nodes, each costing f(n/2^k).
Total = Σ(k=0..log₂(n)) 2^k · n/2^k
      = n · Σ(k=0..log₂(n)) (2/2^1)^k     (factor out n)
      = n · Σ(k=0..log₂(n)) ρ^k          where ρ = a/b^q = 1

ρ = 1 exactly, so every level costs the same and the geometric formula degenerates:
  Σ(k=0..m) 1 = m + 1
With m = log₂(n):  = n · (log₂(n) + 1)
      = n log₂(n) + n
Drop the lower-order term:
      = Θ(n log n)
```

`T(n) = T(n-1) + n`:

```
Total = Σ(k=0..n−1) f(n − k)
      = n + (n−1) + … + 1
Reading the terms in increasing order, with i:
      = Σ(i=1..n) i

Arithmetic series:
  Σ(i=1..m) i = m(m+1)/2
With m = n:  = n(n+1)/2
      = n²/2 + n/2
Drop the lower-order term:
      = Θ(n²)
```

Fibonacci derives its base rather than asserting it:

```
Try T(n) = x^n:
  x^n = x^(n−1) + x^(n−2)
Divide through by x^(n−2):
  x² = x + 1
Its dominant root is x = 1.618 = (1+√5)/2 = φ
```

The three geometric cases each state `Σ(k=0..m) ρ^k = (ρ^(m+1) − 1)/(ρ − 1)`,
`Σ(k≥0) ρ^k = 1/(1 − ρ)`, or `Σ(k=0..m) 1 = m + 1` before applying it, and the
ρ > 1 and ρ < 1 cases both end with a leaf-count cross-check so the student can
see why that end of the tree dominates.

Fixed while verifying: `n/2k` was rendering where `n/2^k` was meant (the
superscript map only covers digits, so a symbolic exponent silently lost its
caret); `n^1` and `n^2` now use the same formatter as the rest of the app; and
`16n/4` is written `16·(n/4)`, since the former can be misread as (16n)/4.

1038 assertions, up from 847. Removed `akraEquationText`, `akraIntegralText` and
an unused `theta` import, all dead once the working module took over.

## References

- [E-007](../epics/E-007-recurrence-tree-fidelity-and-verification.md)
