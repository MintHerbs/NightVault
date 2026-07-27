---
id: T-067
title: Reconstruct db/sql/0006-0015 from the deployed social schema
status: in-progress
severity: high
area: infra
epic: E-008
created: 2026-07-27
---

## Unblocked and written (2026-07-27)

The Supabase MCP connector supplied the access this ticket was blocked on. The
schema was read out of the live project and transcribed into `0028`-`0038`,
listed in `db/migrations.yaml` and summarised in `db/README.md`. The "Access
needed" section below is kept as the record of what was missing and how it was
obtained.

Still open: none of `0028`-`0038` has been run yet, against production or a
fresh local database, so the acceptance criteria below stay unticked. They are
written to be no-ops against production.

Three things found during transcription that were not visible from the
OpenAPI document, and that are reproduced as-deployed rather than corrected:

- The vote-count sync triggers exist but are doubly broken. Filed as T-068 and
  fixed in `0039`.
- The social RLS ownership checks can never match, and three tables have
  missing or disabled policies. Filed as T-069.
- `posts_code_lines` checks `string_to_array(code, '\n')`, which with
  `standard_conforming_strings` on splits on a literal backslash-n rather than
  a newline, so the 1000-line cap does not work. Recorded in `0029`, not fixed.

## Summary

The ten migrations that are supposed to declare the entire social schema
(`posts`, `post_votes`, `post_flags`, `comments`, `comment_votes`, `polls`,
`poll_votes`, `rate_limits`, `bot_blacklist`, plus their RLS policies, RPCs
and realtime publication) are 0-byte files. The repo therefore has no written
record of the schema the social feed and chat run on, cannot rebuild it, and
`db/README.md` describes contents that do not exist.

## Evidence

All ten files are empty, and all ten are listed in the manifest as real
migrations:

```
$ ls -l db/sql/000[6-9]* db/sql/001[0-5]*
0 db/sql/0006_init_posts.sql        0 db/sql/0011_init_polls.sql
0 db/sql/0007_init_post_votes.sql   0 db/sql/0012_init_rate_limits.sql
0 db/sql/0008_init_post_flags.sql   0 db/sql/0013_social_rls.sql
0 db/sql/0009_init_comments.sql     0 db/sql/0014_social_rpcs.sql
0 db/sql/0010_init_comment_votes.sql 0 db/sql/0015_social_realtime.sql
```

`db/migrations.yaml:65-138` lists ids `0006` through `0015`, each pointing at
one of those empty files.

`db/README.md:39-48` documents contents for each of them, including a
"vote-count sync trigger" for `0007` and `0010`, a "depth-enforcement trigger"
for `0009`, and an "auto-flag trigger" for `0008`. None of those exist in the
repo. `db/README.md:50-53` further claims "the migrations were extracted from
the live schema so the repo finally has a written record", which is false for
this range.

Migrations `0001`-`0005` and `0016`-`0027` are all non-empty, so this is
specific to the social range, not a general convention.

## Impact

**A fresh local stack has no social tables at all.** `npm run db:migrate`
against a new database applies ten no-ops and records all ten as applied. The
resulting database cannot serve `/social/feed` or `/social/chat`, because
`posts`, `comments` and `rate_limits` were never created. This is why T-064
could not be verified locally even setting Docker aside: bringing the local
stack up would not have produced a database the feed could talk to.

**Facts the code depends on are unknowable from the repo.** Three examples
found while reviewing T-064:

- `usePosts.js` and `useComments.js` call `upsert(..., { onConflict:
  'post_id,session_id' })` and `{ onConflict: 'comment_id,session_id' }`,
  which require unique constraints on those column pairs. Nothing in the repo
  confirms they exist.
- The replica identity of `post_votes` determines whether realtime UPDATE and
  DELETE payloads carry the columns the vote handlers read. T-064 had to code
  defensively around not knowing this, and one gap (foreign vote removal)
  cannot be closed without knowing it.
- `db/README.md` claims a vote-count sync trigger maintains vote totals. If one
  existed, the client-side counting in `loadFeedExtras()` would be redundant
  and possibly conflicting. It appears not to exist, but the only way to be
  sure is to inspect the live database.

