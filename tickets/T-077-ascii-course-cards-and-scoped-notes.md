---
id: T-077
title: Rework home/course cards into ASCII-cover design, scope notes to a course, add course hide toggle
status: backlog
severity: medium
area: home
epic: none
created: 2026-07-29
---

## Summary

Rework the home page's tool cards into the "ASCII/halftone animation as
cover" card design the owner supplied as a reference (two screenshots: a
dark card set with a spinning pinwheel / vortex-with-logo / iris-like
halftone cover over "GET STARTED", and an orange variant with the same
idea). Home becomes a grid of **course** cards (Computer Science, Data
Science, Math with Computer Science — plus Grade Toolkit and Socials,
which aren't course-scoped) instead of a flat tool list. Opening a course
card lands on that course's own page showing a Notes card plus every tool
card (B+ Tree, ERD, Code Complexity, Recurrence Relation, Grade Toolkit)
in the same design. Separately, fix a real bug: the public notes browser
currently shows every course's Subjects mixed together with no scoping.
The primary owner also needs to be able to hide a course from the public
site without deleting it.

## Evidence

- `src/pages/home/HomePage.jsx:18-68` — `TOOLS` is a hardcoded array (Notes,
  CPA/Grade Toolkit, B+ Tree, ERD, Code Complexity, Recurrence Relation,
  Socials) rendered as flat `Card` grid (`HomePage.jsx:84-94`). No concept
  of "course" exists on this page at all.
- `src/components/ui/Card/Card.jsx` — the project's one card primitive has
  an icon-glyph header + title + description; **no cover-image/animation
  slot**, no CTA-button footer. It's the M3 filled-card pattern (T-... /
  Session 10 in `docs/design.md`), a different shape from the reference.
- `src/lib/coursesApi.js:17-28` — `listCourses()` already reads the real
  `courses` table (`id text`, `display_name`), used today only by
  `AdminUsers.jsx`'s course switcher/management. Prod already holds
  `computer-science` and `computer-with-mathematics` rows (per
  `db/sql/0025_hotfix_prod_sidebar_modules_course_id.sql`'s header); a
  `data-science` row does not exist yet and needs creating via the
  existing "New course" admin flow (`AdminUsers.jsx:486-543`) — not new
  code.
- **Notes-browser course leak (confirmed bug):** `AdminBrowser.jsx:230-231`
  scopes its Subjects list with
  `modules.filter(m => !activeCourseId || m.courseId === activeCourseId)`.
  `src/pages/notes-browser/NotesBrowserPage.jsx:139-161`'s `items` memo has
  **no equivalent filter** — at the `'subjects'` level it does
  `modules.map(...)` over every `sidebar_modules` row from every course.
  `useNotesRegistry()` (`src/hooks/useNotesRegistry.js:38-46`) →
  `listModules()` (`src/lib/modulesApi.js:11-26`) confirms `courseId` is
  already present on every row returned — the data needed to filter exists,
  it's just never applied on this page. Net effect: `/notes-browser` shows
  Subjects/folders from every course in one flat list, and there is no
  course picker or URL param to scope it.
- **No hide flag on `courses` today.** The reusable pattern already exists
  one table over: `sidebar_modules.hidden` (`db/sql/0023_...sql:69-78`) +
  `setModuleHidden()` (`modulesApi.js:63-69`), surfaced in `AdminBrowser.jsx`
  as "Hide on live site"/"Unhide". `courses` has no such column.
  `AdminUsers.jsx:146-162` (`courseMenuFor`) already renders a per-course
  `RowMenu` with Rename/Delete — the natural place to add Hide/Unhide.
  `useAdmin.js`'s `isPrimaryOwner` is the existing gate for
  course-management actions in this file (`AdminUsers.jsx:57`, `290`).
- **No ASCII/halftone rendering exists anywhere in the repo** (`grep -rni
  ascii src` only matches an unrelated comment in
  `src/lib/logic/formulaParser.js:198`). This is new infrastructure, not a
  reskin of something that exists.
- Two separate, unsynced "what tools does a Subject have" registries exist:
  `HomePage.jsx`'s inline `TOOLS` array and
  `src/components/layout/Sidebar/modules.js`'s `MODULE_TOOLS` (keyed by
  Subject id, e.g. `database: [btree, erd]`, `algorithms: [complexity,
  recurrence]`). Neither is keyed by *course* — Subjects belong to courses
  via `sidebar_modules.course_id`, tools belong to Subjects via
  `MODULE_TOOLS`, so "every tool for course X" would require joining through
  Subjects, and today's courses/Subjects mapping isn't guaranteed to cover
  every course evenly. Reconciling that mapping precisely is out of scope
  here (see "Suggested fix" below for the deliberately simpler approach).

