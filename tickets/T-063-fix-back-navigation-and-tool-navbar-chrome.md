---
id: T-063
title: Fix inconsistent back-navigation and tool pages leaking home-only navbar chrome
status: backlog
severity: medium
area: layout/navigation
epic: none
created: 2026-07-26
---

## Summary

Three related navigation gaps found via codebase audit: (1) several tool
pages have no way to leave the tool except the sidebar or browser back
button; (2) the one existing back-icon affordance (in the notes reader) is
anchored top-right instead of top-left, and it's a one-off local to
`NoteReader` rather than a shared component; (3) `Navbar` shows the "Team"
link (and, on the B+Tree page, "Disclaimer") on every page that renders
it, including tool pages — that chrome should be home-only.

## Evidence

**1. Back button missing on tool pages** (none of these render any
Link/breadcrumb/back-icon back toward home or a parent view — only
sidebar/browser-back exists):
- `src/pages/tree/TreePage.jsx` — landing view (line 117, bare `<Navbar />`)
  and visualizer view (lines 137-148, `<Navbar showTitle showReset
  showDisclaimer />`); `showReset` is a "Reset / New Tree" action, not
  navigation.
- `src/pages/erd/ERDPage.jsx` — has a "Previous" button (lines 152-157,
  `handlePrevious` lines 106-122) but it only steps back within the
  3-step wizard, not page-level navigation.
- `src/pages/algo/complexity/ComplexityPage.jsx` — "New Code" reset (lines
  87-89) and "← Try Again" (lines 97-99) both just reset local state via
  `handleReset`.
- `src/pages/algo/recurrence/RecurrencePage.jsx` — same pattern: "New
  Formula" (lines 129-131) and "← Edit this formula" (line 141), both
  local reset.
- `src/pages/logic/proof/LogicalEquivalencePage.jsx` —
  `showNewFormula`/`onNewFormula={handleReset}` (lines 132-135) only
  clears result state.
- `src/pages/logic/tableaux/TableauxPage.jsx` — `showNewFormula` reset
  (lines 78-83) and an error-state "← Try Again" button (lines 114-119,
  CSS class literally named `backButton` but it's a state reset, not
  navigation).
- `src/pages/tools/grade-toolkit/GradeToolkitPage.jsx` — doesn't render
  `<Navbar />` at all; no back button, no breadcrumb, no exit affordance
  whatsoever.
- `src/pages/notes-browser/NotesBrowserPage.jsx` — has a real `Breadcrumb`
  component (lines 41-59, rendered line 177) built from a `crumbs` array
  (lines 161-166: Home → Subjects → Module → Folder), but no discrete
  "go up one level" icon — only clicking a specific breadcrumb segment.

Directory-nesting/up-navigation today only exists in two forms: the
`Breadcrumb` in `NotesBrowserPage.jsx` (jump to an arbitrary ancestor, not
step-back-one), and `NotesPage.jsx`'s `handleBack` (lines 47-56), which
uses `deriveSubfolder(subpath)` from `src/lib/notesApi.js` (lines 34-37,
plus `segmentToSubfolder`/`subfolderToSegment` lines 47-53) to compute the
one parent level deterministically (not browser-history-based, since
notes can be reached via direct/shared link).

**2. Back icon is right-anchored, and is a one-off**
- `src/components/markdown/NoteReader/NoteReader.jsx` (lines 1-19) renders
  the only back-icon button in the app (`ArrowLeft` from
  `@phosphor-icons/react`), wired only from `src/pages/notes/NotesPage.jsx`
  (lines 47-56, 98-99 via `onBack={handleBack}`). It is optional
  (`{onBack && (...)}`) — no other page imports or reuses `NoteReader`'s
  back button.
- `src/components/markdown/NoteReader/NoteReader.module.css` lines 30-56
  (`.backButton`): `position: fixed; top: 24px; right: 24px;` —
  explicitly commented "Top-right so it clears the global left Sidebar
  rail (fixed 56px, expands on hover)". Mobile override at lines 62-72
  repeats `right: 16px`.
- `src/components/layout/Sidebar/Sidebar.module.css` lines 1-14 confirms
  the sidebar is `position: fixed; left: 0; width: 56px` (desktop), and
  translates off-canvas (`transform: translateX(-100%)`) below 968px
  (lines 25-34) — so on mobile the sidebar isn't actually occupying the
  left edge, and the "top-right to clear the sidebar" justification only
  applies at desktop widths.

**3. Navbar shows Team/Disclaimer unconditionally, not gated by route**
- `src/components/layout/Navbar/Navbar.jsx` (lines 5-17): `showAbout =
  true` and `showDisclaimer = false` are prop defaults with no
  route/pathname awareness anywhere in the component (confirmed no
  `useLocation`/`pathname` reference in `Navbar.jsx` or
  `src/components/layout/PageShell/PageShell.jsx`, which just forwards
  `navbarProps` straight through, e.g. lines 17/26/36).
- Because `showAbout` defaults to `true`, every page that renders bare
  `<Navbar />` gets "Team" unconditionally: `ERDPage.jsx:147`,
  `ComplexityPage.jsx:57` and `:84`, `RecurrencePage.jsx:97` and `:126`,
  `LogicalEquivalencePage.jsx:132` and `:159`, `TableauxPage.jsx:78` and
  `:109`, `TreePage.jsx:117` (landing).
