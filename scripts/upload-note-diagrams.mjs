#!/usr/bin/env node
// scripts/upload-note-diagrams.mjs
//
// Uploads a directory of SVG diagrams into the `note-images` Storage bucket
// under <module>/, which is where a note's `/notes/img/<module>/<file>` path
// resolves to (see src/lib/noteImageSrc.js).
//
// Two sources of diagrams exist for the web module, deliberately kept apart:
//   • src/content/diagrams/web/  — authored by hand, tracked in the repo
//   • build/web-diagrams/        — extracted from the source HTML by
//                                  scripts/extract-web-note-diagrams.mjs
// Point --dir at either.
//
// Storage has no authorship trigger and the service role bypasses the bucket's
// is_owner() policy, so unlike a notes write this needs no user session.
//
// Skip-if-unchanged, so re-running is cheap and will not churn object owners.
// Nothing is ever deleted.
//
// Usage:
//   node --env-file=.env scripts/upload-note-diagrams.mjs \
//     --dir src/content/diagrams/web [--module web] [--dry-run]

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'note-images'

const { values: flags } = parseArgs({
  options: {
    dir: { type: 'string' },
    module: { type: 'string', default: 'web' },
    'dry-run': { type: 'boolean', default: false },
  },
})

if (!flags.dir) {
  console.error('Usage: --dir <dir> [--module web] [--dry-run]')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL).')
  process.exit(1)
}
if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).')
  process.exit(1)
}

console.log(`Target:  ${supabaseUrl}`)
console.log(`Writing: ${BUCKET}/${flags.module}/*.svg  from ${flags.dir}/`)
if (flags['dry-run']) console.log('DRY RUN — nothing will be written.\n')
else console.log('')

const sb = createClient(supabaseUrl, key, { auth: { persistSession: false } })
const publicUrl = (p) => `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${p}`

/**
 * The bytes of an object already in the bucket, or null if it isn't there.
 *
 * Read over the PUBLIC url rather than storage.list(): listing needs a SELECT
 * policy on storage.objects, and note-images has insert/update/delete only
 * (0023/0027), so list() returns empty even for an owner. Reading the public
 * url sidesteps RLS entirely.
 *
 * Downloads the body rather than sending HEAD and trusting content-length:
 * these responses come back without a content-length (the CDN uses chunked
 * transfer), so a HEAD-based size check silently reports every object as absent
 * and the skip-if-unchanged path never runs. The files are a few KB each.
 */
async function existingBytes(objectPath) {
  const res = await fetch(publicUrl(objectPath), { cache: 'no-store' })
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

const files = (await readdir(flags.dir)).filter((f) => f.endsWith('.svg')).sort()
if (files.length === 0) {
  console.error(`No .svg files in ${flags.dir}`)
  process.exit(1)
}

let uploaded = 0
let skipped = 0
for (const file of files) {
  const objectPath = `${flags.module}/${file}`
  const body = await readFile(join(flags.dir, file))
  const already = await existingBytes(objectPath)

  if (already !== null && already.equals(body)) {
    console.log(`  unchanged     ${objectPath}  (${body.length} bytes)`)
    skipped += 1
    continue
  }
  if (flags['dry-run']) {
    console.log(`  would ${already === null ? 'upload ' : 'replace'} ${objectPath}  (${body.length} bytes)`)
    continue
  }

  const { error } = await sb.storage
    .from(BUCKET)
    // Explicit: Storage guesses from the extension, and an SVG served as
    // anything other than image/svg+xml will not render inside an <img>.
    .upload(objectPath, body, { contentType: 'image/svg+xml', upsert: true })

  if (error) {
    console.error(`  FAILED ${objectPath}: ${error.message}`)
    process.exit(1)
  }
  console.log(`  uploaded      ${objectPath}  (${body.length} bytes)`)
  uploaded += 1
}

if (flags['dry-run']) {
  console.log(`\nDry run complete. ${files.length} files considered.`)
  process.exit(0)
}

// Prove they are fetchable at the url the notes actually reference, and served
// as SVG. A wrong content-type breaks every <img> silently.
console.log('\nverifying public URLs:')
let badType = 0
for (const file of files) {
  const res = await fetch(publicUrl(`${flags.module}/${file}`))
  const type = res.headers.get('content-type')
  if (!res.ok || !String(type).startsWith('image/svg+xml')) badType += 1
  console.log(`  ${res.status}  ${type}  ${file}`)
}

console.log(`\nDone. ${uploaded} uploaded, ${skipped} unchanged, ${files.length} verified.`)
if (badType > 0) {
  console.error(`${badType} object(s) are not being served as image/svg+xml.`)
  process.exit(1)
}
