---
id: T-049
title: Static sidebar (Academia → Home), public read-only Drive-style notes browser, and a Home "Notes" card
status: done
severity: medium
area: layout, notes
epic: none
created: 2026-07-24
---

## Summary

Replace the sidebar's hover-to-expand file tree with a static collapsed bar (Academia icon navigates
straight to `/home` instead of expanding), add a new "Notes" card to the Home page before the CPA
Calculator card, and build a public, read-only, Google-Drive-style browser (Subjects → folders → files)
for students to navigate to a note — the same navigation model `AdminBrowser.jsx` already uses for
admins, minus every write affordance. The existing note viewer's back button becomes deterministic,
always returning to that browser instead of relying on browser history. The new browser page shows the
Starfield through its content area (transparent background); the admin panel's own background is
untouched. Delivered as one ticket in five phases (same consolidation pattern as
[T-045](T-045-admin-drive-navigation.md)) — each phase has its own acceptance block and can ship as its
own PR even though they're tracked as one ticket.

## Evidence

- **Sidebar today** ([Sidebar.jsx](../src/components/layout/Sidebar/Sidebar.jsx)) collapses to 56px and
  expands to 240px on hover (`handleMouseEnter`/`handleMouseLeave`,
  [Sidebar.jsx:60-70](../src/components/layout/Sidebar/Sidebar.jsx#L60-L70)) or when the bottom Academia
  icon is clicked
  ([CollapsedView.jsx:161-164](../src/components/layout/Sidebar/CollapsedView/CollapsedView.jsx#L161-L164):
  `setMode('academia'); setIsExpanded(true)`). Expanded state renders
  [ExpandedView.jsx](../src/components/layout/Sidebar/ExpandedView/ExpandedView.jsx), a VS-Code-style file
  tree of every Subject → subfolder → note/tool, plus a `package.json` easter-egg popup
  ([PackageJsonPopup.jsx](../src/components/layout/Sidebar/PackageJsonPopup/PackageJsonPopup.jsx), used
  nowhere else). The module-icon list in the collapsed bar is already commented out
  ([CollapsedView.jsx:96-126](../src/components/layout/Sidebar/CollapsedView/CollapsedView.jsx#L96-L126))
  — today's collapsed bar already is just moon logo / Social icon / Academia icon / avatar.
- **Home page** ([HomePage.jsx](../src/pages/home/HomePage.jsx)) renders a `TOOLS` array of cards via the
  shared `Card` component ([HomePage.jsx:17-60](../src/pages/home/HomePage.jsx#L17-L60)); CPA Calculator
  is `TOOLS[0]`.
- **Admin's Drive browser** ([AdminBrowser.jsx](../src/pages/admin/AdminBrowser.jsx)) is the exact UI in
  the reference screenshot (breadcrumb, Type/Modified filter chips, list/grid toggle, table/grid rows).
  It's tightly coupled to `useAdmin()` auth, owner/contributor checks, and rename/delete/hide/move/create
  popovers — not something to reuse by hiding props on. Its data comes from
  `useAdminModulesRegistry` ([useAdminModulesRegistry.js](../src/hooks/useAdminModulesRegistry.js)), which
  deliberately *keeps* hidden Subjects/notes/folders for admins to manage.
  `useNotesRegistry()` ([useNotesRegistry.js:33-44](../src/hooks/useNotesRegistry.js#L33-L44)) is the
  public-safe equivalent already used by the sidebar tree today — it drops hidden Subjects/notes/folders
  before merging, so a read-only browser built on it is safe by construction, not by an added filter.
- **Note viewer** ([NotesPage.jsx](../src/pages/notes/NotesPage.jsx)) already renders `NoteReader`'s back
  button ([NoteReader.jsx:19-26](../src/components/markdown/NoteReader/NoteReader.jsx#L19-L26)), wired to
  `handleBack` ([NotesPage.jsx:53-61](../src/pages/notes/NotesPage.jsx#L53-L61)): `navigate(-1)` when
  in-app history exists, else the module's first tool route or `/home`. Never a file browser — none
  exists yet.
- **Starfield gating** ([App.jsx:65](../src/App.jsx#L65)):
  `{!isAdminRoute && !isNoteRoute && <Starfield />}`. Admin's opacity comes from
  `AdminBrowser.module.css`'s `.app { background: var(--color-bg) }`
  ([AdminBrowser.module.css:11](../src/pages/admin/AdminBrowser.module.css#L11)), not from Starfield being
  absent — a new route under neither `/admin` nor `/notes/` already gets Starfield for free.
- `displaySubfolder` (used by `ExpandedView`, `AdminBrowser`, `useEditorFiles`) is already exported from
  [notesApi.js:36](../src/lib/notesApi.js#L36) and reusable for computing a note's folder from its path.
- Routing precedent: [docs/specs/admin-drive-navigation.md §3.1](../docs/specs/admin-drive-navigation.md#31-routes)
  specifies real per-depth routes (not client-only view state) so back/forward and bookmarking work,
  "matching how Drive itself behaves" — the same pattern this ticket's browser should follow.
- No existing "read-only browser" or partial version of this was found anywhere in the codebase
  (`search_text` for "read-only browser" — zero hits); this is greenfield.

## Impact

Today, browsing notes on the live site means hovering the sidebar into a cramped 240px file tree, and a
directly-linked note's back button strands the reader on `/home` or an unrelated tool route instead of
where the note actually lives. This removes that detour: a full-page, read-only Drive browser mirrors the
admin experience for public visitors, discoverable from a Home card, with real bookmarkable/back-forward-
capable URLs, and a back button that always returns to the right folder. It also stops relying on hover
for primary navigation (bad for touch/mobile per the existing sidebar drag on small screens) by retiring
the sidebar's expand entirely in favor of Home-page and browser-page navigation.

The one place real product judgment is needed: the sidebar's `ExpandedView` (file tree) and its
`package.json` popup lose their only entry point once Academia stops expanding. This ticket treats both
as retired dead code (see phase A and Open questions) rather than relocating them — confirm before
landing phase A if the popup should survive somewhere else.

## Suggested fix

**Phase A — Sidebar goes static; Academia → Home**
- [Sidebar.jsx](../src/components/layout/Sidebar/Sidebar.jsx): remove `isExpanded` state and the
  `handleMouseEnter`/`handleMouseLeave` hover handlers (`:60-70`); the `aside` always renders
  `CollapsedView` at the collapsed 56px width. Remove `isPackageJsonOpen` state and the props threaded to
  the (deleted) `ExpandedView`.
- [CollapsedView.jsx:161-164](../src/components/layout/Sidebar/CollapsedView/CollapsedView.jsx#L161-L164):
  change the Academia icon's `onClick` from `setMode('academia'); setIsExpanded(true)` to
  `go('/home', 'Home')` — same pattern the moon logo already uses
  ([CollapsedView.jsx:39-42](../src/components/layout/Sidebar/CollapsedView/CollapsedView.jsx#L39-L42)).
  The existing path-based `mode` sync effect
  ([Sidebar.jsx:48-50](../src/components/layout/Sidebar/Sidebar.jsx#L48-L50)) already flips `mode` back to
  `'academia'` once the path leaves `/social/*`, so no extra mode bookkeeping is needed.
- Delete `ExpandedView/` (jsx + module.css) and `PackageJsonPopup/` (confirmed used nowhere else) unless
  the owner wants the easter egg relocated (see Open questions).
- Mobile: the hamburger button ([Sidebar.jsx:98-108](../src/components/layout/Sidebar/Sidebar.jsx#L98-L108))
  currently toggles into the (now-deleted) expanded view. With nothing left to expand into, remove the
  hamburger and mobile overlay entirely and let the already-minimal collapsed bar render as-is on mobile.

**Phase B — Public read-only notes browser**
- New `src/pages/notes-browser/NotesBrowserPage.jsx` + `.module.css`, following the existing
  `pages/<area>/<Name>Page.jsx` convention (`pages/notes/NotesPage.jsx`, `pages/admin/AdminBrowser.jsx`).
  Depth-by-`useParams()`, same shape as `AdminBrowser`'s three list-views (subjects → folders → files),
  but:
  - Data from `useNotesRegistry()`, not `useAdminModulesRegistry` — hidden items are already excluded, no
    auth gate, no `useAdmin()` import.
  - No "New" button/create popover, no per-row 3-dot menu (no rename/hide/delete/move), no left rail with
    edit controls. Breadcrumb + Type/Modified filter chips + list/grid toggle + search carried over for
    visual parity with the reference screenshot; a Subjects quick-nav rail is left out of v1 (breadcrumb
    drill-down is enough at read-only depth) — flagged in Open questions if that parity matters more than
    assumed here.
  - Root breadcrumb crumb is "Home", navigating to `/home` — this is the browser's own "back to Home" per
    the ask.
  - Clicking a file navigates to the existing `/notes/:moduleId/:path` viewer, not an editor route.
- New routes in [src/routes/index.jsx](../src/routes/index.jsx) (mirroring admin's per-depth pattern,
  spec §3.1):
  ```
  /notes-browser                      → Subjects (root)
  /notes-browser/:moduleId            → that Subject's folders
  /notes-browser/:moduleId/:subfolder → that folder's files
  ```
  (Can't reuse `/notes/...` — already the note viewer's path.)

**Phase C — Home page "Notes" card**
- [HomePage.jsx:17-60](../src/pages/home/HomePage.jsx#L17-L60): insert a `notes` entry into `TOOLS`
  immediately before the `cpa` entry, `route: '/notes-browser'`, an unused Phosphor icon (e.g. `Files` or
  `FolderOpen` — `Calculator`/`TreeStructure`/`Graph`/`ChartLineUp`/`FunctionIcon`/`Globe` are already
  spoken for by the other five cards).

**Phase D — Note viewer back-navigation is deterministic**
- [NotesPage.jsx:53-61](../src/pages/notes/NotesPage.jsx#L53-L61): replace `handleBack`'s history-based
  logic (`navigate(-1)` / module-tool-route / `/home` fallback) with a single deterministic target:
  `navigate(`/notes-browser/${section}/${displaySubfolder(subpath)}`)`, using the already-exported
  `displaySubfolder` from [notesApi.js](../src/lib/notesApi.js). This fixes the existing "deep-linked note
  strands the reader" gap the current fallback comment already acknowledges (`:54-55`) — today it strands
  them at a tool route or `/home`, not at the browser, because the browser didn't exist yet.

**Phase E — Starfield shows through the new browser page only**
- No change to [App.jsx:65](../src/App.jsx#L65) — `/notes-browser*` already matches neither
  `isAdminRoute` nor `isNoteRoute`, so `<Starfield />` renders there for free.
- In `NotesBrowserPage.module.css`, do not give the outer container an opaque
  `background: var(--color-bg)` the way `AdminBrowser.module.css`'s `.app` does
  ([AdminBrowser.module.css:11](../src/pages/admin/AdminBrowser.module.css#L11)) — leave it transparent
  (same mechanism `home.module.css`/`PageShell`'s content variant already relies on) so Starfield shows
  through the breadcrumb/chips/list region. Row/card surfaces keep their existing `--md-surface-container`
  tokens for contrast against the starfield.
- `AdminBrowser.module.css` is not touched — admin stays exactly as opaque as it is today.

## Acceptance criteria

**Phase A**
- [x] Hovering the collapsed sidebar never expands it; there is no code path that sets an expanded width
      anymore. Verified live: sidebar bounding-box width is 56px both before and after a hover.
- [x] Clicking the Academia icon navigates to `/home` from any route, including `/social/*` (and flips the
      sidebar's `mode` back to academia via the existing path-sync effect). Verified live from `/tree`.
- [x] `ExpandedView/` and `PackageJsonPopup/` are deleted, not left as unreachable dead code. Confirmed no
      remaining imports anywhere in `src/` (one stale prose comment in `notesApi.js` still names
      `ExpandedView` — harmless, not a code reference).
- [ ] **Deviation, not met as written:** the sidebar still renders a hamburger + off-canvas overlay on
      mobile — implementation judgment call, documented in `Sidebar.jsx`'s file comment, was to keep the
      toggle but have it reveal the *same static 56px bar* (never a wider panel) rather than removing the
      toggle outright, since a permanently-docked 56px bar was judged to cost too much width on narrow
      phones. Verified live: no horizontal overflow at 390px viewport, hamburger opens the bar at the same
      56px width. Flagging for the owner to confirm this reinterpretation is acceptable rather than
      silently marking the literal AC done.

**Phase B**
- [x] `/notes-browser` (and its `:moduleId` / `:moduleId/:subfolder` children) render Subjects → folders →
      files exactly as `useNotesRegistry` reports them, with no hidden Subject/folder/note ever appearing.
      Verified live end-to-end: subjects → `database` → `notes` folder → 4 files.
- [x] No create, rename, delete, hide, or move affordance exists anywhere on this page; it is unauthenticated
      and requires no admin session. Confirmed by reading `NotesBrowserPage.jsx` in full — no admin imports,
      no write calls.
- [x] Clicking a file navigates to the existing `/notes/:moduleId/:path` viewer. Verified live.
- [x] The page is reachable, bookmarkable, and supports browser back/forward at all three depths (real
      routes, not client-only view state).

**Phase C**
- [x] Home page shows a "Notes" card immediately before the CPA Calculator card, routing to
      `/notes-browser`. Verified live: card order is `["Notes", "CPA Calculator", ...]`.

**Phase D**
- [x] Opening a note and clicking back lands on `/notes-browser/<moduleId>/<subfolder>`, verified two ways:
      via the browser drill-down, and via a cold direct link straight to a note URL with no in-app history —
      both land back on the correct folder, not `/home` or a tool route.

**Phase E**
- [x] `/notes-browser*` shows the Starfield behind its content — confirmed via code: `isNoteRoute` in
      `App.jsx` matches `/notes/` (trailing slash) only, so `/notes-browser` doesn't match either Starfield
      exclusion.
- [x] `AdminBrowser.module.css` is untouched by this ticket's diff — confirmed via `git diff`.

## Open questions

1. Does the `package.json` easter egg need a new home once `ExpandedView` is deleted, or is it fine to
   retire along with it? Recommendation: retire it — it has no other trigger today, and reintroducing it
   elsewhere is easily a follow-up ticket if the owner wants it back.
2. Is a read-only Subjects quick-nav rail (mirroring admin's left rail, minus edit controls) worth the
   extra surface in v1, or is breadcrumb-only drill-down enough? Recommendation: breadcrumb-only for v1 —
   smaller surface, and the reference screenshot itself doesn't show a rail.
3. Should a Subject with zero visible notes/folders still appear in the browser (as an empty-but-enterable
   folder, matching admin's "(coming soon)" empty state) or be hidden entirely from the public listing?
   Recommendation: still show it with an empty-state message — consistent with how `ExpandedView` already
   treats an empty module today (`(coming soon)`), and less surprising than a Subject disappearing outright.
4. Exact route slug (`/notes-browser` vs. something else) is a naming bikeshed, not a technical constraint
   — flag if a different name is preferred before phase B lands.

## References

- [T-045](T-045-admin-drive-navigation.md) — same one-ticket/multi-phase consolidation pattern, and the
  source of the Drive-style navigation model this ticket's public browser mirrors.
- [docs/specs/admin-drive-navigation.md §3.1](../docs/specs/admin-drive-navigation.md#31-routes) — routing
  convention this ticket's phase B follows.
- [T-035](T-035-reader-parity-note-reader-and-code-theme.md) — introduced the shared `NoteReader`/`onBack`
  surface phase D changes the target of.