**No disaster recovery path.** If the Supabase project were lost, the social
schema could not be recreated from this repo.

## Verified so far (2026-07-27)

Introspected the deployed project read-only via the PostgREST OpenAPI document
(`GET /rest/v1/` with the service key), which exposes columns, types,
nullability, defaults, primary keys and foreign keys. Everything below is
observed, not inferred.

All ten social tables exist, plus `flagged_posts_review`, and all four social
RPCs exist (`check_and_increment_rate_limit`, `check_bot_blacklist`,
`set_session_id`, `soft_delete_post`, `soft_delete_comment`).

Every table's primary key is a `uuid id DEFAULT gen_random_uuid()` except
`rate_limits` and `bot_blacklist`, whose PK is `session_id`. Every
`session_id` is a FK to `sessions.id`; every `post_id` is a FK to `posts.id`.
All timestamps are `timestamptz NOT NULL DEFAULT now()`.

| table | columns beyond `id` / FKs / `created_at` |
|---|---|
| `posts` | `title text`, `content text NOT NULL`, `code text`, `code_language text DEFAULT 'python'`, `gif_url text`, `upvotes int NOT NULL DEFAULT 0`, `downvotes int NOT NULL DEFAULT 0`, `flag_count int NOT NULL DEFAULT 0`, `is_flagged bool NOT NULL DEFAULT false`, `is_deleted bool NOT NULL DEFAULT false`, `is_edited bool NOT NULL DEFAULT false`, `updated_at` |
| `post_votes` | `vote_type text NOT NULL` |
| `post_flags` | (none) |
| `comments` | `parent_comment_id uuid` FK to `comments.id`, `content text NOT NULL`, `upvotes int NOT NULL DEFAULT 0`, `downvotes int NOT NULL DEFAULT 0`, `is_deleted bool NOT NULL DEFAULT false`, `depth int NOT NULL DEFAULT 0` |
| `comment_votes` | `vote_type text NOT NULL` |
| `polls` | `options jsonb NOT NULL` |
| `poll_votes` | `option_index int NOT NULL` |
| `rate_limits` | `{post,chat,comment,vote}_count int NOT NULL DEFAULT 0` and `{post,chat,comment,vote}_window_start timestamptz NOT NULL DEFAULT now()` |
| `bot_blacklist` | `reason text NOT NULL`, `flagged_at` |
| `flagged_posts_review` | `flagged_at`, `review_status text NOT NULL DEFAULT 'pending'` |

Two findings worth carrying into other tickets:

- **`posts.upvotes`/`downvotes`/`flag_count` and `comments.upvotes`/`downvotes`
  exist.** This makes `db/README.md`'s "vote-count sync trigger" claim more
  plausible than previously assumed. `usePosts.js:181` currently overwrites
  these with client-computed values. Whether anything maintains them decides
  most of T-068's design and should be the first thing checked once access
  exists. Comparing the columns against `count(post_votes)` answers it.
- **`post_votes`'s PK is `id`, not `(post_id, session_id)`**, so the
  `onConflict: 'post_id,session_id'` upserts in `usePosts.js` and
  `useComments.js` depend on a separate unique constraint that OpenAPI does not
  expose. It almost certainly exists, because without it every vote upsert
  would fail with `42P10` and voting would be broken rather than slow, but it
  is inferred rather than observed.

## `db/seeds/dev_social_schema.sql` is a starting point, not a record

This file (added 2026-07-26) reconstructs enough social schema to run the UI
locally, including RLS stubs, RPC bodies, indexes, CHECK constraints and
UNIQUE constraints. Its own header is explicit that it was "derived by reading
the app's own queries, not from the real database", that types and constraints
"are guesses that satisfy the client code", that its RLS policies are
"permissive stubs for local anon access", and that it must never be copied into
`db/sql/`. Treat it as a scaffold for the real reconstruction, and as evidence
of the shape the client expects, not as the schema.

It also independently confirms the drift trap described below: per its header,
all ten stubs are already recorded in `schema_migrations` with hash
`e3b0c44298fc1c14`, the SHA of an empty string.

Comparing it against the deployed columns shows how far a
guessed-from-client-code schema drifts. On `posts` alone:

