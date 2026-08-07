#!/usr/bin/env node
// scripts/verify-note-sql.mjs
//
// Runs every script in the `::sqlrun` registry through a real Postgres (PGlite,
// the same engine the reader's console uses) and reports what each statement
// did. A note that embeds a console is making a promise that the SQL in it
// works; this is what keeps that promise honest.
//
// Some steps are MEANT to fail — the DDL lecture demonstrates referential
// integrity by trying to insert a bad foreign key. Those are marked in the
// registry note text, so this script does not guess: it prints every outcome
// and fails the run only when a step errors that has no `expectError` flag.
//
// Usage:
//   node scripts/verify-note-sql.mjs            # all scripts
//   node scripts/verify-note-sql.mjs ddl-build  # only ids containing "ddl-build"

import { PGlite } from '@electric-sql/pglite'
import { dreamhomeScripts } from '../src/content/sql/dreamhome.js'

const filter = process.argv[2] ?? ''
const scripts = [...dreamhomeScripts].filter((s) => s.id.includes(filter))

let failures = 0
let unexpectedOk = 0

for (const script of scripts) {
  console.log(`\n=== ${script.id} — ${script.label} ===`)
  const db = await PGlite.create()
  if (script.setup) {
    try {
      await db.exec(script.setup)
    } catch (err) {
      console.log(`  SETUP FAILED: ${err.message}`)
      failures += 1
      await db.close()
      continue
    }
  }

  for (const [i, step] of script.steps.entries()) {
    const n = String(i + 1).padStart(2)
    try {
      const res = await db.query(step.sql)
      const rows = res.rows?.length ?? 0
      const affected = res.affectedRows ?? 0
      const summary = rows > 0 ? `${rows} row(s)` : affected > 0 ? `${affected} affected` : 'ok'
      if (step.expectError) {
        console.log(`  ${n} UNEXPECTEDLY SUCCEEDED (marked expectError): ${summary}`)
        unexpectedOk += 1
      } else {
        console.log(`  ${n} ✓ ${summary}`)
      }
    } catch (err) {
      if (step.expectError) {
        console.log(`  ${n} ✓ failed as intended: ${err.message}`)
      } else {
        console.log(`  ${n} ✕ ${err.message}`)
        console.log(`     ${step.sql.split('\n')[0]}`)
        failures += 1
      }
    }
  }

  // Every watched table must actually be readable at the end, or the console
  // would render a permanent "does not exist yet" panel.
  for (const table of script.watch ?? []) {
    try {
      await db.query(`select * from ${table}`)
    } catch (err) {
      console.log(`  watch table ${table} unreadable at end: ${err.message}`)
      failures += 1
    }
  }

  await db.close()
}

console.log(
  `\n${scripts.length} script(s) checked. ${failures} unexpected failure(s), ${unexpectedOk} step(s) that should have failed but did not.`
)
process.exit(failures + unexpectedOk > 0 ? 1 : 0)
