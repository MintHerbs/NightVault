-- 0046_courses_hidden.sql
-- T-077: lets the primary owner hide a course from the public site without
-- deleting it (Subjects, notes, and admin_users rows scoped to it are
-- untouched — this only gates whether the home page and that course's own
-- routes surface it).
--
-- Additive only, deliberately schema-agnostic about `courses.id`'s type:
-- dev's courses table (0024) uses `id uuid`, prod's pre-existing courses
-- table (see 0025's header) uses `id text, display_name` and was created
-- outside this repo's migrations entirely. Neither matters here — a new
-- independent boolean column is safe to add either way. Do NOT use this
-- migration as a place to also reconcile the id-type drift; that's its own
-- future migration once the target design is decided (see 0025 §"IMPORTANT:
-- this does NOT reconcile with 0024").
--
-- Read policy follows sidebar_modules' existing precedent exactly
-- (0023_sidebar_modules_and_images.sql: `using (true)`, hidden filtered
-- client-side in useNotesRegistry.js) rather than encoding `hidden` into the
-- RLS predicate itself — courses.is_primary_owner() is granted EXECUTE to
-- `authenticated` only (0026), so an `OR is_primary_owner()` branch in a
-- public SELECT policy would risk "permission denied for function" for the
-- anon role, since Postgres does not guarantee left-to-right short-circuit
-- evaluation of OR. Write/rename/delete stay gated by the existing "courses
-- primary owner update" policy (0026) — hidden is just another column an
-- update to this row can change, no new write policy needed.

alter table public.courses
  add column if not exists hidden boolean not null default false;

alter table public.courses enable row level security;

drop policy if exists "courses public read" on public.courses;
create policy "courses public read"
  on public.courses for select
  using ( true );

grant select on public.courses to anon, authenticated;
