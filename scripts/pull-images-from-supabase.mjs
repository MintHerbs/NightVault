#!/usr/bin/env node
// scripts/pull-images-from-supabase.mjs
//
// Downloads every object in the `note-images` Storage bucket (the live
// source for note images since 2026-07-24 — see useEditorSave.js's
// resolveImageQueue) into public/notes/img/<moduleId>/<file> on disk. Storage
// stays the live source until you separately confirm and run
// scripts/prune-images-from-supabase.mjs to remove the Storage copy — this
// script only ever writes locally, never deletes from Storage.
//
// Object metadata (the list of paths) is read via the same Postgres
// connection scripts/sync-notes-to-disk.mjs uses (storage.objects is a real
// table); the bytes themselves come from the Storage API, which needs the
// service-role key (RLS on storage.objects would otherwise scope downloads
// to what the caller's own admin role is allowed to write, not read).
//
// Usage:
//   SUPABASE_DB_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/pull-images-from-supabase.mjs
//   ...same... node scripts/pull-images-from-supabase.mjs --dry-run

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMAGES_ROOT = resolve(join(ROOT, 'public', 'notes', 'img'))
const BUCKET = 'note-images'

// Storage object names are admin-authored (RLS scopes WHICH module a
// contributor can write under via the path's first segment, but not what
// comes after it) — a name like 'database/x.png/../../../etc/cron.d/x' would
// make writeFileSync below write attacker-controlled bytes outside
// IMAGES_ROOT entirely without this check.
function safeJoin(root, ...segments) {
  const target = resolve(join(root, ...segments))
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`path escapes ${root}: ${segments.join('/')}`)
  }
  return target
}

const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!dbUrl || !supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_DB_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.')
  console.error('  local stack: `npx supabase status` prints the URL and the "Secret" key.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: dbUrl })
await client.connect()
let objects
try {
  ;({ rows: objects } = await client.query(
    `select name from storage.objects where bucket_id = $1 order by name`,
    [BUCKET]
  ))
} finally {
  await client.end()
}

// { transport: ws } works around supabase-js unconditionally constructing a
// RealtimeClient (unused here — we only need Storage) which throws on Node
// < 22 without a global WebSocket. See supabase-js#37217.
const supabase = createClient(supabaseUrl, serviceRoleKey, { realtime: { transport: ws } })

let downloaded = 0, unchanged = 0, failed = 0

for (const { name: objectPath } of objects) {
  let diskPath
  try {
    diskPath = safeJoin(IMAGES_ROOT, ...objectPath.split('/'))
  } catch (err) {
    console.error(`  skip (${err.message})`)
    failed++
    continue
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath)
  if (error) {
    console.error(`  failed to download ${objectPath}: ${error.message}`)
    failed++
    continue
  }
  const bytes = Buffer.from(await data.arrayBuffer())
  const current = existsSync(diskPath) ? readFileSync(diskPath) : null
  if (current && current.equals(bytes)) {
    unchanged++
    continue
  }
  downloaded++
  if (!flags['dry-run']) {
    mkdirSync(dirname(diskPath), { recursive: true })
    writeFileSync(diskPath, bytes)
  }
}

console.log(`Storage objects: ${objects.length} — ${downloaded} downloaded, ${unchanged} unchanged, ${failed} failed.`)
if (flags['dry-run']) {
  console.log('\n--dry-run set; nothing was written.')
} else {
  console.log(`\nDone. Review with \`git status\` / \`git diff\` under public/notes/img/ before committing.`)
  console.log('Once committed, pushed, and deployed, run scripts/prune-images-from-supabase.mjs to remove the Storage copies.')
}
