#!/usr/bin/env node
// scripts/import-web-module-notes.mjs
//
// Imports the converted Web & Mobile Development chapters (T-075) into the
// `web` Subject: the seven diagrams into the `note-images` Storage bucket, then
// one `notes` row per chapter under a `chapters/` folder.
//
// Idempotent. Notes are upserted on (module_id, path) and images are uploaded
// with upsert, so re-running after fixing one chapter replaces only that
// chapter. Nothing is ever deleted, and anything already under `web` that this
// script does not name — notably the contributed `web/notes/jquery` note — is
// left completely alone.
//
// AUTHORSHIP: if migration 0042 (note_authors, T-071) is applied to the target
// project, its AFTER trigger inserts auth.uid() into a NOT NULL column. A
// service-role key has no `sub` claim, so auth.uid() is null there and every
// notes write would abort. The script detects that table up front and refuses,
// pointing at the credentialed mode instead:
//
//   • service-role mode (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY) —
//     works only while note_authors does not exist.
//   • sign-in mode (IMPORT_EMAIL + IMPORT_PASSWORD, with the anon key) — runs
//     as a real user, so RLS and the authorship trigger both behave exactly as
//     they do for a save from the admin editor. Preferred whenever available.
//
// Usage:
//   node --env-file-if-exists=.env scripts/import-web-module-notes.mjs \
//     --chapters <dir> --diagrams <dir> [--dry-run]
//
// Point SUPABASE_URL at the project you mean. Defaults to VITE_SUPABASE_URL,
// which in this repo is PRODUCTION in .env and the local stack in .env.local —
// the script prints the host it is about to write to before touching anything.

