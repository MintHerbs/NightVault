---
id: T-089
title: Build the Digital Logic Lab tool for the computer-architecture Subject
status: done
severity: medium
area: circuits
epic: none
created: 2026-08-01
---

## Summary

The `computer-architecture` Subject has no tool. Juniors taking it work four
things by hand with no way to check themselves: Boolean algebra simplification,
the expression → truth table → K-map → circuit pipeline, flip-flop circuits, and
question → state machine → circuit synthesis. Build one tool at
`/arch/digital-logic` covering all four, selected by a mode dropdown.

Full design in [docs/specs/digital-logic.md](../docs/specs/digital-logic.md).
This ticket tracks the whole build; the spec's §11 phases are the checklist
below.

## Evidence

- `src/components/layout/Sidebar/modules.js:45-58` — `MODULE_TOOLS` has entries
  for `algorithms`, `artificial-intelligence` and `database` only. No
  `computer-architecture` key, so the Subject renders as a greyed "coming soon"
  icon.
- `src/components/layout/Sidebar/modules.js:80` — `MODULE_ABBREV` already
  reserves `'computer-architecture': 'CA'`, so the breadcrumb slot exists and
  nothing else does.
- `src/lib/logic/formulaParser.js` cannot be reused: it parses propositional
  notation where `AB` is a parse error and `+` is not an operator. Digital logic
  needs implicit-AND juxtaposition and postfix complement.
- `api/_lib/erdQuota.js:22` — `HOURLY_LIMIT` is a single ERD-wide counter with
  no tool dimension, so a second generating tool would spend the ERD allowance.

## Impact

Without it, the CA Subject is an empty folder in the sidebar. With the K-map
engine specifically: a student checking a 4-variable minimisation by hand has no
way to discover that their answer is one of several equally minimal covers, which
is the most common source of "the tutor's answer differs from mine" confusion in
this course.

## Suggested fix

Per spec §11, four phases, each independently shippable:

1. Expression parser, truth table, Quine–McCluskey, K-map, SOP/POS, circuit
   render. Mode 2 (`?mode=kmap`) only; the other three modes present but
   disabled in the dropdown.
2. Circuit sandbox (mode 3) plus "Open in sandbox" handoff from mode 2.
3. FSM (mode 4): `api/fsm.js`, quota generalisation, parser, synthesis, oracle
   test.
4. Boolean algebra rewrite steps (mode 1).

Key constraints, all from the spec:

- Quine–McCluskey is the engine, the K-map is only the display. A wrapped group
  renders as several rectangles, never one bounding box.
- Don't-cares participate in prime-implicant generation but are never cover
  obligations, and a PI covering only don't-cares is never essential.
- Flip-flops sample all inputs then commit all `Q`s. Committing one at a time
  collapses a shift register to a single stage.
- Undriven nets are `X`, not `0`.
- SR with `S=R=1` is flagged invalid, never given a defined next state.

## Acceptance criteria

### Phase 1 — combinational pipeline (done 2026-08-01)

- [x] `expressionParser.js` handles implicit AND (`ABC`), postfix complement
      (`A'`, `(A+B)'`), overbars, word operators, and every documented
      ASCII/Unicode alias, with a positioned error carrying a hint.
      **Correction:** multi-letter identifiers cannot be rejected. `IN` is
      indistinguishable from `I · N` and `ABC` is a valid three-variable
      product, so no test separates them. Juxtaposition always means AND; the
      safety net is the parenthesised echo the page shows above the result
- [x] Minterm-list input (`F(A,B,C,D) = Σm(...) + Σd(...)`, `ΠM(...)`, ranges)
      builds a truth table directly, including don't-cares, and `M(A+B)` is
      still parsed as an ordinary product
- [x] `quineMcCluskey.oracle.test.js` passes over all 65 536 four-variable
      functions against three independent references (3^n cube scan for the
      prime implicants, direct table comparison, iterative-deepening subset
      search for the cost). 0 skipped over budget
- [x] K-map renders 2, 3 and 4 variables in Gray order; 5 as a linked pair;
      6+ falls back to table + expression with a note
- [x] Multiple equally minimal covers are surfaced with a selector, not hidden
- [x] POS path produces a correct product-of-sums from the zeros
- [x] Truth-table row ↔ K-map cell cross-highlight works both directions
- [x] Circuit renders from the minimal form, with a NAND-only toggle
- [x] Route, sidebar entry and analytics keys registered

### Phase 2 — sandbox (done 2026-08-01)

- [x] Every gate, pin, clock, constant and D/JK/SR/T flip-flop placeable and
      wireable; one driver per input pin, enforced with a message rather than a
      silent overwrite
- [x] `simulator.test.js` passes: 4-bit shift register, mod-8 counter, SR `11`
      flagged invalid, forced ring reported unstable rather than hanging.
      **Correction:** an *unforced* ring of inverters does not oscillate under
      three-valued semantics (NOT(x) is x, so all-unknown is a real fixed
      point). The oscillation fixture forces a definite value into the loop
      first; both behaviours are asserted
