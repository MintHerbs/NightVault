# logic-spec.md — Logic Tools Specification

## Overview

Four logic tools added under the Logic nav group.
All tools share: text input pill + symbol button row + result rendered in the same
canvas-style environment used for ERD (starfield background, pan/zoom SVG).

No existing files are modified. Everything lives in:
- `src/pages/logic/` — one page per tool
- `src/components/logic/` — all logic-specific components
- `src/lib/logic/` — all pure algorithm functions
- `src/engine/logic/` — step-by-step animation engines

---

## The Four Tools

### 1. English to Logic (`/logic/translate`)
User types an English sentence. Gemini API returns formal logic translation + explanation.
No algorithm needed — pure LLM. Same 3-step flow as ERD:
step 1 = input, step 2 = Gemini generates, step 3 = result displayed.

Result display: a simple styled card showing the English sentence, the formal logic
translation, and a breakdown of each symbol used. No tree diagram needed.

### 2. Proof Tree — Natural Deduction (`/logic/proof`)
User types premises separated by commas, then a conclusion.
Example input: `¬S∧C, ¬S→¬W, ¬W→a, a→e` with conclusion `e`.
LLM (Gemini) figures out the proof steps using inference rules.
Result: rendered as a V-connector tree diagram (see Image 1 in notes).

LLM returns JSON. Algorithm renders it. No pure-JS proof search needed.

### 3. Semantic Tableaux / Truth Tree (`/logic/tableaux`)
User types a propositional formula (e.g. `¬(¬(P∧Q)↔(¬P∨¬Q))`).
Algorithm (pure JS, no LLM) applies tableau rules, builds the tree, closes branches.
Result: rendered as a branching tree with X (closed) and ○ (open) markers.
The rules reference table is always visible alongside the tree.

This IS fully implementable without LLM. Tableau for propositional logic is a
deterministic algorithm.

### 4. Resolution Method (`/logic/resolution`)
User types a formula or a set of clauses (comma separated).
Algorithm (pure JS) converts to CNF, extracts clauses, applies resolution.
Result: rendered as the V-connector diagram showing which clauses resolve (see Image 4).
Knowledge base panel shown alongside.

Also fully implementable without LLM.

---

## Shared Input UI

All four tools use the same input page layout:

```
<LogicInputPage>
  <HeroText title="..." subtitle="..." />
  <PillInput placeholder="..." onSubmit={...} onFocus={→ observing} />
  <SymbolBar />           ← row of symbol buttons below pill
</LogicInputPage>
```

### SymbolBar Component

A horizontal row of small square buttons, each inserting a logic symbol at the
cursor position in the pill input. Symbols:

| Button | Symbol | Unicode |
|--------|--------|---------|
| NOT    | ¬      | \u00AC  |
| AND    | ∧      | \u2227  |
| OR     | ∨      | \u2228  |
| IF     | →      | \u2192  |
| IFF    | ↔      | \u2194  |
| THERE4 | ∴      | \u2234  |
| TRUE   | ⊤      | \u22A4  |
| FALSE  | ⊥      | \u22A5  |

Uses `npx shadcn@latest add @animate-ui/components-buttons-copy` as base.
Buttons are styled: `background: #0f0f0f`, `border: 1px solid #333`,
`border-radius: 8px`, `color: #8B5CF6`, `font-size: 16px`, `width: 40px`,
`height: 40px`. On hover: border becomes `#8B5CF6`, subtle glow.
On click: inserts symbol at cursor position in the pill input (uses
`inputRef.current.setRangeText(symbol)` then fires an input event).
`PillInput` must expose a `ref` so `SymbolBar` can call `setRangeText`.

---

## Formula Parser (shared by Tableaux + Resolution)

Location: `src/lib/logic/formulaParser.js`

Parses propositional logic strings into an AST. Supports:
- Atoms: single uppercase letters (P, Q, R, S...)
- Negation: `¬P`, `¬(P∧Q)`
- Binary connectives: `∧`, `∨`, `→`, `↔`
- Parentheses for grouping
- Also accepts ASCII equivalents: `~` for ¬, `&` for ∧, `|` for ∨, `->` for →, `<->` for ↔

Returns a node tree:
```js
// Atom
{ type: 'atom', name: 'P' }

// Negation
{ type: 'not', child: node }

// Binary
{ type: 'and' | 'or' | 'implies' | 'iff', left: node, right: node }
```

Throws a descriptive error if the formula is malformed.

---

## Semantic Tableaux Algorithm

Location: `src/lib/logic/tableauxEngine.js`

Input: formula string
Output: a tree of `TableauNode` objects ready for rendering

