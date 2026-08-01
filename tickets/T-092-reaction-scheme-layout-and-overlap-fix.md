---
id: T-092
title: Render multi-step reaction schemes without overlapping structures
status: done
severity: medium
area: notes
epic: none
created: 2026-08-01
---

## Summary

Phase 4 of the chemistry-notes spec
([docs/specs/chemistry-notes.md](../docs/specs/chemistry-notes.md), Layer 3):
add a `reaction` fenced-code format for multi-step reaction schemes
(reactants, arrow, above/below conditions, products), a pure layout module
that measures each structure's real rendered size instead of assuming a fixed
one, and a third toolbar tab to build one. This is the requested fix for
structures rendering on top of each other, plus the ability to display
schemes like a diazotisation/azo-coupling sequence (two structures, a
below-arrow reagent, two-line conditions) via paste or construction.

## Evidence

- Reported directly: rendered chemical structures overlap each other on the
  page. Root cause identified in the spec: a naive renderer assumes every
  structure occupies the same fixed width/height box. A bare reagent (`HCl`)
  and a fused two-ring structure (`1-naphthol`) are not remotely the same
  size, so placing them at fixed offsets in the same row is what collides.
- This codebase already solves the same class of problem — sized boxes that
  must not collide — in `src/lib/erdLayout.js`,
  `src/lib/circuits/circuitLayout.js`, `src/lib/circuits/kmapLayout.js`,
  `src/lib/logic/tableauxLayout.js` and `src/lib/algo/recurrenceTreeLayout.js`:
  a pure function, a `DEFAULTS` constants object, and a measure-then-place
  pass. `circuitLayout.js`'s own `laneGap` comment states the principle this
  ticket needs applied to structures instead of wires.
- No reaction-scheme markup, layout module, or toolbar tab exists yet;
  `docs/specs/chemistry-notes.md` did not cover multi-structure schemes at
  all before this ticket's spec update (Layer 3 was added alongside this
  ticket).
- Confirmed via `ls node_modules`: neither `openchemlib` nor `smiles-drawer`
  is installed yet — the Layer 2 renderer spike this ticket depends on has
  not been run.

## Impact

Without a layout pass that measures real structure sizes, any reaction scheme
with differently-sized reactants/agents/products (which is the normal case,
not an edge case) renders with structures visually overlapping — see the
motivating example: a two-step diazotisation/coupling scheme with a
below-arrow reagent structure and two-line conditions. Without the `reaction`
format and toolbar tab, there is also no way for an author to produce a
multi-step scheme at all, only single `::molecule` structures (Layer 2).

## Suggested fix

Full design is written up in
[docs/specs/chemistry-notes.md § Layer 3: Reaction schemes](../docs/specs/chemistry-notes.md)
— follow it rather than re-deriving here. Summary of the pieces:

1. A ```` ```reaction ```` fenced code block carrying a validated JSON payload
   (steps → reactants/agents/products SMILES + above-arrow condition lines),
   with a pre-parse size cap and the same SMILES allowlist/length cap as
   `::molecule`.
2. `src/lib/chem/reactionLayout.js`: pure geometry, following the
   `circuitLayout.js` convention — cells sized from each structure's real
   rendered bounding box (not a fixed constant), arrow cell width driven by
   its widest condition/below-arrow content, below-arrow agents placed in
   their own vertical band offset from the main baseline. This vertical/width
   separation is the actual overlap fix, not a cosmetic pass afterward.
3. A `ReactionScheme` reader/editor component, wrapped in the same
   `overflow-x: auto` pattern `.katex-display`/`.tableWrapper` already use for
   wide content, with a built-from-data `aria-label` summary.
4. Reaction-SMILES paste auto-detection (unambiguous format, same precedent as
   MOL-block detection), with the documented gap that reaction SMILES cannot
   carry free-text conditions — author fills those in via the toolbar after
   paste.
5. A third "Reaction" tab in the chemistry toolbar modal (alongside Layer 2's
   Equation/Structure tabs): ordered step builder with live preview via the
   same layout/reader path, "copy as note directive" action.

## Acceptance criteria

- [x] **Blocked until Phase 2 (renderer spike: OpenChemLib vs SmilesDrawer)
      and Phase 3 (`::molecule` directive) are implemented** — both done
      (ADR 0002; T-093), in the same worktree, before this ticket's work
- [x] A reaction scheme with differently-sized structures (e.g. a bare
      reagent next to a fused-ring structure) renders with zero bounding-box
      intersection between any two cells in the same row —
      `reactionLayout.test.js`'s `assertNoOverlaps` asserts this directly on
      6 deliberately mismatched fixtures
- [x] The motivating example (two-step diazotisation → azo-coupling, each step
      with a below-arrow reagent structure and two stacked condition lines)
      renders correctly in both the note reader and the admin editor preview —
      verified live via Playwright with the exact motivating fixture; the
      scheme is wider than the prose column and scrolls horizontally to reveal
      the final product, by design (`.wrapper`'s `overflow-x: auto`, same rule
      `.katex-display`/`.tableWrapper` already use), confirmed not a clipping
      bug by scrolling and re-screenshotting
- [x] A pasted reaction SMILES string auto-converts to a `reaction` block with
      structures populated and conditions left blank for manual entry —
      hardened during self-review: the original charset-shape-only check
      false-positived on plain prose that happens to match
      `reactants>agents>products` shape (e.g. "TODO>WIP>DONE"); it now defers
      to an OCL parse of every fragment before committing to the conversion,
      falling back to the original pasted text otherwise
- [x] A malformed `reaction` block (bad JSON, oversized payload, over the
      step/structure count cap) degrades to a plain rendered code block, never
      a thrown exception
- [x] The chemistry toolbar modal's Reaction tab builds a scheme step by step
      with live preview and produces a working `reaction` directive via "copy
      as note directive"
- [x] `npm run test:chem` covers the fence validator and paste detector;
      `src/lib/chem/reactionLayout.test.js` asserts the non-overlap invariant
      directly on deliberately mismatched fixtures (63 + 6 assertions)
- [x] Non-chemistry and single-structure notes see no bundle-size or behavior
      change

### Found during self-review (fixed, not part of the original scope)

- `ReactionScheme.jsx` reused a per-instance cell-id counter starting at 0 on
  every mount, so two `` ```reaction `` blocks on the same page collided on
  DOM id (same root cause and same `useId()` fix as `MoleculeStructure.jsx`,
  see T-093).

## References

- [docs/specs/chemistry-notes.md](../docs/specs/chemistry-notes.md) — Layer 3:
  Reaction schemes; this ticket is Phase 4 of that spec
- [tickets/T-088-chemistry-note-equations-mhchem.md](T-088-chemistry-note-equations-mhchem.md) —
  Phase 1 (mhchem equations), same spec, already implemented
- `src/lib/circuits/circuitLayout.js`, `src/lib/erdLayout.js` — layout-module
  precedent this ticket follows
