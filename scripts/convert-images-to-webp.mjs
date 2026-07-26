#!/usr/bin/env node
// scripts/convert-images-to-webp.mjs
//
// One-off migration: re-encodes every EXISTING note image as WebP at reader
// width, in both places note images live, and rewrites the Markdown that
// points at them.
//
//   1. public/notes/img/<module>/<file>   — images already promoted into the repo
//   2. the `note-images` Storage bucket    — images not yet promoted
//   3. notes.content_md                    — every `/notes/img/…` reference, AND
//                                            base64 `data:` URIs inlined in the
//                                            Markdown, which are pulled out into
//                                            Storage as normal image references
//
// All three have to move together: the reference string is the same in the
// repo and in Storage (see lib/noteImageSrc.js), so rewriting content_md
// without converting both copies, or converting either copy without
// rewriting content_md, leaves broken images.
//
// New uploads no longer need this — lib/imageToWebp.js converts them in the
// browser before they ever reach Storage. This script exists for everything
// uploaded before that was true.
//
// Originals are copied into .image-backup/<run>/ before anything is deleted,
// so a bad conversion is recoverable without a redeploy.
//
// Unlike its sibling scripts this talks to PostgREST and the Storage API
// rather than Postgres directly, so it needs no SUPABASE_DB_URL — only the
// two values already in .env.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/convert-images-to-webp.mjs --dry-run
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/convert-images-to-webp.mjs
//   ...                                            node scripts/convert-images-to-webp.mjs --keep-originals

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMAGES_ROOT = resolve(join(ROOT, 'public', 'notes', 'img'))
const BUCKET = 'note-images'

// Keep in sync with MAX_WIDTH / QUALITY in src/lib/imageToWebp.js, so an
// image converted here and one converted at upload time look identical.
const MAX_WIDTH = 1440
const QUALITY = 82

// GIF loses its animation and SVG loses its resolution independence when
// rasterised — the browser-side converter skips both for the same reason.
const SKIP_EXTS = new Set(['.webp', '.gif', '.svg'])

const { values: flags } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    'keep-originals': { type: 'boolean', default: false },
  },
})
const dryRun = flags['dry-run']

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  console.error('  local stack: `npx supabase status` prints the URL and the "Secret" key.')
  process.exit(1)
}

const BACKUP_ROOT = join(ROOT, '.image-backup', new Date().toISOString().replace(/[:.]/g, '-'))

// Same untrusted-object-name reasoning as pull-images-from-supabase.mjs: a
// Storage object called 'database/x.png/../../../etc/cron.d/x' must not be
// able to steer a write outside the directory we mean to write into.
function safeJoin(root, ...segments) {
  const target = resolve(join(root, ...segments))
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`path escapes ${root}: ${segments.join('/')}`)
  }
  return target
}

const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }

function backup(relPath, bytes) {
  const dest = safeJoin(resolve(BACKUP_ROOT), ...relPath.split('/'))
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, bytes)
}

/** Re-encode to WebP, downscaling only when the source is wider than MAX_WIDTH. */
async function toWebp(bytes) {
  return await sharp(bytes)
    // sharp does not honour EXIF orientation unless asked. Without this a
    // photo tagged "rotate 90°" would be re-encoded sideways, because the
    // WebP loses the tag the browser was using to correct it on display.
    // (No image in the 2026-07-26 run carried one; this is for reruns.)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer()
}

const fmt = (n) => `${(n / 1024).toFixed(0)} KB`

// `renames` accumulates every reference change as `/notes/img/…` old → new, and
// is applied to notes.content_md at the end. Both passes feed the same map, so
// a note referencing a repo image and a Storage image is fixed in one update.
const renames = new Map()
let savedBytes = 0

// ─── Pass 1: images already promoted into the repo ──────────────────────────

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

