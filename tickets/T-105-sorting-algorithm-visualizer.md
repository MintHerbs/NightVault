---
id: T-105
title: Build a Sorting Algorithms visualizer that animates every comparison, pointer move and swap
status: done
severity: medium
area: algo
epic: none
created: 2026-08-03
---

## Summary

The app teaches trees, recurrences, tableaux and circuits, but has nothing for
sorting. Add a Sorting Algorithms tool: one CSV input, a Method dropdown and an
Ascending/Descending order control underneath it, and a canvas that animates the
chosen algorithm one atomic action at a time. Every `i` move, every `j` move,
every comparison, every three-part
swap through `temp`, every pivot placement and every recursive split is its own
addressable step, colour-coded and scrubbable, in the same shape as the B+ tree
animation.

The reference behaviour is the lecture presentation the owner was taught from
(screenshots supplied): Lomuto partition, pivot is the last element, `i` in
green, `j` in yellow, an explicit `temp` box below the array during a swap, and
recursion drawn as nested `quickSort( … )` frames with the less-than partition
in red and the greater-than partition in blue. That is the target for Quicksort;
the other five algorithms get the same treatment in their own pointer
vocabulary.

## The reference trace this must reproduce exactly

Input `2, 8, 4, 7, 1, 3, 9, 6, 5`, method Quicksort. Lomuto, `pivot = a[high]`,
`i` starts at `low - 1`, `j` scans `low … high-1`, and `if (a[j] <= pivot) { i++;
swap(a[i], a[j]) }`.

| j | a[j] | vs pivot 5 | i after | array after |
|---|---|---|---|---|
| 0 | 2 | ≤ | 0 | `2 8 4 7 1 3 9 6 5` (self-swap) |
| 1 | 8 | > | 0 | unchanged |
| 2 | 4 | ≤ | 1 | `2 4 8 7 1 3 9 6 5` |
| 3 | 7 | > | 1 | unchanged |
| 4 | 1 | ≤ | 2 | `2 4 1 7 8 3 9 6 5` |
| 5 | 3 | ≤ | 3 | `2 4 1 3 8 7 9 6 5` |
| 6 | 9 | > | 3 | unchanged |
| 7 | 6 | > | 3 | unchanged |
| — | — | place pivot: `swap(a[i+1], a[high])` | — | `2 4 1 3 5 7 9 6 8` |

`2 4 1 3 | 5 | 7 9 6 8` is the second supplied screenshot, cell for cell. If the
engine's first partition does not produce that array, the engine is wrong. This
row-by-row table is the acceptance oracle for the Quicksort trace, and a test
asserts it literally (see Tests below).

The same input in **descending** mode, where the only change is `a[j] >= pivot`:

| j | a[j] | vs pivot 5 | i after | array after |
|---|---|---|---|---|
| 0 | 2 | < | -1 | unchanged |
| 1 | 8 | ≥ | 0 | `8 2 4 7 1 3 9 6 5` |
| 2 | 4 | < | 0 | unchanged |
| 3 | 7 | ≥ | 1 | `8 7 4 2 1 3 9 6 5` |
| 4 | 1 | < | 1 | unchanged |
| 5 | 3 | < | 1 | unchanged |
| 6 | 9 | ≥ | 2 | `8 7 9 2 1 3 4 6 5` |
| 7 | 6 | ≥ | 3 | `8 7 9 6 1 3 4 2 5` |
| — | — | place pivot: `swap(a[i+1], a[high])` | — | `8 7 9 6 5 3 4 2 1` |

Giving `8 7 9 6 | 5 | 3 4 2 1`: everything left of the pivot is ≥ 5, everything
right of it is < 5, and the final sort is `9 8 7 6 5 4 3 2 1`. Note that `i` stays
at `-1` through the first comparison here, which is the "pointer has not entered
the frame yet" state the canvas has to be able to draw (see Canvas below). Both
tables are asserted literally.

Screenshot 1 is the frame where `i = 1` (on value 8, green), `j = 2` (on value 4,
yellow) and `temp` is about to hold 8. So the swap is not one step: the visitor
sees `temp ← a[i]`, then `a[i] ← a[j]`, then `a[j] ← temp`. That three-beat swap
is a hard requirement, not a nicety, because the `temp` variable is the thing the
lecture was actually teaching.

Screenshot 3 is the recursion display: frames stacked down the page, each labelled
`quickSort( … )`, each holding its own subarray, with already-placed pivots shown
outside the brackets.

## Evidence

