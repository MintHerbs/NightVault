# digital-logic.md — Digital Logic Lab Specification

> Status: **All four phases shipped** (T-089), then reworked by
> [T-092](../../tickets/T-092-digital-logic-playground-and-input-language.md):
> the input layer moved onto the shared pill, the island was wired up, and the
> sandbox became a Logisim-shaped playground. See §11 for the phases and §14 for
> what T-092 changed.
> Subject: `computer-architecture` (CA). Route: `/arch/digital-logic`.

## Overview

One tool covering the four things a junior does in a digital logic / computer
architecture course, selected by a mode dropdown:

| Mode | Query param | Input | Output chain |
|---|---|---|---|
| 1. Boolean algebra | `?mode=algebra` | Expression | Named-law rewrite steps to a minimal form |
| 2. Truth table & K-map | `?mode=kmap` | Expression or minterm list | Truth table → K-map → minimal SOP/POS → circuit |
| 3. Circuit sandbox | `?mode=sandbox` | Direct manipulation | Live simulation + waveform |
| 4. State machine | `?mode=fsm` | English question | FSM → state table → excitation table → K-maps → circuit |

Modes 2 and 4 are pipelines that end in a circuit. Mode 3 is where that circuit
becomes editable and runnable. That handoff ("Open in sandbox") is the reason
this is one tool with a dropdown rather than four separate pages: the student
sees the same artifact carried through synthesis, then pokes at it.

**Only mode 4 calls an LLM**, and only for the English → FSM step. Everything
downstream of the FSM JSON is deterministic, testable code. Modes 1, 2 and 3
never touch the network.

