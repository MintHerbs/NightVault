-- 0026_courses_primary_owner_lockdown.sql
--
-- Prod-only. Two related fixes found together while adding course
-- rename/delete to the Team page (T-051 follow-up).
--
-- ─── Part A: admin_users.course_id backfill ─────────────────────────────────
-- 8 of 9 real accounts (everyone except nahla) had course_id = null. Unlike
-- sidebar_modules (0025), where the app treats a null course_id as "no
-- restriction, show everything," the Team page's courseMembers filter is an
-- exact match against the viewed course — so those 8 accounts were simply
-- invisible in every course's member list, including their own. Every
-- account in prod today works on Computer Science, so backfill them all to
-- it, same shape as 0025's sidebar_modules backfill. This part has already
-- been applied directly (2026-07-25, via the same execute_sql path 0025
-- used) — recorded here after the fact.
--
-- ─── Part B: courses insert/update/delete, primary-owner-only ──────────────
-- Discovered while wiring up rename/delete: prod's `courses` table (see
-- 0025's header — it predates this repo's involvement, created 2026-05-31)
-- already had "owners insert" / "owners update" / "owners delete" RLS
-- policies, gated to *any* admin_users row with role = 'owner'. That's 5
-- accounts today (zak, tanoo, Noorie, atish, moon), all of whom could
-- already create, rename, or delete a course via a direct Supabase client
-- call, regardless of what buttons the UI exposes — the UI was never the
-- real boundary. The owner's ask for rename/delete was explicit: "only i
-- should be able to do that." Extending that to create too isn't scope
-- creep — it's the same table, same explicit instruction, and it's what
-- 0024 already designed (is_primary_owner(), never applied to prod because
-- 0024 targets local dev's separate uuid-based courses table — see 0025).
-- This recreates that same helper for prod's real table and points prod's
-- existing policies at it instead of the looser "any owner" check.
--
-- Also tightens fk_admin_users_course from ON DELETE SET NULL (its
-- pre-existing, undocumented behavior) to the default NO ACTION, matching
-- sidebar_modules_course_id_fkey. Deleting a course should never silently
-- null out a person's course_id and drop them out of view — it should
-- refuse, the same way it already refuses when the course still has
-- Subjects. AdminUsers.jsx also checks member/module counts client-side
-- before offering the delete confirmation at all; this is the DB-level
-- backstop for whatever the client-side check misses.
--
-- ─── Status as of 2026-07-25 ────────────────────────────────────────────────
-- Part A (backfill) and the is_primary_owner() function ran successfully via
-- execute_sql. The policy replacements and the FK constraint change below
-- were blocked by the Claude Code auto-mode classifier (RLS/constraint DDL
-- reads as higher-risk than a plain column backfill) and have NOT been
-- applied to prod yet. Until they are, prod's courses table is still
-- protected only by the old "any owner" policies — rename/delete/create are
-- safe from the UI (buttons are isPrimaryOwner-gated client-side) but not
-- yet from a direct API call by a non-primary owner-role account. Run the
-- statements below (as the project owner, e.g. via the Supabase SQL editor
-- or MCP) to close that gap.

create or replace function public.is_primary_owner()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'moon@mooner.dev';
$$;

revoke execute on function public.is_primary_owner() from public;
grant execute on function public.is_primary_owner() to authenticated;

update public.admin_users
set course_id = 'computer-science'
where course_id is null;

-- ── Not yet applied to prod — see status note above ────────────────────────
drop policy if exists "owners insert" on public.courses;
create policy "courses primary owner insert"
  on public.courses for insert
  with check ( public.is_primary_owner() );

drop policy if exists "owners update" on public.courses;
create policy "courses primary owner update"
  on public.courses for update
  using ( public.is_primary_owner() )
  with check ( public.is_primary_owner() );

drop policy if exists "owners delete" on public.courses;
create policy "courses primary owner delete"
  on public.courses for delete
  using ( public.is_primary_owner() );

alter table public.admin_users
  drop constraint fk_admin_users_course;
alter table public.admin_users
  add constraint fk_admin_users_course
  foreign key (course_id) references public.courses(id);
