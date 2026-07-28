---
id: T-071
title: Note authorship audit trail — created_by, multi-author tracking, and author display
status: in-progress
severity: high
area: admin
epic: E-009
created: 2026-07-28
---

## Implementation status (2026-07-28)

Code-complete per the Suggested fix below:

- `db/sql/0042_note_authorship.sql` — schema, trigger split, backfill
  (registered in `db/migrations.yaml` as id `0042`).
- `src/lib/notesApi.js` — `listNotes()`/`getNote()` now select `id` and
  `updated_by`; added `listNoteAuthors()`, `getNoteAuthors()`,
  `mergeAuthorLists()`, `authorsForFolder()`, `authorsForModule()`.
- `src/hooks/useNotesRegistry.js` / `useAdminModulesRegistry.js` thread
  the author map into `mergeNotesIntoModules()`.
- `src/components/common/AvatarGroup/AvatarGroup.jsx` — new shared
  component (stacked chips, `HoverCard` popover, `AppearancePopover`'s
  spring), used by all three surfaces below.
- `AdminBrowser.jsx`, `NotesBrowserPage.jsx`, `NoteReader.jsx` (+
  `NotesPage.jsx` to fetch a single note's authors) wired to real
  authors instead of the stub.

**Not verified**: this session had no Docker daemon running, so the
local Supabase stack (`npx supabase start`) was unreachable and
`npm run db:migrate` could not be applied or checked against a real
database — confirmed via `npm run db:migrate -- --status`, which failed
to connect to `127.0.0.1:54322`. `npm run build` passes; every
acceptance criterion below that requires a live database is still
unchecked pending: start Docker Desktop, `npx supabase start`, `npm run
db:migrate`, then work through the checklist.

**Self-review (2026-07-28) caught and fixed three real bugs before any
of this was verified against a database:**
1. The backfill originally left `notes_track_author_trg` (AFTER) enabled
   while disabling only `notes_set_metadata_trg` (BEFORE). With no JWT in
   a direct SQL migration, `auth.uid()` is null, so the AFTER trigger's
   `insert into note_authors (note_id, user_id) values (new.id, null)`
   would have violated `user_id`'s `not null` constraint and aborted
   every backfill `UPDATE` outright. Fixed: both triggers are now
   disabled for the backfill and re-enabled together afterward.
2. `listNoteAuthors()`/`getNoteAuthors()` threw on a Postgres error. Both
   are called inside a `Promise.all()` alongside `listNotes()`/
   `listModules()`/`listNoteFolders()` in the registry hooks — if this
   frontend ships before `0042` is actually applied to an environment
   (a real risk here, since it couldn't be applied this session),
   `note_authors`/`admin_profiles_public` won't exist yet, the query
   errors, and the whole `Promise.all` would reject — taking down the
   entire notes/Subjects listing on both the public site and the admin
   panel, not just the avatars. Fixed: both now log and degrade to an
   empty result instead of throwing, matching the resilience the
   registry hooks already apply one layer up.
3. `AvatarGroup` originally used `Popover` opened via `onMouseEnter` with
   no close handling. Radix `Popover` only dismisses on outside-click/
   Escape, so hovering a row and moving away without clicking left it
   stuck open — and since each row's `open` state is independent,
   sweeping the mouse down a list of many rows could leave several
   popovers open at once. Switched to Radix `HoverCard` (already
   available via the installed `radix-ui` meta-package, no new
   dependency), which tracks real pointer enter/leave and closes itself.

`npm run build` passes after all three fixes.



## Summary

`notes` has no `created_by` and no multi-author history — `updated_by` is
overwritten on every save, so the original author is lost the moment
someone else edits a note. Nothing in the UI reads even that: the admin
Owner column is a hardcoded stub, and the public site shows no attribution
at all. Add real author tracking (one or more people per note) and wire it
into the two places it needs to show up.

## Evidence

- [db/sql/0020_init_notes.sql:44-54](../db/sql/0020_init_notes.sql#L44-L54) —
  `notes` has `updated_by uuid references auth.users(id)` only, no
  `created_by`.
- [db/sql/0020_init_notes.sql:136-157](../db/sql/0020_init_notes.sql#L136-L157) —
  the existing `notes_set_metadata()` trigger is `BEFORE INSERT OR UPDATE`
  and unconditionally does `new.updated_by := auth.uid()`. Any new logic
  that needs the row's `id` to already exist in the table (e.g. writing to
  a child table via FK) cannot live in this trigger — see Suggested fix.
- [src/pages/admin/AdminBrowser.jsx:751](../src/pages/admin/AdminBrowser.jsx#L751)
  and
  [:775-777](../src/pages/admin/AdminBrowser.jsx#L775-L777) — the table
  already has an "Owner" column header, but every row renders
  `{username.charAt(0).toUpperCase()}` / `"me"` — `username` is the
  *logged-in admin*, not data from the row (`item`) at all.
- [src/pages/notes-browser/NotesBrowserPage.jsx:260-264](../src/pages/notes-browser/NotesBrowserPage.jsx#L260-L264)
  (table head) and
  [:282-286](../src/pages/notes-browser/NotesBrowserPage.jsx#L282-L286)
  (row) — the public Drive-style browser (the one in the screenshot) is a
  strict 2-column grid, Name + Date modified only. No owner/author concept
  exists here at all.
- [src/components/markdown/NoteReader/NoteReader.jsx:19-25](../src/components/markdown/NoteReader/NoteReader.jsx#L19-L25) —
  the note-reading view takes an optional `eyebrow` string rendered
  directly above the content; no author prop exists.
- [src/lib/notesApi.js:152-166](../src/lib/notesApi.js#L152-L166) and
  [:181-198](../src/lib/notesApi.js#L181-L198) — `listNotes()`/`getNote()`,
  shared by both the admin and public browsers, select
  `module_id, path, title, updated_at, hidden` / `..., content_md, hidden`.
  Neither selects `id` or `updated_by` — both need adding regardless of
  this ticket, since nothing downstream can join to per-note authorship
  without the note's own `id`.
- [db/sql/0016_init_admin_users.sql:21-34](../db/sql/0016_init_admin_users.sql#L21-L34) —
  `admin_users` SELECT policy only allows an owner to see all rows, or a
  user their own row. Anon (the public site) cannot join to it directly to
  read a name — a public-safe view is required, not a policy loosening.
- Live schema check (Supabase MCP, read-only, 2026-07-28): `admin_users` on
  the live project has **no `email`, `avatar_url`, `display_name`, or
  `updated_at` column** at all — it has drifted from
  `0016_init_admin_users.sql`/`0024_course_scoped_roles.sql` (same drift
  already documented for `courses` in T-051). Only
  `id, username, role, allowed_directories, created_at, course_id` exist.
  Any migration here must be additive against the *live* shape, not assume
  the SQL files are current.

## Impact

Right now every note in the admin browser visually claims to be owned by
whoever happens to be logged in, which is actively misleading (e.g. Rheva
opening the admin panel would see her own avatar next to Noorie's Database
notes). On the public site, junior readers have no way to know which
mentor wrote a given set of notes — the entire stated purpose of this
feature ("juniors can see the names of the mentor who created the notes").

## Suggested fix

**Schema** (new migration, next free number after `0041`):

```sql
alter table public.notes add column created_by uuid references auth.users(id) on delete set null;
alter table public.admin_users add column display_name text;
alter table public.admin_users add column avatar_url text;

create table public.note_authors (
  note_id              uuid not null references public.notes(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  first_contributed_at timestamptz not null default now(),
  last_contributed_at  timestamptz not null default now(),
  contribution_count   int not null default 1,
  primary key (note_id, user_id)
);
alter table public.note_authors enable row level security;
create policy "note_authors public read" on public.note_authors for select using (true);
-- No direct insert/update/delete policy: only the SECURITY DEFINER trigger
-- function below writes to this table.

create view public.admin_profiles_public as
  select id, coalesce(display_name, username) as display_name, avatar_url
  from public.admin_users;
grant select on public.admin_profiles_public to anon, authenticated;
```

**Trigger split** — extend the existing `notes_set_metadata()` (BEFORE) to
also stamp `created_by` on INSERT:

```sql
if tg_op = 'insert' then new.created_by := auth.uid(); end if;
```

Add a **separate AFTER INSERT OR UPDATE** trigger for `note_authors` — it
must be AFTER, not folded into the BEFORE trigger above, because the
`note_authors.note_id` FK requires the `notes` row to already exist in the
table, which is only true once the BEFORE trigger returns and Postgres
performs the actual write:

```sql
create function public.notes_track_author() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.note_authors (note_id, user_id)
  values (new.id, auth.uid())
  on conflict (note_id, user_id) do update
    set contribution_count = note_authors.contribution_count + 1,
        last_contributed_at = now();
  return new;
end $$;

create trigger notes_track_author_trg
  after insert or update on public.notes
  for each row execute function public.notes_track_author();
```

**Backfill** — verified against the live project (Supabase MCP, read-only,
2026-07-28), not assumed:

| Notes | `created_by`/`updated_by` → | Basis |
|---|---|---|
| `database` (2 rows) | already Noorie | no-op, already correct |
| `software-engineering` "Semester 1" (3 rows) | already maisara | no-op, already correct |
| `math` "notes • sem 2" (5 rows) | already nusaibah | no-op, already correct |
| `computer-architecture` "notes/lecture-{1,2,3}-*" (3 rows, currently `updated_by NULL`) | Rheva (`481224f9-caba-4b7a-9875-dde7b0ab956f`) | 4th note in this module (lecture-4) is already self-stamped to Rheva; these are the same "sem 1 fundamentals" set |
| `math` "notes • sem 1" (16 rows, currently `NULL`) | **Munazir (moon) AND Nahla** (`9ccb7fbc-7e67-4d34-bd62-48feb7edca9f`) — two `note_authors` rows each, not one | user correction, 2026-07-28 |
| All remaining `updated_by IS NULL` rows (computer-vision, operating-systems, test, web — ~14 rows) | Munazir (`662b1d4d-e875-402d-9dce-f226cd3c7680`, moon@mooner.dev) | "all other notes is tracked to me" |
| `computer-architecture` sem 2 / `programming` | **do not backfill — no rows exist yet** | Ismail and Zakiyyah (`zak`) haven't written anything yet; the trigger will attribute them correctly the moment they save |

Backfill SQL must run with the BEFORE trigger disabled
(`alter table public.notes disable trigger notes_set_metadata_trg`, ...
`enable trigger ...`) — otherwise `notes_set_metadata()`'s unconditional
`new.updated_by := auth.uid()` overwrites the backfilled value with `NULL`,
since a direct SQL migration runs with no JWT / `auth.uid()` context. The
AFTER `note_authors` trigger can stay enabled since it reads `auth.uid()`
into an INSERT, not an overwrite — but since it would also insert `NULL`
as the `user_id` in that same no-JWT context (violating the `not null`
constraint and aborting the whole statement), the backfill migration must
instead insert directly into `note_authors` itself (not rely on the
trigger) using `notes.updated_at` as `first_contributed_at`/
`last_contributed_at` and `contribution_count = 1`.

**Display — admin (`AdminBrowser.jsx`)**: replace the `cellOwner` stub
(lines 775-777) with the row's real author(s) sourced from
`note_authors` joined to `admin_profiles_public` — a small avatar (photo or
initials-fallback chip) per author, stacked if more than one, same
component as the public site (below) so there's one implementation, not
two.

**Display — public (`NotesBrowserPage.jsx` + `NoteReader.jsx`)**: add a new
`AvatarGroup` component (stacked circular avatars, "+N" overflow past 3)
whose trigger opens a Radix `Popover` listing each author's avatar + name.
Reuse the motion recipe already in
[AppearancePopover.jsx:48-51](../src/components/layout/AppearancePopover/AppearancePopover.jsx#L48-L51)
(`initial={{opacity:0,scale:0.92,y:8}}`, spring `stiffness:400 damping:30`)
rather than adding a new animation dependency — it's already the "soft"
feel asked for. Place it in `NotesBrowserPage.jsx` as a new third grid
column (list view) / small badge under the name (grid view, which has no
metadata row today), and in `NoteReader.jsx` next to the existing
`eyebrow` element. On folder/module rows in `NotesBrowserPage.jsx` (which
have no single note behind them), show the **deduped union** of authors
across all notes contained in that folder — same `AvatarGroup` component,
just fed a merged author list, so folder rows and file rows look
consistent (resolves the "individual notes vs folders" open question from
the original spec discussion in favor of showing it on both).

## Acceptance criteria

- [ ] `notes.created_by` exists and is stamped on INSERT only, never
      overwritten on UPDATE
- [ ] `note_authors` records every distinct person who has ever saved a
      note, with accurate `contribution_count`
- [ ] Backfill matches the table above exactly, including the two-author
      `note_authors` rows for all 16 "math sem 1" notes (Munazir + Nahla)
- [ ] `computer-architecture` sem 2 and `programming` have zero
      `note_authors`/`created_by` rows post-migration (nothing backfilled
      for Ismail or Zakiyyah)
- [ ] `admin_profiles_public` exposes only `id`, `display_name`,
      `avatar_url` — confirmed no `email`/`role`/`allowed_directories`
      leak via `select * from admin_profiles_public` as an anon key
- [ ] `AdminBrowser.jsx`'s Owner column shows each row's real author(s),
      not the logged-in admin
- [ ] `NotesBrowserPage.jsx` shows author avatars on both file rows and
      folder rows (deduped union), in both list and grid view
- [ ] `NoteReader.jsx` shows author avatars near the eyebrow/title
- [ ] Hovering an avatar group opens a popover listing every author's
      avatar + name, animated with the same spring scale/fade as
      `AppearancePopover`
- [ ] A note with no author on record (shouldn't exist post-backfill, but
      defensively) renders no avatar group rather than erroring

## References

- E-009 — parent epic
- T-072 — adds the Settings page that lets people set a real
  `avatar_url`/`display_name` on the columns this ticket creates; until
  then, avatars fall back to initials
- T-051 — prior art for the "live schema has drifted from the SQL files"
  problem this ticket also hit on `admin_users`