## Impact

- Today the home page can't grow past a flat tool list — there's no
  container for "everything under Computer Science" vs. "everything under
  Data Science," so adding Data Science content means either dumping it
  into the same undifferentiated notes list or inventing ad hoc UI each
  time.
- A visitor opening `/notes-browser` right now sees Subjects from every
  course at once. It happens to look fine only because just one course's
  worth of Subjects exists in prod today; the moment Data Science or Math
  with CS gets its own Subjects, their folders will appear mixed in with
  Computer Science's on the same unscoped listing, which is exactly the
  wrong behavior the owner flagged.
- There is no way to soft-launch a new course (add it in admin, populate it
  over time, then reveal it) — it either exists and is fully public, or it
  doesn't exist at all.

## Suggested fix

### 1. New card design (`AsciiCard`)

New component, `src/components/ui/AsciiCard/AsciiCard.jsx` +
`AsciiCard.module.css` (own folder per `docs/design.md`'s Modularity Rules
— this is a distinct visual language from the M3 `ui/Card`, not a variant
of it: cover image on top, title + description below, solid CTA button
footer, versus `Card`'s icon-header/description/ripple). Reuse `Card`'s
`to`/`href`/`onClick` + `prefers-reduced-motion` pattern rather than
duplicating that logic blind.

Cover is an animated canvas, not a static image — `AsciiCanvas`
(`src/components/ui/AsciiCard/AsciiCanvas.jsx`): a `<canvas>` that samples a
per-card "field function" `(nx, ny, t) => density 0..1` (coordinates
normalized to -1..1) across a character grid, maps density to a monospace
ramp (` .:-=+*#%@`), and redraws on `requestAnimationFrame`. The cover box is
square so that domain maps to equal horizontal and vertical screen distance —
on a 4:3 box every circular motif rendered as a squashed ellipse.

Two kinds of cover feed that one renderer:

- **Procedural** (`src/lib/asciiArt/fields/*.js`) — pure
  `(nx, ny, t) => density` functions, good for abstract motion.
- **Character art** (`src/lib/asciiArt/bitmaps/*.js` via
  `bitmapField.js`) — a hand-authored grid of ramp characters, sampled and
  animated by a wrapper (`scanline`, `swirl`, `dissolve`, `flicker`,
  `breathe`). Necessary for anything that has to be *recognisable as an
  object*: a distance function can draw a convincing vortex but not a
  convincing computer, and the procedural attempts at the folder and the
  B+ tree both sampled down to anonymous smudges at this grid resolution.
  This is also what makes the image upload below possible — an uploaded
  photo becomes exactly the same kind of grid.

| Card | Cover | Motif |
|---|---|---|
| Computer Science | `bitmaps/computer.js` | CRT computer: bezel, screen, `>` prompt + cursor, power LED, stand; `scanline` sweep reads as a CRT refresh |
| Data Science | `fields/dataScatter.js` | scatter cloud with a regression line that rocks as if being re-fitted |
| Math with Computer Science | `fields/blackhole.js` | spiral/vortex (angle + log(radius) − speed·t) |
| Socials | `fields/eye.js` | eye-shaped mask, pupil offset by `sin(t)` (looks left/right) |
| Notes (on every course page) | `bitmaps/folder.js` | folder with a tab and papers inside |
| Grade Toolkit | `fields/barMeter.js` | oscillating bar-chart / GPA meter |
| B+ Tree | `bitmaps/btree.js` | B+ tree diagram, including the linked leaf row that distinguishes a B+ tree from a B tree |
| ERD | `fields/graphPulse.js` | connected node graph, pulsing edges |
| Code Complexity | `fields/codeRain.js` | matrix-style scrolling density columns |
| Recurrence Relation | `fields/spiralZoom.js` | nested recursive rings zooming inward |

A course with no explicit motif gets one **hashed from its id**
(`pickPresetForId`), not `Math.random()` — a course must keep the same
animation across reloads and across visitors, or it reads as a glitch.
Overriding it is either a line in `coverPresets.js` or an admin cover
choice (below).

Respect `prefers-reduced-motion`: freeze on a single representative frame
instead of animating (same media-query pattern `Card.jsx:40-53` already
uses). Colors come from existing tokens only — no new hex values, per
`docs/design.md`'s color rule.

Because a canvas cannot consume `var(--color-accent)`, `AsciiCanvas` reads
it as a literal via `resolveThemeColor()` and re-reads it from a
**`MutationObserver` on `<html>`** (watching `data-color-theme`,
`data-mode`, `style`) rather than from a `useTheme()` dependency. The
observer is load-bearing, not incidental: `ThemeProvider` writes those
attributes from its own effect, and React runs child effects *before*
parent effects, so a child re-reading `getComputedStyle` on the same render
picks up the **old** accent — which presented as covers only recolouring
after a page reload. The observer fires after the DOM has changed, so it
can't race; it also covers `index.html`'s pre-React no-flash script, and it
keeps a theme change from tearing down the animation loop (which restarted
every cover's motion from t=0).

The accent then **crossfades over 420ms** (`coverColor.js`) instead of
snapping. The fade start is stamped from the rAF timestamp inside the loop,
deliberately *not* from `performance.now()` in the observer: those are
different clock domains, and a start stamped ahead of the next frame makes
progress negative, which clamps the mix to 0 and freezes the cover on the
old colour indefinitely.

### 1b. Admin-authored covers

`courses.cover_preset` / `cover_ascii` / `cover_anim` (migration `0050`)
let the primary owner pick a cover from `/admin/users` → a course's
Change cover, via `src/components/admin/CoverPicker/`:

- a grid of every named preset, each previewing live through the same
  `AsciiCanvas` the real card uses (so there's no second preview path to
  drift);
- an image upload, converted to a ~72-column character grid in the browser
  (`src/lib/asciiArt/imageToAscii.js`: downscale to one pixel per cell,
  Rec. 601 luma, contrast-stretch, quantise to the ramp), with an animation
  picker and an Invert toggle for light-background sources;
- Reset, which clears both and returns the card to the hashed default.

The grid is stored as ~3 KB of text rather than the image as a Storage
file: no bucket policy, no second network round trip when a card paints,
and no orphan-cleanup lifecycle to own (the problem T-002 covers for note
images). The source image is deliberately not retained — re-uploading is
how you change a cover.

### 2. Tools registry consolidation

Home's inline `TOOLS` and `Sidebar/modules.js`'s `MODULE_TOOLS` already
drift (two lists, unsynced). Introduce `src/constants/tools.js` exporting
one array of `{ id, title, description, field, route }` for the
non-course-specific tool cards (B+ Tree, ERD, Code Complexity, Recurrence
Relation, Grade Toolkit), consumed by `HomePage` and the new course page.
`Notes` and `Socials` stay special-cased (Notes needs a `courseId`, Socials
isn't a "tool").

**Scope note:** `Sidebar/modules.js` deliberately keeps its own
`MODULE_TOOLS`/`STANDALONE_TOOLS` rather than reading the new registry. The
two lists are the same *tools* but not the same *shape or purpose*:
`MODULE_TOOLS` is keyed by Subject id and feeds sidebar labels (with the
`.js` suffixes of the file-tree metaphor) plus `findActiveModule`'s
pathname matching, none of which the card registry has. Unifying them means
restructuring the sidebar's data model and re-testing its active-state
routing — worth doing, but its own ticket, not a rider on a card redesign.
So the drift is narrowed (the card surfaces now share one list) rather than
eliminated.

### 3. Home page → course-first

`HomePage.jsx` renders three groups of `AsciiCard`s:

- One card per **non-hidden** course from `listCourses()` (see hide flag
  below), routing to `/courses/:courseId`.
- **Grade Toolkit** — stays a standalone top-level card (route unchanged,
  `/tools/grade-toolkit`), since it isn't tied to any one course.
- **Socials** — stays a standalone top-level card (route unchanged,
  `/social/feed`), same reasoning.

### 4. Course landing page

New route `/courses/:courseId` → new `src/pages/course/CourseLandingPage.jsx`.
Renders:

- A **Notes** `AsciiCard` → `/notes-browser/:courseId` (see fix #5).
- ~~Every entry from the new `src/constants/tools.js` registry, unfiltered —
  i.e. the same B+ Tree / ERD / Code Complexity / Recurrence Relation /
  Grade Toolkit cards appear on **every** course's page.~~ **Superseded.**
  This read the owner's "grade toolkit **again**" as sanctioning the whole
  toolset on every page; what it actually sanctioned was Grade Toolkit
  appearing again. Corrected on review of the live site: B+ Tree, ERD, Code
  Complexity and Recurrence Relation are computer-science artefacts, so only
  Computer Science shows them and every other course gets Notes + Grade
  Toolkit. Implemented as `toolsForCourse()` in `src/constants/tools.js` — a
  per-course id → tool-id map, defaulting to `['grades']` for an unlisted
  course, so a new course shows the always-applicable tool rather than
  inheriting the CS toolset by accident. No join through
  `sidebar_modules.course_id`/`MODULE_TOOLS` was needed after all, which is
  what the original deferral was really avoiding.
- 404/empty state if `courseId` doesn't match any course (mirror
  `NotesBrowserPage.jsx:196`'s `notFound` pattern).

### 5. Fix the notes-browser course leak

`NotesBrowserPage` becomes course-scoped: routes gain a `:courseId` segment
(`/notes-browser/:courseId`, `/notes-browser/:courseId/:moduleId`,
`/notes-browser/:courseId/:moduleId/:subfolder`), and the `'subjects'`-level
branch of the `items` memo (`NotesBrowserPage.jsx:155-159`) filters
`modules` by `m.courseId === courseId` before mapping — the exact one-line
pattern already proven in `AdminBrowser.jsx:230-231`. The old unscoped
`/notes-browser` entry point either 404s or redirects to the (only) course
page — there is no legitimate "notes across every course" view anymore, by
design (this was the leak, not a feature). Breadcrumb's "Subjects" crumb
(`NotesBrowserPage.jsx:187`) points back to the owning course page instead
of a global root.

### 6. Course hide/unhide (primary owner only)

- New migration `db/sql/00NN_courses_hidden.sql`: `alter table public.courses
  add column if not exists hidden boolean not null default false;` — additive,
  no backfill needed. **Before writing this**, re-confirm the live prod
  `courses` schema directly (T-051 already documents dev/prod drift on this
  exact table — `id uuid` in dev's `0024` vs. `id text, display_name` in
  prod's undocumented hotfix) so this migration targets what's actually
  there, not `0024`'s local-dev version. Add the entry to
  `db/migrations.yaml`; note `npm run db:migrate` is already blocked
  entirely by pre-existing `0024` drift (see `0044`/`0045`'s entries) — apply
  via `docker exec psql` for local dev like those did, and flag prod
  application as a manual follow-up, not something this ticket's code can
  verify end-to-end itself.
- `src/lib/coursesApi.js`: add `hidden` to `listCourses()`'s select/mapped
  return, and a `setCourseHidden(id, hidden)` function mirroring
  `modulesApi.js:63-69`'s `setModuleHidden`.
- `AdminUsers.jsx`: add a "Hide on live site"/"Unhide" entry to
  `courseMenuFor(c)` (`AdminUsers.jsx:146-162`), gated on `isPrimaryOwner`
  like the rest of that menu already is contextually; update local
  `courses` state optimistically on toggle, same pattern `courseRename`'s
  `onRenamed` callback uses.
- `HomePage.jsx` filters `listCourses()`'s result to `!hidden` before
  rendering course cards. `CourseLandingPage` for a hidden course's direct
  URL should behave like `AdminBrowser`'s hidden-Subject direct-URL check
  (`modulesApi.js:74-82`'s `isModuleHidden` precedent) — 404 rather than
  silently rendering, so hiding a course actually removes it from
  reachability, not just from the home grid.

## Acceptance criteria

- [ ] Home page renders one `AsciiCard` per non-hidden course, plus a
      standalone Grade Toolkit card and a standalone Socials card, all using
      the new cover-animation card design. *(Rendered, but **only for logged-in
      visitors** until migration `0049` is applied to prod: `courses`' sole
      SELECT policy is 0024's `"courses authenticated read" ... to
      authenticated`, so an anonymous read returns `200 []` — verified with a
      direct anon PostgREST call against prod. Logged-out visitors saw a home
      page with only the two standalone cards and nothing in the console. `0049`
      adds the `"courses public read"` policy that fixes it.)*
- [ ] Course cards appear in `COURSE_ORDER` (`src/constants/courses.js`), not
      alphabetically — alphabetical put Chemistry first and Computer Science
      second. Unlisted courses sort after the ranked ones, keeping the
      `display_name` order the query already asks for.
- [ ] Opening a course card navigates to `/courses/:courseId`, showing a
      Notes card plus **that course's** tool cards — all five for Computer
      Science, Grade Toolkit only for every other course (see the superseded
      note under fix #4). *(The
      `/courses/:courseId` route was missing from `src/routes/index.jsx`
      entirely in PR #72 — `CourseLandingPage` was lazily imported but never
      rendered, and with no catch-all route every course card led to a blank
      page. Route added in the T-077 follow-up; verified statically, the app
      was not driven in that pass.)*
- [ ] Clicking Notes from a course page opens a notes browser scoped to
      that course only — Subjects/folders from other courses never appear,
      confirmed with at least two courses that each have at least one
      Subject. *(The course filter and the `/notes-browser/:courseId/...`
      route shape were both absent from PR #72 — `NotesBrowserPage.jsx` was
      never committed, so the leak this ticket exists to fix was still live on
      `main`, and `CourseLandingPage`'s Notes link fell through to the old
      `/notes-browser/:moduleId` route and listed every course's Subjects.
      Both landed in the T-077 follow-up. Still only exercised against one
      populated course: local dev's second course has 0 Subjects, so the
      two-populated-courses case remains untested.)*
- [x] The old unscoped `/notes-browser` route no longer shows a mixed list
      of every course's Subjects (404s or redirects). *(Was checked off
      prematurely: PR #72 shipped `HomePage`/`CourseLandingPage` without the
      route table or `NotesBrowserPage` changes, so on `main` the bare and
      `/:moduleId` routes were still live and still unscoped. Wired in the
      T-077 follow-up — the bare path now redirects to `/home`.)*
- [ ] Primary owner can toggle a course's visibility from `/admin/users`;
      a hidden course disappears from the home grid and its
      `/courses/:courseId` and `/notes-browser/:courseId` URLs 404 for a
      non-owner; unhiding restores both. *(Behaviour verified by toggling
      `hidden` in the DB: home grid drops the card, both routes refuse,
      unhiding restores. The admin menu item itself was never clicked.)*
- [ ] Users with `prefers-reduced-motion: reduce` see a static frame per
      card instead of an animated one. *(Code path exists, never exercised.)*
- [x] Cover animations are drawn in the active theme's accent colour, and
      switching theme or light/dark mode recolours them without a reload.
- [x] A course with no explicit cover still gets a motif, and the same one
      on every reload.
- [ ] Primary owner can set a course's cover from `/admin/users` — either a
      named preset or an uploaded image — and clearing it returns the card
      to its automatic motif. *(Picker renders with all 12 presets; the
      stored-grid render path is verified end to end via a grid written
      straight to `cover_ascii`. The upload → Invert → Save round trip
      through the UI is untested.)*
- [x] Existing tool routes (`/tree`, `/erd`, `/algo/code-complexity`,
      `/algo/recurrence-relation`, `/tools/grade-toolkit`, `/social/feed`)
      are unchanged and still reachable directly.
- [x] No new raw hex colors introduced — cards use existing `--color-*`
      tokens only.

## Deployment order

`listCourses()` selects `*` rather than naming the T-077 columns, precisely so
this can ship before `0049`/`0050` reach an environment — naming them would
make every read a PostgREST 400 and the public home page would render **no
course cards at all** until the migration landed. Reads are therefore
order-independent.

Writes are not: `setCourseHidden` / `setCourseCover` target the new columns
directly, so until `0049`/`0050` are applied, the admin Hide and Change-cover
actions will fail with a visible error toast. Apply both migrations to prod
before relying on either.

## Local dev residue (not committed, but present on this machine)

Verification touched the **local** dev database only — no writes ever went to
the remote/prod project. Two items are worth knowing about:

- **`courses.display_name` was added to local dev by hand**, outside any
  migration. `coursesApi.js` targets prod's shape (`display_name`), while dev's
  `courses` still carries 0024's `name`/`slug`, so without that shim every
  course read 400s locally. It is *not* in `0049`/`0050` on purpose — the real
  fix is T-051's dev/prod reconciliation. A `supabase db reset` will drop it and
  local course reads will start failing again until it's re-added.
- Computer Science has `cover_preset = 'computer'` set directly in dev, and the
  local `moon@mooner.dev` password was reset, both to enable testing.

Also still true on dev: creating a course from the admin UI fails locally,
because dev's `courses.name`/`slug` are NOT NULL and `createCourse` only sends
`display_name`. Pre-existing T-051 drift, not introduced here.

## References

- Reference design: two screenshots supplied by the owner in the scoping
  conversation (dark ASCII/halftone card set with spinning-vortex /
  swirl-with-logo / iris covers over a "GET STARTED" button; an orange
  variant of the same idea) — not committed to the repo, described above.
- `tickets/T-051-course-scoped-roles-and-user-management.md` — the
  dev/prod `courses` schema drift this ticket's migration must account for.
- `tickets/T-045-admin-drive-navigation.md`,
  `tickets/T-049-public-notes-browser-and-static-sidebar.md` — prior art
  for the Subjects → folders → files navigation model both browsers share.
- `docs/design.md` — color tokens, M3 `ui/Card` precedent, Modularity Rules
  (new-folder-per-component, 200-line file cap), reduced-motion pattern.
