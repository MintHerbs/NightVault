-- 0023_sidebar_modules_and_images.sql
--
-- Moves the last two GitHub-only admin write paths onto Supabase:
--
--  1. Subjects (id/label/icon) — previously edited by committing regex-surgered
--     JS source to modules.js on GitHub (admin-github-write's commitFile/
--     deleteModule ops). `sidebar_modules` is a new, purpose-built table — NOT
--     a reuse of the existing `subjects` table (0005_init_subjects.sql), which
--     T-030 already flags as unrelated dead schema with a different shape
--     (name/description, no icon, meant for future per-subject content
--     tables). Reusing it here would recreate exactly the confusion that
--     ticket warns about. `icon_name` is a string resolved client-side via
--     ADMIN_ICON_OPTIONS (src/components/admin/adminIconOptions.js) — the
--     live React Icon component never needs to leave code.
--
--     Supersedes `module_visibility` (0022): that table's only job was giving
--     code-defined Subjects somewhere to carry a hidden flag. A real Subject
--     row makes it redundant. 0022 has not been applied anywhere yet
--     (applied_envs: [] for both dev and prod in migrations.yaml), so this is
--     dropped with no migration path needed for existing data — the backfill
--     below is a correctness safety net, not a real data migration.
--
--  2. Note images — previously uploaded straight to the GitHub Contents API
--     (admin-github-write's uploadImage op) and served via a
--     raw.githubusercontent.com rewrite (src/lib/noteImageSrc.js) to dodge
--     GitHub-commits-aren't-live-until-redeploy lag. The `note-images` Storage
--     bucket gives the same instant-publish property notes already have.

-- ─── sidebar_modules ─────────────────────────────────────────────────────────
create table if not exists public.sidebar_modules (
  id         text        primary key,
  label      text        not null,
  icon_name  text        not null,
  sort_order integer     not null default 0,
  hidden     boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id) on delete set null
);

alter table public.sidebar_modules enable row level security;

drop policy if exists "sidebar_modules public read" on public.sidebar_modules;
create policy "sidebar_modules public read"
  on public.sidebar_modules for select
  using ( true );

-- Subject create/rename/hide are owner-only everywhere else in the admin
-- panel today (contributors never manage Subjects, only notes/folders inside
-- their allowed_directories) — no admin_can_write_module scoping needed here.
drop policy if exists "sidebar_modules owner insert" on public.sidebar_modules;
create policy "sidebar_modules owner insert"
  on public.sidebar_modules for insert
  with check ( public.is_owner(auth.uid()) );

drop policy if exists "sidebar_modules owner update" on public.sidebar_modules;
create policy "sidebar_modules owner update"
  on public.sidebar_modules for update
  using ( public.is_owner(auth.uid()) )
  with check ( public.is_owner(auth.uid()) );

-- Delete additionally requires admin_is_delete_authorized() (0022) — same
-- delete lock already applied to notes/note_folders, and a Subject delete is
-- at least as destructive (cascades to every note/folder under it via
-- deleteModuleNotes, unchanged).
drop policy if exists "sidebar_modules delete locked" on public.sidebar_modules;
create policy "sidebar_modules delete locked"
  on public.sidebar_modules for delete
  using ( public.is_owner(auth.uid()) and public.admin_is_delete_authorized() );

create or replace function public.sidebar_modules_set_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists sidebar_modules_set_metadata_trg on public.sidebar_modules;
create trigger sidebar_modules_set_metadata_trg
  before insert or update on public.sidebar_modules
  for each row execute function public.sidebar_modules_set_metadata();

grant select on public.sidebar_modules to anon, authenticated;
grant insert, update, delete on public.sidebar_modules to authenticated;

-- Seed with the 14 Subjects currently hardcoded in modules.js MODULES, in
-- their existing display order. Idempotent — a second run changes nothing.
insert into public.sidebar_modules (id, label, icon_name, sort_order) values
  ('algorithms',              'Algorithms',              'ChartLineUp',   0),
  ('artificial-intelligence', 'Artificial Intelligence',  'Brain',         1),
  ('database',                'Database',                 'Database',      2),
  ('math',                    'Computational Math',       'FunctionIcon',  3),
  ('computer-architecture',   'Computer Architecture',    'Cpu',           4),
  ('computer-networking',     'Computer Networking',      'Network',       5),
  ('computer-security',       'Computer Security',        'ShieldCheck',   6),
  ('computer-vision',         'Computer Vision',          'Eye',           7),
  ('operating-systems',       'Operating Systems',        'HardDrive',     8),
  ('notes',                   'Notes',                    'BookOpen',      9),
  ('labs',                    'Labs',                     'Flask',        10),
  ('programming',             'Programming',               'TerminalWindow',11),
  ('software-engineering',    'Software Engineering',     'Code',         12),
  ('experimental',            'experimental',             'Atom',         13)
on conflict (id) do nothing;

-- Backfill hidden from module_visibility, if any rows exist there, before
-- dropping it below.
update public.sidebar_modules sm
set hidden = mv.hidden
from public.module_visibility mv
where mv.module_id = sm.id;

drop table if exists public.module_visibility;

-- ─── note-images Storage bucket ─────────────────────────────────────────────
-- Public bucket: reads need no RLS policy (Supabase serves public-bucket
-- objects directly). Object path convention mirrors the old GitHub layout
-- minus the "public/notes/img/" prefix: "<module_id>/<n>.<ext>".
insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

-- Insert: reuses the existing admin_can_write_module() helper (0020) against
-- the first path segment — the same owner-or-allowed-directory scoping
-- contributors already have for note content.
drop policy if exists "note-images insert scoped" on storage.objects;
create policy "note-images insert scoped"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'note-images'
    and public.admin_can_write_module((storage.foldername(name))[1])
  );

drop policy if exists "note-images update scoped" on storage.objects;
create policy "note-images update scoped"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'note-images'
    and public.admin_can_write_module((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'note-images'
    and public.admin_can_write_module((storage.foldername(name))[1])
  );

-- Delete: owner-only, matching useImageCleanup's existing owner gate (image
-- cleanup was never contributor-accessible).
drop policy if exists "note-images owner delete" on storage.objects;
create policy "note-images owner delete"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'note-images' and public.is_owner(auth.uid()) );
