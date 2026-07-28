-- 0042_note_authorship.sql
-- T-071: note authorship audit trail.
--
-- notes.updated_by is overwritten on every save, so the original author is
-- lost the moment a second person edits a note, and there is no way to
-- represent more than one contributor. This adds:
--   - notes.created_by, stamped once on INSERT, never touched on UPDATE
--   - note_authors, a per-note/per-person contribution ledger
--   - admin_users.display_name / .avatar_url (T-072 fills these in via UI)
--   - admin_profiles_public, a public-safe view so anon/authenticated can
--     resolve a name/avatar without RLS on admin_users granting them
--     row-level access to admin_users itself (email/role/allowed_directories
--     must never leak to the public site).

alter table public.notes add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.admin_users add column if not exists display_name text;
alter table public.admin_users add column if not exists avatar_url text;

-- ─── note_authors ────────────────────────────────────────────────────────────
create table if not exists public.note_authors (
  note_id              uuid not null references public.notes(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  first_contributed_at timestamptz not null default now(),
  last_contributed_at  timestamptz not null default now(),
  contribution_count   int not null default 1,
  primary key (note_id, user_id)
);

alter table public.note_authors enable row level security;

drop policy if exists "note_authors public read" on public.note_authors;
create policy "note_authors public read"
  on public.note_authors for select
  using ( true );
-- No insert/update/delete policy: only the SECURITY DEFINER trigger function
-- below (notes_track_author) writes to this table.

grant select on public.note_authors to anon, authenticated;

-- ─── admin_profiles_public ───────────────────────────────────────────────────
-- admin_users' own RLS only lets an owner see every row, or anyone see their
-- own — the public site cannot join to it directly to resolve a name. This
-- view exposes just enough to attribute a note; it deliberately runs with the
-- view owner's privileges (Postgres default for views), the same trust
-- boundary a SECURITY DEFINER function would use, so it can read every row of
-- admin_users while only ever emitting these three columns.
create or replace view public.admin_profiles_public as
  select id, coalesce(display_name, username) as display_name, avatar_url
  from public.admin_users;

grant select on public.admin_profiles_public to anon, authenticated;

-- ─── Trigger split ───────────────────────────────────────────────────────────
-- notes_set_metadata (BEFORE, existing) now also stamps created_by, but only
-- on INSERT — every later UPDATE leaves it alone, unlike updated_by.
create or replace function public.notes_set_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  if tg_op = 'UPDATE' and new.module_id is distinct from old.module_id then
    if not public.is_owner(auth.uid()) then
      raise exception 'Only owners can move a note to a different subject';
    end if;
  end if;
  return new;
end;
$$;

-- note_authors' note_id FK needs the notes row to already exist, which is
-- only true once the BEFORE trigger returns and Postgres performs the actual
-- write — so this has to be a separate AFTER trigger, not folded into the one
-- above.
create or replace function public.notes_track_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.note_authors (note_id, user_id)
  values (new.id, auth.uid())
  on conflict (note_id, user_id) do update
    set contribution_count = note_authors.contribution_count + 1,
        last_contributed_at = now();
  return new;
end;
$$;

drop trigger if exists notes_track_author_trg on public.notes;
create trigger notes_track_author_trg
  after insert or update on public.notes
  for each row execute function public.notes_track_author();

-- Same intent as notes_set_metadata (0020): a trigger function has no
-- business being callable directly via RPC. Unlike 0020's version, this also
-- revokes from anon/authenticated explicitly, not just public — this
-- project's Supabase stack grants EXECUTE on new public-schema functions
-- directly to anon/authenticated/service_role via ALTER DEFAULT PRIVILEGES,
-- so those roles never inherited it via PUBLIC and revoking from PUBLIC
-- alone is a no-op for them (verified against pg_proc.proacl locally).
revoke execute on function public.notes_track_author() from public, anon, authenticated;

-- ─── Backfill ─────────────────────────────────────────────────────────────
-- Verified against the live project (Supabase MCP, read-only, 2026-07-28) —
-- see T-071's evidence/backfill table, not assumed from the SQL files.
--
-- Runs with both triggers disabled. notes_set_metadata_trg's unconditional
-- `new.updated_by := auth.uid()` would otherwise null out every value this
-- backfill sets, since a direct SQL migration has no JWT (auth.uid() is
-- null here). notes_track_author_trg reads auth.uid() into an INSERT rather
-- than overwriting anything, but that INSERT would still supply a null
-- user_id in this same no-JWT context — note_authors.user_id is NOT NULL,
-- so left enabled it would abort every one of these UPDATEs outright. The
-- note_authors rows it would otherwise have written are added explicitly,
-- below, once both triggers are back on.
alter table public.notes disable trigger notes_set_metadata_trg;
alter table public.notes disable trigger notes_track_author_trg;

-- computer-architecture: lecture-{1,2,3} were never stamped; lecture-4 is
-- already correctly Rheva's and is left untouched by the IS NULL guard.
-- computer-architecture's "sem 2" folder has no rows yet (Ismail/Zakiyyah
-- haven't written anything) so this cannot touch it either.
update public.notes
   set updated_by = '481224f9-caba-4b7a-9875-dde7b0ab956f',
       created_by = '481224f9-caba-4b7a-9875-dde7b0ab956f'
 where module_id = 'computer-architecture'
   and updated_by is null;

-- math "notes • sem 1": user-confirmed dual authorship (Munazir + Nahla).
-- "notes • sem 2" is already correctly nusaibah's (non-null), so this only
-- reaches the 16 sem 1 rows. The legacy single-value columns can only carry
-- one uuid; Munazir anchors them here, note_authors below carries both.
update public.notes
   set updated_by = '662b1d4d-e875-402d-9dce-f226cd3c7680',
       created_by = '662b1d4d-e875-402d-9dce-f226cd3c7680'
 where module_id = 'math'
   and updated_by is null;

-- Everything else still unattributed (computer-vision, operating-systems,
-- test, web) is tracked to Munazir per "all other notes is tracked to me".
-- The 'programming' module has no rows yet, so this cannot touch it either.
update public.notes
   set updated_by = '662b1d4d-e875-402d-9dce-f226cd3c7680',
       created_by = '662b1d4d-e875-402d-9dce-f226cd3c7680'
 where updated_by is null;

alter table public.notes enable trigger notes_set_metadata_trg;
alter table public.notes enable trigger notes_track_author_trg;

-- note_authors backfill: the trigger only fires on future writes, so
-- pre-existing rows need their ledger entries written directly, using
-- updated_at as both contribution timestamps and contribution_count = 1.
--
-- Nahla's row for math sem 1 first (the one case a single updated_by can't
-- express) ...
insert into public.note_authors (note_id, user_id, first_contributed_at, last_contributed_at, contribution_count)
select id, '9ccb7fbc-7e67-4d34-bd62-48feb7edca9f', updated_at, updated_at, 1
from public.notes
where module_id = 'math' and updated_by = '662b1d4d-e875-402d-9dce-f226cd3c7680'
on conflict (note_id, user_id) do nothing;

-- ... then one row per note from its own (post-backfill) updated_by, covering
-- every other module's already-correct authors (Noorie, maisara, nusaibah)
-- plus everything just set above (Rheva, Munazir).
insert into public.note_authors (note_id, user_id, first_contributed_at, last_contributed_at, contribution_count)
select id, updated_by, updated_at, updated_at, 1
from public.notes
where updated_by is not null
on conflict (note_id, user_id) do nothing;