### Node structure
```js
{
  id: string,
  formula: string,        // display string e.g. "¬(P∧Q)"
  formulaNode: ASTNode,   // parsed AST
  isClosed: boolean,      // leaf ends a branch that contradicts itself
  isOpen: boolean,        // leaf ends a branch with nothing left to expand
  closedBy: [id1, id2],   // the two node IDs that contradict
  model: object|null,     // on an open leaf: the assignment that branch witnesses
  children: TableauNode[],// [] = leaf, [one] = α rule, [two] = β rule
  revealAt: number,       // step index at which this node appears
  markAt: number|null     // step index at which its ✗ / ○ appears
}
```

Every leaf of a finished tableau has exactly one of `isClosed` / `isOpen` set, and every
id in `closedBy` is present in the tree. The oracle test asserts both.

### Rules

**α-rules (one branch, formulas stack):**
| Formula | Produces |
|---------|----------|
| `¬¬P` | `P` |
| `P∧Q` | `P`, `Q` (stacked) |
| `¬(P∨Q)` | `¬P`, `¬Q` (stacked) |
| `¬(P→Q)` | `P`, `¬Q` (stacked) |

**β-rules (two branches):**
| Formula | Left branch | Right branch |
|---------|------------|--------------|
| `P∨Q` | `P` | `Q` |
| `¬(P∧Q)` | `¬P` | `¬Q` |
| `P→Q` | `¬P` | `Q` |
| `P↔Q` | `P`, `Q` | `¬P`, `¬Q` |
| `¬(P↔Q)` | `¬P`, `Q` | `P`, `¬Q` |

`P↔Q` is a **β-rule**. Earlier revisions of this spec listed it under the α table with
"left branch"/"right branch" columns, which is a contradiction in terms: the two cases
(both sides true, both sides false) cannot be stacked on one branch. The engine has
always treated it as β; the table was wrong (T-084).

### Algorithm
1. Start from the formula as written (satisfiability) or from its negation (validity:
   a formula is valid exactly when its negation has no model).
2. Track each branch as a root-to-leaf path with its own literal set and its own queue
   of unexpanded formulas.
3. Expand α before β: it keeps the tree narrow, and often closes a branch before a split
   is needed.
4. **Every expansion appends to the branch's current leaf**, never to the node the
   expanded formula sits on. Attaching to the formula's own node severs whatever is
   already below it (T-084).
5. Check for a contradiction as each literal is written. Close the branch at the literal
   that introduced it and stop expanding: everything below is irrelevant.
6. A branch with an empty queue and no contradiction is open, and the literals along it
   are a model of the formula.
7. All branches closed = unsatisfiable (or, in validity mode, valid).

### Step array for animation
The engine produces a `steps[]` array of
`{ id, description, kind, highlightNodeId }`, where `kind` is one of
`start` / `expand` / `split` / `close` / `open` / `result`. Close steps also carry
`closedBy`, open steps carry `model`, and the final `result` step carries both the
verdict and the witnessing model.

Steps deliberately do **not** carry a tree snapshot. The canvas lays the finished tree
out once and reveals nodes whose `revealAt` has been reached, so nothing moves under the
viewer as the animation runs.

### Tests
`npm run test:logic` runs three suites:
- `formulaParser.test.js`: grammar, associativity, and the position/hint attached to
  every parse error
- `tableauxEngine.oracle.test.js`: every verdict cross-checked against an exhaustive
  truth table over curated tautologies plus seeded fuzz, with the structural invariants
  above
- `tableauxLayout.test.js`: no overlapping boxes on any row, chains vertical, splits
  centred over their branches

---

## Resolution Algorithm

Location: `src/lib/logic/resolutionEngine.js`

Input: array of clause strings OR a single formula string (auto-converted to CNF)
Output: `{ steps: [], knowledgeBase: [], result: 'contradiction' | 'satisfiable' }`

### Steps
1. Parse each clause into a set of literals
2. Try all pairs of clauses for resolution:
   find complementary literals (P and ¬P), remove them, merge remaining literals
3. If empty clause produced → contradiction (formula is unsatisfiable / argument is valid)
4. If no new clauses can be produced → satisfiable
5. Record each resolution as a step: { clause1Id, clause2Id, resolvedLiteral, resultClause }

### CNF Conversion (for single formula input)
1. Eliminate ↔: `P↔Q` → `(P→Q)∧(Q→P)`
2. Eliminate →: `P→Q` → `¬P∨Q`
3. Push ¬ inward (De Morgan, double negation)
4. Distribute ∨ over ∧

---

## LLM JSON Schemas

### Proof Tree JSON (Gemini returns this)
```json
{
  "premises": ["¬S∧C", "¬S→¬W", "¬W→a", "a→e"],
  "conclusion": "e",
  "steps": [
    {
      "id": "step1",
      "formula": "¬S",
      "justification": "Simp",
      "from": ["¬S∧C"]
    },
    {
      "id": "step2",
      "formula": "¬W",
      "justification": "M.P.",
      "from": ["¬S", "¬S→¬W"]
    }
  ]
}
```