Everything below already exists and constrains the design. Nothing here is new
infrastructure that has to be invented.

**The step/snapshot contract is established.** `src/engine/AnimationEngine.js:64`
(`snap`) and `:68` (`record`) build each step as a full deep clone of the
structure plus highlight fields, and `src/pages/tree/TreePage.jsx:51-54` renders
`player.currentStep.treeSnapshot` in preference to the committed tree. That is
why the tree's scrubber can run backwards correctly: no step has to be undone,
each one carries its own world. Sorting must carry a full `array` snapshot per
step for the same reason.

**The transport is shared and already fires island acks.**
`src/hooks/useAnimationPlayer.js:17-28` (`DEFAULTS`, including `maxTotalMs`),
`:67` (long runs get proportionally shorter steps), `:85` (reduced motion jumps
to the final frame), and `:100`–`:156` (`fireAck` for play, pause, step, skip,
rewind, speed). Building the sorting transport on this hook satisfies
`docs/rules.md §15.5` with no per-button work.

**There are already two copies of the transport bar.**
`src/features/tree/components/StepControls/StepControls.jsx` and
`src/features/logic/components/LogicStepControls.jsx` are the same component
twice, differing only in a verdict badge and CSS accent. A third copy would trip
`docs/rules.md §16.2`. See "Cuttable sub-task" below.

**The input surface pattern the owner asked for exists, but the reference
implementation breaks the rule.** `src/features/recurrence/components/
RecurrenceInput/RecurrenceInput.jsx:197-227` renders the Method dropdown below
the pill, which is exactly the layout wanted here. But that file is a bespoke
`<textarea>` (`:132-142`), not the shared pill, which `docs/rules.md §14.1` makes
mandatory. The sorting tool copies Recurrence's *placement* of the Method
selector while using `src/components/ui/PillInput/PillInput.jsx`. Do not copy
`RecurrenceInput`'s text field.

**Tool publication is a two-part registry with a known failure mode.**
`src/constants/tools.js:32-122` is the single registry, and the header comment at
`:24-31` records T-084 shipping a tool that was routable and on the home page but
absent from `/courses/computer-science` because a second id list was not updated.
The `courses:` key on the entry is now the only switch. `routeQuips.js` builds its
index from `TOOLS`, so a correct registry entry also buys the arrival quip.

**Multi-hue token precedent exists.** `src/styles/global.css:897-912` declares
`--kmap-group-1..8` with `-rgb` triplets and a light-mode restatement at `:927+`,
because a K-map needs colours that are told apart from *each other*, not from the
page. `docs/design.md` records the reasoning. A sorting canvas has the identical
requirement (i vs j vs pivot vs left vs right vs sorted), so it follows that
precedent rather than reaching for the theme accent.

**Tests are plain node scripts, not a runner.** `package.json:11-20`: `npm test`
chains `node <file>.test.js` per area. A new area gets its own `test:sorting`
script appended to the chain.

## Impact

Without this, the six algorithms in the syllabus have no visual anywhere in the
app, and the one the owner was actually taught (Quicksort with `i`, `j`, `pivot`
and `temp`) is the one that is hardest to follow from static lecture slides,
because the whole difficulty is *when* `i` advances relative to `j` and what the
array looks like between the three halves of a swap. A finished-array-only
renderer, or a renderer that treats a swap as one frame, teaches nothing that a
textbook diagram does not already.

## Scope: six algorithms

| Method id | Label | Pointer vocabulary |
|---|---|---|
| `quick` | Quicksort | `i` boundary, `j` scanner, `pivot` (last element), `temp`, recursion frames |
| `merge` | Merge Sort | split frames, then `i`/`j` into the two runs and `k` into the output row |
| `radix` | Radix Sort (LSD, base 10) | `digit` place marker, 10 bucket rows, collect pass |
| `bubble` | Bubble Sort | `i` pass counter, `j` scanner comparing `a[j]` with `a[j+1]`, `temp`, growing sorted tail |
| `insertion` | Insertion Sort | `i` sorted-prefix boundary, `j` walking back, `key` held in the `temp` box, shifts drawn as slides |
| `selection` | Selection Sort | `i` boundary, `j` scanner, `min` marker, one swap per pass through `temp` |

Quicksort is the priority and the acceptance oracle; it ships correct or the
ticket is not done. The other five share the step model and the canvas, so they
are mostly engine work.

## Sort direction

Ascending and descending are both offered. Descending is not a separate
algorithm, it is one flipped comparison, so it costs almost nothing and its
absence would be the more surprising choice.

