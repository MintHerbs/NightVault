---
id: T-053
title: Open content create/write to every admin account, keep delete primary-owner-only, and allow files directly under a Subject
status: in-progress
severity: high
area: admin
epic: E-001
created: 2026-07-25
---

## Summary

Contributors cannot create folders at all, and nobody can create a file
directly under a Subject, because the admin browser gates folder creation
on a role tier the production database has never heard of and the note
path model fakes root-level files into a synthetic folder named `notes`.
Separately, the delete row-menu is offered to accounts the database
refuses, and the committed migration 0024 would silently hand delete to
every contributor if it were ever applied to prod.

## Evidence

Live production policy state, read from `pg_policies` and `pg_proc` on
2026-07-25 (not from the repo migrations, which have drifted):

- `admin_can_write_module(text)` in prod is still the 0020 body:
  `role = 'owner' or p_module_id = any(allowed_directories)`. The `admin`
  tier introduced by [0024_course_scoped_roles.sql](../db/sql/0024_course_scoped_roles.sql)
  was never applied — `db/migrations.yaml` records `applied_envs: ["dev"]`.
  The database therefore treats the one `admin`-role account exactly like
  a contributor.
- Eight policies route through that one function: `notes` insert/update,
  `note_folders` insert/update, both delete policies, and the
  `note-images` storage insert/update policies.
- `notes delete locked` and `note_folders delete locked` are
  `admin_can_write_module(module_id) AND admin_is_delete_authorized()`,
  and `admin_is_delete_authorized()` is hardcoded to the primary owner's
  JWT email. Delete is already correctly locked in prod.
- `note-images owner delete` is gated on `is_owner(auth.uid())`, so all
  six `owner`-role accounts can delete images. This is the one delete
  path that does not honour the primary-owner rule.

Client code, written against 0024 rather than against prod:

