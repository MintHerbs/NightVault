---
id: T-059
title: Recurrence input and error-state UX pass
status: done
severity: low
area: recurrence
epic: E-007
created: 2026-07-26
---

## Summary

The recurrence page has had no UX pass. There are no example formulas to start
from, and hitting an unsupported input throws away what was typed.

## Evidence

- `RecurrencePage.jsx` `handleReset` clears `formula` and returns to the input
  view, so the error screen's "Try Again" button discards the user's text. The
  only way back is to retype it.
- The landing view offers a single placeholder (`T(n) = T(n-1) + log(n)`) and no
  worked examples, so there is nothing to click to see what the tool does.
- On the substitution view the derivation runs below the fold with no indication
  that there is more to scroll to.

## Impact

A typo in a long formula costs a full retype, and a first-time visitor has to
guess both the syntax and what the tool is for.

## Suggested fix

- Preserve the input when an error sends the user back, so "Try Again" returns
  to an editable field with their text intact.
- Add a small row of example formulas on the landing view, chosen to show the
  distinct behaviours: merge sort, quicksort worst case, Karatsuba, Fibonacci.
- Indicate scrollable overflow on the substitution panel.

## Acceptance criteria

- [x] An unsupported input can be corrected without retyping it
- [x] Examples are one click from the landing view and populate the input
- [x] No regression to the existing submit and animation flow

## Resolution

`handleReset` takes a `keepFormula` flag. The error screen's button is now
"Edit this formula" and passes `true`, so a rejected input comes back editable
with its text and chosen method intact; the navbar's "New Formula" passes
`false` and still clears. `RecurrenceInput` accepts `initialFormula` and
`initialMethod` to seed itself.

Six example chips on the landing view, one per distinct behaviour rather than six
variations of the same one: merge sort (case 2), binary search (a = 1 chain),
quicksort worst case (subtract chain), Karatsuba (case 3, non-integer exponent),
Fibonacci (exponential via characteristic root), and median of medians
(Akra-Bazzi, which only became solvable in T-058). They are hidden once the field
has content so they never compete with the KaTeX preview.

Verified every chip solves, both methods agree, and each tree branches with no
overlaps or tail collisions.

Not done: the substitution panel's scroll affordance. The derivation running
below the fold is a symptom of the panel not stacking, which is
[T-020](T-020-split-panel-pages-force-unstackable-two-columns.md); fixing it here
would conflict with that work.

## References

- [E-007](../epics/E-007-recurrence-tree-fidelity-and-verification.md)
