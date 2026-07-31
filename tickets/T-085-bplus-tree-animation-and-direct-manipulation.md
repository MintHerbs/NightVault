---
id: T-085
title: Animate B+ tree insert/delete, round the node chrome, and allow direct manipulation of leaf records
status: in-progress
severity: medium
area: tree
epic: none
created: 2026-07-31
---

## Summary

The B+ tree visualizer draws only the finished tree, so the thing it exists to
teach, how a tree *reorganises* under insert and delete, is invisible. Node
chrome is square and hardcodes white text. There is no way to act on a key you
can see; every operation goes through a text field. And a tool published in
`TOOLS` does not necessarily appear on a course landing page, which left
Semantic Tableaux (T-084) invisible on `/courses/computer-science`.

## Evidence

**Publishing gap (regression from T-084).** `src/constants/tools.js` had two
lists: the `TOOLS` registry and a separate `COURSE_TOOL_IDS` map read by
`toolsForCourse`, which `src/pages/course/CourseLandingPage.jsx:74` is the sole
consumer of. T-084 appended `semantic-tableaux` to `TOOLS` only, so the CS page
kept rendering `['btree', 'erd', 'complexity', 'recurrence', 'grades']`, the
exact five cards in the reported screenshot. Verifying the card in the shipped
bundle was not sufficient: it *was* in the bundle, just never selected for that
page.

**Narration carries no target.** `BPlusTree._emit(kind, description)`
(`src/lib/BPlusTree.js:44`) passes a string and nothing else, so a step cannot
say *which* node or key it concerns and the canvas has nothing to highlight.

**Delete's first event fires too late.** `delete()` splices the key out at
`src/lib/BPlusTree.js:174` and only then emits `remove`. There is no moment at
which a step still contains the doomed key, so it cannot be shown being marked
before it disappears.

**Square chrome.** `TreeNode.jsx:18` sets `rx="4"` on the outer rect, but the
pointer/key slot rects it draws over the top (`TreeNode.jsx:22-60`) have no
rounding and tile the full width, so they square the corners back off.
`TreeNode.module.css:44` hardcodes `fill: #ffffff` for key text instead of a
token.

**No direct manipulation.** `TreeNode.module.css:50` sets
`pointer-events: none` on key text and no handler exists on the slots.

## B+ tree semantics this must respect

Established by reading `src/lib/BPlusTree.js`, and it constrains the feature:

1. **Keys are unique.** `_keySet` is a `Set` and `insert` no-ops on a key
   already present (`BPlusTree.js:77`). The tree can never hold two records with
   the same value.
2. **Records live only in leaves.** `_splitLeaf` *copies* the right node's first
   key upward (`BPlusTree.js:105`), so one value can legitimately appear twice on
   screen: once as a leaf record and once as an internal separator.
   `_splitInternal` *moves* its key up instead (`BPlusTree.js:137-146`), so
   higher separators need not equal any leaf key.
3. **Therefore a separator is not deletable.** The request to "delete the root
   node which is 5 rather than the leaf which is also 5" has no B+ tree
   equivalent: that 5 is a signpost meaning *go right for keys ≥ 5*, not a
   record. Removing it would break routing to an entire subtree. What already
   happens on deleting the leaf record is
   `_refreshSeparatorForDeletedKey` (`BPlusTree.js:196`) replacing the stale
   separator with the subtree's true minimum.
4. **Editing is delete-then-insert.** A key's location is determined by sort
   order, so changing its value must move it. Composing the two verified
   operations preserves every invariant; an in-place overwrite would not.

The UI should teach 2 and 3 rather than pretend otherwise: leaf keys get
Edit/Delete, internal keys get an explanation of what they are and a pointer to
the leaf that holds the real record.

## Impact

- A student watching the tool sees a tree appear fully formed. Splits, borrows,
  merges and root growth, the entire syllabus content, never render.
- Deleting a key gives no feedback about which key went or why the shape then
  changed.
- Semantic Tableaux was unreachable from the course page it was published for;
  reported twice as "still not showing".

## Suggested fix

- Co-locate course visibility on each tool (`courses: [...]` / `EVERY_COURSE`)
  and derive `toolsForCourse` by filtering `TOOLS`, deleting the second list.
- Widen `_emit` to `(kind, description, detail)` carrying `nodeIds`, `keys` and
  an `intent`, and add a pre-mutation emit in `delete` so the key can be marked
  before removal. Both are observation-only: no operation changes behaviour, and
  the existing fuzz suite must stay at 0 failures to prove it.
- Round the node by clipping the slot rects to a rounded rect and stroking the
  border over the top; move key text onto a token.
- Transition nodes by their stable `id` between snapshots so the tree visibly
  reflows.
- Hover a key slot to raise a popover: Edit/Delete for leaf records, an
  explanation for separators.

## Acceptance criteria

- [ ] `/courses/computer-science` lists Semantic Tableaux, and adding a tool to
      `TOOLS` without declaring `courses` is a visible hole rather than a silent
      omission.
- [ ] Inserting a key plays a step sequence; the new key is marked in the user's
      theme accent, and nodes glide to their new positions rather than jumping.
- [ ] Deleting a key marks it in red *before* it is removed, then plays the
      borrow/merge/shrink steps that follow.
- [ ] Hovering a leaf key offers Edit and Delete for that key; hovering an
      internal key explains it is a separator and names where the record lives.
- [ ] Editing a key is narrated as the delete and insert it actually is.
- [ ] Node corners are rounded and no raw hex remains in the tree components.
- [ ] `npm run test:tree` passes, including the fuzz suite at 0 failures and
      trace agreement between narration and the library.
- [ ] `npx vite build` and `npm run lint:css` are clean.

## References

- T-084, the semantic tableaux overhaul this ticket's publishing fix follows up.
- `src/lib/treeTrace.js`, narration built on the library's own hooks, so the
  animation cannot drift from the tree it draws.
- `src/engine/AnimationEngine.js`, the superseded second implementation; it is
  parameterised by minimum degree `t` where `BPlusTree` uses order `m`, and reads
  a `tree.t` that does not exist. Not used by this work.
