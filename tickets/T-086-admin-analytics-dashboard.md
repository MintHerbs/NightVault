---
id: T-086
title: Add an admin analytics dashboard for page and tool usage
status: in-progress
severity: medium
area: admin
epic: none
created: 2026-07-31
---

## Summary

The admin panel has no visibility into how the site is actually used. There is
no pageview or event table anywhere in `db/sql/`, and no analytics package in
`package.json`, so questions like "which tools do people use", "which notes are
being read", and "where do visitors go from the home page" are currently
unanswerable. This adds the instrumentation plus a Material You dashboard
reachable from the admin navbar.

A feature request rather than a defect, filed as a ticket so the design
decisions below have somewhere to live.

## Evidence

Nothing tracks navigation or tool use today:

- `db/sql/` holds 51 migrations; none creates a pageview, event, or metric
  table. The closest existing counters are single-purpose quota rows:
  `api_calls` (`0003`), `rate_limits` (`0035`), and `erd_rate_limits` /
  `erd_cache` (`0051`).
- No analytics dependency in [package.json](../package.json), and
  [vercel.json](../vercel.json) contains only a SPA rewrite, so Vercel Web
  Analytics is not enabled either.
- [src/App.jsx:16](../src/App.jsx#L16) already calls `useLocation()` and reads
  `session_id` from localStorage at line 36, but only to toggle per-route
  chrome. Every navigation passes through here unrecorded.
- The admin panel's three existing pages (`/admin/editor`, `/admin/users`,
  `/admin/settings`) are wired in [src/routes/index.jsx:44-53](../src/routes/index.jsx#L44-L53).
  There is no fourth surface for reporting.

Data that already exists and needs no new instrumentation, so the dashboard
should read it directly rather than re-collecting it:

- `notes.created_at` / `updated_at` / `created_by` / `updated_by`
  (`0020`, `0042`, `0046`).
- `note_authors` — per-note, per-person ledger with `first_contributed_at`,
  `last_contributed_at`, `contribution_count` (`0042`).
- `sessions` (`0002`) — one row per anonymous browser, but `last_seen` only.
- `erd_cache.hit_count` and `erd_rate_limits` (`0051`).
- `posts`, `comments`, `post_votes`, `comment_votes`, `post_flags`, `polls`
  (`0029`-`0034`), and `messages` (`0001`).

## Impact

Without this, tool investment is guesswork. Three concrete cases already in the
tree that no one can currently evaluate:

- `/experimental` ([academiaRoutes.jsx:26](../src/routes/academiaRoutes.jsx#L26))
  is deliberately unlisted and unlinked. Whether anyone has ever found it is
  unknown.
- The CPA calculator and "min effort, max result" tools were fused into the
  Grade Toolkit, with the old paths kept as redirects
  ([academiaRoutes.jsx:31-35](../src/routes/academiaRoutes.jsx#L31-L35)).
  Whether that fusion matched demand, and which half people arrive for, is
  unknown.
- Notes are written and revised with no signal about which chapters are read.

## Suggested fix

Three tables, one migration, plus a server-side write path.

**Why `/api/` and not a client-side Supabase write.** The event vocabulary is
an allowlist the caller must not be able to extend, which puts it on the `/api/`
side of the boundary in
[architecture-update.md §3.1](../docs/architecture-update.md). `api_calls`
(`0003`) shipped with fully open insert/update RLS for want of exactly this and
had to be closed in `0048`; repeating that mistake with a table that accepts
arbitrary text keys would hand anyone with the anon key a free write-anything
store. The analytics tables therefore get no anon grants at all and are written
only by the service role, matching `erd_rate_limits`.

**Aggregate counters, not an event log.** Row count stays bounded by
routes × sessions × days instead of growing per navigation, and the tables
cannot accumulate a per-person browsing trail, which keeps this consistent with
the no-raw-IP stance already taken in `0051`.

Four ranking correctness requirements, all forced by the current route table:

1. Alias routes must collapse to one canonical key. `/logic/tableaux`,
   `/logic/truth-tree`, and `/logic/semantic-tableaux` are one page; so are
   `/algo/complexity` + `/algo/code-complexity` and `/algo/recurrence` +
   `/algo/recurrence-relation`. Keyed literally, tableaux traffic splits three
   ways and under-ranks.
2. Redirect hops must not count as visits. `/` renders
   `<Navigate to="/home">`, so a naive pathname effect records a hit on a path
   that is not a page. Same for `/notes-browser`, `/tools/cpa-calculator`, and
   `/tools/lazy-grades`. Keep them as an entry-alias dimension instead.
3. Notes must key on note identity, not the `/notes/:section/*` pattern, or the
   entire note corpus collapses into one row.
4. Rank on distinct sessions, not raw hits. Tools get reloaded repeatedly by
   one person while a note is read once, so raw hits systematically overrate
   tools.

Opened-versus-used is the metric that actually answers "which tools do people
use", since a pageview alone cannot distinguish a bounce from thirty inserts.

## Acceptance criteria

- [x] Migration `0052` creates `page_hits`, `note_reads`, `route_transitions`
      and `tool_events`, and adds `sessions.first_seen`, all with RLS on and no
      anon/authenticated grants. (`note_reads` was split out from `page_hits`
      during implementation — a PK column cannot be NULL, so a nullable note
      discriminator was not expressible, and the separate table gets an FK to
      `notes` that cascades read counts away on delete.)
- [x] `POST /api/analytics` accepts a batch, validates every route and event key
      against a server-side allowlist, drops unknown keys, and is rate limited
      per hashed IP. No raw IP is stored. The limiter is analytics-owned
      (`analytics_rate_limits` + `analytics_check_and_increment()`) rather than a
      reuse of 0051's, so analytics does not depend on the ERD feature's schema
      being applied and neither feature's abuse control moves the other. It fails
      **open**, unlike the ERD limiter: refusing an analytics write protects
      nothing and loses data, whereas refusing a generation protects a metered
      third-party quota.
- [x] Alias routes collapse to one canonical key; redirect hops are recorded as
      entry aliases and excluded from the page ranking.
- [x] Note reads are keyed per note and joinable to `notes.updated_at`.
- [x] Tool events come from a fixed allowlist covering tree, ERD, tableaux,
      logic proof, complexity, recurrence, grade toolkit, and the notes browser.
- [x] `/admin/analytics` renders overview tiles, a top-pages ranking by distinct
      sessions, a top-notes ranking, a tool leaderboard with
      opened / used / activation / uses per person, entry points, the flow
      between pages, contributors, and recently updated notes.
- [x] The dashboard is reachable from the admin navbar and gated to
      owner + admin, matching the existing `isOwner || isAdmin` gate on the
      Manage users button.
- [x] `/admin/*` traffic is never recorded, and contributors can opt their own
      sessions out (eye-slash toggle in the dashboard top bar). `doNotTrack` is
      honoured too.
- [x] Styling uses only the existing `--md-*` / `--admin-md-*` tokens and CSS
      Modules. No MUI or `@material/web` (`docs/rules.md §5.2`,
      `docs/design.md`).
- [x] Analytics failures are always non-fatal to the page the visitor is on.

## Verification

- `npm run test:analytics` — 113 checks on the allowlist and route
  canonicalisation, 34 on the API's validation boundary. All pass.
- `npm run build`, `npx stylelint "src/**/*.css"` — clean.
- `npm run test:tree` / `test:erd` / `test:logic` — unaffected, all pass.
- `0052_analytics.sql` was executed against a real Postgres (PGlite/WASM, with
  Supabase's `auth.*`, roles and referenced tables stubbed) and its behaviour
  exercised end to end: alias exclusion from pageview totals, opened-vs-used,
  duplicate keys within one batch summing rather than raising
  `ON CONFLICT ... cannot affect row a second time`, an unresolvable note id
  dropping without aborting the batch, accumulation across calls, the
  `analytics_can_view()` refusal for a contributor, zero-filled daily series,
  range clamping, FK cascade, and `analytics_prune()`. Two real defects were
  found and fixed this way: ranked panels had no total order, so tied rows
  reshuffled between loads, and `generate_series` on bare dates resolved to the
  `timestamptz` overload, which could land a day on the wrong side of a time
  zone and break the join to `page_hits.day`.

**Role grants are the one thing not proven.** PGlite accepted the
`REVOKE`/`GRANT` statements but does not reproduce Supabase's role semantics, so
that anon genuinely cannot reach `analytics_record()` still needs confirming
against a real Supabase project — the exact gotcha noted against `0048`/`0051`.

## Remaining

`0052` is **not applied to any environment**. `db:migrate` is still blocked on
the 0024 drift, so it needs applying by hand (psql or the Supabase SQL editor)
as `0051` was, and `SUPABASE_SECRET_KEY` must be present in the Vercel
environment. Until then the dashboard renders empty and
`POST /api/analytics` returns 204, which is the intended unconfigured
behaviour rather than a failure.

## References

- [docs/architecture-update.md §3.1](../docs/architecture-update.md) — server
  vs client boundary
- [docs/design.md](../docs/design.md) — appearance system, M3 token rules
- `db/sql/0048_storage_limits_and_api_calls_lockdown.sql` — why open insert RLS
  on a counter table is not acceptable
- `db/sql/0051_erd_generation_quota.sql` — hashed-IP and SECURITY DEFINER
  precedent this follows
- `db:migrate` is blocked on the 0024 drift, so `0052` is applied by hand like
  `0051` was.