- [AdminBrowser.jsx:304](../src/pages/admin/AdminBrowser.jsx#L304) —
  `canCreate` for the folder level is `canManageStructure`
  (`isOwner || isAdmin`), so a contributor never sees "New folder" even
  inside a directory the database would let them write.
- [AdminBrowser.jsx:247](../src/pages/admin/AdminBrowser.jsx#L247) — an
  `admin`-role account sees every Subject in the course but can only
  write those in `allowed_directories`, so creates fail with an RLS
  error on the rest.
- [AdminBrowser.jsx:371](../src/pages/admin/AdminBrowser.jsx#L371),
  [:379](../src/pages/admin/AdminBrowser.jsx#L379),
  [:433](../src/pages/admin/AdminBrowser.jsx#L433) — Delete is rendered
  for every contributor and always fails against prod's stricter policy.
  The comments at [:361-364](../src/pages/admin/AdminBrowser.jsx#L361-L364)
  and [useEditorModules.js:140-142](../src/hooks/useEditorModules.js#L140-L142)
  assert delete is write-scoped, describing 0024 and not reality.
- [0024_course_scoped_roles.sql:170-178](../db/sql/0024_course_scoped_roles.sql#L170-L178)
  rewrites both delete policies to plain `admin_can_write_module(module_id)`,
  stripping the primary-owner lock.

Root-level files:

- [notesApi.js:36](../src/lib/notesApi.js#L36) — `displaySubfolder`
  returns `deriveSubfolder(path) ?? 'notes'`, so a note whose `path` has
  no slash is displayed inside a synthetic folder called `notes`
  alongside notes genuinely prefixed `notes/`.
- [AdminBrowser.jsx:263-268](../src/pages/admin/AdminBrowser.jsx#L263-L268)
  returns only folders at the Subject level, so there is no surface on
  which a root-level file could appear or be created.
- [useEditorModules.js:184](../src/hooks/useEditorModules.js#L184) and
  [:201](../src/hooks/useEditorModules.js#L201) hardcode
  `${subfolder}/${filename}`, so every created or moved note is forced
  into a folder.
- [routes/index.jsx:43](../src/routes/index.jsx#L43) is
  `/admin/editor/:moduleId/:subfolder/:slug`; a root file has no
  subfolder segment, and `/admin/editor/:moduleId/:slug` is ambiguous
  with the browse-a-folder route at [:40](../src/routes/index.jsx#L40).
- [NotesBrowserPage.jsx:24-38](../src/pages/notes-browser/NotesBrowserPage.jsx#L24-L38)
  duplicates `subfoldersForModule` and `filesForFolder` from
  [AdminBrowser.jsx:40-58](../src/pages/admin/AdminBrowser.jsx#L40-L58)
  and consumes the same `displaySubfolder`, so the public site needs the
  matching change or root notes vanish from it.

Production `notes` table content by first path segment:

| First segment | Notes | Depth 3+ |
|---|---|---|
| `notes • sem 1` | 16 | 0 |
| `Labs` | 10 | 10 |
| `notes` (literal folder) | 8 | 0 |
| `test` | 1 | 0 |
| root, no slash | 1 | 0 |

## Impact

A contributor opening a Subject they are assigned to has no way to create
a folder: the button is not rendered, even though `note_folders insert
scoped` would accept the insert. The single `admin`-role account sees
Subjects it cannot write and gets an opaque RLS error on create. Every
contributor sees a Delete option on files and folders that always fails.
And no account, including the primary owner, can put a file directly
under a Subject — it is silently filed into a folder named `notes`,
mixed in with the eight notes that really do live there.

The latent risk is 0024: applying it to prod as written, in combination
with widening `admin_can_write_module`, grants delete on every note and
folder to every contributor.

## Suggested fix

Redefine `admin_can_write_module` as "is the caller an admin-panel
account at all", keeping the existing signature so all eight dependent
policies pick up the change without being dropped and recreated. Delete
stays gated by `admin_is_delete_authorized()`; tighten the `note-images`
delete policy to match. Amend 0024 so it no longer strips the lock.

For root files, make `displaySubfolder` return `null` at root and branch
explicitly at each call site, reserve a route sentinel for "no folder",
and render folders and root files together at the Subject level. Hoist
the duplicated `subfoldersForModule` / `filesForFolder` helpers into
`notesApi` so the admin browser and the public browser share one
implementation.

## Acceptance criteria

- [ ] Any account in `admin_users`, regardless of role or
      `allowed_directories`, can create a folder and a file in any
      Subject, and edit any note.
- [ ] Only `moon@mooner.dev` can delete a note, folder, Subject, or note
      image; no other account is shown a delete affordance.
- [ ] Creating a Subject remains owner-only.
- [ ] A file can be created directly under a Subject and appears
      alongside folders in both the admin browser and the public notes
      browser.
- [ ] Inside a folder, only files can be created — no nested folders.
- [ ] Deleting the `notes` folder no longer also deletes the root-level
      note.
- [ ] Applying 0024 to prod can no longer remove the primary-owner
      delete lock.

## Status (2026-07-25)

Code complete. 0027 applied to prod and verified live: `admin_can_write_module`
now reads `exists (select 1 from admin_users where id = auth.uid())`, and all
four delete policies confirmed still primary-owner-gated (`notes`,
`note_folders`, `sidebar_modules` via `admin_is_delete_authorized()`,
`note-images` via `is_primary_owner()`).

Verified: production build passes; the existing `test:tree` suite passes; the
tree change was traced against real prod rows, where exactly one note
(`database` / `getting-started`) moves out of the `notes` folder up to the
Subject level, and every other note is prefixed and unaffected.

**Not verified in a browser.** The repo has no test runner covering these
components (`src/hooks/hooks.test.jsx` has no configured runner, and `vitest`
is not a dependency), so the create picker, the mixed Subject-level listing,
the root-file editor route, and the move-to-top-level option have not been
exercised against a running app. Same gap T-005 hit.

## References

- Epic [E-001](../epics/E-001-admin-panel-hardening.md)
- [db/sql/0024_course_scoped_roles.sql](../db/sql/0024_course_scoped_roles.sql),
  [0022_admin_delete_lock_and_visibility.sql](../db/sql/0022_admin_delete_lock_and_visibility.sql),
  [0020_init_notes.sql](../db/sql/0020_init_notes.sql)
- Follow-up not in scope: the 10 `Labs` notes at depth 3
  (`Labs/C Programming/introduction`) are flattened into `Labs` by the
  two-level UI, hiding the middle segment. Needs its own ticket.