| column | dev seed | deployed |
|---|---|---|
| `session_id` | `text` | `uuid` |
| `content` | nullable | `NOT NULL` |
| `code_language` | no default | `DEFAULT 'python'` |
| `updated_at` | nullable, no default | `NOT NULL DEFAULT now()` |
| `upvotes`, `downvotes`, `flag_count` | absent | `integer NOT NULL DEFAULT 0` |

Five divergences on one table, so the same is likely true of the others. This
is why the reconstruction has to come from the database rather than from
extending this file.

Two of its guesses are worth keeping in mind because the client depends on
them and they look right: `post_votes` declares
`UNIQUE (post_id, session_id)` and `CHECK (vote_type IN ('up','down'))`. The
UNIQUE constraint is what the `onConflict` upserts need.

## Access needed

OpenAPI exposes table shapes only. It does not expose, and nothing else
reachable from this repo exposes:

- RLS policies (the largest gap, and the one that makes a partial
  reconstruction actively dangerous)
- Trigger definitions, including whether the vote-count sync trigger exists
- RPC function bodies
- CHECK constraints (e.g. whether `vote_type` is constrained to `up`/`down`,
  whether `depth` is capped at 1)
- Non-PK UNIQUE constraints and indexes
- Replica identity, which T-064 needs
- `supabase_realtime` publication membership

Deliberately **not** writing partial migrations from the shapes alone. Files
that create these tables with no policies would give a fresh database either
a fully-open or fully-closed social schema depending on whether RLS got
enabled, and an app with no RPCs. That is a worse artefact than the current
empty stubs, because it looks finished.

Unblocked by either:

```bash
# preferred: needs the Supabase CLI (not currently installed) + DB password
supabase link --project-ref <ref> && supabase db dump --schema public

# or, with the pooler connection string
pg_dump --schema-only --no-owner --no-privileges "<pooler-url>"
```

## Suggested fix

Introspect the deployed schema and write it down. Note that the two obvious
approaches are both wrong for different reasons:

**Do not simply fill in the empty files.** The runner tracks a content
checksum per migration in `public.schema_migrations` and hard-fails on
mismatch (`scripts/db-migrate.mjs:107-117`, "Never edit an applied migration.
Add a new migration that supersedes it."). Any database that has already run
these ten stubs has recorded the checksum of an empty file. Filling them in
would trip drift detection and block `npm run db:migrate` entirely, for every
environment, including ones unrelated to social.

**Do not renumber or remove them from the manifest** for the same reason: the
recorded ids would no longer match.

The path that respects the runner's own rule is a new range (`0028`+) that
creates the social schema idempotently (`CREATE TABLE IF NOT EXISTS`, guarded
`DO` blocks, `DROP POLICY IF EXISTS` before `CREATE POLICY`), so it is a no-op
against the live project and a full build against a fresh one. Leave
`0006`-`0015` in place as historical no-ops and say so explicitly in
`db/README.md` rather than leaving the table describing contents that were
never written.

Getting the actual schema out of the live project is the bulk of the work:
`pg_dump --schema-only` against the production database, or the Supabase
dashboard's schema view, then splitting it into one-concern files to match the
convention in `db/README.md`.

## Acceptance criteria

- [ ] Every table, constraint, index, RLS policy, RPC and publication
      membership the social area depends on exists in a non-empty file under
      `db/sql/`
- [ ] `npm run db:migrate` against a fresh local database produces a schema
      the social feed and chat can run against, verified by loading both
- [ ] `npm run db:migrate` against the live project reports no pending work
      and no drift
- [ ] `db/README.md` describes what the files actually contain, and the
      `0006`-`0015` rows are marked as the empty historical no-ops they are
- [ ] The replica identity of `post_votes` and `comment_votes` is recorded, so
      the realtime handlers in `usePosts.js` can be reasoned about
- [ ] The unique constraints the `onConflict` clauses rely on are confirmed
      present

## References

- E-008 (social feed and chat overhaul) is where this was discovered
- T-064 documents the three places its implementation had to guess because
  this record is missing
- T-068 depends on this: the `get_feed_posts` RPC needs a schema to extend
- `scripts/db-migrate.mjs` for the drift-detection behaviour that constrains
  the fix