**It applies to all six methods, not only Quicksort.** The request named
Quicksort, and that is where the option is most visible (it changes which side of
the pivot each value lands on), but the mechanism is one comparison site in every
one of the six engines. Showing the control only for Quicksort would mean five
methods that silently ignore a setting the visitor can see, which reads as broken
rather than as scoped. Narrowing it back later is deleting one conditional.

Per algorithm, the change is:

| Method | Where direction enters |
|---|---|
| `quick` | `a[j] <= pivot` becomes `a[j] >= pivot` in the partition test |
| `bubble` | `a[j] > a[j+1]` becomes `a[j] < a[j+1]` |
| `insertion` | the walk-back test `a[j] > key` becomes `a[j] < key` |
| `selection` | `a[j] < a[min]` becomes `a[j] > a[min]` |
| `merge` | the merge-take test picks the larger head instead of the smaller |
| `radix` | **not** a comparator flip, see below |

**Radix is the exception worth calling out.** LSD radix performs no comparison at
all, so there is nothing to invert. Descending is produced by collecting the
buckets `9 → 0` instead of `0 → 9` on every pass. That is a real difference in
the engine and a real difference in what the canvas shows during the collect
step, so it needs its own implementation and its own test rather than being
assumed to fall out of a shared comparator.

The comparator lives in one place per engine, `cmp(a, b)` derived from
`direction` at trace time, so no engine contains a second inverted copy of its
own loop.

**Narration must follow the direction.** In descending mode the step description
says `a[j]=8 ≥ pivot 5`, and the partition bands are labelled by position
relative to the pivot rather than by "less" and "greater". A description that
still reads `≤` while the engine tested `≥` is worse than no description.

## Step model (the contract)

One shape for all six algorithms, so the canvas, transport and pseudocode pane
never branch on `algo` for anything structural:

```js
{
  id: 0,                    // sequential
  algo: 'quick',
  direction: 'asc',         // 'asc' | 'desc', constant for the whole run
  type: 'compare',          // see vocabulary below
  array: [2, 8, 4, 7, ...], // FULL snapshot AFTER this step's mutation
  pointers: { i: 1, j: 2, pivot: 8, low: 0, high: 8 },  // indices, or null
  marks: { 8: 'pivot', 1: 'i', 2: 'j' },                // index -> role
  ranges: [ { low: 0, high: 3, role: 'left' }, ... ],   // red/blue bands
  frames: [ { low: 0, high: 8, depth: 0, state: 'active' }, ... ],
  temp: { value: 8, from: 1 } | null,
  buckets: null,            // radix only: array of 10 arrays
  codeLine: 4,              // index into the algorithm's pseudocode
  description: 'a[j]=4 ≤ pivot 5, so i advances to 1 and 4 swaps into place',
}
```

Rules the engine must hold to:

- **`array` is a fresh copy per step.** No shared reference, mirroring
  `AnimationEngine.js:64`. Scrubbing backwards must never require an undo.
- **One atomic action per step.** A swap is three steps (`swap-hold`,
  `swap-write-left`, `swap-write-right`). A comparison that changes nothing is
  still its own step, because "we looked and did nothing" is information.
- **Self-swaps collapse.** When `i === j`, the three-beat swap emits one
  `swap-noop` step ("already in position") instead. Otherwise a nearly-sorted
  input spends most of the animation shuffling values into the slots they are
  already in. The reference trace's first comparison (`j=0`, `i` becomes 0) is
  exactly this case.
- **`description` is written for a student, not a log.** It names the values and
  the reason, like `AnimationEngine.js:116` does, and it states the comparison
  actually performed, so it reads `≥` in descending mode.
- **One comparator per engine.** `direction` is resolved to a single `cmp(a, b)`
  at the top of the trace function and used everywhere. An engine with two
  near-identical loops, one per direction, is the failure mode this rule exists
  to prevent: the second copy is where the bug will live.

Step `type` vocabulary: `frame-enter`, `frame-exit`, `pointer-init`,
`pointer-advance`, `compare`, `swap-hold`, `swap-write-left`, `swap-write-right`,
`swap-noop`, `shift`, `place`, `pivot-place`, `partition-done`, `merge-take`,
`bucket-scatter`, `bucket-collect`, `mark-sorted`, `done`.

## Colour system

New tokens in `src/styles/global.css`, declared **before** the
`[data-mode="light"]` block and restated inside it, exactly as the K-map group
tokens at `:897-935` are, with `-rgb` triplets for the fills:

