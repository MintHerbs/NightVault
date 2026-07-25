-- 0025_hotfix_prod_sidebar_modules_course_id.sql
--
-- Documents a hotfix already applied directly to prod on 2026-07-25 via the
-- Supabase MCP execute_sql tool (not through this repo's migration runner —
-- recorded here after the fact specifically so it doesn't become more
-- undocumented drift, which is the exact problem this migration exists to
-- describe). Restores the public site: every listModules() call (public
-- notes browser AND admin panel) was erroring with "column
-- sidebar_modules.course_id does not exist" because 0024 was only ever
-- applied to local dev, never to prod.
--
-- ─── IMPORTANT: this does NOT reconcile with 0024 ──────────────────────────
-- 0024 (local dev only) creates its own `courses` table: id uuid, name,
-- slug. Prod already had a *different*, pre-existing `courses` table —
-- id text, display_name, created_by, description — created 2026-05-31,
-- entirely outside this repo (no migration file or application code ever
-- referenced it before this). It already holds real rows ('computer-science',
-- 'chemistry', 'computer-with-mathematics') and prod's admin_users.course_id
-- (also pre-existing, also undocumented) already references it.
--
-- This migration's course_id is `text`, matching PROD's existing courses
-- table — deliberately NOT `uuid` like 0024's. Local dev and prod are
-- therefore on two incompatible course_id schemes right now. Do not try to
-- unify them by editing this file or 0024 after the fact (editing an applied
-- migration is drift — see db/README.md); a real reconciliation is its own
-- future migration once the target design (which `courses` table wins, or
-- how they merge) is decided. Until then: full multi-course role/ownership
-- logic (0024's is_primary_owner(), the 'admin' role tier, course-scoped RLS)
-- has NOT been applied to prod and should not be assumed to be active there.
--
-- What prod's admin_users.role and course_id actually look like today,
-- for whoever picks up the reconciliation:
--   - role already has real 'admin' values in use (e.g. a live account) —
--     prod's role check constraint is looser than 0016's 'owner'|'contributor'
--     and was never captured as a migration either.
--   - course_id is NULL for most existing admin_users rows; only accounts
--     created after the pre-existing courses table went in have it set.
--     The app's course filtering treats a null course_id as "no
--     restriction" (shows everything) rather than "show nothing", so this
--     doesn't break access — it's a correctness gap, not an outage.

alter table public.sidebar_modules
  add column if not exists course_id text references public.courses(id);

update public.sidebar_modules
set course_id = 'computer-science'
where course_id is null;
