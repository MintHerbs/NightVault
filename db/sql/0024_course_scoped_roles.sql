-- 0024_course_scoped_roles.sql
-- T-051: course-scoped ownership hierarchy (primary owner / owner / admin /
-- contributor) and per-course Subjects.
--
-- Full design: docs/specs/course-roles-and-user-management.md.

-- ─── courses ─────────────────────────────────────────────────────────────────
-- Resolves T-030: the dead `subjects` table (0005) was never wired up, and its
-- name collides with this codebase's unrelated existing "Subject" concept
-- (sidebar_modules, 0023 — e.g. Algorithms, Database). `courses` gets the
-- "future per-subject content" role T-030's header comment described,
-- correctly named this time.
drop table if exists public.subjects;

create table public.courses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

-- Read open to any authenticated admin account — the course switcher needs
-- to list all courses for the primary owner; a course-locked account only
-- ever resolves its own course_id anyway. Not public yet — no public-facing
-- multi-tenant site per the spec's non-goals.
drop policy if exists "courses authenticated read" on public.courses;
create policy "courses authenticated read"
  on public.courses for select
  to authenticated
  using ( true );

-- Primary owner check — mirrors admin_is_delete_authorized (0022), but its
-- own named helper since it now gates more than delete (course/owner
-- creation too, in the create-user Edge Function). Checks the verified JWT
-- email, never admin_users.email — that's an editable profile column, not
-- an identity claim; see 0022's header for why that distinction matters.
create or replace function public.is_primary_owner()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'moon@mooner.dev';
$$;

drop policy if exists "courses primary owner insert" on public.courses;
create policy "courses primary owner insert"
  on public.courses for insert
  with check ( public.is_primary_owner() );

drop policy if exists "courses primary owner update" on public.courses;
create policy "courses primary owner update"
  on public.courses for update
  using ( public.is_primary_owner() )
  with check ( public.is_primary_owner() );

revoke execute on function public.is_primary_owner() from public;
grant execute on function public.is_primary_owner() to authenticated;

grant select on public.courses to authenticated;
grant insert, update on public.courses to authenticated;

-- Seed the first course from today's single implicit tenant.
insert into public.courses (name, slug)
values ('Computer Science', 'computer-science')
on conflict (slug) do nothing;

-- ─── admin_users: course scoping + the 'admin' tier ─────────────────────────
alter table public.admin_users
  add column if not exists course_id uuid references public.courses(id);

update public.admin_users
set course_id = (select id from public.courses where slug = 'computer-science')
where course_id is null;

alter table public.admin_users
  drop constraint if exists admin_users_role_check;
alter table public.admin_users
  add constraint admin_users_role_check check (role in ('owner', 'admin', 'contributor'));

-- Course lookup for the calling user — security definer so the admin_users
-- SELECT policy below can compare course_id without recursing into RLS on
-- itself (same pattern as is_owner, 0017).
create or replace function public.admin_course_id(p_user_id uuid)
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select course_id from public.admin_users where id = p_user_id;
$$;

revoke execute on function public.admin_course_id(uuid) from public;
grant execute on function public.admin_course_id(uuid) to authenticated;

-- Replaces "Owners can view all admin users" (0016/0017): visibility is now
-- course-scoped instead of "any owner sees everyone." "Users can view own
-- profile" (0016) still applies unchanged — narrowing it isn't in scope
-- here, and it's harmless overlap with the `id = auth.uid()` clause below.
drop policy if exists "Owners can view all admin users" on public.admin_users;
create policy "Course members can view same-course admin users"
  on public.admin_users for select
  using (
    id = auth.uid()
    or public.is_primary_owner()
    or course_id = public.admin_course_id(auth.uid())
  );

-- ─── sidebar_modules: course scoping ─────────────────────────────────────────
alter table public.sidebar_modules
  add column if not exists course_id uuid references public.courses(id);

update public.sidebar_modules
set course_id = (select id from public.courses where slug = 'computer-science')
where course_id is null;

-- Subject create/rename/hide stay owner-only (unchanged from 0023) but now
-- additionally confined to the owner's own course, so an owner from one
-- course can't create or edit Subjects in another.
drop policy if exists "sidebar_modules owner insert" on public.sidebar_modules;
create policy "sidebar_modules owner insert"
  on public.sidebar_modules for insert
  with check (
    public.is_owner(auth.uid())
    and (course_id = public.admin_course_id(auth.uid()) or public.is_primary_owner())
  );

drop policy if exists "sidebar_modules owner update" on public.sidebar_modules;
create policy "sidebar_modules owner update"
  on public.sidebar_modules for update
  using (
    public.is_owner(auth.uid())
    and (course_id = public.admin_course_id(auth.uid()) or public.is_primary_owner())
  )
  with check (
    public.is_owner(auth.uid())
    and (course_id = public.admin_course_id(auth.uid()) or public.is_primary_owner())
  );

-- ─── admin_can_write_module (0020): course-aware, and 'admin' gets
-- owner-equivalent write scope within their course instead of being
-- restricted to allowed_directories (spec §3 role matrix) ──────────────────
create or replace function public.admin_can_write_module(p_module_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users au
    join public.sidebar_modules sm on sm.id = p_module_id
    where au.id = auth.uid()
      and (au.course_id = sm.course_id or public.is_primary_owner())
      and (au.role in ('owner', 'admin') or p_module_id = any(au.allowed_directories))
  );
$$;

-- ─── Delete: role/course scoping replaces the single hardcoded email ───────
-- 0022 locked all content delete to one email regardless of role, as a
-- stopgap. The new role matrix has contributors and admins deleting within
-- their own scope, same as write — admin_can_write_module (above) already
-- encodes that correctly (role + course + directory), so note/folder delete
-- no longer needs an extra check on top of it.
drop policy if exists "notes delete locked" on public.notes;
create policy "notes delete locked"
  on public.notes for delete
  using ( public.admin_can_write_module(module_id) );

drop policy if exists "note_folders delete locked" on public.note_folders;
create policy "note_folders delete locked"
  on public.note_folders for delete
  using ( public.admin_can_write_module(module_id) );

-- Whole-Subject delete stays in the narrower, more-destructive category (it
-- cascades to every note/folder underneath, unchanged) — the hardcoded
-- single email generalizes to "primary owner, or this course's own owner"
-- instead of being dropped outright.
create or replace function public.admin_is_delete_authorized(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_primary_owner() or exists (
    select 1 from public.admin_users au
    where au.id = auth.uid() and au.role = 'owner' and au.course_id = p_course_id
  );
$$;

drop policy if exists "sidebar_modules delete locked" on public.sidebar_modules;
create policy "sidebar_modules delete locked"
  on public.sidebar_modules for delete
  using ( public.is_owner(auth.uid()) and public.admin_is_delete_authorized(course_id) );

revoke execute on function public.admin_is_delete_authorized(uuid) from public;
grant execute on function public.admin_is_delete_authorized(uuid) to authenticated;

-- Superseded by the course-aware version above.
drop function if exists public.admin_is_delete_authorized();