| Token | Role | Reference colour |
|---|---|---|
| `--sort-i` | the `i` pointer and its cell ring | green |
| `--sort-j` | the `j` pointer and its cell ring | yellow |
| `--sort-pivot` | the pivot cell | yellow ring, locked to neutral once placed |
| `--sort-left` | the "less than pivot" partition band | red |
| `--sort-right` | the "greater than pivot" partition band | blue |
| `--sort-sorted` | cells in final position | theme accent |
| `--sort-temp` | the `temp` holding box | white / foreground |

Same treatment as the K-map set and for the same stated reason: these must be
distinguishable from *each other*, so they do not derive from the theme seed.
Record the addition in `docs/design.md` before writing the CSS ("No new colours
without updating this table first"). Rings and tints over the cell, not solid
fills, so the value text keeps its normal colour and needs no on-fill contrast
pair, matching `TreeNode.module.css`'s `.keyChip`.

## Canvas

`src/features/sorting/components/SortCanvas/` renders SVG:

- **Array row.** Rounded cells, monospace values, the teacher's proportions.
  Cells are positioned by CSS `transform` with a transition, the way
  `TreeNode.module.css:1-8` does it, so a swap visibly *moves* two cells past
  each other rather than cutting between two values.
- **Pointer markers above the row.** Lowercase italic `i`, `j`, `pivot`, `min`,
  `k`, sliding horizontally to their index with the same transition. A pointer at
  `low - 1` renders just off the left edge of the frame, not clamped onto cell 0,
  since "i has not entered yet" is a real state.
- **`temp` box below the row,** appearing only for the three swap steps, with the
  held value.
- **Partition bands.** After `partition-done`, the left range gets a red outline,
  the right a blue one, the pivot a locked neutral cell.
- **Recursion frames** (merge). Each active frame is a row down the page,
  bracketed by `mergeSort(` … `)` labels, depth growing downward. Cap the drawn
  depth at what fits and scroll the frame stack rather than shrinking cells
  below legibility.
  **Superseded for quicksort** by the follow-up at the end of this ticket: it
  draws a full recursion tree of segments rather than a call-stack ladder, which
  is what screenshot 3 actually shows.
- **Bucket rows** (radix). Ten labelled rows `0`–`9`; scatter animates cells into
  a bucket, collect walks them back out in order.

Layout maths goes in a pure module, `src/lib/algo/sorting/sortLayout.js`,
following `src/lib/treeLayout.js` (which has its own unit test) so cell
positions, frame offsets and bucket geometry are testable without a browser.

## Pseudocode pane

Right-hand panel showing the selected algorithm's pseudocode with the line at
`step.codeLine` highlighted. This is what turns "a cell moved" into "line 7 ran".
Static text per algorithm in `src/lib/algo/sorting/pseudocode.js`; the engine
already emits `codeLine`, so the pane is presentational.

## Input surface

`src/pages/algo/sorting/SortingPage.jsx`, two views (`input` and `result`), the
shape of `RecurrencePage.jsx:103-131`:

- `ScrambleText` title → subtitle → `PillInput`, per `docs/rules.md §14.1`.
- **Method dropdown below the pill**, six options, styled as
  `RecurrenceInput.module.css`'s `.methodSelector` (allowed by §14.2). Changing
  it fires `fireAck('mode-switch')`.
- **Order control beside Method**, on the same row: `Ascending` / `Descending`.
  Two chips rather than a dropdown, because the choice is binary and a dropdown
  that holds two items costs a click to show what a pair of chips shows for free.
  It is always visible, for every method (see Sort direction above). It also
  fires `fireAck('mode-switch')`, which is correct per `docs/rules.md §15.5`:
  one glyph per verb, and switching order is the same verb as switching method.
- Both Method and Order survive the round trip back to the input view and are
  echoed in the result view's header, so a visitor scrubbing a long descending
  radix run can still see which settings produced it.
- **Example chips** when the field is empty, as `RecurrenceInput.jsx:13-20` does.
  One of them is `2, 8, 4, 7, 1, 3, 9, 6, 5` labelled "Lecture example", plus
  "Already sorted", "Reverse sorted", "With duplicates", and a "Shuffle" chip that
  writes a fresh random array. Chips write into the pill via its `value` /
  `onValueChange` props, which already exist (`PillInput.jsx:14`).
- Method survives the round trip back to the input view, as
  `RecurrencePage.jsx:89-101` does for the formula.

## Validation and limits

Parsed by `src/lib/algo/sorting/parseSortInput.js`, returning
`{ values, error }` in the same shape as `parseRecurrence`:

- Comma and/or whitespace separated integers. **Duplicates are allowed** (unlike
  the B+ tree, whose keys are a set) and must be handled by every algorithm and
  asserted in tests.
- **3 to 24 values.** The upper bound is a step-count bound, not a taste call:
  bubble and selection are O(n²) in *comparisons*, so n=24 is already ~275
  compares and, with pointer and swap steps, over a thousand frames.
  `useAnimationPlayer`'s `maxTotalMs` compression (`:67`) keeps that watchable;
  n=50 would not be. Reject outside the range with a message naming the limit.
- **Radix rejects negative values** with a message that says why (LSD base-10
  radix has no digit for a sign). Every other method accepts them. The rejection
  is checked at submit against the selected method, so switching method after a
  reject is a real fix and not a dead end.
- A rejection sets `aiState` `error` with `errorMessage` and does **not** fire an
  ack, per `docs/rules.md §15.5` ("never on top of an aiState you are also
  setting").

## Island wiring

- `PillInput` already drives `observing` / `idle` (`PillInput.jsx:53-66`).
- Submit sets `thinking`, and the page holds it until the animation reaches its
  end, copying `TreePage.jsx:66-70` (`hasSteps && !isAtEnd ? 'thinking' : 'idle'`)
  rather than clearing synchronously, which would paint nothing
  (`docs/rules.md §15.4`).
- Route `onAIStateChange` through a ref wrapper per `§15.3`, including the prop
  passed down to `PillInput`.
- Transport acks come free from `useAnimationPlayer`; do not fire them by hand.
- Add a `'tool:sorting'` entry to `QUIPS` in `src/lib/sentinel/quips.js`
  alongside `'tool:btree'` at `:198`. `quips.test.js` asserts resolved grid
  matrices are unique, so pick a pattern/mode/colour triple that no existing
  entry resolves to, and run `npm run test:sentinel` before assuming it passed.

## Registry and routing

- `src/constants/tools.js`: one entry, `id: 'sorting'`, `route: '/algo/sorting'`,
  `courses: ['computer-science']`. The `courses` key is the whole publication
  switch (see the header comment at `:24-31`); omitting it is the T-084 bug.
- `src/routes/academiaRoutes.jsx`: lazy import, entry in `routeComponents` for
  `/algo/sorting` plus the alias `/algo/sorting-algorithms` (the tool registry
  route is the canonical one, mirroring how `/algo/recurrence` and
  `/algo/recurrence-relation` both resolve), and a line in
  `preloadAcademiaRoutes`.
- A new ASCII cover field in `src/lib/asciiArt/fields/` (e.g. `barSort.js`,
  columns of varying height settling), exported from that folder's `index.js` and
  referenced as the entry's `field`.

## Files

Add:

```
src/pages/algo/sorting/SortingPage.jsx
src/pages/algo/sorting/SortingPage.module.css
src/features/sorting/components/SortCanvas/{SortCanvas.jsx,.module.css}
src/features/sorting/components/SortCell/{SortCell.jsx,.module.css}
src/features/sorting/components/PointerMarker/{PointerMarker.jsx,.module.css}
src/features/sorting/components/TempSlot/{TempSlot.jsx,.module.css}
src/features/sorting/components/CallFrames/{CallFrames.jsx,.module.css}
src/features/sorting/components/BucketRows/{BucketRows.jsx,.module.css}
src/features/sorting/components/RunOptions/{RunOptions.jsx,.module.css}   # Method dropdown + Order chips, one row
src/features/sorting/components/PseudocodePane/{PseudocodePane.jsx,.module.css}
src/lib/algo/sorting/{index.js,parseSortInput.js,sortLayout.js,pseudocode.js}
src/lib/algo/sorting/{quickSort.js,mergeSort.js,radixSort.js,bubbleSort.js,insertionSort.js,selectionSort.js}
src/lib/algo/sorting/sorting.test.js
src/lib/algo/sorting/sorting.oracle.test.js
src/lib/algo/sorting/sortLayout.test.js
src/lib/asciiArt/fields/barSort.js
```

Change: `src/constants/tools.js`, `src/routes/academiaRoutes.jsx`,
`src/lib/asciiArt/fields/index.js`, `src/lib/sentinel/quips.js`,
`src/styles/global.css`, `docs/design.md`, `package.json`.

All `.jsx` and CSS Modules, feature-first, PascalCase component folders,
camelCase lib files, per `docs/architecture-update.md §3`.

## Cuttable sub-task: one transport bar instead of three

`StepControls` and `LogicStepControls` are already the same component twice. The
recommendation is to promote it to `src/components/ui/StepControls/` taking
`{ player, accent, note }` (the tableaux verdict becomes `note`), repoint both
existing call sites, and have sorting use it. If that consolidation is not wanted
in this ticket, sorting imports the tree's `StepControls` as-is rather than
adding a third copy; forking it again is the one option that is not acceptable.

## Tests

New `test:sorting` script in `package.json`, appended to the `test` chain, in the
plain-node style of the existing suites (`package.json:12-20`).

- **Lecture oracle, both directions.** `quickSort` on `[2,8,4,7,1,3,9,6,5]`
  reproduces both row tables above exactly: the array snapshot after each `j`
  iteration, the value of `i` at each point, and `[2,4,1,3,5,7,9,6,8]` /
  `[8,7,9,6,5,3,4,2,1]` after the pivot placement.
- **Sortedness.** For each of the six algorithms **× both directions**, 500
  random arrays (lengths 1..24, values including negatives and duplicates; radix
  gets non-negative input only): the final step's `array` equals
  `[...input].sort((a, b) => direction === 'asc' ? a - b : b - a)`.
- **Descending is not a no-op.** For each algorithm, an input with at least two
  distinct values produces different final arrays under the two directions. This
  is the test that catches a `direction` prop that is threaded through the UI and
  then never read, which is otherwise invisible: every other assertion here
  passes fine against an engine that always sorts ascending.
- **Radix collect order.** Descending radix collects buckets `9 → 0`, asserted on
  the bucket-collect steps directly rather than only on the final array, since
  radix is the one method where descending is not a comparator flip.
- **Snapshot legality.** Consecutive snapshots differ by at most one legal
  mutation: a swap of two indices, one write, or one bucket move. This is what
  catches an engine that quietly jumps ahead between frames, which is the defect
  a screenshot review cannot see.
- **Multiset invariant.** Every snapshot is a permutation of the input multiset.
  Catches a shift loop that duplicates or drops a value, the classic insertion
  sort bug.
- **Pointer sanity.** `i` and `j` never leave `[low - 1, high]` of their frame;
  `pivot` always indexes the frame's last element at partition start.
- **Swap atomicity.** Every `swap-hold` is followed by exactly one
  `swap-write-left` then one `swap-write-right`, and `temp` is non-null across
  exactly those steps.
- **Step budget.** No algorithm exceeds a documented step ceiling at n=24, so a
  future change cannot silently make the animation unwatchable.
- **Layout.** `sortLayout` is deterministic and produces no overlapping cells at
  any supported length or recursion depth, in the style of `treeLayout.test.js`.
- **Parser.** Range, separators, duplicates, negatives, radix-specific rejection.
- `npm run test:sentinel` passes with the new quip entry (matrix uniqueness).

## Acceptance criteria

- [ ] `/algo/sorting` renders title, subtitle, shared `PillInput`, a Method
      dropdown below the pill with six options, and an Ascending/Descending
      order control beside it.
- [ ] The tool appears on the home page and on `/courses/computer-science` from a
      single `TOOLS` entry.
- [ ] Submitting `2, 8, 4, 7, 1, 3, 9, 6, 5` with Quicksort produces the exact
      trace in the ascending table above, and the descending table when Order is
      flipped, verified by test, not by eye.
- [ ] All six methods honour the Order setting, radix included, and the step
      descriptions state the comparison actually performed (`≥`, not `≤`, in
      descending mode).
- [ ] Each swap plays as three visible steps through a `temp` box; a self-swap
      plays as one "already in position" step.
- [ ] `i` and `j` are separately coloured, labelled markers that move one step at
      a time and can be stepped backwards and forwards with the transport.
- [ ] After a partition, the pivot is locked and the two sides are visibly banded
      red and blue; recursing draws nested `quickSort( … )` frames.
- [ ] All six methods animate end to end and finish sorted, including inputs with
      duplicates and negatives (radix rejects negatives with a stated reason).
- [ ] The pseudocode pane highlights the line matching the current step.
- [ ] The transport is built on `useAnimationPlayer`, so scrubbing, speed and
      reduced motion all work and the island acks fire without per-button code.
- [ ] The island shows `observing` on focus, `thinking` for the whole animation,
      and returns to `idle` at the end and on unmount.
- [ ] Inputs outside 3..24 values are rejected with a message naming the limit,
      and set `error` rather than firing an ack.
- [ ] New `--sort-*` tokens exist in `global.css` for both modes and are recorded
      in `docs/design.md`; no raw hex in the feature's CSS.
- [ ] No third copy of the transport bar exists.
- [ ] `npm test` includes `test:sorting` and passes.

## References

- `docs/rules.md` §10.3 (reduced motion), §14 (shared input surfaces), §15
  (island feedback), §16.2 (refactoring triggers)
- `docs/design.md` (colour token table, K-map group precedent)
- `docs/architecture-update.md` §2–3 (feature-first placement, naming)
- T-085 (B+ tree step animation) — the step/snapshot pattern this reuses
- T-095 (Digital Logic input layer) — the input-language and island rules this
  must not repeat the violation of
- T-099 (Sentinel acks) — `fireAck` families and the transport acks

---

## Outcome (implemented 2026-08-03)

Shipped. All acceptance criteria met. Verified by test assertions across
three suites plus a Playwright pass over the running app.

### Verified against the lecture

Both oracle tables reproduce exactly, asserted iteration by iteration rather
than on the final array:

- ascending first partition → `2 4 1 3 | 5 | 7 9 6 8`
- descending first partition → `8 7 9 6 | 5 | 3 4 2 1`

Screenshot 1's frame (`i` on 8, `j` on 4, `temp` holding 8, listing on
`temp = A[i]`) and screenshot 2's banding (red `2 4 1 3`, pivot `5`, blue
`7 9 6 8`) both render as drawn in the source material.