console.log('── public/notes/img')
if (existsSync(IMAGES_ROOT)) {
  for (const file of walk(IMAGES_ROOT)) {
    const ext = extname(file).toLowerCase()
    if (SKIP_EXTS.has(ext)) continue

    const rel = relative(IMAGES_ROOT, file).split(sep).join('/')
    const original = readFileSync(file)
    let webp
    try {
      webp = await toWebp(original)
    } catch (err) {
      console.error(`  FAILED ${rel}: ${err.message}`)
      continue
    }

    // Converting a file to something bigger is a loss, not a migration.
    if (webp.length >= original.length) {
      console.log(`  skip (webp not smaller) ${rel}`)
      continue
    }

    const newRel = `${rel.slice(0, -ext.length)}.webp`
    renames.set(`/notes/img/${rel}`, `/notes/img/${newRel}`)
    savedBytes += original.length - webp.length
    console.log(`  ${rel}  ${fmt(original.length)} → ${fmt(webp.length)}`)

    if (!dryRun) {
      backup(`repo/${rel}`, original)
      writeFileSync(safeJoin(IMAGES_ROOT, ...newRel.split('/')), webp)
      if (!flags['keep-originals']) unlinkSync(file)
    }
  }
} else {
  console.log('  (no public/notes/img directory)')
}

// ─── Pass 2: images still living in Storage ─────────────────────────────────
// The Storage list API lists one prefix at a time, so enumerate the module
// folders at the root and then the objects under each.

async function listPrefix(prefix) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000 }),
  })
  if (!res.ok) throw new Error(`list ${prefix || '/'} failed: ${res.status} ${await res.text()}`)
  return await res.json()
}

console.log('\n── note-images bucket')
const folders = await listPrefix('')
const objectPaths = []
for (const folder of folders) {
  // A row with no `metadata` is a folder placeholder, not an object.
  if (folder.metadata) { objectPaths.push(folder.name); continue }
  for (const obj of await listPrefix(folder.name)) {
    if (obj.metadata) objectPaths.push(`${folder.name}/${obj.name}`)
  }
}

for (const objectPath of objectPaths) {
  const ext = extname(objectPath).toLowerCase()
  if (SKIP_EXTS.has(ext)) continue

  const dl = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`, { headers })
  if (!dl.ok) {
    console.error(`  FAILED download ${objectPath}: ${dl.status}`)
    continue
  }
  const original = Buffer.from(await dl.arrayBuffer())

  let webp
  try {
    webp = await toWebp(original)
  } catch (err) {
    console.error(`  FAILED ${objectPath}: ${err.message}`)
    continue
  }
  if (webp.length >= original.length) {
    console.log(`  skip (webp not smaller) ${objectPath}`)
    continue
  }

  const newPath = `${objectPath.slice(0, -ext.length)}.webp`
  console.log(`  ${objectPath}  ${fmt(original.length)} → ${fmt(webp.length)}`)

  if (!dryRun) {
    backup(`storage/${objectPath}`, original)

    const up = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURI(newPath)}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
      body: webp,
    })
    if (!up.ok) {
      console.error(`  FAILED upload ${newPath}: ${up.status} ${await up.text()}`)
      continue
    }

    // Only after the replacement is safely uploaded, and only then, is the
    // reference rewrite and the delete of the original safe to record.
    if (!flags['keep-originals']) {
      const del = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`, {
        method: 'DELETE',
        headers,
      })
      if (!del.ok) console.error(`  WARN delete ${objectPath}: ${del.status}`)
    }
  }

  renames.set(`/notes/img/${objectPath}`, `/notes/img/${newPath}`)
  savedBytes += original.length - webp.length
}

// ─── Pass 3: rewrite notes.content_md ───────────────────────────────────────
// Two edits per note, applied together so each note takes a single PATCH:
//   • the `/notes/img/…` extension renames from passes 1 and 2
//   • base64 data URIs pulled out into Storage (see below)

/**
 * Images pasted into the editor as part of a Markdown document arrive as
 * `data:` URIs and get stored INSIDE content_md. They're the worst case for
 * the reader: base64 inflates the bytes ~33%, the pixels are unoptimised, and
 * because they're part of the note row they block the render instead of
 * lazy-loading like a real `<img src>`. Three lecture notes were 96-100%
 * base64 by weight.
 *
 * So each one is decoded, converted like any other image, uploaded to the same
 * Storage bucket the editor uploads to, and replaced by a normal
 * `/notes/img/<module>/<uuid>.webp` reference.
 *
 * Milkdown escapes the colon when it serialises the URI (`data\:image/…`), so
 * the backslash is optional in the pattern. The replacement is a plain path
 * with no punctuation needing escapes.
 */
