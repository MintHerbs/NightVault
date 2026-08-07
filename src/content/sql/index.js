// Registry for the `::sqlrun{id="…"}` note directive.
//
// Scripts are CODE-DEFINED, not authored in note content: a note's Markdown can
// only name a script by id. Same boundary as ::playground and ::anim.
//
// The SQL genuinely runs. NoteSqlConsole loads PGlite (Postgres compiled to
// WebAssembly) on demand and executes each statement against a fresh in-memory
// database that lives entirely in the reader's tab, so CREATE TABLE really
// creates a table, INSERT really inserts, and a SELECT returns what Postgres
// actually returned rather than an answer somebody typed out by hand. Nothing
// here touches the site's own database.
//
// Each entry:
//   id          stable slug used in note content — renaming one orphans the note
//   label       shown in the console header
//   dialect     'postgres' by default. Set 'sqlserver' when the note is teaching
//               T-SQL syntax the lecture used; `setup` then carries a Postgres
//               translation so the console still runs, and the statement text
//               shown to the reader stays the syntax they will be examined on.
//   setup       SQL run once before the first step, invisibly. Use it for the
//               tables a script assumes rather than the ones it is teaching.
//   steps       [{ sql, note, hidden }]
//                 sql     the statement, shown and executed
//                 note    the line of prose explaining this step
//                 hidden  run it but do not show it (fixtures mid-script)
//   watch       table names whose full contents are shown after every step, so
//               the reader sees rows appear as they are inserted
//   editable    true to let the reader change the SQL and re-run it

import { SQL_SCRIPT_ID_RE } from '../../constants/noteSql'
import { dreamhomeScripts } from './dreamhome'

const ALL = [...dreamhomeScripts]

const BY_ID = new Map(ALL.map((entry) => [entry.id, entry]))

/** The script for an id, or null. Never throws on unknown input. */
export function getSqlScript(id) {
  if (!SQL_SCRIPT_ID_RE.test(String(id ?? ''))) return null
  return BY_ID.get(id) ?? null
}

/** Every registered id, for the build-time check that notes reference real ones. */
export function allSqlScriptIds() {
  return ALL.map((entry) => entry.id)
}
