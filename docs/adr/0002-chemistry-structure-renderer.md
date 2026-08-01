# ADR 0002 — Structure-rendering library for chemistry notes (T-090, Phase 2 spike)

**Status:** Accepted (spike passed)
**Date:** 2026-08-01
**Tickets:** T-090 — Reaction scheme layout and overlap fix; unblocks the
Phase 3 `::molecule` directive
**Spec:** [docs/specs/chemistry-notes.md](../specs/chemistry-notes.md), Layer 2
and Layer 3

## Decision

Use **OpenChemLib `9.24.0`** (`openchemlib`) as the structure renderer for
both `::molecule` (Phase 3) and reaction schemes (Phase 4 / T-090), over
**SmilesDrawer `2.4.1`** (`smiles-drawer`).

## Context

The spec left the renderer choice as an explicit spike rather than a
preference (Layer 2, "Renderer choice: needs a spike, not a guess"), and
recommended OpenChemLib provisionally on the premise that its published
`openchemlib/minimal` and `openchemlib/full` entry points split the read-path
cost from the builder cost. Layer 3 (reaction schemes) then made the renderer
choice load-bearing for a second reason: `reactionLayout.js` needs each
structure's *real* rendered size, not a guessed fixed one, or the reaction
scheme overlaps exactly the way the reported bug describes.

## What was tested

Both packages installed and measured directly (not estimated) in a scratch
project, against the ten-fixture set the spec calls for: benzene, aspirin,
caffeine, L-alanine (stereocentre), the Fe³⁺ ion and sulfate ion (charges),
thorium-227 (isotope), cyclohexane, 1-naphthol (fused rings, the actual
coupling partner in the motivating picture), and one deliberately invalid
input.

### Correction to the spec's premise

`openchemlib@9.24.0`'s `package.json` `exports` map has exactly two entries,
`.` and `./debug` — there is no `minimal`/`full` split in the currently
published package. The spec's cost argument for OpenChemLib was wrong for the
installed version; both `Molecule.fromSmiles()` (needed for reading) and the
`Molecule` editing API (needed for the layer-4 builder) ship in the same
`dist/openchemlib.js` bundle. This ADR's decision does not rest on that split.

### Measured size

| Package | Minified | Gzipped |
|---|---|---|
| `openchemlib` (`dist/openchemlib.js`, whole bundle — no split) | 1.1 MB | **343 KB** |
| `smiles-drawer` (`dist/smiles-drawer.min.mjs`) | 197 KB | **59 KB** |

SmilesDrawer is about 6x smaller gzipped. This is a real cost, stated
plainly, not glossed over.

### Rendering correctness on the fixture set

Both libraries parsed all nine valid fixtures and rejected the invalid one
with a catchable, descriptive error (`OCL`:
`SmilesParser: unknown element label found`; SmilesDrawer's PEG parser:
a positional expectation error) — neither discriminates on this axis.

### The deciding factor: DOM dependency

`OCL.Molecule.fromSmiles(smiles).toSVG(width, height, id, options)` is a pure
function: SMILES string in, SVG string out, no `document` or `window`
required. It ran unmodified in plain Node across the whole fixture set.

`SmilesDrawer.SvgDrawer.prototype.draw()` calls
`document.createElementNS('http://www.w3.org/2000/svg', 'svg')`
unconditionally — confirmed by inspecting the built function source. It
cannot run headless without a DOM shim (jsdom or equivalent). This repository
has no such dependency today: every one of its nine `test:*` scripts
(`test:math`, `test:circuits`, `test:erd`, ...) is plain `node file.test.js`,
matching the layout-module convention (`circuitLayout.js`,
`erdLayout.js`, ...) of pure functions with no rendering library inside them.
Choosing SmilesDrawer would mean either adding jsdom just to test the
renderer, or leaving the renderer untested by the same convention every other
diagram module in this codebase follows.

### The bounding-box requirement (Layer 3 / T-090)

`reactionLayout.js` needs each structure's real rendered size to place cells
without overlap. OpenChemLib gives this two ways, both confirmed working:

- `molecule.getBounds()` returns `{x, y, width, height}` in molecule
  coordinate units before any rendering — usable to pick a proportional
  canvas size ahead of time. (A single heavy atom like `Cl` alone reports
  `width: 0, height: 0` — a real degenerate case the layout module must clamp
  to a minimum cell size, not divide by.)
- `toSVG(w, h, id, { autoCrop: true, autoCropMargin })` tightens the emitted
  `width`/`height` attributes to the actual content — confirmed: requesting a
  generous 150×100 canvas for benzene came back as a cropped 54×61 SVG.
  Reading the emitted attributes off the result is simpler than a separate
  bounds pass and is the mechanism `reactionLayout.js` should use.

SmilesDrawer's `ReactionParser`/`ReactionDrawer` do exist and parse reaction
SMILES headlessly (worth recording — a real point in its favor that was
weighed), but `ReactionDrawer.draw()` still routes through the same
DOM-bound `SvgDrawer` internals, and it does its own internal layout with no
hook for this codebase's overlap-avoidance strategy (a below-arrow vertical
band offset). Using it would mean forking the library to fix the exact bug
this ticket exists to fix, not saving the work of `reactionLayout.js`.

### New finding: bond colour needs a fix regardless of which library wins

`toSVG()` emits bond strokes as literal `stroke="rgb(0,0,0)"` — invisible on
this app's dark theme. Atom-label colours (e.g. `rgb(255,13,13)` for oxygen)
are the standard CPK palette and read fine on either theme. There is no
theme/colour option on `toSVG()` to fix this at the source. Recorded here so
Phase 3's "Rendering safety" sanitisation pass (already planned to allowlist
SVG elements/attributes before mounting) also substitutes the literal black
bond stroke for `currentColor`, so structures inherit `color` from their
container the same way an icon font would. This is a real, confirmed
dark-mode bug, not a hypothetical one — add it to the spec.

## Consequences

- `openchemlib` is added as a production dependency. Per the existing
  performance-budget rule, it must be a lazy chunk fetched only by notes
  containing a `::molecule`/`` ```reaction `` block, matching how KaTeX/mhchem
  are already lazy-loaded — never a static import on a path a non-chemistry
  reader walks.
- `reactionLayout.js` is written as a pure module regardless of renderer, per
  the existing `circuitLayout.js`/`erdLayout.js`/`kmapLayout.js` convention,
  and is unit-testable with plain `node reactionLayout.test.js` — no jsdom
  needed anywhere in this feature.
- The spec's Layer 2 "minimal/full split" cost claim is corrected by this
  ADR: no such split exists in the installed version. The real cost is
  343 KB gzip, paid only by structure-note readers.
- Bond-stroke colour substitution (`rgb(0,0,0)` → `currentColor`) is added as
  a concrete requirement of the SVG-sanitisation step in Layer 2's Rendering
  safety section.