const DATA_URI_RE = /data\\?:image\/([a-z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/gi

async function extractInlineImages(note, contentMd) {
  // matchAll works off its own copy of the regex, so DATA_URI_RE's lastIndex
  // is never advanced here. Do NOT add a `DATA_URI_RE.test(...)` pre-check —
  // .test() on a /g/ regex DOES advance lastIndex, which would make the next
  // note's check start mid-string and silently skip its images.
  const matches = [...contentMd.matchAll(DATA_URI_RE)]
  if (!matches.length) return { content: contentMd, extracted: 0, saved: 0 }

  console.log(`  ${note.module_id}/${note.path} — ${matches.length} inline image(s)`)
  let content = contentMd
  let extracted = 0
  let saved = 0

  for (const [index, match] of matches.entries()) {
    const [token, subtype, b64] = match
    let original
    try {
      original = Buffer.from(b64, 'base64')
    } catch {
      console.error(`  FAILED decode inline image ${index + 1} in ${note.module_id}/${note.path}`)
      continue
    }

    let webp
    try {
      webp = await toWebp(original)
    } catch (err) {
      console.error(`  FAILED convert inline image ${index + 1} in ${note.module_id}/${note.path}: ${err.message}`)
      continue
    }

    const objectPath = `${note.module_id}/${randomUUID()}.webp`
    console.log(`    inline #${index + 1} (${subtype})  ${fmt(token.length)} of markdown → ${fmt(webp.length)} in Storage`)

    if (!dryRun) {
      backup(`inline/${note.module_id}/${note.path}/${index + 1}.${subtype}`, original)
      const up = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURI(objectPath)}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
        body: webp,
      })
      if (!up.ok) {
        console.error(`  FAILED upload ${objectPath}: ${up.status} ${await up.text()}`)
        continue
      }
    }

    // Replace this exact token. Splitting on the literal avoids both regex
    // escaping of a 380 KB string and any chance of touching another image.
    content = content.split(token).join(`/notes/img/${objectPath}`)
    extracted++
    saved += token.length - webp.length
  }

  return { content, extracted, saved }
}

console.log('\n── notes.content_md')
const notesRes = await fetch(`${supabaseUrl}/rest/v1/notes?select=id,module_id,path,content_md`, { headers })
if (!notesRes.ok) throw new Error(`fetch notes failed: ${notesRes.status} ${await notesRes.text()}`)
const notes = await notesRes.json()

let rewritten = 0
let inlineExtracted = 0
for (const note of notes) {
  const before = note.content_md || ''
  let next = before
  for (const [from, to] of renames) next = next.split(from).join(to)

  const inline = await extractInlineImages(note, next)
  next = inline.content
  inlineExtracted += inline.extracted
  savedBytes += inline.saved

  if (next === before) continue

  rewritten++
  if (!inline.extracted) console.log(`  ${note.module_id}/${note.path}`)
  if (dryRun) continue

  const res = await fetch(`${supabaseUrl}/rest/v1/notes?id=eq.${note.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_md: next }),
  })
  if (!res.ok) console.error(`  FAILED rewrite ${note.module_id}/${note.path}: ${await res.text()}`)
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(
  `\n${renames.size} file image(s) converted, ${inlineExtracted} inline image(s) extracted, ` +
  `${rewritten} note(s) rewritten, ${fmt(savedBytes)} saved.`
)
if (dryRun) {
  console.log('--dry-run set; nothing was written, uploaded, deleted, or rewritten.')
} else {
  console.log(`Originals backed up to ${relative(ROOT, BACKUP_ROOT)}`)
  console.log('Review `git status` under public/notes/img/ before committing.')
}

// Notes on disk are a mirror of the DB (scripts/sync-notes-to-disk.mjs), so
// their `/notes/img/…` references are now stale until that runs again.
if (!dryRun && rewritten > 0) {
  console.log('Run `npm run notes:sync-to-disk` to refresh the on-disk Markdown mirror.')
}
