---
id: T-098
title: "Reconcile the two incompatible `courses` tables (0024 uuid vs prod's pre-existing text)"
status: backlog
severity: medium
area: infra
epic: none
created: 2026-08-02
---

## Summary

There are two different, incompatible `courses` tables depending on which
environment you're looking at. `db/sql/0024_course_scoped_roles.sql` creates
one with `id uuid`. Prod already had its own `courses` table — `id text`,
created 2026-05-31, entirely outside this repo — before `0024` was ever
written. `0025` and `0026` were written against prod's text-keyed table and
fail outright if applied on top of a fresh `0024` schema (`invalid input
syntax for type uuid: "computer-science"`). This was already known and
documented by whoever wrote those files; it became a concrete blocker while
implementing T-097 (CI migration validation), which discovered it by
literally running the full manifest against a freshly created schema — the
first time anyone had actually replayed `0001`→`0052` from nothing.

## Evidence

- [db/sql/0025_hotfix_prod_sidebar_modules_course_id.sql](../db/sql/0025_hotfix_prod_sidebar_modules_course_id.sql)
  header: *"0024 (local dev only) creates its own `courses` table: id uuid,
  name, slug. Prod already had a different, pre-existing `courses` table —
  id text, display_name, created_by, description — created 2026-05-31,
  entirely outside this repo... Local dev and prod are therefore on two
  incompatible course_id schemes right now."*
- [db/sql/0026_courses_primary_owner_lockdown.sql](../db/sql/0026_courses_primary_owner_lockdown.sql)
  header: *"Prod-only... what 0024 already designed (is_primary_owner(),
  never applied to prod because 0024 targets local dev's separate
  uuid-based courses table — see 0025)."*
- Reproduced directly (2026-08-02): applying the full manifest to a
  freshly started, isolated local Supabase stack (`npx supabase start` in a
  scratch project, port-shifted to avoid the shared dev stack) succeeds
  through `0024`, then `0025` fails with `invalid input syntax for type
  uuid: "computer-science"` — the migration inserts a prod course slug
  into a column whose type/FK target is `0024`'s uuid-keyed table on a
  from-scratch schema.
- As a stopgap for T-097, `0025` and `0026` are now marked `ci_skip: true`
  in [db/migrations.yaml](../db/migrations.yaml) so CI's fresh-schema
  migration check can validate the other 50 migrations; see
  [db/README.md](../db/README.md) and
  [docs/runbooks/local-supabase.md §5](../docs/runbooks/local-supabase.md).
  That flag is a workaround, not a fix — it exists specifically so this
  ticket has something to remove once the tables are reconciled.
- `0049_courses_hidden.sql` and `0050_courses_cover.sql` both `alter table
  public.courses` and were written/applied assuming `0024`'s table (they
  don't reference `0025`/`0026` at all), so at least two later migrations
  are already implicitly taking a side in this fork without saying so.

## Impact

- Local dev and prod cannot run the same migration chain and end up in the
  same state — a contributor who runs `npm run db:migrate` against a fresh
  local stack gets `0024`'s uuid schema; prod has never run `0024` at all
  and instead has its own pre-`0024` table plus the `0025`/`0026`
  hotfixes. Nobody has verified what `0049`/`0050` (both applied to prod
  per `applied_envs`) actually did to prod's text-keyed table versus what
  they were written against.
- Every future migration that touches `courses` or `course_id` has to be
  written twice in the author's head — once for local dev's schema, once
  for prod's — with no automated check that both actually work, since
  `ci_skip` makes CI validate only the dev-side branch.
- `db:migrate` can never be pointed at prod as-is: `0025`/`0026` are
  recorded `applied_envs: ["prod"]` but were applied via direct
  Supabase MCP `execute_sql` calls, never through the runner, so prod's
  `schema_migrations` bookkeeping doesn't actually reflect them — the
  same class of untracked-drift problem noted in
  `docs/prod-db-has-no-migration-tracking` (2026-08-01 outage retro).

## Suggested fix

Not attempted here — this is a schema-design decision the ticket
deliberately leaves open, per `0025`'s own header ("a real reconciliation
is its own future migration once the target design is decided"). Options
worth weighing when picking this up:

1. Migrate prod's `courses.id` from `text` to `uuid` (matching `0024`),
   with a mapping migration for any FK'd rows (`admin_users.course_id`,
   `sidebar_modules.course_id`).
2. Change `0024` to match prod's `text`-keyed design instead, and rewrite
   `is_primary_owner()`/RLS accordingly.
3. Whichever direction is chosen, write it as a new migration that
   supersedes `0024`+`0025`+`0026` together (never edit an applied
   migration — see `db/README.md`), remove their `ci_skip` flags, and
   confirm a fresh CI run applies the full chain with no skips.

## Acceptance criteria

- [ ] `courses` has one schema, chosen deliberately, applied identically
      via the runner to a fresh local stack and to prod
- [ ] `0025` and `0026` (or their replacements) no longer carry `ci_skip`
      in `db/migrations.yaml`
- [ ] `npm run db:migrate -- --ci` in CI applies the entire manifest with
      zero skipped entries
- [ ] `db/README.md`'s courses-table history section is updated to
      describe the reconciled state, not just the fork

## References

- [tickets/T-097-ci-pr-checks-build-tests-migration-gate.md](T-097-ci-pr-checks-build-tests-migration-gate.md) — the CI work that surfaced this
- [db/README.md](../db/README.md) — courses/admin_users drift history (2026-07-27 correction)
- [db/sql/0025_hotfix_prod_sidebar_modules_course_id.sql](../db/sql/0025_hotfix_prod_sidebar_modules_course_id.sql), [0026_courses_primary_owner_lockdown.sql](../db/sql/0026_courses_primary_owner_lockdown.sql)
