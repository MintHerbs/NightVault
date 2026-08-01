# Chemistry notes: equations, structures, and a construction playground

Status: proposed
Created: 2026-08-01
Area: notes, admin editor
Related: [notes-wysiwyg-and-reader.md](notes-wysiwyg-and-reader.md), [T-075](../../tickets/T-075-web-module-notes-and-repl-playground.md)

## Goal

Open the notes platform to chemistry students. Today an author can paste bare
LaTeX into the admin editor and it typesets in the reader (`lib/noteMath.js`,
T-074). Chemistry has to reach the same standard: paste a chemical equation or a
molecule and see it render live, with a playground for building structures and
plotting the diagrams chemistry courses actually use.

## The one thing to get straight first

"Chemistry LaTeX" is not a single format, and treating it as one is the main way
this feature goes wrong. There are three separate problems with three separate
answers:

| What the student has | The real format | What renders it |
|---|---|---|
| An equation: `2H2 + O2 -> 2H2O`, `SO4^2-`, `^{227}_{90}Th` | mhchem (`\ce{...}`), a LaTeX package | KaTeX, already installed |
| A structure: benzene, aspirin, a chair conformation | SMILES or MOL, **not LaTeX** | A cheminformatics renderer, new dependency |
| A reaction scheme: several structures, an arrow, conditions above/below it | Not one format — structures plus arrow layout | Same cheminformatics renderer, plus a layout module we write |
| A plot: energy profile, titration curve | Data, not markup | SVG we draw |

The LaTeX package chemists use for skeletal structures is `chemfig`, which is
built on TikZ. TikZ is a full TeX drawing engine and KaTeX cannot run it. There
is no path to "paste chemfig, see a benzene ring" in this app short of a
server-side TeX install, which is out of scope and out of proportion.

That is not a real loss, because chemfig is not how structures move between
people anyway. Students copy **SMILES** strings from PubChem, Wikipedia and
ChemDraw (`CC(=O)Oc1ccccc1C(=O)O` is aspirin), or MOL blocks out of drawing
software. Supporting those two is supporting how chemistry is actually shared.

So the spec is layered. Layer 1 is nearly free and covers most of a chemistry
course. Layer 2 is the real engineering, and layer 3 builds directly on it to
cover full reaction schemes. Layers 4 and 5 are the playground.

---

## Layer 1: Chemical equations via mhchem

### Why this is cheap

`katex@0.16.47` is already a dependency, and it ships mhchem in the box:

```
node_modules/katex/dist/contrib/mhchem.mjs        75 KB
node_modules/katex/dist/contrib/mhchem.min.js     34 KB
```

mhchem is a side-effecting import that registers `\ce`, `\pu` and `\cf` into
KaTeX's macro table. It needs no new package, no API key, and no server. It must
be imported after KaTeX and before the first render.

### What it covers

- Formulas with automatic subscripting: `\ce{H2SO4}`, `\ce{Ca(OH)2}`
- Reactions and arrow types: `\ce{2H2 + O2 -> 2H2O}`, equilibrium `\ce{<=>}`,
  resonance `\ce{<->}`
- Conditions over and under an arrow: `\ce{A ->[cat][\Delta] B}`
- Charges and oxidation states: `\ce{SO4^2-}`, `\ce{Fe^{3+}}`
- Isotopes: `\ce{^{227}_{90}Th+}`
- States and phases: `\ce{NaCl(aq)}`, precipitate `v`, gas `^`
- Units: `\pu{123 kJ//mol}`, `\pu{1.2e3 J}`
- Simple explicit bonds: `\ce{CH3-CH2-OH}`, `\ce{C#N}`

That is the whole of a first- and second-year inorganic, physical and analytical
syllabus. It does not draw rings or stereochemistry, which is layer 2.

### Reader wiring

