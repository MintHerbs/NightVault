#!/usr/bin/env node
// scripts/prune-images-from-supabase.mjs
//
// Deletes images from the `note-images` Storage bucket once they're safely
// promoted to the repo — implementing "once we're sure it's living locally,
// delete it from Supabase" as a real check, not a manual judgment call: for
// every Storage object, this downloads it and compares it byte-for-byte
// against public/notes/img/<moduleId>/<file> on disk. Only an exact match is
// deleted; anything missing or different locally is left alone and reported.
//
// Run scripts/pull-images-from-supabase.mjs FIRST, then commit, push, and
// deploy so the promoted copy is actually live at the app's own URL, THEN run
// this. Deleting from Storage before that deploy lands breaks the image
// (resolveNoteImageSrc/noteImageFallbackSrc in src/lib/noteImageSrc.js have
// nothing left to fall back to). This script does not check deploy status —
// that sequencing is on you.
//
// Always an explicit, separate, opt-in run — never bundled into the pull
// script's default behavior.
//
// Usage:
//   SUPABASE_DB_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/prune-images-from-supabase.mjs --dry-run   # see what qualifies
//   ...same... node scripts/prune-images-from-supabase.mjs    # actually delete

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMAGES_ROOT = resolve(join(ROOT, 'public', 'notes', 'img'))
const BUCKET = 'note-images'

// See the matching check in pull-images-from-supabase.mjs — same
// untrusted-object-name reasoning applies to the read side here.
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

const toDelete = []
let missingLocally = 0, mismatched = 0, failed = 0

for (const { name: objectPath } of objects) {
  let diskPath
  try {
    diskPath = safeJoin(IMAGES_ROOT, ...objectPath.split('/'))
  } catch (err) {
    console.error(`  skip (${err.message})`)
    failed++
    continue
  }
  if (!existsSync(diskPath)) {
    missingLocally++
    console.log(`  skip (not pulled locally yet): ${objectPath}`)
    continue
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath)
  if (error) {
    failed++
    console.error(`  failed to download ${objectPath} for verification: ${error.message}`)
    continue
  }
  const remoteBytes = Buffer.from(await data.arrayBuffer())
  const localBytes = readFileSync(diskPath)
  if (!localBytes.equals(remoteBytes)) {
    mismatched++
    console.log(`  skip (local copy differs from Storage): ${objectPath}`)
    continue
  }
  toDelete.push(objectPath)
}

let deleted = 0
if (toDelete.length > 0 && !flags['dry-run']) {
  const { data, error } = await supabase.storage.from(BUCKET).remove(toDelete)
  if (error) {
    console.error(`  batch delete failed: ${error.message}`)
  } else {
    deleted = data?.length ?? toDelete.length
  }
} else {
  deleted = toDelete.length
}

console.log(`\nStorage objects: ${objects.length} — ${deleted} verified-and-deleted, ${missingLocally} not pulled locally, ${mismatched} local mismatch, ${failed} failed.`)
if (flags['dry-run']) {
  console.log('\n--dry-run set; nothing was deleted. The count above is what would be deleted.')
}
