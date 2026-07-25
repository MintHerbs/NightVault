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

-- ─── Delete: still primary-owner-only ──────────────────────────────────────
-- SUPERSEDED BY T-053 (0027). This section originally dropped 0022's
-- admin_is_delete_authorized() conjunct from the notes/note_folders delete
-- policies, on the reasoning that the role matrix should let contributors and
-- admins delete within the same scope they can write. The owner's rule is the
-- opposite and explicit: everyone in the admin panel creates and edits, only
-- the primary owner deletes. Applying the original version to prod would have
-- handed delete on every note and folder to every contributor.
--
-- The policies are restated here rather than removed so that applying this
-- migration to an environment that already has 0022 is a no-op on delete
-- rather than a silent relaxation.
drop policy if exists "notes delete locked" on public.notes;
create policy "notes delete locked"
  on public.notes for delete
  using ( public.admin_can_write_module(module_id) and public.admin_is_delete_authorized() );

drop policy if exists "note_folders delete locked" on public.note_folders;
create policy "note_folders delete locked"
  on public.note_folders for delete
  using ( public.admin_can_write_module(module_id) and public.admin_is_delete_authorized() );

-- Whole-Subject delete stays in the narrower, more-destructive category (it
-- cascades to every note/folder underneath, unchanged). The course-aware
-- overload below is kept because the course model still needs it, but per
-- T-053 it is no longer what gates Subject delete: "primary owner, or this
-- course's own owner" would let any of the six owner-role accounts delete a
-- Subject, and the rule is primary owner only. The policy below therefore
-- still uses the zero-arg 0022 check.
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
  using ( public.is_owner(auth.uid()) and public.admin_is_delete_authorized() );

revoke execute on function public.admin_is_delete_authorized(uuid) from public;
grant execute on function public.admin_is_delete_authorized(uuid) to authenticated;

-- The zero-arg 0022 version is deliberately NOT dropped here. Three delete
-- policies (notes, note_folders, sidebar_modules) depend on it; dropping it
-- was what made this migration's original delete relaxation possible.
