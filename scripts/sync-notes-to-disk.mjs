#!/usr/bin/env node
// scripts/sync-notes-to-disk.mjs
//
// Reverse of scripts/migrate-notes-to-supabase.mjs: reads the Supabase
// `notes` + `note_folders` tables (the source of truth since E-005/T-043)
// and writes a matching on-disk copy at src/content/notes/, pruning any file
// or empty-folder placeholder that no longer has a DB row. Also snapshots
// `sidebar_modules` (Subject structure, DB-backed since 2026-07-24) to a
// plain JSON file — disaster-recovery reference only, not regenerated JS
// source; nothing in the running app reads it back. Run this every now and
// then and commit the result — it's a static fallback for the live site to
// be rebuilt from if Supabase is ever unreachable, not a live sync path (the
// app itself always reads from the DB).
//
// This is a mirror, not a merge: on-disk state that doesn't come from the DB
// is deleted. Review `git diff` / `git status` after running before
// committing.
//
// Connection: reads SUPABASE_DB_URL (preferred) or DATABASE_URL — the same
// variable scripts/db-migrate.mjs and migrate-notes-to-supabase.mjs use.
//   • local stack: postgresql://postgres:postgres@127.0.0.1:54322/postgres
//   • prod:        the project's pooler connection string
//
// Usage:
//   SUPABASE_DB_URL=... node scripts/sync-notes-to-disk.mjs
//   SUPABASE_DB_URL=... node scripts/sync-notes-to-disk.mjs --dry-run

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, sep, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import pg from 'pg'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NOTES_ROOT = resolve(join(ROOT, 'src', 'content', 'notes'))
const MODULES_SNAPSHOT_PATH = join(ROOT, 'db', 'snapshots', 'sidebar_modules.json')

const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
if (!dbUrl) {
  console.error('Set SUPABASE_DB_URL (or DATABASE_URL) to the source database.')
  console.error('  local: postgresql://postgres:postgres@127.0.0.1:54322/postgres')
  process.exit(1)
}

// module_id/path/name are admin-authored DB content, not filesystem-trusted
// input — a contributor's own notes table row can carry any string in `path`
// (client-side name validation is UI-only, not RLS-enforced). Without this
// check, a row like path: '../../../../etc/cron.d/x' would make writeFileSync
// below write attacker-controlled content outside NOTES_ROOT entirely.
function safeJoin(root, ...segments) {
  const target = resolve(join(root, ...segments))
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`path escapes ${root}: ${segments.join('/')}`)
  }
  return target
}

const stripMd = (p) => String(p || '').replace(/\.md$/i, '')
const toDiskPath = (moduleId, path) => safeJoin(NOTES_ROOT, moduleId, ...stripMd(path).split('/')) + '.md'
const toGitkeepPath = (moduleId, name) => safeJoin(NOTES_ROOT, moduleId, name, '.gitkeep')

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

// Remove now-empty directories left behind after deletions, bottom-up, but
// never NOTES_ROOT itself.
function pruneEmptyDirs(dir) {
  if (dir === NOTES_ROOT || !existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) pruneEmptyDirs(full)
  }
  if (readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true })
    pruneEmptyDirs(dirname(dir))
  }
}

const client = new pg.Client({ connectionString: dbUrl })
await client.connect()

let notesRows, folderRows, moduleRows
try {
  ;({ rows: notesRows } = await client.query(
    'select module_id, path, content_md from public.notes order by module_id, path'
  ))
  ;({ rows: folderRows } = await client.query(
    'select module_id, name from public.note_folders order by module_id, name'
  ))
  ;({ rows: moduleRows } = await client.query(
    'select id, label, icon_name, sort_order, hidden from public.sidebar_modules order by sort_order'
  ))
} finally {
  await client.end()
}

