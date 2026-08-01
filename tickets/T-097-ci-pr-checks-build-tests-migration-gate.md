---
id: T-097
title: "CI: PR checks — build, full test suite, and migration validation gate"
status: in-progress
severity: high
area: infra
epic: none
created: 2026-08-01
---

## Summary

The only CI check that runs on a PR today is CSS linting
([.github/workflows/lint.yml](../.github/workflows/lint.yml)), which its own
header comment says is deliberately narrow and explicitly defers broader CI to
GitHub issue #9. A PR can currently break the production build, break any of
the 27 existing test files, or ship broken migration SQL, and nothing in CI
will catch it before merge — Vercel deploys `main` straight to users
([vercel.json](../vercel.json)), and there is no branch protection yet
(GitHub issue #10, which is itself blocked on this ticket landing first).

## Evidence

- [.github/workflows/lint.yml](../.github/workflows/lint.yml) runs exactly one
  job: `npm run lint:css`, a single-rule stylelint contrast guard. Its header
  comment (lines 6-9) says: *"Broader CI — a real test suite, build
  verification, GitHub Actions setup — is tracked separately in issue #9 and
  should be designed there rather than accreted onto this file."*
- [package.json](../package.json) defines 9 separate `test:*` scripts
  (`test:math`, `test:hooks`, `test:chem`, `test:recurrence`, `test:tree`,
  `test:logic`, `test:circuits`, `test:erd`, `test:analytics`) covering 27
  test files under `src/lib/`, `src/hooks/`, and `src/test/{tree,erd,
  analytics}/`. None of them are wired into CI. There is also no aggregate
  `npm test` script — nothing chains them together.
- Verified locally (Node 22, matching the Node-20+ requirement noted in
  project memory — the repo's ambient Node 18 is known to break stylelint and
  env-file scripts) that all 27 test files currently pass, and `npm run
  build` (Vite) currently succeeds. This is the known-good baseline this
  ticket should lock in, not fix.
- Every `test:*` script is offline-safe except for one file:
  `src/test/erd/test-gemini-handler.mjs` (part of `npm run test:erd`), which
  fully mocks `global.fetch` — no live API key or network call. The separate,
  *unaggregated* `npm run test:gemini` script does hit the live Gemini API
  with a real key and must not be added to CI.
- No CI job runs `npm run build`. A PR that breaks the Vite build entirely can
  merge today with only the CSS contrast guard as a gate.
- `db/sql/` holds 52 migration files ([db/migrations.yaml](../db/migrations.yaml),
  `schema_version: 52`), and nothing validates that new or changed SQL in
  that folder is even syntactically valid before merge. This is a live risk,
  not a hypothetical one: prod has no migration-tracking table, the shared
  local dev database currently has drift (verified 2026-08-02: checksum
  mismatches on `0045`-`0049`, from past renumbering — the runner refuses
  to apply anything against it until that's resolved, unrelated to this
  ticket), and the 2026-08-01 social/chat outage was traced to drift
  between what `db/migrations.yaml` claimed was applied and actual prod
  state (see `db/README.md` and the commit `docs(db): record actual prod
  migration state after the social/chat outage`). None of this blocks CI's
  migration job, which runs against a stack with no prior history to drift
  against — see Implementation notes.
- `src/hooks/hooks.test.jsx`, flagged in GitHub issue #9 as a "console.log-
  based demo" that needed replacing, already carries a header comment citing
  "project decision T-039: no test framework" — it's intentionally a
  documentation/usage-example file, not a runnable test. The real coverage
  for that hook's contract lives in `src/test/tree/test-library-integration.js`
  via `npm run test:tree`. That specific acceptance criterion in issue #9 is
  already resolved and should be closed out by this ticket, not re-done.

## Impact

A PR that deletes an export the app depends on, introduces a syntax error,
regresses tree/circuit/logic/chem/ERD/recurrence/analytics logic, or ships a
migration file with invalid SQL can be merged to `main` today and Vercel will
deploy it straight to production, with zero automated signal beyond CSS
contrast. The 2026-08-01 outage is a concrete instance of exactly the
migration-drift failure mode this ticket's migration-validation job is meant
to catch pre-merge instead of post-deploy.

## Suggested fix

Add PR-gating CI coverage in four parts. Given `lint.yml`'s own comment
inviting this, either fold these in as additional jobs in that file or add a
sibling `.github/workflows/ci.yml` — whichever reads cleaner; both keep the
existing CSS job as-is.

1. **Aggregate test script.** Add to `package.json`:
   ```json
   "test": "npm run test:math && npm run test:hooks && npm run test:chem && npm run test:recurrence && npm run test:tree && npm run test:logic && npm run test:circuits && npm run test:erd && npm run test:analytics"
   ```
   Deliberately excludes `test:gemini` (hits the live API, needs a real key,
   non-deterministic — wrong for a PR gate).

2. **Build-verification job.** `npm ci && npm run build` on Node 20 (pin for
   the same reason `lint.yml` already does — Vite 5 compatible, current LTS,
   avoids the Node 18 breakage noted in project memory).

3. **Test-suite job.** `npm ci && npm test` on Node 20. Budget for
   `test:circuits` being the slow one (its fuzz suite takes several minutes
   locally) when setting any job timeout.

4. **Migration-validation job (new coverage, not a rerun of the app tests).**
   Apply changed/added files under `db/sql/*.sql` against a fresh disposable
   Postgres in the workflow (an Actions `postgres:` service container, or
   PGlite — project memory already has precedent for validating migrations
   with PGlite locally when docker/psql aren't available) and fail the job on
   any SQL error. Scope to changed files in the PR diff, applied in
   `db/migrations.yaml` order, against a clean schema — this is about
   catching broken SQL before merge, not re-certifying the full historical
   migration chain on every PR.

All four should run on `pull_request` targeting `main` (and on push to
`main`), matching `lint.yml`'s existing trigger shape, so the resulting
status checks are available for GitHub issue #10 (branch protection) to
require once this lands.

## Implementation notes (2026-08-02)

- Built as a new sibling workflow, [.github/workflows/ci.yml](../.github/workflows/ci.yml),
  rather than folding into `lint.yml` — three independent jobs (`build`,
  `test`, `migrations`), all Node 20, same trigger/concurrency shape as
  `lint.yml`. `lint.yml` itself is untouched.
- `npm test` added to [package.json](../package.json), chaining all 9
  `test:*` scripts. Verified locally: full run passes, ~4m15s (dominated by
  `test:circuits`'s fuzz suite) — `test` job has a 15-minute timeout.
- **Migration job deviates from the "scope to changed files" suggestion
  above.** Instead of diffing the PR for changed `db/sql/*.sql` files, it
  applies the *entire* manifest (`npm run db:migrate -- --ci`) to a
  freshly started local Supabase stack (`supabase/setup-cli` action +
  `supabase start`), using the real runner rather than a from-scratch
  reimplementation. This is a stronger check — it validates that the whole
  manifest is still buildable from nothing, which a diff-only check
  wouldn't catch — and reuses `scripts/db-migrate.mjs` as-is instead of
  writing a second migration-running codepath to maintain. Chose real
  Supabase (via the CLI) over a bare `postgres:` container or PGlite
  because 14 of 52 SQL files reference `auth.*` and 4 reference
  `storage.*`, which only the real local stack provides — this also
  matches the CI approach already sketched (and now filled in) in
  [docs/runbooks/local-supabase.md §5](../docs/runbooks/local-supabase.md).
- **This surfaced a real, pre-existing defect while testing.** Running the
  full manifest from scratch failed at `0025`
  (`invalid input syntax for type uuid: "computer-science"`) — `0025` and
  `0026` are prod-only hotfixes written against prod's pre-existing
  `courses` table (`id text`), which is a different table from the one
  `0024` creates (`id uuid`); this divergence was already documented in
  both files' headers but had never actually been exercised end-to-end
  before. Rather than editing either file (never edit an applied
  migration) or silently working around it, added a `ci_skip: true` field
  to those two entries in `db/migrations.yaml`, taught
  `scripts/db-migrate.mjs --ci` to skip anything so flagged, and filed
  [T-098](T-098-courses-table-schema-fork-dev-vs-prod.md) to track the
  actual reconciliation. Verified: with `0025`/`0026` skipped, all other
  50 migrations apply cleanly to a fresh instance, and a second `--ci` run
  is a clean no-op (idempotent).
- Not yet done, and deliberately left for the user rather than taken
  autonomously: closing/commenting on GitHub issue #9. Also left a scratch
  verification directory (`/home/moon/Desktop/Projects/ci-migration-test`,
  an isolated throwaway Supabase project used only to test the migration
  job) for the user to remove — outside the sandboxed scratchpad, so
  automatic cleanup wasn't permitted even after the user approved it.

### Self review (2026-08-02)

Two real issues found and fixed before push, both in `.github/workflows/ci.yml`:

- **Unverified build-without-`.env` claim.** `.env`/`.env.local` are
  gitignored (`git ls-files` confirms neither is tracked), so a fresh CI
  checkout has neither — but my first `npm run build` verification ran
  with `.env` already sitting in the working directory, which isn't
  representative. Re-ran with both files moved out entirely: `npm run
  build` still exits 0 (`src/lib/supabaseClient.js` degrades gracefully
  when the Supabase env vars are unset, per its own `isSupabaseConfigured`
  check). Confirmed for real rather than assumed.
- **`supabase/setup-cli` was pinned to `latest`, package.json pins `supabase`
  devDependency to `2.98.2`.** `latest` would let CI silently drift onto a
  CLI version nobody has run locally against this repo's
  `supabase/config.toml`. Changed to `'2.98.2'` in both `ci.yml` and its
  mirrored excerpt in `docs/runbooks/local-supabase.md` §5 (which still
  said `latest` after the first edit — caught the doc/workflow mismatch on
  re-read).

Also tightened: added `timeout-minutes: 10` to the `build` job (the other
two jobs already had one; `build` didn't); corrected `ci.yml`'s own header
comment, which claimed it validates "changed" `db/sql/*.sql` files —
actual behavior (by design, see the migration-job comment in the file
itself) is the full manifest minus `ci_skip` entries; corrected this
ticket's Evidence section, which cited a 4-day-old memory claiming
`db:migrate` drift was on migration `0024` — re-verified against the live
shared dev DB today and the drift has since moved to `0045`-`0049`;
updated the stale memory file too.

Re-ran after fixes: `npm run build` (clean env, exit 0), `npm test` (all
27 files, exit 0), `npm run db:migrate -- --ci` against a fresh isolated
Supabase instance (0 failures, 2 skipped, idempotent on re-run), `npm run
db:migrate -- --status` against the shared dev DB (unchanged drift
output — confirms `--ci` didn't alter default behavior), YAML
re-validated with `js-yaml` after every edit. No scope leaks: this
session's other pre-existing dirty/untracked files (chat feature
changes, `inspect_*.mjs`, etc.) are untouched and excluded from the
commit.

## Acceptance criteria

- [x] `npm test` exists in `package.json` and runs all 9 existing `test:*`
      scripts (not `test:gemini`, not `db:migrate`)
- [x] A CI job runs `npm run build` on every PR to `main` and fails the PR if
      the build breaks
- [x] A CI job runs `npm test` on every PR to `main` and fails the PR if any
      of the 27 test files regress
- [x] A CI job validates the `db/sql/*.sql` manifest against a real
      (disposable) Postgres instance and fails the PR on invalid SQL —
      implemented as a full-manifest fresh apply rather than a diff-only
      check, see Implementation notes
- [x] All new jobs are pinned to Node 20, matching `lint.yml`'s existing
      justification
- [x] The existing CSS contrast-guard job in `lint.yml` is unaffected and
      still runs
- [ ] CI passes on the PR that adds this workflow — pending: workflow not
      yet pushed/opened as a PR
- [ ] GitHub issue #9 is closed/commented, pointing to this ticket, noting
      the `hooks.test.jsx` criterion was already resolved (T-039) and the
      test-runner criterion is superseded (plain Node scripts already exist
      and are now wired into CI, not Vitest) — pending user confirmation
      before commenting/closing a GitHub issue

## References

- [.github/workflows/lint.yml](../.github/workflows/lint.yml) — existing CSS-only CI, header comment defers broader CI to issue #9
- GitHub issue #9 — "Add real test suite and GitHub Actions CI workflow" (partially stale; this ticket supersedes its CI-workflow scope)
- GitHub issue #10 — "Require approving review before merge to main" (blocked on this ticket; natural follow-up once CI status checks exist, out of scope here)
- [tickets/T-039-bplus-tree-correctness.md](T-039-bplus-tree-correctness.md) — project decision behind `hooks.test.jsx` being documentation, not a test
- [db/README.md](../db/README.md), [db/migrations.yaml](../db/migrations.yaml) — migration manifest and the 2026-08-01 drift incident
- [tickets/T-098-courses-table-schema-fork-dev-vs-prod.md](T-098-courses-table-schema-fork-dev-vs-prod.md) — the `courses` table divergence this ticket's implementation discovered and worked around via `ci_skip`
