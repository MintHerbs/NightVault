---
id: T-054
title: Replace ad hoc "Loading" text/spinners with a shared Quantum indicator
status: done
severity: low
area: ui
epic: none
created: 2026-07-25
---

## Summary

The app shows a loading state six different ways across pages and features
— three are plain "Loading…"/"Loading..." text nodes, one is a hand-rolled
CSS border-spinner, and two duplicate the same full-page text pattern.
There's no shared loading component, so every screen reinvents its own
markup and copy. Standardize all of them on the `Quantum` animation from
[uiball/ldrs](https://uiball.com/ldrs/) via a single shared component.

## Evidence

- `src/pages/notes-browser/NotesBrowserPage.jsx:207` — `<div className={styles.emptyState}>Loading…</div>`
- `src/pages/admin/AdminEditor.jsx:582-586` — `.loading` wrapper with a `.loadingSpinner` text node reading `Loading...`
- `src/pages/notes/NotesPage.jsx:103` — inline-styled `Loading...` text
- `src/pages/admin/AdminUsers.jsx:200` — `<div className={styles.fullLoading}>Loading…</div>`
- `src/pages/admin/AdminBrowser.jsx:471` — `<div className={styles.fullLoading}>Loading…</div>` (identical pattern to AdminUsers)
- `src/features/chat/components/ChatPanel/ChatPanel.jsx:29-31` + `ChatPanel.module.css` `.spinner`/`@keyframes spin` — hand-rolled CSS border-spinner, no text

Not in scope: `TenorSearch.jsx`'s GIF grid skeleton and `HomeFeedPage.jsx`'s
`FeedSkeleton` are content-placeholder skeletons (a different pattern from
a spinner/text loading state) and SmoothUI's `grid-loader` is reserved for
Dynamic Island AI states per `docs/design/components.md` — none of these
were touched.

## Impact

Six slightly different implementations of the same concept means
inconsistent visual language (some pages show text, one shows a spinner,
none match) and copy/paste drift if the loading copy or styling ever needs
to change — each site has to be found and edited individually.

## Suggested fix

Add `ldrs` as a dependency and wrap its `Quantum` react component in a new
`src/components/ui/Loading/Loading.jsx` (+ `Loading.module.css`), sized/
colored to match each call site's existing accent token
(`var(--color-accent)` public pages, `var(--accent)` admin pages), with
`role="status"`/`aria-label="Loading"` for accessibility. Swap all six
call sites above to render `<Loading />` instead of their bespoke markup,
and delete the now-unused `ChatPanel.module.css` spinner CSS.

## Acceptance criteria

- [x] `ldrs` added to `package.json` dependencies
- [x] Shared `Loading` component exists in `src/components/ui/Loading/`
- [x] All six call sites listed above render the shared component
- [x] Unused spinner CSS/keyframes removed from `ChatPanel.module.css`
- [x] `npm run build` passes

## References

- https://uiball.com/ldrs/ (Quantum animation)
- `docs/design/components.md` — component library conventions