// Desired disk state, derived entirely from the DB rows just read.
let rejected = 0
const desiredFiles = new Map() // absolute path -> content
for (const r of notesRows) {
  try {
    desiredFiles.set(toDiskPath(r.module_id, r.path), r.content_md ?? '')
  } catch (err) {
    rejected++
    console.error(`  skip (${err.message})`)
  }
}
const desiredGitkeeps = new Set() // absolute path
for (const f of folderRows) {
  try {
    desiredGitkeeps.add(toGitkeepPath(f.module_id, f.name))
  } catch (err) {
    rejected++
    console.error(`  skip (${err.message})`)
  }
}

// A folder row only needs a .gitkeep placeholder if nothing else already
// keeps that directory alive (i.e. no note file lives under it).
const folderHasNote = (gitkeepPath) => {
  const dir = dirname(gitkeepPath)
  for (const filePath of desiredFiles.keys()) {
    if (filePath.startsWith(dir + sep)) return true
  }
  return false
}

let created = 0, updated = 0, unchanged = 0

for (const [path, content] of desiredFiles) {
  const exists = existsSync(path)
  const current = exists ? readFileSync(path, 'utf8') : null
  if (current === content) { unchanged++; continue }
  exists ? updated++ : created++
  if (!flags['dry-run']) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, 'utf8')
  }
}

let gitkeepsWritten = 0
for (const path of desiredGitkeeps) {
  if (folderHasNote(path) || existsSync(path)) continue
  gitkeepsWritten++
  if (!flags['dry-run']) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '', 'utf8')
  }
}

// Prune: any on-disk file under NOTES_ROOT that isn't a desired note file and
// isn't a still-wanted .gitkeep gets deleted.
const onDisk = walk(NOTES_ROOT)
let deleted = 0
for (const path of onDisk) {
  const isWantedNote = desiredFiles.has(path)
  const isWantedGitkeep = path.endsWith(`${sep}.gitkeep`) && desiredGitkeeps.has(path) && !folderHasNote(path)
  if (isWantedNote || isWantedGitkeep) continue
  deleted++
  if (!flags['dry-run']) rmSync(path)
}

if (!flags['dry-run']) pruneEmptyDirs(NOTES_ROOT)

// Subjects snapshot — a single JSON file, always rewritten in full (no
// per-row prune logic needed for one file). Reports changed/unchanged the
// same way as the notes loop above.
const modulesSnapshot = JSON.stringify(
  moduleRows.map((m) => ({
    id: m.id, label: m.label, iconName: m.icon_name, sortOrder: m.sort_order, hidden: m.hidden,
  })),
  null,
  2
) + '\n'
const modulesSnapshotExists = existsSync(MODULES_SNAPSHOT_PATH)
const modulesSnapshotCurrent = modulesSnapshotExists ? readFileSync(MODULES_SNAPSHOT_PATH, 'utf8') : null
const modulesSnapshotChanged = modulesSnapshotCurrent !== modulesSnapshot
if (modulesSnapshotChanged && !flags['dry-run']) {
  mkdirSync(dirname(MODULES_SNAPSHOT_PATH), { recursive: true })
  writeFileSync(MODULES_SNAPSHOT_PATH, modulesSnapshot, 'utf8')
}

console.log(`Notes: ${notesRows.length} in DB — ${created} created, ${updated} updated, ${unchanged} unchanged.`)
console.log(`Folders: ${folderRows.length} in DB — ${gitkeepsWritten} .gitkeep placeholder(s) written.`)
console.log(`Pruned: ${deleted} on-disk file(s) with no matching DB row.`)
if (rejected > 0) console.log(`Rejected: ${rejected} DB row(s) with a path escaping ${NOTES_ROOT} — not written.`)
console.log(`Subjects: ${moduleRows.length} in DB — snapshot ${modulesSnapshotChanged ? 'updated' : 'unchanged'} (db/snapshots/sidebar_modules.json).`)
if (flags['dry-run']) {
  console.log('\n--dry-run set; nothing was written or deleted.')
} else {
  console.log(`\nDone. Review with \`git status\` / \`git diff\` under src/content/notes/ and db/snapshots/ before committing.`)
}
