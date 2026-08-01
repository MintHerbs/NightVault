#!/usr/bin/env node
// Migration runner for db/sql/. Reads db/migrations.yaml as the order
// authority, tracks applied migrations in a public.schema_migrations
// table on the target database, and only re-runs what is pending.
//
// See db/README.md and docs/runbooks/local-supabase.md for usage.

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import yaml from 'js-yaml'
import pg from 'pg'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = join(REPO_ROOT, 'db', 'migrations.yaml')
const DB_ROOT = join(REPO_ROOT, 'db')

const HELP = `Usage:
  npm run db:migrate                 apply pending migrations
  npm run db:migrate -- --status     list applied vs pending, no writes
  npm run db:migrate -- --dry-run    show what would be applied, no writes
  npm run db:migrate -- --ci         skip manifest entries marked ci_skip
  npm run db:migrate -- --help       this message

Reads the database URL from SUPABASE_DB_URL (preferred) or DATABASE_URL.

For a local Supabase stack (npx supabase start), the URL is:
  postgresql://postgres:postgres@127.0.0.1:54322/postgres

Bookkeeping lives in public.schema_migrations on the target database
(created automatically on first run).

--ci is for validating the manifest against a freshly created schema (see
.github/workflows/ci.yml) and excludes any entry with \`ci_skip: true\` in
migrations.yaml — used for migrations documented as targeting a specific
environment's pre-existing schema rather than one this repo's own
migrations produce from scratch (see db/README.md). Do not use --ci
against dev or prod: it would leave those entries permanently pending
there.
`

const { values: flags } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    status:    { type: 'boolean', default: false },
    ci:        { type: 'boolean', default: false },
    help:      { type: 'boolean', short: 'h', default: false },
  },
})

if (flags.help) {
  console.log(HELP)
  process.exit(0)
}

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
if (!dbUrl) {
  console.error('Set SUPABASE_DB_URL (or DATABASE_URL).')
  console.error('Local Supabase: postgresql://postgres:postgres@127.0.0.1:54322/postgres')
  process.exit(1)
}

const manifest = yaml.load(readFileSync(MANIFEST_PATH, 'utf8'))
if (!manifest?.migrations?.length) {
  console.error(`No migrations listed in ${MANIFEST_PATH}.`)
  process.exit(1)
}

const entries = flags.ci
  ? manifest.migrations.filter((m) => !m.ci_skip)
  : manifest.migrations

if (flags.ci) {
  const skipped = manifest.migrations.filter((m) => m.ci_skip)
  if (skipped.length) {
    console.log(`--ci: skipping ${skipped.length} manifest entr${skipped.length === 1 ? 'y' : 'ies'} marked ci_skip: ${skipped.map((m) => m.id).join(', ')}`)
  }
}

const planned = entries.map((m) => {
  if (!m.id || !m.file) {
    throw new Error(`Manifest entry missing id or file: ${JSON.stringify(m)}`)
  }
  const sql = readFileSync(join(DB_ROOT, m.file), 'utf8')
  return {
    id: String(m.id),
    file: m.file,
    description: m.description ?? '',
    sql,
    checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16),
  }
})

const client = new pg.Client({ connectionString: dbUrl })

try {
  await client.connect()
} catch (err) {
  console.error(`Could not connect to ${redact(dbUrl)}:`)
  console.error(`  ${err.message}`)
  if (err.code === 'ECONNREFUSED') {
    console.error('  → Is Docker Desktop running and `npx supabase start` complete?')
  }
  process.exit(1)
}

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id          TEXT        PRIMARY KEY,
      file        TEXT        NOT NULL,
      checksum    TEXT        NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    COMMENT ON TABLE public.schema_migrations
      IS 'Owned by scripts/db-migrate.mjs; one row per migration in db/migrations.yaml that has been applied. Do not add a SQL migration that creates this table.';
  `)

  const { rows: appliedRows } = await client.query(
    'SELECT id, checksum, applied_at FROM public.schema_migrations ORDER BY id'
  )
  const applied = new Map(appliedRows.map((r) => [r.id, r]))

  const drift = planned.filter(
    (p) => applied.has(p.id) && applied.get(p.id).checksum !== p.checksum,
  )
  if (drift.length) {
    console.error('Drift detected — these migrations were applied with different content than the current file:')
    for (const p of drift) {
      const live = applied.get(p.id)
      console.error(`  ${p.id}  ${p.file}`)
      console.error(`    DB checksum:   ${live.checksum} (applied ${live.applied_at.toISOString()})`)
      console.error(`    file checksum: ${p.checksum}`)
    }
    console.error('\nNever edit an applied migration. Add a new migration that supersedes it.')
    process.exit(2)
  }

  const pending = planned.filter((p) => !applied.has(p.id))

  if (flags.status) {
    console.log(`Database: ${redact(dbUrl)}\n`)
    console.log('Applied:')
    if (applied.size === 0) console.log('  (none)')
    for (const p of planned.filter((p) => applied.has(p.id))) {
      const at = applied.get(p.id).applied_at.toISOString()
      console.log(`  ${p.id}  ${p.file}  @ ${at}`)
    }
    console.log(`\nPending: ${pending.length}`)
    for (const p of pending) console.log(`  ${p.id}  ${p.file}`)
    process.exit(0)
  }

  if (pending.length === 0) {
    console.log(`No pending migrations. Database ${redact(dbUrl)} is up to date.`)
    process.exit(0)
  }

  console.log(`Database: ${redact(dbUrl)}`)
  console.log(`${pending.length} pending migration(s):`)
  for (const p of pending) console.log(`  ${p.id}  ${p.file}`)

  if (flags['dry-run']) {
    console.log('\n--dry-run set; not applying.')
    process.exit(0)
  }

  for (const p of pending) {
    process.stdout.write(`\nApplying ${p.id}  ${p.file} ... `)
    try {
      await client.query('BEGIN')
      await client.query(p.sql)
      await client.query(
        'INSERT INTO public.schema_migrations (id, file, checksum) VALUES ($1, $2, $3)',
        [p.id, p.file, p.checksum],
      )
      await client.query('COMMIT')
      console.log('ok')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      console.log('FAILED')
      console.error(`  ${err.message}`)
      if (err.position) console.error(`  at SQL position ${err.position}`)
      process.exit(3)
    }
  }

  console.log('\nAll pending migrations applied.')
} finally {
  await client.end()
}

function redact(url) {
  return url.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1***$3')
}