### Deviations from the spec above, and why

- **`sortSweep.js`, not `barSort.js`.** The name says what it does: bars
  scramble, a scanner sweeps left to right, each bar it passes settles into a
  rising staircase, the staircase holds, then it scrambles again. Deliberately
  unlike `barMeter` (Grade Toolkit), which is also bars but oscillates forever
  and never resolves.
- **`RunOptions`, not `MethodSelect`.** Method and Order are one row and one
  concern, so they are one component rather than two that have to agree about
  spacing.
- **`SortRuns` owns merge sort's `i` and `j`.** Found while driving the built
  page: merge sort's `i`/`j` index the two runs, not the array, and the canvas
  was drawing them in the main pointer lane on unrelated cells, alongside a
  duplicate `k`. They are now labelled on the runs they actually index, and only
  `k` (a real array position) stays on the main row.
- **`LEFT_MARGIN` in the viewBox.** Also found by driving it: the recursion
  frames' `quickSort(` label is right-aligned to the frame's left edge and was
  being clipped to `uickSort` at the old one-cell margin.
- **`LogicStepControls` was not folded in.** The shared bar now lives at
  `src/components/ui/StepControls/` and the B+ tree uses it, so sorting adds no
  third copy and the acceptance criterion holds. The tableaux copy carries a
  verdict badge and is styled against the M3 token set, so merging it is a
  visual change to a shipped tool and wants its own ticket. The shared
  component's `note` slot is the seam it would use.

