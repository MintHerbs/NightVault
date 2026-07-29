---
id: T-076
title: Order notes by date created, then naturally by number/name
status: done
severity: medium
area: notes
epic: E-004
created: 2026-07-29
---

## Summary

Both note listings ordered files by title with a plain `localeCompare`, so a
numbered set read "Chapter 1, Chapter 10, Chapter 11, Chapter 12, Chapter 2,
Chapter 20, Chapter 3, …". There was also no way to order by when a note was
written, because `public.notes` never had a `created_at` column.

## Evidence

- `NotesBrowserPage.jsx:169` (before this ticket) —
  `a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })`, with the
  default sort `{ key: 'name', dir: 'asc' }` at line 78. No `numeric` option, so
  digit runs compare character by character.
- `AdminBrowser.jsx:290` — the same comparator, separately written. The two
  pages each carried their own copy, so they could disagree.
- `notesApi.js:187` `listNotes()` selected `updated_at` only and ordered by
  `path`; `0020_init_notes.sql:45` confirms the table has never had a
  `created_at`.
- Verified against the local stack before the fix: `web/notes` listed Chapter 1,
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 2, 20, 3, 4, … in that order.

## Impact

Any Subject whose notes are numbered past 9 reads in the wrong order in both the
public browser and the admin panel — for a 20-chapter course that is most of the
list. Sorting by "Modified" is no substitute: every save rewrites `updated_at`,
so editing an old note jumps it to one end.

## Fix

- **0046_notes_created_at.sql** adds `notes.created_at` (default `now()`,
  backfilled from `updated_at`, since nothing else records the original insert),
  a BEFORE UPDATE trigger pinning it so a save cannot rewrite it, and a
  `(module_id, created_at)` index. The backfill disables all three triggers on
  `notes` inside a DO block — `notes_track_author_trg` (0042) aborts on a null
  `auth.uid()`, `notes_set_metadata_trg` (0020) would null `updated_by`, and the
  new freeze trigger would no-op the backfill itself. The block checks
  `pg_trigger` first, because 0042 is not applied everywhere and naming a missing
  trigger is a hard error.
- **notesApi.js** gains `compareNotes` / `compareRowsByCreated` /
  `compareRowsByName`, shared by both pages so they cannot drift again.
  Ordering is **created day, then natural name** — day granularity, not raw
  timestamp, because a batch imported together differs only by milliseconds of
  insert order, which would scatter ch01…ch20 arbitrarily. Rows sort on the
  filename (`sortKey`) rather than the title, so an index note titled "Web &
  Mobile Development…" but named `00-module-overview` sorts first instead of
  under W.
- `listNotes()` requests `created_at` optimistically and retries without it if
  the column is absent, the same way `listNoteAuthors` tolerates 0042 being
  unapplied. Without that, one un-migrated environment would 400 the whole
  notes query and take down the sidebar and the public browser.
- Both listings default to `created`, expose "Date created" in the sort menu, and
  swap the date column's header and value to match the active sort.

## Acceptance criteria

- [x] A numbered set reads 1, 2, 3, … 20 rather than 1, 10, 11, 2, 20
- [x] The live browser and the admin panel show identical order — verified with
      both open on `web/notes`, 22 rows, lists byte-identical
- [x] A note genuinely created earlier sorts above a later batch —
      `jquery.md` (Jul 26) sits above the chapters (Jul 29)
- [x] An index note sorts first despite its title
- [x] `created_at` survives a save (freeze trigger verified directly: the UPDATE
      succeeds, the value does not change)
- [x] The backfill dates rows from `updated_at`, not from migration time —
      79/79 rows match, 0 wrongly dated today
- [x] Re-running the migration is idempotent
- [x] Applied to production — run via the dashboard SQL editor 2026-07-29;
      verified after: `created_at` present on all 65 rows then in the table, 0 with
      `created_at > updated_at` (so the backfill reached every row), and
      `web/notes/jquery` correctly dated 2026-07-26 rather than migration day

## Notes

The migration is applied to both environments as of 2026-07-29 (see **Migration
numbering** below for how, and why the file is now 0046 rather than 0045). Since
neither run touched `schema_migrations`, the runner will re-apply the file once
0024's drift is resolved, which is safe: it is idempotent and its backfill is a
no-op on a second pass (`created_at > updated_at` matches nothing once the values
are equal).

The `listNotes()` fallback path is therefore no longer exercised in either
environment, but it stays: it is what keeps one un-migrated environment from
400-ing the whole notes query and taking down the sidebar.

## Migration numbering

This was authored as **0045** and applied to dev and prod under the filename
`0045_notes_created_at.sql`. While it sat unshipped, `0045_contributor_photo_
syncs_avatar.sql` (T-072 follow-up, PR #65) merged to main and took that id, so
the file was **renumbered to 0046** here.

Renumbering is safe: neither application went through `npm run db:migrate` (dev
via `docker exec psql`, prod via the dashboard SQL editor), because 0024's
pre-existing drift still blocks every run of the runner. So no environment holds
a `schema_migrations` row binding this migration to an id, and there is nothing
for the new number to contradict. The column, trigger and index are already in
place in both environments regardless of what the file is called.

## How this shipped despite the T-077 entanglement

At the time T-075 shipped, this ticket's two UI files each carried another
ticket's in-flight work in the same diff, and `NotesBrowserPage.jsx` could not be
committed without T-077's routes: it reads `courseId` from `useParams`, which was
`undefined` against main's routes, so the course filter returned `[]` and the
public browser rendered zero Subjects.

That resolved in two different ways:

- **AdminBrowser.jsx** stopped being a problem on its own. Its foreign hunk was
  T-072's Settings nav item, and T-072 has since merged, so the file's diff
  against main is now T-076's changes only.
- **NotesBrowserPage.jsx** was **reconstructed** rather than copied: T-076's
  changes were re-applied by hand to main's version of the file, so none of
  T-077's course scoping came along. T-077 keeps its own working-tree copy and is
  unaffected.
