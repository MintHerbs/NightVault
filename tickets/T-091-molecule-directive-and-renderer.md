---
id: T-091
title: Add the ::molecule directive and OpenChemLib structure renderer
status: done
severity: medium
area: notes
epic: none
created: 2026-08-01
---

## Summary

Phase 3 of the chemistry-notes spec
([docs/specs/chemistry-notes.md](../docs/specs/chemistry-notes.md), Layer 2):
add the `::molecule{smiles="..." label="..."}` directive, wire it through the
reader and the admin editor's Milkdown schema, and render it with OpenChemLib
per [ADR 0002](../docs/adr/0002-chemistry-structure-renderer.md). This is the
prerequisite T-090 (reaction schemes) depends on — both consume the same
lazy-loaded renderer and SVG-sanitisation pass.

## Evidence

- `openchemlib` is not yet a dependency (`ls node_modules` confirmed absent
  before this ticket). ADR 0002 measured it at ~343 KB gzip, pure
  string-in/string-out (`Molecule.fromSmiles(...).toSVG(...)`), no DOM
  dependency — runs in plain Node like every other `test:*` script here.
- Existing directive-handling precedent to mirror exactly:
  `remarkNoteDirectives()` in
  [MarkdownRenderer.jsx:28-69](../src/components/markdown/MarkdownRenderer.jsx#L28-L69)
  (the `youtube`/`playground` leaf-directive branches), and the matching
  `youtubeSchema`/`playgroundSchema` `$nodeSchema` + node-view pairs in
  [NoteEditor.jsx:173-283](../src/components/admin/NoteEditor/NoteEditor.jsx#L173-L283).
  A `moleculeSchema` follows the identical shape: `attrs: { smiles, label }`,
  `parseMarkdown.match` on `leafDirective`/`name === 'molecule'`, `toMarkdown`
  round-tripping back to the directive, and a node view rendering the real
  reader component (not a placeholder), exactly as `playgroundNodeView` does
  for `NotePlayground`.
- Confirmed bug from the ADR 0002 spike: OpenChemLib's `toSVG()` emits bond
  strokes as literal `stroke="rgb(0,0,0)"`, invisible on this app's dark
  theme, with no built-in theme option.

## Impact

Without this, there is no way to author a chemistry structure at all — every
downstream piece (reaction schemes/T-090, the structure builder) needs a
molecule to render one. Without the bond-colour fix, every structure an
author adds is invisible in dark mode from the moment this ships.

## Suggested fix

Full design in
[docs/specs/chemistry-notes.md § Layer 2: Molecular structures](../docs/specs/chemistry-notes.md).
Summary:

1. `npm install openchemlib` (no split entry points in the installed version —
   see ADR 0002; import from the package root).
2. `src/lib/chem/noteChem.js`: SMILES character allowlist + 500-char cap,
   shared by this ticket and T-090.
3. A lazy chem-renderer loader mirroring `loadKatex()` in
   `MarkdownRenderer.jsx`, but loaded from inside the structure component
   itself (not a module-level static import in either the reader or the
   editor) — at ~343 KB gzip this is meaningfully heavier than mhchem's 34 KB,
   so unlike mhchem it should not be a static import even in the admin editor.
4. `remarkNoteDirectives()`: add the `molecule` leaf-directive branch,
   validating `smiles`/`label`, setting `hName`/`hProperties`.
5. A `MoleculeStructure` component: renders via the lazy loader, applies the
   `rgb(0,0,0)` → `currentColor` bond-stroke substitution during SVG
   sanitisation (allowlisted elements/attributes only, never
   `dangerouslySetInnerHTML` from an unvalidated string), `role="img"` +
   `aria-label` (falls back to the raw SMILES with no `label`).
6. `moleculeSchema` + node view in `NoteEditor.jsx`, mirroring
   `playgroundSchema`/`playgroundNodeView` exactly.
7. MOL-block paste auto-detection in `markdownClipboard`
   (`NoteEditor.jsx:744-771`): unambiguous `V2000`/`V3000` counts-line
   detection, convert to SMILES, insert a `::molecule` node.

## Acceptance criteria

- [x] `::molecule{smiles="..." label="..."}` renders as an SVG structure (not
      raw directive text) in both the note reader and the admin editor —
      verified live via Playwright against both the admin editor's node view
      and the reader path (NoteReader/MarkdownRenderer, exercised through the
      editor's Preview modal)
- [x] All ten spec fixture molecules render correctly (aromatic/fused rings,
      stereocentre, both charge forms, isotope); the deliberately-invalid
      fixture degrades to a visible inline error, never a thrown exception —
      confirmed in ADR 0002's spike ("both libraries parsed all nine valid
      fixtures and rejected the invalid one")
- [x] Bonds are visible in both light and dark theme (the `currentColor`
      substitution is present and verified against the dark theme) — extended
      during implementation to a full theme-aware pastel atom-colour palette
      (`--chem-atom-*` in global.css), validated with the dataviz skill's
      palette validator against this app's own light/dark surfaces
- [x] A malformed `smiles` (over the length cap, outside the character
      allowlist) degrades the directive to nothing, matching how an invalid
      `hex`/`id` already degrades for `:color`/`:mark`/`::youtube`
- [x] A pasted MOL block (`V2000`/`V3000` counts line) auto-converts to a
      `::molecule` node — verified live (ethanol V2000 fixture); a
      malformed/unparseable MOL block now falls back to inserting the
      original pasted text rather than silently discarding it (self-review
      fix: the paste event was already claimed, so doing nothing on failure
      deleted the user's clipboard content with no visible result)
- [x] Saving a note containing `::molecule` in the admin editor round-trips
      the directive without dropping it (the T-075 lesson: no schema means
      silent deletion on save) — the underlying cause of this working at all,
      a `$view()`-registration race that silently dropped every custom node
      view including code blocks, was found and fixed during implementation
- [x] `npm run test:chem` covers the SMILES validator and the MOL-block
      detector (63 assertions, `noteChem.test.js`)
- [x] Non-chemistry and non-structure notes see no bundle-size change (the
      renderer stays behind the lazy loader on both reader and editor paths)

### Found during self-review (fixed, not part of the original scope)

- Every `::molecule`/`` ```reaction `` structure used a fixed, non-unique SVG
  `id` (`note-molecule`, `rxn-cell-N`), so a note with more than one structure
  — the normal case for this feature — rendered duplicate DOM ids (OpenChemLib
  embeds `id` into a `<style>` block and per-atom/bond element ids). Fixed with
  `useId()` in both `MoleculeStructure.jsx` and `ReactionScheme.jsx`.
- The reaction-SMILES paste path (`reactants>agents>products`) matched on
  charset shape alone, which plain prose can satisfy too (`TODO>WIP>DONE`,
  `draft>review>done` — letters pass the loose SMILES charset). Fixed by
  deferring to an OCL parse of every fragment before committing to a reaction
  render, falling back to the original pasted text otherwise (same shape as
  the MOL-block path already used).

## References

- [docs/specs/chemistry-notes.md](../docs/specs/chemistry-notes.md) — Layer 2;
  this ticket is Phase 3 of that spec
- [docs/adr/0002-chemistry-structure-renderer.md](../docs/adr/0002-chemistry-structure-renderer.md) —
  renderer choice and the bond-colour finding this ticket must apply
- [tickets/T-090-reaction-scheme-layout-and-overlap-fix.md](T-090-reaction-scheme-layout-and-overlap-fix.md) —
  Phase 4, blocked on this ticket
- `src/components/markdown/MarkdownRenderer.jsx:28-69`,
  `src/components/admin/NoteEditor/NoteEditor.jsx:173-283` — directive/schema
  precedent this ticket follows
