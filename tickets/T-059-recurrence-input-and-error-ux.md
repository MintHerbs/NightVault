---
id: T-059
title: Recurrence input and error-state UX pass
status: backlog
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

- [ ] An unsupported input can be corrected without retyping it
- [ ] Examples are one click from the landing view and populate the input
- [ ] No regression to the existing submit and animation flow

## References

- [E-007](../epics/E-007-recurrence-tree-fidelity-and-verification.md)