import { readFile, readdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const MODULE_ID = 'web'
// The Subject's existing folder, which already holds a contributed note
// (web/notes/jquery). The chapters go in ALONGSIDE it: every write below is an
// upsert keyed on (module_id, path), and no path here can collide with
// `notes/jquery`, so that note is never touched. Nothing in this script deletes.
const FOLDER = 'notes'
const BUCKET = 'note-images'

const { values: flags } = parseArgs({
  options: {
    chapters: { type: 'string' },
    diagrams: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})

if (!flags.chapters || !flags.diagrams) {
  console.error('Usage: --chapters <dir> --diagrams <dir> [--dry-run]')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.IMPORT_EMAIL
const password = process.env.IMPORT_PASSWORD

if (!supabaseUrl) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL).')
  process.exit(1)
}

const useSignIn = Boolean(email && password)
if (!useSignIn && !serviceRoleKey) {
  console.error('Set either IMPORT_EMAIL + IMPORT_PASSWORD, or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (useSignIn && !anonKey) {
  console.error('Sign-in mode needs SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) too.')
  process.exit(1)
}

console.log(`Target:   ${supabaseUrl}`)
console.log(`Mode:     ${useSignIn ? `sign-in as ${email}` : 'service role'}`)
console.log(`Writing:  ${MODULE_ID}/${FOLDER}/*  +  ${BUCKET}/${MODULE_ID}/*.svg`)
if (flags['dry-run']) console.log('DRY RUN — nothing will be written.\n')
else console.log('')

const supabase = createClient(supabaseUrl, useSignIn ? anonKey : serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

if (useSignIn) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(`Sign-in failed: ${error.message}`)
    process.exit(1)
  }
}

// See the AUTHORSHIP note above. Checked by probing the table rather than by
// reading db/sql, because what matters is the state of THIS project, and the
// repo's migration files can be ahead of any given environment.
// Skipped for --dry-run: that path writes nothing, so service-role credentials
// are enough to preview exactly what a real run would do against this project.
if (!useSignIn && !flags['dry-run']) {
  const { error } = await supabase.from('note_authors').select('note_id').limit(1)
  const missing = error && (error.code === 'PGRST205' || /note_authors/.test(error.message || ''))
  if (!missing && !error) {
    console.error('note_authors exists on this project, so the authorship trigger is live.')
    console.error('A service-role write would abort on its NOT NULL user_id.')
    console.error('Re-run with IMPORT_EMAIL + IMPORT_PASSWORD instead.')
    process.exit(1)
  }
}

// The Subject must already exist: creating one is an owner action in the admin
// UI with a course_id this script has no business guessing.
const { data: moduleRow, error: moduleErr } = await supabase
  .from('sidebar_modules')
  .select('id, label')
  .eq('id', MODULE_ID)
  .maybeSingle()

if (moduleErr) {
  console.error(`Could not read sidebar_modules: ${moduleErr.message}`)
  process.exit(1)
}
if (!moduleRow) {
  console.error(`Subject "${MODULE_ID}" does not exist on this project. Create it in the admin UI first.`)
  process.exit(1)
}
console.log(`Subject:  ${moduleRow.id} ("${moduleRow.label}")\n`)

// ─── 1. diagrams → Storage ───────────────────────────────────────────────────

const diagramFiles = (await readdir(flags.diagrams)).filter((f) => f.endsWith('.svg')).sort()
console.log(`Diagrams (${diagramFiles.length}):`)

/**
 * Size of an object already in the bucket, or null if it isn't there.
 *
 * Read over the bucket's PUBLIC URL rather than with `storage.list()`. Listing
 * goes through a SELECT on storage.objects, and note-images has insert/update/
 * delete policies only (0023/0027) — no SELECT — so `list()` comes back empty
 * for a signed-in admin even though every object is publicly downloadable. A
 * HEAD on the public URL sidesteps RLS entirely and is what actually tells us
 * whether the object exists.
 */
async function existingSize(objectPath) {
  const res = await fetch(
    `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${objectPath}`,
    { method: 'HEAD' },
  )
  if (!res.ok) return null
  const len = res.headers.get('content-length')
  return len === null ? null : Number(len)
}

for (const file of diagramFiles) {
  const objectPath = `${MODULE_ID}/${file}`
  const body = await readFile(join(flags.diagrams, file))
  const already = await existingSize(objectPath)

  if (already === body.length) {
    console.log(`  unchanged     ${BUCKET}/${objectPath}  (${body.length} bytes)`)
    continue
  }
  if (flags['dry-run']) {
    console.log(`  would ${already === null ? 'upload' : 'replace'}  ${BUCKET}/${objectPath}`)
    continue
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    // contentType is explicit: Storage guesses from the extension, and an SVG
    // served as anything but image/svg+xml will not render in an <img>.
    .upload(objectPath, body, { contentType: 'image/svg+xml', upsert: true })

  if (error) {
    console.error(`  FAILED ${objectPath}: ${error.message}`)
    if (already !== null) {
      console.error('  This object already exists and was written by a different')
      console.error('  caller, which the note-images policies do not let an admin')
      console.error('  overwrite. Delete it in the Storage dashboard and re-run.')
    }
    process.exit(1)
  }
  console.log(`  uploaded      ${BUCKET}/${objectPath}  (${body.length} bytes)`)
}

// ─── 2. the chapters/ folder ─────────────────────────────────────────────────

console.log(`\nFolder:`)

// Checked before writing rather than upserted. A PostgREST upsert on an existing
// row issues an UPDATE, which would touch a folder row this script has no reason
// to modify (and would need update permission it has no reason to need). The
// folder normally already exists — `web/notes` predates this import.
const { data: folderRow, error: folderReadErr } = await supabase
  .from('note_folders')
  .select('name')
  .eq('module_id', MODULE_ID)
  .eq('name', FOLDER)
  .maybeSingle()

if (folderReadErr) {
  console.error(`  FAILED reading note_folders: ${folderReadErr.message}`)
  process.exit(1)
}

if (folderRow) {
  console.log(`  exists        ${MODULE_ID}/${FOLDER}  (left as is)`)
} else if (flags['dry-run']) {
  console.log(`  would create  ${MODULE_ID}/${FOLDER}`)
} else {
  const { error } = await supabase
    .from('note_folders')
    .insert({ module_id: MODULE_ID, name: FOLDER })
  if (error) {
    console.error(`  FAILED: ${error.message}`)
    process.exit(1)
  }
  console.log(`  created       ${MODULE_ID}/${FOLDER}`)
}

// Everything already in the target folder that this run will NOT write, listed
// so it's on the record that the import leaves it alone.
const paths = new Set()
{
  const { data: existing } = await supabase
    .from('notes')
    .select('path')
    .eq('module_id', MODULE_ID)
    .like('path', `${FOLDER}/%`)
  for (const r of existing ?? []) paths.add(r.path)
}

// ─── 3. chapters → notes ─────────────────────────────────────────────────────

/** First `# H1` of the Markdown — what the browser and reader show as the title. */
function titleOf(markdown, fallback) {
  const m = /^#\s+(.+)$/m.exec(markdown)
  return (m ? m[1] : fallback).trim()
}

const chapterFiles = (await readdir(flags.chapters)).filter((f) => f.endsWith('.md')).sort()
console.log(`\nChapters (${chapterFiles.length}):`)

let written = 0
for (const file of chapterFiles) {
  const contentMd = await readFile(join(flags.chapters, file), 'utf8')
  const slug = basename(file, '.md')
  // Paths in the DB never carry `.md` (see notesApi.stripMd), but `title` does
  // — that is the existing convention, e.g. the contributed note at
  // web/notes/jquery is titled "jquery.md".
  const path = `${FOLDER}/${slug}`
  const title = titleOf(contentMd, slug)

  if (flags['dry-run']) {
    console.log(`  would upsert  ${path}  "${title}"  (${contentMd.length} chars)`)
    continue
  }

  const { error } = await supabase
    .from('notes')
    .upsert({ module_id: MODULE_ID, path, title, content_md: contentMd }, { onConflict: 'module_id,path' })
  if (error) {
    console.error(`  FAILED ${path}: ${error.message}`)
    process.exit(1)
  }
  written += 1
  console.log(`  upserted      ${path}  "${title}"`)
}

// Anything that was already in the folder and is not one of ours. Printed so a
// run is auditable: these are untouched, and nothing above ever deletes.
const chapterPaths = new Set(chapterFiles.map((f) => `${FOLDER}/${basename(f, '.md')}`))
const untouched = [...paths].filter((p) => !chapterPaths.has(p))
console.log(`\nPre-existing notes in ${MODULE_ID}/${FOLDER} left untouched (${untouched.length}):`)
for (const p of untouched) console.log(`  ${p}`)

if (useSignIn) await supabase.auth.signOut()

console.log(
  flags['dry-run']
    ? `\nDry run complete. ${chapterFiles.length} chapters and ${diagramFiles.length} diagrams would be written.`
    : `\nDone. ${written} chapters and ${diagramFiles.length} diagrams written to ${supabaseUrl}.`
)