[MarkdownRenderer.jsx:305-326](../../src/components/markdown/MarkdownRenderer.jsx#L305-L326)
already lazy-loads KaTeX keyed off whether the note contains maths. Add mhchem
to the same `Promise.all`:

```js
katexPromise = Promise.all([
  import('rehype-katex'),
  import('katex/dist/katex.min.css'),
  import('katex/dist/contrib/mhchem.mjs'),
])
```

Ordering matters and the existing shape already handles it: `Promise.all`
resolves all three before `katexModule` is set, so `rehype-katex` can never run
against a KaTeX that has not yet been extended. Both imports resolve to the same
module instance under Vite, so registering once covers every later render.

Cost: +34 KB on the KaTeX chunk, which only maths notes fetch, and which the
listing already warms on hover via `prefetchKatex`. No prose note pays anything.

### Editor wiring

[NoteEditor.jsx:43](../../src/components/admin/NoteEditor/NoteEditor.jsx#L43)
imports the KaTeX stylesheet statically. Add the mhchem import beside it. The
admin editor already loads KaTeX and Monaco eagerly, so 34 KB is noise there.

`@milkdown/plugin-math` is already configured with `throwOnError: false`
([NoteEditor.jsx:805](../../src/components/admin/NoteEditor/NoteEditor.jsx#L805)),
so a malformed `\ce{...}` renders a red inline error rather than throwing
through ProseMirror's view update. That guard was added for the KaTeX crash in
the admin editor and covers mhchem for free.

### The noteMath.js defect this exposes

This is the substantive code change in layer 1, and it is a real bug rather
than a theoretical one. Verified by running `normalizeNoteMath` against
chemistry inputs:

| Input (a line on its own) | Current output | Correct |
|---|---|---|
| `\ce{H2O}` | `$$\n\ce{H2O}\n$$` | yes |
| `\ce{2H2 + O2 -> 2H2O}` | `$$\n...\n$$` | yes |
| `\ce{NaOH}` | `$\ce{NaOH}$` | **no, should be display** |
| `\ce{2Na + 2H2O -> 2NaOH + H2}` | `$\ce{...}$` | **no, should be display** |
| `\pu{123 kJ//mol}` | `$\pu{...}$` | **no, should be display** |

The cause is
[`isWholeFormula`](../../src/lib/noteMath.js#L319-L333). It decides whether a
line is entirely a formula by stripping the parts that are LaTeX by definition
and then rejecting the line if any word of three or more letters survives. The
reasoning holds for maths, where variables are one or two characters, so
"seconds" surviving the strip proves the line is prose.

Chemistry breaks the premise. `NaOH`, `KMnO4` and `CH3COOH` are element symbol
runs of three, four and more letters, and they are not prose. Every equation
containing one falls through rule 3 to rule 4 and lands inline instead of
display.

The fix should not be to loosen the prose heuristic, which exists to stop rules
3 and 4 corrupting someone's writing. `\ce{...}` and `\pu{...}` are
unambiguously chemistry wherever they appear, exactly like the `\begin{env}`
environments handled by rule 2 at
[noteMath.js:466-468](../../src/lib/noteMath.js#L466-L468). Add a matching rule:

- Scan for `\ce`, `\cf` and `\pu` followed by a brace group, using the existing
  brace-aware `scanGroup` so nested braces in `\ce{^{227}_{90}Th+}` are consumed
  correctly. A plain regex with `\{[^{}]*\}` will truncate those.
- If the scanned span is the whole line, wrap as `$$`; otherwise wrap as `$`.
- Slot it between rules 2 and 3 in the priority order so it beats the line-level
  heuristics on a contested region but still loses to TeX's own delimiters.

### Known limitation to document, not fix

mhchem allows `$...$` nested inside `\ce{}` for conditions, as in
`\ce{A ->[$\Delta$] B}`. That form cannot work here and the normaliser
correctly refuses to touch it: the line carries a loose `$`, so it is marked
`open: false` and left alone. But `noteHasMath` still returns true, so KaTeX
loads and remark-math parses the inner `$\Delta$` as its own math node, breaking
the `\ce` call in half.

The workaround is to write `\ce{A ->[\Delta] B}` without the inner dollars,
which mhchem accepts and which renders identically. This belongs in the author
guide and as a "must not touch" test case, not in the normaliser. Attempting to
repair it would mean parsing mhchem's own grammar.

---

## Layer 2: Molecular structures

### Markup design

A leaf directive, mirroring `::youtube` and `::playground` exactly:

```
::molecule{smiles="CC(=O)Oc1ccccc1C(=O)O" label="Aspirin"}
```

This is the established escape hatch in this codebase
([MarkdownRenderer.jsx:28-69](../../src/components/markdown/MarkdownRenderer.jsx#L28-L69)):
note content names a thing and supplies validated attributes, never markup. It
keeps the reader's deliberate no-`rehype-raw` guarantee intact.

Verified that SMILES survives the normaliser untouched, including the awkward
stereochemistry form that carries a backslash:

```
::molecule{smiles="F/C=C\F"}                   -> unchanged
::molecule{smiles="CC(=O)Oc1ccccc1C(=O)O"}     -> unchanged
```

The backslash is safe because `LATEX_COMMAND_RE` requires two or more letters
after it and `\F` is one. This is incidental rather than designed, so it needs a
pinned test in the "must not touch" section of `noteMath.test.js`.

SMILES never contains a double quote, so the quoted directive attribute is safe
without escaping. Validate against a character allowlist on both the read and
write paths, the same double validation `HEX_COLOR_RE` gets, because stored
Markdown can also arrive via a GitHub backup restore.

### Editor schema is mandatory

T-075 learned this the hard way and the lesson applies unchanged: a directive
without a matching Milkdown `$nodeSchema` is dropped by the parser, so the first
time an admin opens and saves the note the molecule is silently deleted. Add
`moleculeSchema` alongside
[`playgroundSchema`](../../src/components/admin/NoteEditor/NoteEditor.jsx#L217-L250),
plus a node view rendering the real reader component so the author sees what a
visitor gets.

### Renderer choice: decided by spike, not a guess

**Settled: OpenChemLib `9.24.0`**, over SmilesDrawer `2.4.1`. Both were
installed and measured against the spec's own ten-fixture set rather than
estimated. Full methodology and findings:
[ADR 0002](../adr/0002-chemistry-structure-renderer.md).

Correcting this document's earlier premise: the installed `openchemlib`
package has no `minimal`/`full` split — its `package.json` `exports` map has
only `.` and `./debug`, both backed by the same single bundle. The deciding
factor turned out to be architectural, not bundle size: `Molecule.fromSmiles()
→ toSVG()` is a pure string-in/string-out function with no DOM dependency, so
it runs in plain Node exactly like every other `test:*` script and layout
module (`circuitLayout.js`, `erdLayout.js`, ...) in this codebase already
does. SmilesDrawer's `SvgDrawer.draw()` calls `document.createElementNS(...)`
directly and cannot run headless without adding a jsdom-style dependency this
repo doesn't otherwise need. `Molecule.getBounds()` plus `toSVG()`'s
`autoCrop` option additionally give each structure's real rendered size,
which layer 3's `reactionLayout.js` depends on directly.

The real, stated cost of that choice: OpenChemLib gzips to ~343 KB versus
SmilesDrawer's ~59 KB — about 6x larger. Paid only by readers of a note
containing a structure or reaction, via the same lazy-chunk pattern as
KaTeX/mhchem, never by a prose reader.

SmilesDrawer does ship a built-in `ReactionParser`/`ReactionDrawer`, which
looked at first like it might make layer 3's own layout module unnecessary.
It doesn't: `ReactionDrawer.draw()` still routes through the same DOM-bound
`SvgDrawer`, and it runs its own internal layout with no hook for the
below-arrow vertical-band separation the overlap fix needs — using it would
mean forking the library to fix the exact bug this feature exists to fix.

One confirmed bug to carry forward: `toSVG()` emits bond strokes as literal
`stroke="rgb(0,0,0)"`, invisible on this app's dark theme, with no
colour/theme option to fix it at the source. See "Rendering safety" below.

Spike acceptance criteria:

- Measured gzipped chunk size for each option's render path
- Both rendered against the same ten-molecule fixture set spanning aromatic
  rings, stereocentres, charges, isotopes and a failing input
- Visual comparison in both light and dark theme
- A decision recorded as an ADR under `docs/adr/`

### Rendering safety

The renderer produces SVG markup. It must never reach the DOM through
`dangerouslySetInnerHTML` from an unvalidated string, which would reintroduce
precisely the injection surface the reader avoids by having no `rehype-raw`.
Either render into a DOM node the library constructs, or sanitise the SVG
through an allowlist of elements and attributes before mounting.

Two denial-of-service guards, since a SMILES string is author-supplied and
parsers for it are recursive:

- Cap the SMILES length, 500 characters is generous for teaching material
- Treat a parse failure as a quiet degradation: render the raw SMILES as an
  inline code span, matching how an unrecognised directive already degrades to
  nothing rather than an error box

Confirmed by the ADR 0002 spike: OpenChemLib's `toSVG()` emits bond strokes as
literal `stroke="rgb(0,0,0)"`, which is invisible against this app's dark
theme and has no colour/theme option to fix it at the source. The same
sanitisation pass that allowlists elements/attributes must also substitute
that literal black bond stroke for `currentColor`, so a structure's bonds
inherit `color` from their container the way an icon font would. Atom-label
colours (the standard CPK palette OpenChemLib already uses — red oxygen, blue
nitrogen, etc.) need no change; they read fine on either theme.

### Accessibility

A rendered structure is an image and needs a text alternative. `label` becomes
`role="img"` plus `aria-label`. With no label, fall back to the SMILES string
itself, which is at least machine-readable and speakable, rather than emitting
an unlabelled graphic.

Note the contrast with layer 1: KaTeX emits MathML alongside its visual output,
so mhchem equations are accessible for free. Structures are not, which is why
the label matters.

### Paste behaviour

`markdownClipboard`
([NoteEditor.jsx:744-771](../../src/components/admin/NoteEditor/NoteEditor.jsx#L744-L771))
already routes every paste through the Markdown parser and the maths
normaliser.

**Do not auto-detect SMILES on paste.** A short SMILES string is
indistinguishable from ordinary text: `CC(=O)O` is acetic acid, and `No` is a
valid SMILES for nobelium as well as an English word. Auto-detection would
corrupt prose, which is the exact failure mode `noteMath.js` is written to
avoid. Structures go in through an explicit toolbar action.

**Do auto-detect a MOL block on paste.** That format is unambiguous: it has a
counts line ending in `V2000` or `V3000` at a fixed offset. Detecting one,
converting it to SMILES and inserting a `::molecule` node is safe and is what
someone pasting out of ChemDraw expects.

### Toolbar

Add a chemistry button beside the existing formula button at
[EditorNavbar.jsx:313-327](../../src/components/admin/EditorNavbar.jsx#L313-L327),
opening a modal in the same shape as the formula modal wired at
[AdminEditor.jsx:501-503](../../src/pages/admin/AdminEditor.jsx#L501-L503). Two
tabs:

- **Equation**: an mhchem input with live preview and a palette of common
  templates (arrow types, states, charges, isotopes), mirroring the existing
  `MathSymbolBar`
- **Structure**: a SMILES input with live preview, plus a link through to the
  builder

---

## Layer 3: Reaction schemes

A single `::molecule` is not what the picture that motivated this layer looks
like: two structures joined by an arrow, two lines of conditions stacked above
it (`NaNO2, HCl, 0 °C` then `NaOH, 0 °C`), and a third structure — the coupling
partner, `1-naphthol` — drawn below the arrow rather than named in the
conditions. That is a reaction scheme, not a molecule, and it needs its own
markup, its own layout pass, and is the direct cause of the structures
visually overlapping when rendered naively.

### Why this can't be a `::molecule` attribute

`::molecule{smiles="..." label="..."}` is a leaf directive with fixed-arity,
string-valued attributes, which is the right shape for one structure. A
scheme has an unbounded number of steps, each with an unbounded number of
reactants, agents and products, plus free-text condition lines. There is no
sane fixed set of attribute keys for that without an arbitrary step cap
(`step1_smiles`, `step2_smiles`, ...), which is exactly the ugliness the open
question about a MOL-block fence already anticipated for a different reason.

The markup for a scheme is instead a fenced code block with a `reaction` info
string, carrying a JSON payload:

````
```reaction
{
  "steps": [
    {
      "reactants": ["Nc1ccc(Br)cc1"],
      "conditionsAbove": ["1) NaNO2, HCl, 0 °C", "2) NaOH, 0 °C"],
      "agents": [{ "smiles": "Oc1cccc2ccccc12", "label": "1-naphthol" }],
      "products": ["Oc1ccc2ccccc2c1/N=N/c1ccc(Br)cc1"]
    }
  ]
}
```
````

This keeps the same trust boundary as `::molecule`: the block is data, never
markup, and is validated with the same discipline before anything renders —

- Reject the block outright if its raw text exceeds a size cap (2 KB per
  step is generous; cap the whole payload, e.g. 20 KB, before calling
  `JSON.parse`, the same way the SMILES length cap exists so an
  author-supplied string can't be turned into a parser DoS)
- Cap step count (20) and reactants/agents/products per step (6)
- Every SMILES value goes through the same character allowlist and 500-char
  cap as `::molecule`
- A malformed block (bad JSON, a field over its cap, an empty payload)
  degrades to the raw fenced block rendered as a normal code block — matching
  how a parse failure already degrades in layer 2 — never a thrown render

### Layout: this is what fixes the overlap

This codebase already has a convention for this exact class of problem —
laying out sized boxes without them colliding — in
[`erdLayout.js`](../../src/lib/erdLayout.js),
[`circuitLayout.js`](../../src/lib/circuits/circuitLayout.js),
[`kmapLayout.js`](../../src/lib/circuits/kmapLayout.js),
[`tableauxLayout.js`](../../src/lib/logic/tableauxLayout.js) and
[`recurrenceTreeLayout.js`](../../src/lib/algo/recurrenceTreeLayout.js): a pure
function, no SVG or React inside it, a `DEFAULTS` object of gap/size
constants, and a `sizeOf`-style measuring step before anything is positioned.
`circuitLayout.js`'s own comment on `laneGap` states the principle directly:
wires "fan out ... so two of them ... do not sit on top of each other." A
reaction scheme needs the same principle applied to structures instead of
wires.

Add `src/lib/chem/reactionLayout.js` following that convention. The overlap
bug in a naive version of this feature has one root cause: assuming every
structure renders at the same fixed width/height. It doesn't — a bare `HCl`
and a two-ring naphthol are wildly different sizes, and the moment two
differently-sized structures share a row at fixed offsets, the wider one
either clips or crashes into its neighbour. The fix is measuring, not tuning
constants:

- Each reactant/agent/product is a cell whose size comes from the layer 2
  renderer's own reported bounding box for that SMILES, not an assumed
  constant (this is the OpenChemLib point made in layer 2's spike above)
- A `+` glyph cell sits between multiple reactants and between multiple
  products
- One arrow cell per step, whose width is
  `max(coreArrowLength, widestConditionsAboveLine, widestBelowAgentGroup)` —
  this is what stops a long condition line or a below-arrow structure from
  overrunning the arrow or the next cell
- The main row (reactants, `+`, arrow, `+`, products) is baseline-centred on
  the arrow's vertical middle; `agents` drawn below the arrow sit in their own
  band below that baseline, offset by a fixed gap constant (the
  `rowGap`/`laneGap` idea from `circuitLayout.js`) — this vertical separation,
  not a visual tweak afterward, is the actual overlap fix, because the
  below-arrow structure's bounding box then never intersects the arrow's or
  the products'
- Multiple steps chain left to right, each step's product cells becoming
  visual (not data) neighbours of the next step's reactant cells

The scheme's total rendered width is whatever the content demands — do not
build a multi-row reflow algorithm for it. `.katex-display` in
[MarkdownRenderer.module.css:249-253](../../src/components/markdown/MarkdownRenderer.module.css#L249-L253)
already solves "this diagram can be wider than the column" with
`overflow-x: auto; overflow-y: hidden`, and `.tableWrapper` does the same for
tables. Wrap the rendered scheme in a container using that identical rule
rather than inventing a new layout concept for the same problem this codebase
has already solved twice.

### Reader/editor component

A `ReactionScheme` component consumes `reactionLayout.js`'s cell positions
plus per-cell SVG from the layer 2 renderer. Each structure keeps layer 2's
own accessibility contract (`label`/`aria-label` per cell). The whole scheme
additionally needs one wrapping `role="img"` with an `aria-label` built from
the JSON's own text — conditions and labels are already plain strings in the
payload, so the summary ("Step 1: reacts with 1-naphthol under NaNO2, HCl,
0 °C then NaOH, 0 °C to give ...") is string concatenation, not a new
accessibility feature to design.

### Paste behaviour

Extend the layer 2 MOL-block precedent: a pasted **reaction SMILES**
(`reactants>agents>products`, `.`-separated components per segment) is
unambiguous the same way a MOL block's `V2000`/`V3000` counts line is
unambiguous, and converts into a single-step `reaction` block automatically,
with `agents` populated from the middle segment and `conditionsAbove` left
empty.

State this gap plainly rather than papering over it: reaction SMILES has no
slot for free-text conditions like `NaNO2, HCl, 0 °C` — that information
simply is not present in the pasted string. The author workaround is to open
the Reaction tab below and type the condition lines by hand. This is the same
kind of documented, not-fixed limitation as mhchem's nested-`$` case in layer
1 above.

Do not attempt to auto-detect anything looser than full reaction SMILES (a
bare `->` in pasted text, for instance) — the same reasoning layer 2 already
gives for not auto-detecting bare SMILES applies harder here, since `A -> B`
is common English shorthand.

### Toolbar

A third tab, **Reaction**, alongside layer 2's Equation and Structure tabs in
the same chemistry modal. An ordered, add/remove/reorder step list; each step
exposes reactant/agent/product SMILES inputs (each with layer 2's live
preview) and two plain-text condition lines. A running preview renders the
whole scheme via the same `reactionLayout.js` and reader component the
published note will use, so what the author sees while building is the actual
pixel output, not an approximation. "Copy as note directive" serialises the
step list straight to the fenced block. The tab does not duplicate the
canvas-based drawing experience — each SMILES input links out to the layer 4
builder exactly as the Structure tab's own link already does.

---

## Layer 4: The structure builder

A tool where a student draws a molecule and gets a SMILES string back, and where
an author gets a ready-to-paste `::molecule{...}` directive.

### Where it lives

`src/features/chemistry/`, following the feature-first structure in
[architecture-update.md §3.2](../architecture-update.md) and matching the
existing `erd`, `logic`, `complexity` and `tree` features.

It is important that this is **not** built as a `::playground` entry.
`src/content/playgrounds` is a registry of static HTML/CSS/JS documents run
inside a sandboxed iframe with no same-origin access
([NotePlayground.jsx](../../src/components/markdown/NotePlayground/NotePlayground.jsx)).
That design exists so a reader can safely edit and run arbitrary code. A
structure builder is a first-class React feature with real state, so it belongs
with the other tools. Reusing the playground here would mean shipping the whole
chemistry library into an opaque-origin iframe for no benefit.

### Scope

- A canvas for drawing: atoms, bonds, rings, charges, stereo wedges. Delegate to
  the library's own editor rather than building one; a molecule editor is months
  of work and every serious one is a wrapper.
- Paste a SMILES or MOL block and have it appear on the canvas
- Live SMILES output, copyable
- A "copy as note directive" action producing `::molecule{smiles="..." label="..."}`
- Route under the existing tools navigation, gated by
  `constants/experimentalTools.js` per Subject like the other tools

---

## Layer 5: Chemistry plots

This is the loosest part of the request and should ship narrowest.

Chemistry courses draw reaction energy profiles, titration curves, kinetics
plots, phase diagrams and spectra. Of those, most have a substitute already
available: the existing `::playground` node runs arbitrary JS and can plot
anything, and spectra are almost always supplied as images.

The one with no substitute and a genuinely awkward manual path is the **reaction
energy profile**, the enthalpy-versus-reaction-coordinate diagram with labelled
transition states, activation energy arrows and a delta-H bracket. It is drawn
in every kinetics lecture, it is tedious to produce by hand, and it is
structurally simple: an ordered list of levels plus labels.

Recommended first cut: a `::chemplot` directive with a declarative energy
profile schema, rendered as theme-aware SVG. Explicitly deferred until that
ships and gets used: titration curves, kinetics, phase diagrams, and any generic
xy plotting.

Charting work here must follow [docs/design/colors.md](../design/colors.md) for
tokens and the `dataviz` skill for mark, axis and palette decisions. No new raw
hex values, per [rules.md](../rules.md).

---

## Content and subject plumbing

- A `chemistry` row in `subjects` ([db/sql/0005_init_subjects.sql](../../db/sql/0005_init_subjects.sql)).
  Writes are admin-only through `/api/`, so this is a migration plus a seed, not
  a client insert.
- A sidebar module entry, following `0023_sidebar_modules_and_images.sql`
- Notes scoped to the new Subject, as T-077 did for course-scoped notes
- Course-scoped roles already exist (`0024_course_scoped_roles.sql`) and need no
  change

Note the standing constraint before writing any migration: the repo currently
has drift at `0024` that blocks `npm run db:migrate` entirely, and production
has no migration tracking table. Verify production state directly rather than
trusting `applied_envs`, and validate new SQL with PGlite before it goes
anywhere near a real database.

---

## Performance budget

| Path | Added cost | Who pays |
|---|---|---|
| Prose note | 0 | nobody |
| Maths or equation note | +34 KB (mhchem, on the existing KaTeX chunk) | readers of that note |
| Note with a structure | render path only, size to be measured in the spike | readers of that note |
| Note with a reaction scheme | render path (shared with the structure note above) plus `reactionLayout.js`, a small pure module — no new dependency | readers of that note |
| Structure builder | the full editor bundle, lazy | whoever opens the tool |
| Admin editor | +34 KB | admins only |

The governing rule, inherited from the KaTeX and Monaco loaders already in this
codebase: nothing chemistry-related is a static import on a path a
non-chemistry reader walks.

---

## Testing

Follow the existing plain-node convention (`npm run test:math` and friends,
`package.json`):

- Extend `src/lib/noteMath.test.js` with an mhchem section: each row of the
  defect table above, `\ce` inside prose, `\ce` inside a fenced code block
  (must survive verbatim), and the nested-dollar form pinned as a known
  limitation
- Add the two SMILES directive strings to the "must not touch" section,
  including the backslash stereochemistry form
- A new `src/lib/noteChem.test.js` behind `npm run test:chem` for directive
  attribute validation: the allowlist, the length cap, and the parse-failure
  degradation
- A new `src/lib/chem/reactionLayout.test.js`, following the existing
  `circuitLayout.test.js`/`kmapLayout.test.js` convention: assert the
  non-overlap invariant directly (every pair of cell bounding boxes on the
  same row has zero intersection) for a handful of deliberately mismatched
  fixtures — a lone `HCl` next to a fused two-ring structure, a step with
  three reactants, a step with a below-arrow agent and long condition
  lines — rather than only eyeballing rendered output
- `noteChem.test.js` also covers the `reaction` fence: the reaction-SMILES
  paste detector, the step/structure count caps, the pre-parse size cap, and
  malformed-JSON degrading to a plain code block rather than a crash
- A fixture set of ten molecules used by both the spike and the regression
  tests

---

## Suggested phasing

Each phase is independently shippable and useful on its own.

1. **mhchem equations.** Two import lines, the `noteMath.js` rule, and tests.
   Small, no new dependencies, and it covers most of a chemistry syllabus.
2. **Renderer spike — done.** OpenChemLib chosen over SmilesDrawer; see
   [ADR 0002](../adr/0002-chemistry-structure-renderer.md).
3. **`::molecule` directive.** Renderer component, Milkdown schema and node
   view, validation, accessibility, MOL paste detection.
4. **Reaction schemes.** `reactionLayout.js`, the `reaction` fence and its
   validator, the reader component, reaction-SMILES paste detection. Depends
   only on phases 2-3, not on the toolbar or the builder.
5. **Editor toolbar.** Chemistry modal with Equation, Structure and Reaction
   tabs.
6. **Structure builder.** `src/features/chemistry/`, routed and gated.
7. **Energy profile plots.** `::chemplot`, narrow schema.
8. **Subject and content plumbing.** Can run in parallel with any of the above.

Phase 1 alone is worth shipping before anything else is decided.

## Open questions

- Should `::molecule` support a MOL block inline rather than only SMILES?
  SMILES cannot express every structure a MOL file can, notably explicit 2D
  coordinates and some stereochemistry. Storing a MOL block in a directive
  attribute is ugly; a fenced ```` ```mol ```` block may fit better. Deferred
  until someone hits the limit.
- Does the chemistry Subject need its own reader chrome, or does the existing
  note reader suffice?
- Is there an existing chemistry course whose notes drive the fixture set? The
  fixtures should come from real course material rather than being invented.
- Reaction SMILES carries no condition text, so a pasted scheme always needs a
  manual pass in the Reaction tab to fill in conditions. Worth adopting a
  richer interchange format later (an ORD-style reaction record, for
  instance) if this feature sees heavy use, or is the manual step enough?
