-- 0046_notes_created_at.sql
--
-- T-076: adds public.notes.created_at so the notes listing can order by when a
-- note was written rather than by its path.
--
-- The table has only ever carried `updated_at` (0020), which every save
-- rewrites — so it says when a note was last touched, not when it appeared.
-- Ordering a Subject's files by it therefore reshuffles the list every time
-- someone edits an old note, which is exactly what the ordering was supposed
-- to stop.
--
-- Backfilled from updated_at. That is an over-estimate for any note edited
-- since it was created, and it is the best this schema can recover: nothing
-- else records the original insert. Since the reader compares created_at at
-- DAY granularity and falls back to a natural-alphanumeric filename sort
-- within a day (see notesApi.compareNotes), an imprecise backfill degrades to
-- "ordered by name", not to a wrong order.

alter table public.notes
  add column if not exists created_at timestamptz not null default now();

comment on column public.notes.created_at is
  'When the note was first inserted. Backfilled from updated_at by 0046 for rows that predate the column, so values before 2026-07-29 are an upper bound, not exact.';

-- notes_set_metadata (0020) sets updated_at/updated_by on every write. It must
-- not touch created_at, and does not — but an UPDATE arriving with a
-- client-supplied created_at would silently rewrite history, so pin it to the
-- stored value on update. Inserts keep whatever they supply (the importer sets
-- it deliberately) or fall through to the DEFAULT.
create or replace function public.notes_freeze_created_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists notes_freeze_created_at_trg on public.notes;
create trigger notes_freeze_created_at_trg
  before update on public.notes
  for each row execute function public.notes_freeze_created_at();

-- ─── Backfill ─────────────────────────────────────────────────────────────
-- Existing rows took the DEFAULT (now()) when the column was added, which dates
-- every pre-existing note to this migration. Pull them back to the only earlier
-- timestamp on record.
--
-- Every trigger on `notes` has to be off for this, each for its own reason, and
-- leaving any one on breaks the migration rather than merely skewing it:
--
--   • notes_freeze_created_at_trg (just created, above) would pin created_at to
--     its current value and silently no-op the entire backfill.
--   • notes_set_metadata_trg (0020) unconditionally assigns
--     `updated_by := auth.uid()`, which is null in a migration — so it would
--     wipe the authorship this backfill is reading from.
--   • notes_track_author_trg (0042) inserts auth.uid() into
--     note_authors.user_id, which is NOT NULL, so with no JWT present it aborts
--     every row. This is the same trap 0042's own backfill documents.
--
-- Disabled through a DO block rather than plain ALTER TABLE statements because
-- notes_track_author_trg only exists where 0042 has been applied, and naming a
-- missing trigger is a hard error. Probed directly 2026-07-29: production does
-- have 0042 (note_authors exists) but not this migration, so all three triggers are
-- present there by the time this block runs and the guard is a no-op. It stays
-- because the runner is not the only way these files get applied, and an
-- environment without 0042 would otherwise fail on the ALTER rather than skip.
do $$
declare
  t text;
  triggers text[] := array[
    'notes_freeze_created_at_trg',
    'notes_set_metadata_trg',
    'notes_track_author_trg'
  ];
  present text[] := '{}';
begin
  foreach t in array triggers loop
    if exists (
      select 1 from pg_trigger
      where tgrelid = 'public.notes'::regclass
        and tgname = t
        and not tgisinternal
    ) then
      present := present || t;
      execute format('alter table public.notes disable trigger %I', t);
    end if;
  end loop;

  update public.notes
  set created_at = updated_at
  where updated_at is not null
    and created_at > updated_at;

  foreach t in array present loop
    execute format('alter table public.notes enable trigger %I', t);
  end loop;
end
$$;

-- Same lockdown as the other trigger functions here (0020, 0042): a trigger
-- body has no business being callable directly over RPC.
revoke execute on function public.notes_freeze_created_at() from public;
revoke execute on function public.notes_freeze_created_at() from anon;

-- Ordering index: the listing sorts by (module_id, created_at).
create index if not exists notes_module_created_idx
  on public.notes (module_id, created_at);