### Translation JSON (Gemini returns this)
```json
{
  "english": "If it rains then the ground is wet",
  "formal": "R → W",
  "breakdown": [
    { "symbol": "R", "meaning": "It rains" },
    { "symbol": "W", "meaning": "The ground is wet" },
    { "symbol": "→", "meaning": "If...then (material implication)" }
  ]
}
```

---

## SVG Renderers

### Proof Tree Renderer (`ProofTreeCanvas.jsx`)
Renders the V-connector diagram from Image 1.
Each step is a node. Lines connect premises to conclusion using V-shapes.
Layout: topological sort, steps arranged top-to-bottom.
Justification label (M.P., Simp, etc.) sits at the V-junction.

### Tableaux Tree Renderer (`TableauxCanvas.jsx`)
Renders the branching tree from Image 3.
Formulas stack vertically per branch.
Branches split horizontally (β rules).
Closed branches end with ✗ (red), open branches end with ○ (green).
The rules reference panel (from Image 2) is rendered as a fixed sidebar or overlay.

### Resolution Renderer (`ResolutionCanvas.jsx`)
Renders the V-connector diagram from Image 4.
Each resolved clause is a node. V-shapes show which two parent clauses resolved.
The resolved literal is labelled at the junction.
Knowledge base panel shown on the right.

All three canvases reuse pan/zoom logic (copy from ERDCanvas — do not import it).

---

## Rules Reference Panel

Location: `src/components/logic/RulesPanel/`

A collapsible side panel showing the full rules reference from Image 2 (tableaux rules)
and Image 5 (inference rules). Always accessible from the canvas view.
Toggle button: `?` icon, top-right of canvas. Slides in from the right.
Content: formatted table of all α/β rules for tableaux, and all inference rules.

---

## Routing

```
/logic/translate    → TranslatePage
/logic/proof        → ProofPage
/logic/tableaux     → TableauxPage
/logic/resolution   → ResolutionPage
```

Update `App.jsx` to add these four routes (lazy loaded).
Update sidebar `NavChildIcon` for Logic group to route to these pages
instead of showing a toast.

---

## Dynamic Island States for Logic

| Moment | State |
|---|---|
| User focuses pill input on any logic page | `observing` |
| Waiting for Gemini (translate, proof) | `waiting` |
| Algorithm running (tableaux, resolution) | `thinking` |
| Result ready | `idle` after 1s |

---

## Folder Structure

```
src/
├── pages/logic/
│   ├── TranslatePage.jsx
│   ├── ProofPage.jsx
│   ├── TableauxPage.jsx
│   └── ResolutionPage.jsx
│
├── components/logic/
│   ├── LogicInputPage/       ← shared input layout (pill + hero + symbol bar)
│   │   ├── LogicInputPage.jsx
│   │   └── LogicInputPage.module.css
│   ├── SymbolBar/            ← row of logic symbol buttons
│   │   ├── SymbolBar.jsx
│   │   └── SymbolBar.module.css
│   ├── RulesPanel/           ← collapsible reference panel
│   │   ├── RulesPanel.jsx
│   │   └── RulesPanel.module.css
│   ├── ProofTreeCanvas/      ← SVG renderer for natural deduction proof
│   │   ├── ProofTreeCanvas.jsx
│   │   └── ProofTreeCanvas.module.css
│   ├── TableauxCanvas/       ← SVG renderer for semantic tableaux
│   │   ├── TableauxCanvas.jsx
│   │   └── TableauxCanvas.module.css
│   ├── ResolutionCanvas/     ← SVG renderer for resolution method
│   │   ├── ResolutionCanvas.jsx
│   │   └── ResolutionCanvas.module.css
│   └── TranslationResult/    ← card showing translation output
│       ├── TranslationResult.jsx
│       └── TranslationResult.module.css
│
├── lib/logic/
│   ├── formulaParser.js      ← parses logic strings to AST
│   ├── tableauxEngine.js     ← semantic tableaux algorithm
│   ├── resolutionEngine.js   ← resolution algorithm + CNF conversion
│   ├── logicPromptBuilder.js ← builds Gemini prompts for translate + proof
│   └── logicParser.js        ← validates and parses Gemini JSON responses
│
└── engine/logic/
    ├── tableauxAnimationEngine.js   ← produces steps[] for tableaux animation
    └── resolutionAnimationEngine.js ← produces steps[] for resolution animation
```

---

## What Must NOT Be Touched

All B+ tree files, all ERD files, all Dynamic Island files, MusicPlayer, Starfield,
Sidebar (only `App.jsx` routing is updated, not Sidebar component files).