- `TreePage.jsx:147` additionally sets `showDisclaimer={true}` on the
  visualizer view — the only place Disclaimer is turned on, and it's a
  tool page, not home.
- Explicit opt-outs exist only per-caller: `src/pages/legal/TermsPage.jsx:22-23`
  (`showAbout={true} showDisclaimer={false}`),
  `src/pages/social/guidelines.jsx:20-21` (`showAbout={false}
  showDisclaimer={false}`) — proving the gating is currently
  manual/per-page rather than structural.
- `src/App.jsx` lines 29-34 already computes route-classification flags
  (`isToolsRoute = pathname.startsWith('/tools/')`, `isAdminRoute`,
  `isNoteRoute`) for Starfield/Sidebar suppression (consumed at lines
  66-79), but these are never threaded into `Navbar`/`PageShell` —
  confirming Navbar truly has no idea what route it's on.
- Route map: `src/routes/academiaRoutes.jsx` lines 35-53 lists `/tree`,
  `/erd`, `/algo/complexity` (+alias), `/algo/recurrence` (+alias),
  `/logic/proof`, `/logic/tableaux` (+2 aliases), `/about`, `/disclaimer`,
  `/terms`, `/tools/grade-toolkit`, plus redirects; `/home` is the true
  landing page (via `/` → `/home` redirect in `src/routes/index.jsx`).

## Impact

- A user who opens a tool via a shared/direct link (B+Tree, ERD,
  Complexity, Recurrence, Logical Equivalence, Tableaux, Grade Toolkit)
  has no in-page way back to home except the collapsed sidebar rail or
  the browser back button — on mobile, where the sidebar is off-canvas
  by default, this is even less discoverable.
- The single existing back-icon (notes reader) sits top-right,
  inconsistent with typical left-to-right back-navigation conventions and
  inconsistent once reused elsewhere.
- Tool pages currently display "Team" (and, for B+Tree, "Disclaimer") —
  links that make sense on the marketing/landing page but are
  noise/scope-confusion inside an actual tool.

## Suggested fix

1. Promote the notes-reader back button into a small shared component
   (e.g. `src/components/common/BackButton`), fixed-position, anchored
   **top-left** — desktop offset clearing the 56px sidebar rail (e.g.
   `left: 80px` for 24px clearance) with a plain `left: 16px` on the
   `@media (max-width: 968px)` off-canvas breakpoint (matching where
   `Sidebar.module.css` already goes off-canvas, not the reader's own
   768px breakpoint) since the sidebar isn't occupying the edge there.
   Update `NoteReader.jsx`/`NoteReader.module.css` to consume the shared
   component instead of its local `.backButton`.
2. Wire the shared back button (or an equivalent `Navbar`-level "back"
   affordance) into each tool page identified above (`TreePage`,
   `ERDPage`, `ComplexityPage`, `RecurrencePage`,
   `LogicalEquivalencePage`, `TableauxPage`, `GradeToolkitPage`) and into
   `NotesBrowserPage` for a discrete "go up one directory" step (distinct
   from jumping to an arbitrary breadcrumb segment) — bottoming out at
   `/home` once at the top level. Reuse `deriveSubfolder`-style logic
   (`src/lib/notesApi.js`) for computing "one level up" where nesting
   exists (notes/folders); for flat tool pages a fixed target of `/home`
   is sufficient.
3. Make `Navbar`'s `showAbout`/`showDisclaimer` route-aware instead of
   prop-default-true: either (a) flip the defaults to `false` and set
   them explicitly only where already used correctly (home/about/
   disclaimer/terms pages), removing `TreePage.jsx:147`'s
   `showDisclaimer={true}`, or (b) thread the existing
   `isToolsRoute`/route classification from `App.jsx` into
   `PageShell`/`Navbar` so tool routes structurally never receive
   Team/Disclaimer regardless of what a page passes. Prefer (a) for a
   minimal diff, matching how `TermsPage`/`guidelines.jsx` already opt
   out explicitly today.

## Acceptance criteria

- [ ] Every tool page (`/tree`, `/erd`, `/algo/complexity`,
      `/algo/recurrence`, `/logic/proof`, `/logic/tableaux`,
      `/tools/grade-toolkit`) and the notes browser
      (`/notes-browser/...`) shows a back/up-navigation affordance that
      works without relying on the sidebar or browser history.
- [ ] The back icon (wherever it appears — notes reader, and newly on
      tool pages) is anchored top-left, not top-right, on both desktop
      and mobile, and correctly clears the sidebar rail at desktop
      widths.
- [ ] The back-icon UI is implemented once as a shared component and
      reused across notes reader + tool pages, not duplicated.
- [ ] "Team" and "Disclaimer" links no longer appear on any tool page's
      `Navbar` (`/tree`, `/erd`, `/algo/*`, `/logic/*`,
      `/tools/grade-toolkit`) — they remain visible only on `/home` and
      the existing about/disclaimer/terms pages.
- [ ] No regression to `TermsPage`/`guidelines.jsx`'s existing explicit
      `showAbout`/`showDisclaimer` overrides.

## References

- Related: `src/lib/notesApi.js` (`deriveSubfolder`,
  `segmentToSubfolder`/`subfolderToSegment`)
- Related: `src/App.jsx` lines 29-34, 66-79 (existing route-classification
  pattern to potentially reuse for Navbar gating)