This is distinct from [logic-tools.md](./logic-tools.md), which is propositional
logic for the AI subject (tableaux, resolution, natural deduction). Different
notation, different subject, different sidebar group. No shared code beyond
coincidence: do not try to reuse `src/lib/logic/formulaParser.js` here, the
notation conflicts (see [§2](#2-expression-notation)).

---

## 1. Placement and routing

Follows the de facto convention in the tree today (components under
`src/features/`, pure algorithms under `src/lib/<domain>/`), not the not-yet-
migrated target in [architecture-update.md §2](../architecture-update.md).

```
src/pages/arch/digital-logic/
  DigitalLogicPage.jsx          ← mode switch + stage orchestration only
  DigitalLogicPage.module.css

src/features/circuits/components/
  ModeSelect/                   ← the dropdown          (phase 1)
  ExpressionInput/              ← pill + symbol bar     (phase 1)
  StageRail/                    ← stage tabs            (phase 1)
  TruthTableView/               ←                       (phase 1)
  KMapView/                     ←                       (phase 1)
  MinimalFormView/              ← the expression stage  (phase 1)
  CircuitCanvas/                ← read-only netlist     (phase 1)
  CircuitErrorCard/             ← positioned parse error(phase 1)
  AlgebraStepsView/             ← named-law steps     (phase 4)
  StateDiagramView/             ← FSM bubbles         (phase 3)
  StateTableView/               ← state + excitation  (phase 3)
  FsmView/                      ← the whole FSM mode  (phase 3)
  CircuitSandbox/               ← the editable surface(phase 2)
  GatePalette/                  ←                     (phase 2)
  SandboxControls/              ← clock transport     (phase 2)
  WaveformPanel/                ← timing diagram      (phase 2)
  ExpressionField/              ← M3 filled text field
  md/                           ← M3 primitives (button, chip, segmented)

src/lib/circuits/
  expressionParser.js           ← digital notation → AST  (phase 1)
  truthTable.js                 ← + minterm shorthand     (phase 1)
  quineMcCluskey.js             ← PIs, essentials, covers (phase 1)
  kmapLayout.js                 ← Gray cells + rectangles (phase 1)
  circuitSynthesis.js           ← minimal form → netlist  (phase 1)
  circuitLayout.js              ← netlist → coordinates   (phase 1)
  flipFlops.js                  ← FF semantics + excitation (phase 2)
  simulator.js                  ← three-valued netlist sim   (phase 2)
  sandboxModel.js               ← document model + save/load (phase 2)
  fsmParser.js                  ← validates LLM FSM JSON     (phase 3)
  fsmSynthesis.js               ← FSM → excitation → netlist (phase 3)
  fsmPromptBuilder.js           ←                            (phase 3)
  fsmResponseSchema.js          ←                            (phase 3)
  fsmService.js                 ← client for /api/fsm        (phase 3)
  booleanLaws.js                ← the named rewrite rules    (phase 4)
  algebraSimplifier.js          ← best-first rewrite search  (phase 4)

Two files this spec named were not built. `circuitSerialization.js` folded into
`sandboxModel.js`, because the document model and its file format are the same
concern. `fsmScenarioGuard.js` was unnecessary: `erdScenarioGuard.js` already
rejects exactly the input that cannot be a question, and its thresholds needed
no change for FSM prompts, so duplicating it would have created two places to
keep in step.

api/
  fsm.js                        ← Vercel function, mirrors api/gemini.js
```

### Route registration

- `src/routes/academiaRoutes.jsx`: add `DigitalLogicPage` lazily, register
  `'/arch/digital-logic'` in `routeComponents`, add it to
  `preloadAcademiaRoutes()`.
- `src/components/layout/Sidebar/modules.js`: add a `'computer-architecture'`
  key to `MODULE_TOOLS` with one entry,
  `{ id: 'digital-logic', label: 'Digital Logic.js', route: '/arch/digital-logic' }`.
  `MODULE_ABBREV` already has `'computer-architecture': 'CA'`.

  **Precondition to verify before building:** since 2026-07-24 a Subject is a
  `sidebar_modules` DB row, not a code constant. A `MODULE_TOOLS` entry for a
  Subject with no DB row renders nothing. Confirm the `computer-architecture`
  row exists (and is not `hidden`) on both local and prod, or create it in the
  admin panel first.
- Mode lives in the query string (`?mode=kmap`), matching the Grade Toolkit
  precedent. Bare `/arch/digital-logic` defaults to `mode=kmap`, the mode most
  students arrive for. The mode is written to the URL on change so a mode is
  linkable and survives a refresh.

### Analytics

`src/lib/analytics/eventSchema.js`:

```js
TOOL_BY_ROUTE:  '/arch/digital-logic': 'digital-logic',
TOOL_EVENTS:    'digital-logic': ['open', 'mode-algebra', 'mode-kmap', 'mode-sandbox',
                                  'mode-fsm', 'solve', 'generate', 'manual', 'simulate',
                                  'to-sandbox'],
TOOL_LABELS:    'digital-logic': 'Digital Logic',
ROUTE_LABELS:   '/arch/digital-logic': 'Digital Logic',
```

`to-sandbox` is worth its own event: it measures whether the handoff that
justifies the single-tool design is actually used.

---

## 2. Expression notation

Digital logic notation is **not** the propositional notation used by
`src/lib/logic/formulaParser.js`, and the two collide badly. `AB` means
`A AND B` here and is a parse error there; `A'` is a complement here and
nothing there; `+` is OR here and would read as arithmetic anywhere else.
A separate parser is mandatory, not a preference.

### Accepted forms

| Operator | Accepted input | Canonical display |
|---|---|---|
| NOT | `A'`, `!A`, `~A`, `¬A`, `Ā` | `A'` |
| AND | `AB`, `A·B`, `A*B`, `A&B`, `A∧B` | `AB` |
| OR | `A+B`, `A\|B`, `A∨B` | `A + B` |
| XOR | `A^B`, `A⊕B` | `A ⊕ B` |
| XNOR | `A⊙B`, `!(A^B)` | `A ⊙ B` |
| NAND / NOR | only via `(AB)'` / `(A+B)'` | as written |
| Constants | `0`, `1` | `0`, `1` |

### Identifiers

A variable is **one letter plus optional digits**: `A`, `B`, `Q0`, `Q1`, `X2`.
This restriction is what makes implicit AND unambiguous: `ABQ0` tokenises to
`A · B · Q0` with no lookahead.

Multi-letter signal names are therefore **not supported, and cannot be**. An
earlier revision of this spec said they would be "rejected with an explicit
message"; that is not implementable, because `IN` is indistinguishable from
`I · N` and `ABC` is a perfectly ordinary three-variable product. There is no
test that separates the two cases. Juxtaposition always means AND, and the
safety net is the parenthesised echo below rather than a rejection.

The one genuine multi-letter case is the word operators, which **are**
recognised: `NOT`, `AND`, `OR`, `NAND`, `NOR`, `XOR`, `XNOR`, matched only at a
word boundary. `A NAND B` is a NAND; `ANDB` has no boundary after `AND` and
falls through to `A · N · D · B`.

### Precedence

`NOT` > `AND` > `XOR`/`XNOR` > `OR`, left-associative. Postfix `'` binds to the
immediately preceding atom or parenthesised group, so `(A+B)'` complements the
sum and `A+B'` complements only `B`.

Textbooks disagree on where XOR sits. The parser therefore **echoes a fully
parenthesised rendering of what it understood** back to the student above the
result. If they meant something else it is visible immediately, which is
cheaper than being right by convention and wrong for that student's lecturer.

### Minterm-list input

Mode 2 also accepts the exam shorthand directly:

```
F(A,B,C,D) = Σm(0,1,2,5,6,7) + Σd(8,10,11,15)
F(A,B,C) = ΠM(0,3,5)
```

ASCII forms `Sm(...)`, `Sum m(...)`, `d(...)`, `PM(...)` are accepted too. This
path skips the parser and constructs the truth table directly, and it is how
don't-cares enter mode 2 (there is no expression syntax for a don't-care).

### AST

```js
{ type: 'var',   name: 'A' }
{ type: 'const', value: 0 | 1 }
{ type: 'not',   child: node }
{ type: 'and' | 'or' | 'xor', operands: [node, ...] }   // n-ary, ≥ 2
```

AND/OR/XOR are **n-ary**, unlike the binary shape in `src/lib/logic/`. Absorption
and combining rules read over a whole product term at once, and forcing them
through a binary tree means re-associating before every rule match. The parser
flattens associatively as it builds (`A(BC)` → one 3-operand `and`).

Errors carry `{ message, position, hint }` the same way `formulaParser.js` does,
so `FormulaErrorCard` styling can be mirrored (copy it, do not import across
features).

---

## 3. Truth table

`src/lib/circuits/truthTable.js`

```js
buildTruthTable(ast) → {
  vars: ['A', 'B', 'C'],          // sorted, MSB first
  rows: [{ minterm: 0, inputs: [0,0,0], output: 0 | 1 | 'x' }, ...]
}
```

Variables are sorted alphabetically and the first is the MSB, which is what
every textbook does and what makes row index equal minterm index. Rows count up
in binary. `output: 'x'` only ever comes from the minterm-list path.

Cap at **8 variables** (256 rows). Above that the K-map is meaningless anyway
and the UI would be a wall of numbers; reject with a message naming the limit.

`TruthTableView` highlights the row under the cursor and the matching K-map cell
at the same time. That cross-highlight is the single most useful thing in mode 2:
the mapping from row to cell is exactly what students get wrong.

---

## 4. K-map and minimisation

`src/lib/circuits/quineMcCluskey.js`, `src/lib/circuits/kmapLayout.js`

The K-map is the **display**; Quine–McCluskey is the **engine**. Grouping by
scanning the drawn map for rectangles is where naive implementations go wrong,
because the map wraps in both axes and greedy rectangle-finding misses minimum
covers. Compute prime implicants algebraically, then project each selected one
back onto the map as a highlight.

### Algorithm

1. **Prime implicants** by Quine–McCluskey over minterms **plus don't-cares**.
   Don't-cares participate in combining, which is the whole point of them.
2. **Essential prime implicants**: any PI that is the sole cover of some
   minterm. Don't-cares are *not* obligations, so a PI that only covers
   don't-cares is never essential and never required. Getting this backwards
   produces a correct-looking but non-minimal answer.
3. **Minimum cover** of the remaining minterms by Petrick's method, which
   yields *all* minimum covers, not one.
4. **Cost**: fewest product terms first, then fewest total literals. State this
   in the UI, because a different tie-break gives a different "minimal" answer
   and the student will otherwise think one of the two is broken.
5. **POS**: run the identical pipeline over the zeros of the function, then
   complement each resulting term (De Morgan). Don't-cares stay don't-cares.

### Multiple minimal solutions

Common, and worth surfacing rather than hiding. When Petrick returns more than
one cover at equal cost, `KMapView` shows "3 equally minimal groupings" with a
selector. A student whose answer differs from a tutor's is usually looking at
an alternative minimum, and showing that directly is more instructive than
either answer alone.

### Group colours

Every group gets its own colour while the palette lasts, and only repeats past
eight. Colouring purely to resolve overlaps is the textbook graph-colouring
answer and it is wrong here: three disjoint groups all come out colour 1, and
the legend beside the map stops being matchable to it, which is the only reason
the colours exist. When the palette does run out, the repeat lands on a colour
no *overlapping* group is using, since two boxes sharing a cell in one colour
read as a single group.

### Layout

| Vars | Grid | Notes |
|---|---|---|
| 2 | 2×2 | |
| 3 | 2×4 | Columns in Gray order `00 01 11 10` |
| 4 | 4×4 | Rows and columns both Gray |
| 5 | two 4×4 maps | Grouping across the two halves must be drawn as a linked pair |
| 6+ | not offered | Falls back to truth table + minimal expression only, with a note |

`kmapLayout.js` returns, per selected implicant, a list of **rectangles** rather
than one: a group that wraps an edge (or the four-corner group) is one implicant
occupying two or four disjoint rectangles on screen. Emitting a single bounding
box for those draws a highlight over cells the group does not contain.

No returned rectangle may run off the edge of the grid either. A rectangle that
wrapped would be un-drawable as a single `<rect>`, so the wrap is cut here
rather than in every renderer. `kmapLayout.test.js` asserts both halves of that
contract by expanding the rectangles back into cells, for every cube at every
supported width, and requiring an exact match with the cube.

### Tests

`quineMcCluskey.oracle.test.js` runs **exhaustively over all 65 536 functions of
4 variables** (no don't-cares) and asserts, for each:

- the minimised SOP is logically equivalent to the original truth table, and
- its cost equals a brute-force search over all covers built from the PI set.

That is a complete proof of the engine at n=4 and runs in seconds. Functions
with don't-cares (3^16 combinations) are seeded-fuzz sampled instead, checked
for equivalence on the care set only.

---

## 5. Mode 1 — Boolean algebra

`src/lib/circuits/booleanLaws.js`, `src/lib/circuits/algebraSimplifier.js`

The student needs the *named laws*, not just the answer. A truth-table
minimiser gives the destination with no route, and the route is the marked part
of the exam question.

### Approach

Best-first rewrite search over a rule set, scored by (literal count, term
count), with a node budget. Each applied rule emits a step:

```js
{ from: 'AB + AB\'', to: 'A', law: 'Combining', lawStatement: 'XY + XY\' = X',
  highlight: { fromSpan: [0, 9], toSpan: [0, 1] } }
```

The `highlight` spans drive the diff rendering in `AlgebraStepsView`: the
rewritten sub-expression pulses in place rather than the whole line changing.

### Rule set

Identity, Null, Idempotent, Inverse, Involution (double negation),
Commutative, Associative, Distributive (both directions), De Morgan's (both
directions), Absorption (`X + XY = X`), Combining (`XY + XY' = X`), Consensus
(`XY + X'Z + YZ = XY + X'Z`), and Redundancy. Named to match the textbook table
(Identity/Null/Idempotent/Inverse/Commutative/Associative/Distributive/
Absorption/De Morgan's) the course teaches from — Commutative and Associative
never appear as their own step because the AST already treats reordered/
regrouped operands as the same node (`same()` in booleanLaws.js), so there is
no rewrite to name.

Distributive and De Morgan are bidirectional, which is what makes the search
space large; the node budget plus the cost-ordered frontier is what keeps it
bounded.

### Honesty about the result

The search is not guaranteed to reach the algebraic minimum. So:

1. Run Quine–McCluskey on the same expression to get the true minimal SOP.
2. If the rewrite path reached it, show the steps and mark the end confirmed.
3. If it did not, **show the steps it found, then show the QM minimal form
   separately**, labelled as "minimal form (via K-map)" with a note that no
   short algebraic path was found.

Never present a non-minimal result as final, and never invent a step. The
tableaux engine's oracle test set the precedent for verifying a derived answer
against an independent method; the same applies here, at runtime rather than
only in tests.

### Invariant

**Every step preserves the truth table.** `algebraSimplifier.fuzz.test.js`
generates random expressions, runs the simplifier, and asserts the truth table
after each individual step equals the truth table before it. A rule with a typo
in it is caught on the first fuzz seed rather than by a student.

---

## 6. Mode 3 — Circuit sandbox

`src/lib/circuits/simulator.js`, `src/lib/circuits/flipFlops.js`

A Logisim-shaped editor, deliberately narrower: **1-bit wires only**, no buses,
no splitters, no subcircuits, no memory blocks. That covers everything in the
course and removes most of what makes Logisim hard to build.

### Components

| Category | Items |
|---|---|
| I/O | Input pin (click to toggle), Output probe, Clock, Constant 0 / 1 |
| Gates | AND, OR, XOR, NAND, NOR, XNOR, NOT (2–4 inputs, configurable) |
| Flip-flops | D, JK, SR, T |

### Signal values

Three-valued: `0`, `1`, `X` (undriven). An input pin that was never wired is `X`,
not `0`, and a gate with any `X` input outputs `X` and renders grey. Defaulting
undriven pins to `0` makes a half-wired circuit look like it works, which is the
exact bug the student is trying to find.

### Evaluation

Combinational logic is evaluated event-driven: changed nets go on a queue,
downstream gates re-evaluate, repeat until quiescent. Feedback loops (a ring
oscillator, or an SR latch released from `S=R=1`) will not settle, so the loop
carries an **iteration cap of 100 passes**; on exceeding it, simulation stops
and the oscillating nets are flagged in the UI. It must report instability, not
freeze the tab.

### Clocking

Flip-flops are **edge-triggered**, updated in two phases per rising edge:

1. Sample every flip-flop's data inputs against the *current* settled net values
   and compute each next state.
2. Commit all `Q` outputs simultaneously, then re-settle the combinational logic.

Committing one flip-flop at a time is the classic defect here: a shift register
built that way collapses to a single stage, because stage 2 sees stage 1's new
value on the same edge. `simulator.test.js` uses a 4-bit shift register as the
regression fixture for exactly this.

### Flip-flop semantics

| Type | Next state |
|---|---|
| D | `Q⁺ = D` |
| T | `Q⁺ = T ⊕ Q` |
| JK | `00` hold, `01` reset, `10` set, `11` toggle |
| SR | `00` hold, `01` reset, `10` set, `11` **invalid** |

`S=R=1` is not given a defined next state. The flip-flop renders in an error
state and the simulation flags it. Quietly picking a value teaches the student
that the forbidden state is fine, which is the opposite of the lesson.

Asynchronous preset/clear are out of scope for v1.

### Controls

Manual step (one clock edge), free-run at 1 / 2 / 4 / 8 Hz, reset all
flip-flops. Reuse the transport-bar shape and speed-selector idiom from
`LogicStepControls` rather than inventing a second one, but keep it a separate
component: the semantics differ (real time, not a pre-computed `steps[]` array).

### Waveform panel

A rolling timing diagram of every input pin, flip-flop `Q`, and output probe over
the last 32 clock cycles, aligned to the clock. This is the payoff for building
a simulator at all: it is how a student checks a sequence detector actually
detects the sequence, and it turns "my counter is wrong" into a visible edge.

### Editing

- Click an output port, drag, release on an input port to wire. Orthogonal
  routing with a single mid-bend.
- An input port accepts one wire; a second connection to it is refused with a
  "short circuit" message rather than silently overwriting.
- An output port fans out freely.
- Marquee select, drag to move, `Delete` to remove, `Ctrl+Z` / `Ctrl+Shift+Z`
  undo/redo over add / delete / move / wire.
- Pan and zoom copied from `ERDCanvas` (copied, not imported, per
  [logic-tools.md](./logic-tools.md) precedent).

### Persistence

`circuitSerialization.js` writes `{ version, components[], wires[] }`. Autosave
to `localStorage` per browser, plus explicit export/import of the same JSON as a
file. No server storage: circuits are scratch work, and keeping them local
avoids a table, a policy, and an owner-session problem for zero gain.

The serialised shape is also the **handoff format** from modes 2 and 4.

---

## 7. Mode 4 — State machine

### Split of responsibilities

The LLM returns **only the FSM**. It does not produce state assignments,
excitation tables, K-maps, or circuits: those are deterministic given the FSM,
and code that can be tested beats a model that can be plausible. This is the
proposal in the original brief and it is the right split.

### Endpoint

`api/fsm.js`, structurally a copy of `api/gemini.js`: POST a *question*, never a
prompt, so it cannot be used as a general LLM proxy on the project's quota.
Same pinned model, same `temperature: 0`, same structured-output-then-retry-
without-schema fallback, same rule that only responses which parse get cached.

**Quota (shipped, and simpler than this spec first proposed):**
`api/_lib/erdQuota.js` was ERD-specific, so it became
`api/_lib/generationQuota.js` taking a `tool` key.

The spec originally called for a `tool` column on the quota and cache tables.
That turned out to be unnecessary: both keys are opaque SHA-256 digests, so
namespacing the *input* to the hash separates the tools completely while the
existing `erd_check_and_increment` RPC and `erd_cache` table carry on unchanged.
**No migration, no DDL, nothing to verify against prod** — which given prod has
no migration tracking and `db:migrate` is blocked on the 0024 drift is a
materially better trade than the column.

ERD's own hash inputs are left byte-identical, so the move did not cold-start
its cache or reset anyone's in-flight rate window. `api/_lib/erdQuota.js`
remains as ERD's binding of the shared module, so no call site can forget the
`tool` argument and silently share FSM's allowance.

The client mirrors `geminiService.js`: same `TERMINAL_CODES` / `INPUT_CODES`
split, same markdown-fence stripping, same fall-through to a manual
copy-the-prompt / paste-the-JSON flow when generation is unavailable. Students
revise on trains; the tool must not hard-fail when `/api` is not reachable.

`fsmScenarioGuard.js` mirrors `erdScenarioGuard.js` with the same loose
thresholds and the same client-checks-first / server-is-authority arrangement.

### FSM JSON

```json
{
  "title": "101 sequence detector, overlapping",
  "machineType": "moore",
  "inputs":  [{ "name": "X", "description": "serial input bit" }],
  "outputs": [{ "name": "Z", "description": "high when 101 seen" }],
  "reset": "S0",
  "states": [
    { "id": "S0", "label": "no match", "output": { "Z": 0 } },
    { "id": "S1", "label": "saw 1",    "output": { "Z": 0 } },
    { "id": "S2", "label": "saw 10",   "output": { "Z": 0 } },
    { "id": "S3", "label": "saw 101",  "output": { "Z": 1 } }
  ],
  "transitions": [
    { "from": "S0", "to": "S1", "input": { "X": 1 } },
    { "from": "S0", "to": "S0", "input": { "X": 0 } }
  ]
}
```

Moore machines put `output` on states; Mealy machines put it on transitions.
Both are accepted and `machineType` says which to read.

`fsmResponseSchema.js` follows the `erdResponseSchema.js` conventions: only
`type` / `properties` / `items` / `required` / `enum` / `description`, no
`anyOf`, no `$ref`, and the enum lists imported from `fsmParser.js` so schema and
validator cannot drift.

**Do not over-constrain.** The ERD experiment on 2026-07-31 showed the
cardinality enum was itself blocking correct ternary relationships: the prompt
was not the ceiling, the schema was. Concretely here: do not cap the state count,
do not restrict `inputs` to a single signal, and do not enum the state ids.

### Validation (`fsmParser.js`)

Beyond shape:

- `reset` names a real state.
- Every state is reachable from `reset`. Unreachable states are reported as a
  warning, not an error, and are excluded from encoding.
- **Determinism**: no two transitions leave the same state on the same input
  combination.
- **Completeness**: every state has a transition for every one of the `2^|inputs|`
  input combinations. An incomplete FSM cannot be synthesised. Report the
  specific missing `(state, input)` pairs so the student can see what the model
  left out, and offer "treat missing transitions as self-loops" as an explicit
  one-click repair rather than doing it silently.

### Synthesis (`fsmSynthesis.js`)

1. **State reduction** (implication table / partition refinement). Computed and
   *offered*, never applied automatically: if the question asked for the machine
   as specified, silently merging equivalent states changes the answer. Shown as
   "S2 and S5 are equivalent — merge?".
2. **State assignment**: `ceil(log2(n))` flip-flops. Binary (default), Gray, or
   one-hot, user-selectable, with the assignment table shown.
3. **Flip-flop type**: D (default), JK, T, or SR, user-selectable.
4. **Excitation table** from each `Q → Q⁺` transition:

   | Q → Q⁺ | D | T | J | K | S | R |
   |---|---|---|---|---|---|---|
   | 0 → 0 | 0 | 0 | 0 | X | 0 | X |
   | 0 → 1 | 1 | 1 | 1 | X | 1 | 0 |
   | 1 → 0 | 0 | 1 | X | 1 | 0 | 1 |
   | 1 → 1 | 1 | 0 | X | 0 | X | 0 |

   JK and SR generate **don't-cares**, which flow straight into the K-map engine
   from [§4](#4-k-map-and-minimisation). That is precisely why don't-care handling
   there is not optional, and why JK/SR designs come out cheaper than D designs
   in the comparison the tool can now show for free.
5. **One K-map per flip-flop input**, plus one per output signal. Same engine,
   same rendering, same alternative-minimum reporting as mode 2.
6. **Netlist**: flip-flops plus the minimised next-state logic plus the output
   logic, through the same `circuitSynthesis.js` as mode 2.

### Closing the loop

`fsmSynthesis.oracle.test.js`: for each fixture FSM, synthesise the circuit,
run it in `simulator.js` against random input sequences, and assert the
circuit's outputs match the FSM's own transition and output function step for
step, for every combination of encoding and flip-flop type.

This is the highest-value test in the spec. It checks the excitation tables, the
K-map minimisation, the synthesis, the encoding, and the simulator against each
other in one assertion, and it is the only thing standing between a student and
a confidently wrong circuit.

---

## 8. Circuit rendering and synthesis

`src/lib/circuits/circuitSynthesis.js`, `src/lib/circuits/circuitLayout.js`

### Netlist

```js
{
  components: [{ id, kind: 'and'|'or'|'not'|'xor'|'dff'|'input'|'output'|'clock',
                 label, inputs: [portId], outputs: [portId] }],
  wires: [{ from: portId, to: portId }]
}
```

The same shape the sandbox serialises, so "Open in sandbox" is a direct handoff
with no conversion layer, and so `CircuitCanvas` (read-only) and
`CircuitSandbox` (editable) render from one structure.

### Forms

Minimal SOP renders as inputs → inverter bank → one AND per product term → a
single OR. Offer a **NAND-only** toggle (and NOR-only for POS), since "implement
using NAND gates only" is a standard exam instruction and the transformation is
mechanical.

### Layout

Layered left-to-right by longest-path depth, vertically ordered to minimise wire
crossings, orthogonal routing with wires bundled per layer gap. Reuse the pan and
zoom behaviour from `ERDCanvas`.

---

## 9. Shared UI

### Mode navigation

**Superseded.** This originally specified a dropdown top-left of the input area.
It is now `LabNavbar`: a top bar carrying back, the tool name, a mode tablist and
a right-hand action slot. Four modes are four places, and a dropdown framed them
as a setting on the current page.

`ModeSelect.jsx` survives as the `MODES` table and its helpers — the navbar, the
route guard and the not-built-yet panel all read from it — but the component
itself is no longer rendered anywhere.

Switching modes clears mode-specific state but keeps the typed expression where
it is meaningful, so a student can build a truth table in mode 2 and switch to
mode 1 to see the algebra for the same expression without retyping.

### Symbol bar

Same pattern as `SymbolBar` in `src/features/logic/components/` (insert at cursor
via `setRangeText`, input ref exposed by the pill), different symbols:
`'` `+` `·` `⊕` `(` `)` `Σm` `Σd`.

### Stage rail

Modes 2 and 4 produce a chain of artifacts. `StageRail` is a horizontal tab strip
across the top of the result area:

```
Truth table  ›  K-map  ›  Expression  ›  Circuit
```

Stages unlock progressively, one click at a time, so the student works the
problem in the order the exam asks for it. An "Show all" control jumps to the
end for anyone who just wants the answer. Every stage is independently
re-openable; nothing is destroyed by moving forward.

### Dynamic Island states

| Moment | State |
|---|---|
| Input focused | `observing` |
| Algorithm running (modes 1, 2, and FSM synthesis) | `thinking` |
| Waiting on `/api/fsm` | `generating` |
| Sandbox free-running | `thinking` for as long as it runs |
| Result ready | `idle` after 1s |

The sandbox row **reverses** what this spec originally said (`idle`, do not hold
a state for the whole run). Owner decision, T-092 follow-up: pressing Run should
say something, and a circuit ticking at 2Hz genuinely is being computed. The
cost is real and accepted — a non-idle island suppresses chat notifications, so
a long run is a quiet period.

The island also **moves** in sandbox mode: `src/hooks/useIslandDock.js` parks it
in the bottom-right corner, because the full-screen canvas needs the top centre
for its own navbar. It returns to the top on leaving.

Wired through `src/hooks/useAIState.js` (T-092), which owns both the stable
setter and the minimum dwell. The dwell is the load-bearing part here: `analyse()`
returns in single-digit milliseconds, so setting `thinking` and clearing it in
the same block paints nothing. `docs/rules.md` §15 is the general rule.

### Design tokens

Accent from `--color-accent`, `--color-orange` for the CA group active state
(matching the Database and Logic groups), surfaces from `--color-surface`,
borders from `--color-border`. No new raw hex. K-map group colours are the one
place needing a new palette: define it as a token set in `global.css`, validated
for contrast in both light and dark, not as literals in the component.

---

## 10. Testing

`npm run test:circuits`. Phase 1's six suites are in place; later phases append
to the same script.

| Suite | Asserts | |
|---|---|---|
| `expressionParser.test.js` | Implicit AND, postfix complement, overbars, word operators, precedence, canonical-form round trip, position and hint on every parse error | ✅ |
| `truthTable.test.js` | Row index equals minterm index, MSB ordering, the Σm/ΠM/Σd shorthand including ranges, and the `M(A+B)` disambiguation | ✅ |
| `quineMcCluskey.oracle.test.js` | All 65 536 four-variable functions against three independent references: a 3^n cube scan for the prime implicants, direct table comparison for equivalence, and iterative-deepening subset search for the cost. Seeded fuzz for don't-cares and POS | ✅ |
| `kmapLayout.test.js` | Gray adjacency including wrap, and the rectangle contract: for every cube at every supported width, the enclosed cells equal the cube exactly and no rectangle runs off the edge | ✅ |
| `circuitSynthesis.test.js` | Every synthesised circuit simulated by a from-scratch evaluator across its whole input space, both forms, both gate styles, plus structural checks (no unconnected pin, no doubly-driven pin) | ✅ |
| `circuitLayout.test.js` | No overlapping boxes, wires meeting their pins exactly, every segment axis-aligned, no wire doubling back | ✅ |
| `simulator.test.js` | 4-bit shift register (simultaneous commit), mod-8 counter, SR `11` flagged invalid, a forced ring reported unstable rather than hanging, and three-valued gates | ✅ |
| `sandboxModel.test.js` | One driver per pin, placement never overlaps, serialisation refuses malformed files, and the "Open in sandbox" copy behaves identically to the circuit it came from | ✅ |
| `fsmSynthesis.oracle.test.js` | 4 machines × 3 encodings × 4 flip-flop types: each synthesised circuit simulated against its own FSM for 40 random cycles | ✅ |
| `algebraSimplifier.fuzz.test.js` | Truth table preserved across every individual rewrite step, ~6k rewrites and 700 full runs; every law proven to fire | ✅ |
| `gateShapes.test.js` | Every gate's outline distinguishable from every other's, with the kind name excluded from the signature | ✅ |
| `propagation.test.js` | The sweep is display-only — the same netlist settles identically with and without a plan — and the timing stays inside its cap at every depth from 1 to 1000 | ✅ |
| `wireRouting.test.js` | Every segment axis-aligned, endpoints exact, a backward route clear of the band between its pins, and no corner rounded past what its segments can spare | ✅ |
| `binarize.test.js` | ~950 synthesised circuits, both forms and both styles, run over the full truth table before and after the rewrite; no gate wider than two survives; a single-kind circuit gains no new kind | ✅ |
| `circFormat.test.js` | A b-tree `.circ` round-trips byte for byte; the same file with its embedded copy stripped is reconstructed from coordinates alone, fan-out included; malformed and unsupported files are refused with a sentence | ✅ |
| `sandboxRobustness.test.js` | 60 random edit sequences over 2 400 operations; 220 combinational circuits against a topological-order reference; 120 sequential networks against a sample-then-commit reference | ✅ |

Note: `db:migrate` is currently blocked by 0024 drift and prod has no migration
tracking, so validate the quota-table migration with PGlite (running the real
`db/sql/*.sql`) before it goes near an environment.

---

## 11. Phasing

Each phase is independently shippable and each leaves the tool usable.

| Phase | Contents | Why here |
|---|---|---|
| **1** ✅ | Parser, truth table, Quine–McCluskey, K-map, SOP/POS, circuit render. Mode 2 only; dropdown present with the other three greyed | The engine every other mode depends on. Also the single most-used mode |
| **2** ✅ | Circuit sandbox (mode 3), plus "Open in sandbox" from mode 2 | The headline feature, and independent of modes 1 and 4 |
| **3** ✅ | FSM (mode 4): endpoint, quota split, parser, synthesis, and the oracle test | Needs phase 1's K-map engine and phase 2's simulator for its oracle test |
| **4** ✅ | Boolean algebra steps (mode 1) | The only mode whose result can be approximated by another mode (QM gives the destination without the route), so it is the safest to defer if the search proves fiddly |

Phase 1 alone is a useful tool. Phases 1 and 2 together are most of the value.

---

## 12. Scope boundaries

Not in v1, and deliberately:

- Multi-bit buses, splitters, subcircuits, ROM/RAM, adders as primitives
- Asynchronous preset/clear on flip-flops
- Propagation delay modelling or gate-level timing analysis
- Hazard and glitch detection
- 6+ variable K-maps
- Verilog/VHDL export
- Server-side circuit storage or sharing

## 13. What must not be touched

All B+ tree, ERD, Complexity, Recurrence, propositional-Logic, Chat, Dynamic
Island, MusicPlayer and Starfield files. The only edits outside the new
directories are: the route table in `academiaRoutes.jsx`, one `MODULE_TOOLS`
entry in `modules.js`, the four analytics maps in `eventSchema.js`, the K-map
colour tokens in `global.css`, one `package.json` script, and the
`erdQuota.js` → `generationQuota.js` generalisation.

**Amended by T-092.** Two files on that list were changed after all, both
additively and both because the rule this spec was written under turned out to
be the wrong rule:

- `src/components/ui/PillInput/PillInput.jsx` gained an optional controlled
  `value` prop. `value === undefined` is byte-for-byte the previous behaviour, so
  the five existing call sites are untouched. This is what §14 below required:
  extend the shared input rather than fork it.
- `src/components/layout/DynamicIsland/ThinkingAnimation.jsx` changed pattern and
  colour, so local computation stops looking identical to a queued wait.

---

## 14. T-092 — input language and the playground

Five changes, filed together because the first two are app-wide rules and the
last three are one surface.

### Shared input, not a bespoke one

T-089 shipped its own filled text field. Every other question-asking tool uses
`src/components/ui/PillInput/PillInput.jsx`, and nothing in `docs/rules.md` said
which to use — so the drift was the rules' gap as much as the tool's. Both the
expression modes and the FSM mode are now on the pill, with the same
title / subtitle / pill stack `ERDStep1` uses. `docs/rules.md` §14 is the rule.

The symbol bar and example chips stay. They are affordances *around* the input,
not a second input; the pill is driven controlled so the symbol bar can insert at
the caret.

### The island reacts

`src/hooks/useAIState.js` owns the stable setter and the minimum dwell. See §9.
`docs/rules.md` §15 is the rule.

### Gate silhouettes are shared

`src/lib/circuits/gateShapes.js` holds the geometry both canvases draw from. It
was private to `CircuitCanvas`, which is why the editable sandbox shipped drawing
every component as an identical rounded rectangle. Inputs, probes, constants,
clocks and flip-flops get their own shapes too; the sandbox now looks like a
schematic rather than a block diagram.

`gateShapes.test.js` asserts the seven gates are distinguishable by drawn
geometry with the kind name excluded from the comparison — a test that passed on
labels alone would fail.

### Current is animated, values are not staged

`src/lib/circuits/propagation.js` answers one question: in what order would a
signal reach each wire. `CircuitSandbox` uses that to stagger a travelling pulse
along the wires when the circuit runs or steps.

**The animation never gates a value.** The simulator settles to a fixed point
with no notion of time, and that is correct — its numbers must be right, not
gradual. An earlier design had the wavefront decide what each probe displayed,
which is defensible as gate delay but means the digit on screen is briefly not
the digit the simulator computed. A student debugging a circuit cannot afford to
wonder which one they are reading. The pulse is purely additive.

Capped at 1.4s however deep the circuit, and skipped entirely under
`prefers-reduced-motion`.

### Layout

- The page reserves the 56px sidebar rail above 969px. Without it a centred
  sandbox slid under the rail on anything narrower than ~1272px and its leftmost
  components were unclickable.
- The parts palette is a horizontal toolbar above the canvas, not a 168px left
  column — the Logisim arrangement, and 168px back for the canvas.
- The canvas sits on a 20px dot grid built from `--md-outline-variant`, and
  placement and dragging snap to the same 20px lattice `GRID` defines in
  `sandboxModel.js`. A visible grid components do not land on is worse than none.
- Right-click deletes, and carries the per-kind actions that were previously
  only reachable from the footer.

### Follow-up round

- **Full screen.** Mode 3 is a shell, not a panel: navbar, parts toolbar,
  transport, and a canvas that takes everything left over. The timing diagram
  moved from a drawer to a modal opened from the navbar.
- **The island moves and reacts.** See §9.
- **Only a 1 pulses.** A wire holding 0 carries no current, and animating it said
  the opposite of what the circuit was doing.
- **The circuit stage is editable in place.** `CircuitSandbox` has two variants:
  `full` fills its shell, `embedded` is a fixed-height panel inside another
  page's flow. The embedded copy runs with `persist={false}` — it is scratch
  space for one question, and autosaving it would overwrite the student's own
  sandbox.
- **Undo and redo autosave.** They did not, so a reload silently restored work
  that had been undone. Found by driving the real UI; no unit test in this
  project touches localStorage.

### Third round

- **The law leads each algebra step.** It was already named; it was a chip under
  the expression. The rule is what the exam marks, so it is the headline now.
- **The manual FSM flow is a three-step carousel**, matching ERD's: question →
  copy the prompt → paste the JSON, with pagination dots and the island driven
  at every stage. A generation failure drops into step 2 carrying its reason
  rather than leaving a dead end — which matters because `vite dev` serves no
  functions, so this is the normal path in development.
- **The sandbox has no Starfield.** The page was rendering one *on top of*
  App's global one — two animation loops for one background. App now suppresses
  its own for this mode, the same way it already does for ERD.
- **Nothing sits below the sandbox canvas.** File actions moved onto the
  transport row; messages float over the canvas.
- **Wiring is a drag.** Ports carry an 11px transparent hit disc over their 5px
  dot; pressing a driven input pin detaches its wire and picks it up, so
  re-routing is a gesture rather than delete-then-redraw. Drops are resolved by
  hit-testing the pointer against the port geometry, **not** by pointer capture:
  capturing on the source pin delivers the release to the source, so a dragged
  wire can never land.

### Robustness

`sandboxRobustness.test.js` is deliberately three suites in one file, because
"the sandbox works" means three different things:

1. **The model survives abuse.** Random edit sequences with every document
   invariant re-checked after each operation, and again walking the history
   backwards the way undo does.
2. **Combinational results are right.** Random gate DAGs compared against a
   reference that evaluates in topological order with its own restatement of the
   gate tables — a different algorithm from the simulator's fixed-point loop.
3. **Sequential results are right.** Random flip-flop networks against a
   reference stepper that samples every flip-flop before committing any.

Sharing the truth tables between the simulator and its reference would make the
comparison test the plumbing and nothing else, so both are written out twice on
purpose.

## 15. T-093 — the FigJam workbench

The sandbox stops being a panel with controls above it and becomes a canvas with
controls on it. Sandbox mode renders no `LabNavbar`, no global `Sidebar` and no
Starfield; `App.jsx` suppresses the last two on the same condition it already
used for the backdrop.

### Chrome

Three floating docks, all absolutely positioned inside the sandbox's own shell,
none of them in the flow:

| dock | position | contents |
|---|---|---|
| transport | top-left | back, run/pause, step, reset, undo, redo, delete, timing |
| files | top-right | export and import, both `.circ` |
| parts | bottom-centre | every placeable kind, icon-only, grouped |

There is no speed control. The free run is fixed at `RUN_HZ = 2`.

The parts dock caps its width at `min(760px, 100% - 300px)` so it can never
reach the dynamic island, which is docked bottom-right for this mode.

`DOCK_INSET` in `sandboxModel.js` is how both placement paths keep clear of the
transport dock: `nextFreePosition` starts its first row below it, and
`fromNetlist` offsets an incoming layout by it. A component laid out at y = 0
sits behind the controls and reads as missing.

The parts dock places two ways. A click lands at the next free spot — keyboard
reachable, touch reachable, and the fast path for a row of inputs. A drag lands
where it is dropped, carried by a fixed-position ghost, cancelled if released
over any `[data-dock]`.

### Connectors

`lib/circuits/wireRouting.js` is pure geometry with no React in it:
`elbowPoints` gives the polyline, `roundedPath` turns it into path data with
each corner rounded by at most half its shorter neighbour. Both the committed
wire and the connector in flight go through `routeWire`, so a gesture previews
the shape it will produce.

Three routing cases, and the third is the one a naive router gets wrong:

1. aligned and ahead — one straight segment;
2. ahead — out, across to a mid-x, over, in;
3. **behind** — a feedback wire whose target is to the *left* of its source
   detours to a lane below both endpoints. Routing case 2's mid-x there puts the
   vertical run through whatever sits between the two components, which for a
   feedback loop is always the gates the loop is made of.

Wires do **not** route around obstacles. Two components on the same row get a
connector straight through anything between them. That is a much larger
algorithm and FigJam does not do it either.

### Wiring is snapped, not aimed

`SNAP_RADIUS` is 26 and only *compatible* pins are candidates — different
component, opposite side. The nearest one captures the endpoint and lights up.
Filtering there rather than refusing later is what makes the highlight honest:
if a pin lights up, the drop works.

A drag may start at either end. Out→in and in→out build the same wire, because a
student aiming at a gate's pin and dragging back to a source is describing the
same connection.

Dropping on an occupied input calls `reconnect()`, which takes the old driver
off first. `connect()` still refuses a second driver and its tests are unchanged
— the one-driver rule is a property of a *document*, and a file that breaks it is
still broken. Only the gesture changed.

Two browser behaviours have to be suppressed for any of this to work, and both
present as "wiring works sometimes":

- **native drag-and-drop.** A `dragstart` on the SVG hands the pointer to the
  browser, which fires `pointercancel`. `onDragStart` preventDefault plus
  `user-select: none` on the surface.
- **capture on a re-rendered target.** Chromium cancels the pointer when a
  captured element is removed, and pressing a pin re-renders it. The gesture
  captures the **surface**, which is never re-created. This is not the capture
  T-092 removed: that one was on the source pin and broke the drop. The
  consequence is that the trailing `click` is delivered to the surface, so the
  surface ignores any click belonging to a gesture that started on something.

### No standing warnings

The `.notices` panel is gone. `documentWarnings()` still exists and is still
tested, but nothing renders its list: it returns one entry per component with a
loose pin, which is every component, continuously, while a circuit is being
built. A loose pin says so by being drawn hollow and dashed. A refusal is a
transient toast at the top of the canvas that clears itself after 3.2s.

### Colour

Inputs, clocks and constants are `--accent-blue`; probes are `--accent-green`;
gates stay on the neutral surface roles. These are the fixed data-viz colours
(`docs/design/colors.md`), which encode meaning on a canvas rather than brand, so
a source is blue under all nine accents. Use the `rgba(var(--x-rgb), 0.14)` form
for the tints — `rgb(var(--x-rgb) / 14%)` mixes comma and slash syntax, does not
parse, and falls back to opaque black.

A clock is clickable like an input and draws its level.

### Two-input gates

`lib/circuits/binarize.js` rewrites any gate wider than two inputs into a
cascade of two-input ones, and every synthesised netlist goes through it. The
contract is equivalence, checked by running both netlists over the whole truth
table rather than by inspecting the shape.

When the netlist is single-kind — the "NAND only" / "NOR only" styles — the
cascade is built from that kind alone, via `AND(a, b) = NAND(NAND(a, b),
NAND(a, b))`. Two gates per stage instead of one, which is the price of the
style; folding with plain AND cores would put an AND into a circuit whose entire
point was that it has none.

A gate placed by hand is still two-input and still widens by right-click.

### `.circ` files

`lib/circuits/circFormat.js` reads and writes Logisim project XML, with its own
minimal XML reader so it behaves identically in the browser and under plain node
(there is no test framework and no jsdom — §13).

Logisim derives every pin from one `loc`, which is the component's primary
output. The module reproduces that from a documented offset table, all multiples
of 10 so everything lands on Logisim's grid. It is our *model* of Logisim's
geometry, not a bit-exact reproduction: combinational circuits land correctly,
flip-flops may need nudging once opened.

Because that is a real risk, our own exports also carry the exact document in an
XML comment. A b-tree → b-tree round trip is byte-identical and never depends on
the geometry being right; Logisim ignores comments. A file from Logisim proper is
reconstructed structurally, building nets from wire segments — including
T-junctions, where a point lies on another segment's interior — and matching them
to computed pin coordinates.

Buses, splitters, tunnels, subcircuits and rotated components are refused by
name rather than half-read. Import still accepts the JSON T-089 and T-092 wrote,
because those files are on students' disks.
