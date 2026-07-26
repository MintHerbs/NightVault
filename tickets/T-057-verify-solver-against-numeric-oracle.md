---
id: T-057
title: Verify solver output against the numerically evaluated recurrence
status: backlog
severity: high
area: recurrence
epic: E-007
created: 2026-07-26
---

## Summary

The solver's correctness currently rests on ~55 hand-picked test cases. The same
person chooses the cases and writes the symbolic rule, so a rule that is wrong
in a region nobody thought to test passes silently. Add a numeric oracle that
evaluates the recurrence directly and checks the claimed closed form against it.

## Evidence

`T(n) = 2T(n/2) + n/log n` returned Θ(n) when the answer is Θ(n log log n). The
case-2 rule assumed the level sum is always Θ(log^(q+1) n), which holds only for
q > -1; at q = -1 the level costs form a harmonic series. Every existing test
passed. It was found by a human hand-checking a case, which does not scale.

A prototype oracle catches it without being told the case is interesting. For a
divide recurrence at n = b^k the recurrence is an exact loop,
`T_k = a·T_{k-1} + f(b^k)`, evaluated in log space so nothing overflows:

```
old rule  Θ(n)              drift 0.619    <<< CONTRADICTED
new rule  Θ(n log log n)    drift 0.111    confirmed
```

The range matters: at n = 2^24 both rules pass, because log log n barely moves.
Log space allows n = 2^400000, which separates them.

## Impact

Without this, the next wrong rule in an untested region ships and is reported to
students with a confident step-by-step derivation. This is the same failure mode
T-052 was filed for, one level up.

## Suggested fix

`src/lib/algo/recurrence.oracle.test.js`, wired into an npm script. For each
supported family evaluate T(n) numerically and assert that
`log T(n) − log g(n)` has bounded drift over a wide range of n:

- divide: exact loop at n = b^k in log space
- chain: loop n upward, `T(n) = T(n-b) + f(n)`
- branching subtract: same loop in log space, since T grows exponentially
- `T(√n)`: substitute n = 2^m and reuse the divide loop in m

Report drift per case so a failure says which direction the claim is wrong in.

## Acceptance criteria

- [ ] Every case in the existing suite is also confirmed numerically
- [ ] Deliberately feeding a wrong closed form is CONTRADICTED, proving the
      oracle discriminates rather than rubber-stamping
- [ ] Runs in the same order of time as the existing suite
- [ ] Wired into an npm script and documented in the ticket

## References

- [E-007](../epics/E-007-recurrence-tree-fidelity-and-verification.md)