### Conservation invariant, refined during implementation

The spec's "every snapshot is a permutation of the input multiset" is not true
of a correct implementation, and asserting it would have forced a wrong one.
Mid-swap one cell has been overwritten and its old value is in `temp`;
mid-merge the cells past `k` still hold what the runs were copied from;
mid-collect a radix bucket holds part of the array. The test therefore checks
three regimes: settled frames must be exact permutations, and in-flight frames
are reconstructed from `temp` / `runs` / `buckets` before comparison, so the
longest stretches of every run are checked rather than exempted.

The atomicity property turned out to be stronger and simpler than written:
**no two consecutive snapshots differ in more than one cell**, for all six
methods in both directions. That is asserted directly.

### Where it landed

`src/lib/algo/sorting/` (engines, parser, listings, layout, 3 test files),
`src/features/sorting/components/` (SortCanvas, SortRuns, SortBuckets,
CallFrames, PseudocodePane, RunOptions), `src/pages/algo/sorting/`,
`src/components/ui/StepControls/`, `src/lib/asciiArt/fields/sortSweep.js`,
plus registry, routes, quip, tokens and `npm run test:sorting`.

---

## Follow-up: quicksort draws its recursion as a tree (2026-08-03)

Owner request after seeing the first cut. Quicksort no longer animates in a
single row with a textual call-stack ladder underneath. It now draws the shape
the lecture draws:

