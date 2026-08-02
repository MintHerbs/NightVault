---
id: T-103
title: "B+ tree transport: the Previous step button sits under the sidebar rail"
status: done
severity: medium
area: tree
epic: none
created: 2026-08-02
---

## Implementation notes (2026-08-02)

Fixed by matching the pattern the tableaux transport has always used:
`left: 80px` on `.controls`, dropped back to `left: 0` inside the existing
`@media (max-width: 968px)` block where the sidebar becomes a closed drawer.
80px rather than the rail's own 56px so the bar keeps the same 24px of
breathing room its horizontal padding already implies.

Nothing else changed: the rail was not touched, and the tableaux was already
correct.

Verified in Chrome at 1400, 1024 and 800px wide. At each width every transport
button now returns itself from `document.elementFromPoint()` at its own centre,
and a real Playwright click on "Previous step" (which previously timed out with
the sidebar named as the interceptor) lands.

One thing left alone deliberately: the 56px rail width is now hardcoded in two
stylesheets as `80px` of clearance and in `Sidebar.module.css` as the width
itself. A `--sidebar-width` custom property would be the right home for it, but
introducing one touches every surface that lays out around the rail and is a
bigger change than this defect warrants.

## Summary

On the B+ tree visualiser the animation transport starts at `x = 24`, but the
global sidebar is a 56px fixed rail at `x = 0` with `z-index: 60`. The leftmost
button, "Previous step", is therefore covered for most of its width and can only
be hit on an 8px sliver at its right edge.

## Evidence

Measured in Chrome at 1400x900 on `/tree`, after building a tree so the
transport is present:

| Element | Box |
|---|---|
| `aside` (Sidebar) | `x: 0, width: 56`, `position: fixed`, `z-index: 60` |
| `button[aria-label="Previous step"]` | `x: 24, width: 40` (so 24 to 64) |

`document.elementFromPoint()` at that button's centre returns the sidebar's
`CollapsedView` root (`div.flex.flex-col.items-center.justify-between.h-full`),
not the button. Playwright refuses to click it for the same reason:

```
<div class="flex flex-col items-center justify-between h-full">…</div>
  from <aside class="_sidebar_1o3dg_1">…</aside> subtree intercepts pointer events
```

Every other transport button clears the rail: Pause at `x: 68`, Next step at
`x: 120`, Skip at `x: 164`.

Found while verifying [T-099](T-099-sentinel-boot-sequence-and-universal-reactivity.md)'s
transport acks. Pre-existing and unrelated to it: neither the rail's geometry nor
`StepControls`' layout were touched by that work.

## Impact

A visitor stepping backwards through a B+ tree animation clicks "Previous step"
and nothing happens, because the click lands on the sidebar rail behind it. The
8px of the button that does stick out past the rail is hittable, so the failure
is intermittent rather than total, which is worse: the button works about a
fifth of the time depending on where in it you click.

Only the B+ tree is affected. The tableaux transport
([LogicStepControls](../src/features/logic/components/LogicStepControls.jsx))
uses its own stylesheet and does not start this far left.

## Suggested fix

Pad the transport clear of the rail rather than moving the rail. The sidebar is
global chrome on nearly every route and other pages already lay out around it;
the tree's own bar is the thing that is wrong here.

[StepControls.module.css](../src/features/tree/components/StepControls/StepControls.module.css)
should offset by the rail's width on the breakpoints where the rail is docked
(it becomes an off-canvas drawer below 968px, so the offset has to drop with
it). Worth checking whether the rail's width is already a token somewhere before
hardcoding 56px a second time.

## Acceptance criteria

- [x] `document.elementFromPoint()` at the centre of every transport button on
      `/tree` returns that button.
- [x] The transport still clears the rail at 968px and above, and still uses the
      full width below it where the sidebar is a drawer.
- [x] The tableaux transport is unchanged.

## References

- [T-099](T-099-sentinel-boot-sequence-and-universal-reactivity.md) — found during its verification
- [src/features/tree/components/StepControls/StepControls.jsx](../src/features/tree/components/StepControls/StepControls.jsx)
- [src/components/layout/Sidebar/Sidebar.module.css](../src/components/layout/Sidebar/Sidebar.module.css)