- [x] Undriven nets render as `X`, not `0`
- [x] Waveform panel shows the last 32 cycles aligned to the clock
- [x] Autosave to localStorage plus JSON export/import, with deserialisation
      refusing malformed, shorted and wrong-version files
- [x] "Open in sandbox" carries a circuit across with no conversion layer, and a
      test asserts the copy behaves identically to the original

### Phase 3 — FSM (done 2026-08-01)

- [x] `api/fsm.js` accepts a question (never a prompt), mirrors `api/gemini.js`
      structured-output-then-retry and cache-only-what-parses behaviour
- [x] `erdQuota.js` generalised to `generationQuota.js` with a `tool` key.
      **No migration was needed:** both keys are opaque SHA-256 digests, so
      namespacing the hash *input* separates the tools while the existing RPC
      and table are untouched. ERD's own inputs are byte-identical, so its cache
      and rate windows survived. Better than the column given prod has no
      migration tracking
- [x] `fsmParser.js` reports unreachable states as warnings, and refuses
      non-determinism and incompleteness with the exact `(state, input)` pair
      named
- [x] State assignment (binary / Gray / one-hot) × FF type (D/JK/T/SR) all
      selectable, excitation tables shown with don't-cares marked as free
- [x] `fsmSynthesis.oracle.test.js` passes: 48 designs (4 machines × 3 encodings
      × 4 flip-flops), each simulated against its own FSM for 40 random cycles
- [x] Manual copy-prompt / paste-JSON fallback works when `/api` is unreachable,
      verified in `vite dev` where serverless functions are not served

### Phase 4 — algebra (done 2026-08-01)

- [x] Each step names its law, states it in symbols, and shows which
      sub-expression was rewritten
- [x] `algebraSimplifier.fuzz.test.js` passes: ~6k individual rewrites and 700
      full runs, truth table checked after every step (not just end to end,
      which two compensating bugs would survive)
- [x] When the search does not reach the QM minimum, the steps found are shown
      in an outlined (not filled) container **and** the minimal form is shown
      separately, labelled as coming from the K-map
- [x] ~59% of random expressions reach the SOP floor algebraically. Note the
      floor is the minimal SOP, and Factoring and XOR legitimately go *below*
      it: A(B + C) is three literals where the minimal SOP AB + AC is four

### Cross-cutting

- [x] `npm run test:circuits` runs every suite above
- [ ] **`computer-architecture` `sidebar_modules` row confirmed present and not
      hidden on local and prod.** Still outstanding: the `MODULE_TOOLS` entry is
      in place, but a Subject is a DB row since 2026-07-24, so the sidebar entry
      does not appear until that row exists. The tool is reachable at
      `/arch/digital-logic` regardless
- [x] No new raw hex; K-map group colours are tokens in `global.css`. The `:root`
      block is declared *before* `[data-mode="light"]`, which has equal
      specificity and only wins by source order

### Notes from phase 1

- Two defects the tests caught that would have shipped otherwise: K-map
  rectangles could wrap off the grid edge (un-drawable as one `<rect>`), and the
  NAND-only form dropped its second-level gate for a single-term function, which
  inverted the output.
- One defect the screenshots caught: colouring K-map groups only to resolve
  overlaps gave three disjoint groups the same colour, making the legend
  unmatchable to the map.
- `src/lib/analytics/tracker.js` contains literal NUL bytes used as map-key
  separators (`key.split('\0')`). Pre-existing and functional, but it makes the
  file unsearchable with grep. Not touched here.

## Notes from phases 2 to 4

The UI was rebuilt on Material You partway through, using the existing `--md-*`
token set from T-062 rather than a parallel one, so all nine themes and both
modes follow for free. Two M3 roles were added: an error container (built from
the existing `--color-danger` pink, not M3's baseline red) and the eight-hue
K-map group palette. Both documented in `docs/design.md`.

Defects the tests caught that would otherwise have shipped:

- The first clock tick was swallowed. `previousClock` started unknown, so the
  first rising edge was `x -> 1` rather than `0 -> 1`: a shift register stayed
  empty for one press and then behaved, which reads as a wiring mistake.
- `Combining` fired on product terms containing a repeated variable, matching
  the wrong occurrence by name. `BB' + C'B` "simplified" to `1`.
- The search exited before exploring whenever the input already had the target
  literal count, so `A''` was declared finished without applying Involution.
- **`formatExpression` could emit text it could not itself read.** `and(A, 0)`
  rendered as `A0`, which the parser reads back as a *variable named A0*. Now a
  factor starting with a digit gets an explicit `·`.

One defect only screenshots caught: colouring K-map groups purely to resolve
overlaps gave three disjoint groups the same colour, making the legend
unmatchable to the map.

## References

- [docs/specs/digital-logic.md](../docs/specs/digital-logic.md) — full spec
- [docs/specs/logic-tools.md](../docs/specs/logic-tools.md) — the propositional
  logic tools this is deliberately **not** sharing code with
- `src/lib/erdParser.js`, `src/lib/geminiService.js`, `api/gemini.js` — the
  generation pipeline mode 4 mirrors
- T-078 — why the input gate is enforced server-side as well as client-side