1. the whole array partitions in place, `i`, `j`, `temp`, pivot as before;
2. the pivot lands, that row is finished, and it **stays on screen** holding the
   arrangement its own partition produced;
3. the row splits into its two halves, drawn as two rows beneath it — a step you
   can stop on, before either half starts moving;
4. the left half becomes the working row, then the right, recursively, each new
   level appearing below the last;
5. the combined sorted array appears at the very bottom, in an accent band.

### Why the engine changed, not just the canvas

The old engine emitted `frames`, a snapshot of the call stack. A stack cannot
express this view, because it **pops** the ranges you still want to see. It now
emits `segments`: every range any call has owned, each carrying its own frozen
copy of what that range looked like when its partition finished, plus a state of
`pending` → `active` → `split` / `done`. The frozen copy is the load-bearing
part — row 0 must keep showing `2 4 1 3 5 7 9 6 8` while the rows below it churn,
and a live slice of the array would rewrite history under the visitor.

The partition logic is untouched, so both oracle tables still pass unchanged.

### Layout notes

- **Only the active level reserves the pointer lane and the temp lane.** Giving
  every level that room makes a deep recursion three times taller than it needs
  to be; giving it only when temp is on screen makes every row below jump 78px
  twice per swap. Reserving it for as long as a level is active neither wastes
  space nor moves.
