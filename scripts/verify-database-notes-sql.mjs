#!/usr/bin/env node
// Runs database-notes-upsert.sql against a real Postgres (PGlite) standing in
// for the live schema, and checks that what lands is byte-identical to the
// files it was generated from.
//
//   node scripts/verify-database-notes-sql.mjs
//
// The point is the string escaping. 54 KB of Markdown carrying apostrophes,
// dollar signs and backslashes is exactly where a generated UPDATE goes wrong,
// and a quoting bug would either fail loudly in the SQL editor or, worse,
// truncate a note silently.
//
// The stub reproduces only what the file touches: the two tables, and the
// auth.uid() the real triggers read. It is not a substitute for the real
// schema; it is a check that the SQL is well formed and the content survives.

import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url)
const sql = await readFile(new URL('database-notes-upsert.sql', ROOT), 'utf8')

const AUTHOR = 'f4fbb1be-fcca-4e72-84f5-e3c22d658e26'
const PATHS = {
  'Semester_1_lecture-3-Data_Definition_Language.md': 'Semester 1/lecture-3-Data Definition Language',
  'Semester_1_lecture-4_Data_ManIpulation_Language.md': 'Semester 1/lecture-4 Data ManIpulation Language',
  'Semester_1_lecture-5_Data_Manipulation_Language.md': 'Semester 1/lecture-5 Data Manipulation Language',
  'Semester_1_lecture-6_Sql_Views_Access_Privileges.md': 'Semester 1/lecture-6 Sql Views Access Privileges',
  'Semester_1_lecture-7_Entity_Relationship_Modelling.md': 'Semester 1/lecture-7 Entity Relationship Modelling',
  'Semester_1_lecture-10_Normalisation.md': 'Semester 1/lecture-10 Normalisation',
  'Semester_2_lecture-5_Multilevel_Indexes_&_B+-Trees.md': 'Semester 2/lecture-5 Multilevel Indexes & B+-Trees',
}

const db = await PGlite.create()

await db.exec(`
  create schema if not exists auth;
  create table public.admin_users (
    id uuid primary key,
    username text,
    role text
  );
  create table public.notes (
    id uuid primary key default gen_random_uuid(),
    module_id text not null,
    path text not null,
    title text,
    content_md text,
    unique (module_id, path)
  );
  create table public.note_authors (
    note_id uuid not null,
    user_id uuid not null
  );
  insert into public.admin_users values ('${AUTHOR}', 'Noorie', 'owner');
`)

// Seed the seven notes with their PRE-augmentation content, so the run has to
// actually change something rather than passing against empty rows.
for (const [file, path] of Object.entries(PATHS)) {
  const orig = new URL(`preview-notes-original/${file}`, ROOT)
  const before = existsSync(orig) ? await readFile(orig, 'utf8') : ''
  await db.query('insert into public.notes (module_id, path, content_md) values ($1, $2, $3)', [
    'database',
    path,
    before,
  ])
}
const seeded = await db.query('select count(*)::int as n from public.notes')
console.log(`seeded ${seeded.rows[0].n} notes with their pre-augmentation content`)

// A negative control: prove the harness would notice a bad file.
try {
  await db.exec('begin; update public.notes set content_md = \'x\' where 1/0 = 1; commit;')
  console.log('NEGATIVE CONTROL FAILED: a broken statement was accepted')
  process.exit(1)
} catch {
  await db.exec('rollback')
  console.log('negative control: a broken statement is rejected, as expected')
}

try {
  await db.exec(sql)
} catch (err) {
  console.error(`\nSQL FAILED: ${err.message}`)
  process.exit(1)
}

let bad = 0
for (const [file, path] of Object.entries(PATHS)) {
  const expected = await readFile(new URL(`preview-notes/${file}`, ROOT), 'utf8')
  const got = await db.query('select content_md from public.notes where module_id = $1 and path = $2', [
    'database',
    path,
  ])
  if (got.rows.length !== 1) {
    console.log(`  ✕ ${path}: matched ${got.rows.length} rows`)
    bad += 1
    continue
  }
  const actual = got.rows[0].content_md
  if (actual !== expected) {
    console.log(`  ✕ ${path}: content differs (${actual.length} stored vs ${expected.length} expected)`)
    // Show the first divergence, which is where the escaping broke.
    for (let i = 0; i < Math.max(actual.length, expected.length); i += 1) {
      if (actual[i] !== expected[i]) {
        console.log(`     first difference at ${i}: ${JSON.stringify(expected.slice(i - 30, i + 30))}`)
        console.log(`                        got: ${JSON.stringify(actual.slice(i - 30, i + 30))}`)
        break
      }
    }
    bad += 1
    continue
  }
  console.log(`  ✓ ${path.padEnd(52)} ${actual.length} chars, byte-identical`)
}

// Re-running must be a no-op, not a duplicate.
await db.exec(sql)
const after = await db.query('select count(*)::int as n from public.notes')
if (after.rows[0].n !== seeded.rows[0].n) {
  console.log(`  ✕ re-running changed the row count: ${seeded.rows[0].n} -> ${after.rows[0].n}`)
  bad += 1
} else {
  console.log(`  ✓ re-running is a no-op, still ${after.rows[0].n} notes`)
}

await db.close()
console.log(bad === 0 ? '\nall 7 notes verified' : `\n${bad} problem(s)`)
process.exit(bad === 0 ? 0 : 1)