- **`quickSort` labels alternate sides.** Pinning them all to the left put the
  right half's label straight through the left half's last cell (caught by
  driving the built page, not by a test). The label now goes wherever there is
  room, left preferred, which is exactly what the lecture slide does:
  `quickSort( … )` on the left and `( … )quickSort` on the right.
- **The tree is sized to its content and the panel scrolls**, with the active row
  scrolled into view. A 24-value already-sorted input recurses 23 levels deep,
  and squeezing that into a fixed panel makes every cell unreadable.
- **`SortRow` was extracted** so a cell looks and animates identically whether it
  is the whole array or one branch four levels down. The other five methods are
  unchanged and still use the single-row layout.

### Tests

`sortLayout.test.js` gains a tree section: exactly one row live at a time,
depths strictly increasing downward, sibling segments never overlapping, every
segment aligned to the cells it owns and holding exactly `high - low + 1`
values, the result row appearing only on the final step and never above the
deepest level, and the top row still holding its own partition rather than the
sorted array at the end.

---

## Self review (2026-08-04)

Adversarial pass over the whole diff. Scope is clean: all 44 files belong to
this ticket. Three defects found and fixed, all by reading the code and driving
the built page rather than re-reading the implementation report.

1. **Selection sort's listing indented the swap into the inner scan loop**
   (`pseudocode.js`). It said selection sort swaps on every comparison, which is
   the exact property that separates it from bubble sort, and it contradicted
   both the narration and the animation, which do one swap per pass. Fixed, and
   asserted against the engine's own line numbers plus a
   "swaps == passes" check so the two cannot drift again.

2. **The result row was off screen at the end of a deep run** (`SortCanvas.jsx`).
   `scrollIntoView` followed the active row, and on the final step there is no
   active row, so nothing scrolled. With 24 already-sorted values (23 levels) the
   run ended with the payoff a full panel-height out of sight. The scroll target
   is now the result row once it exists. Verified: result fully visible at both
   9 and 24 values.

3. **The right recursive call never lit its own line** (`quickSort.js`). Both
   halves highlighted `quickSort(A, low, p - 1)` when they started, so line 5 of
   the listing never highlighted at all and the pane named the wrong call for
   half the tree. Segments now carry the line that created them, and the listing
   reads 3 → 4 → 5. Asserted.

Also hardened: the canvas centred its SVG on the scroll container itself, which
in a browser that does not clamp centred overflow puts the top of a tall tree
past the scroll origin where it cannot be reached. Centring moved to an inner
stage with `min-height: 100%`, so it only applies when the content fits.

Removed a dead `strict` parameter from `relSymbol`.

**Not fixed, reported instead —** `docs/documentation.md` is pre-existing stale:
its "Current tools" list names two tools and files the shipped logic tools under
"Planned (not yet implemented)", and its path listings predate the
`features/`/`pages/` layout. Adding one line for Sorting Algo to a list already
missing eight tools would misrepresent the doc as maintained. Its own ticket.

Gates after the fixes: `npm run test:sorting` 256 assertions across three files,
full `npm test` exit 0, `npm run build` clean, stylelint clean on every new
stylesheet, no page errors driving all six methods in both directions.
