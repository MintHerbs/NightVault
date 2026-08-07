import { useCallback, useEffect, useRef, useState } from 'react'
import { SQL_SCRIPT_ID_RE } from '../../../constants/noteSql'
import styles from './NoteSqlConsole.module.css'

/**
 * A SQL console embedded in a note, running real Postgres in the tab.
 *
 * Reached from note Markdown as `::sqlrun{id="ddl-create-branch"}`. The id
 * resolves against the code-defined registry in src/content/sql — note content
 * never supplies SQL of its own, which is the same boundary ::playground and
 * ::anim keep.
 *
 * The engine is PGlite: Postgres built to WebAssembly, running in an in-memory
 * database created fresh per console. So a student pressing Run watches a table
 * genuinely be created and genuinely be filled, and a mistake in their own
 * edited SQL comes back as the error Postgres actually raises, with its real
 * message and code. It cannot reach the network or the site's own database;
 * there is nothing in the datadir but what the script put there.
 *
 * It costs about 3 MB of WebAssembly, so nothing loads until the reader presses
 * Run. A reader who scrolls past a console pays for none of it. Same
 * load-on-demand rule as the reader's KaTeX chunk and the playground's Monaco.
 */

/** The PGlite module, fetched once per session and shared by every console. */
let pgliteModule = null
let pglitePromise = null

function loadPglite() {
  if (pgliteModule) return Promise.resolve(pgliteModule)
  if (!pglitePromise) {
    pglitePromise = import('@electric-sql/pglite').then((mod) => {
      pgliteModule = mod
      return mod
    })
  }
  return pglitePromise
}

/** The script registry, fetched once per session. */
let registryModule = null
let registryPromise = null

function loadRegistry() {
  if (registryModule) return Promise.resolve(registryModule)
  if (!registryPromise) {
    registryPromise = import('../../../content/sql').then((mod) => {
      registryModule = mod
      return mod
    })
  }
  return registryPromise
}

/** Postgres reports its own tag ("CREATE TABLE", "INSERT 0 1"); PGlite exposes
 *  the pieces separately, so rebuild the line psql would have printed. */
function statusLine(result) {
  if (!result) return 'OK'
  const rows = result.rows?.length ?? 0
  if (rows > 0) return `${rows} row${rows === 1 ? '' : 's'} returned`
  const affected = result.affectedRows ?? 0
  if (affected > 0) return `${affected} row${affected === 1 ? '' : 's'} affected`
  return 'Success. No rows returned'
}

function ResultGrid({ fields, rows, highlightFrom, labels }) {
  if (!fields?.length) return null
  if (!rows?.length) {
    return <p className={styles.empty}>No rows</p>
  }
  const columns = fields.map((f) => f.name)
  return (
    <div className={styles.gridWrap}>
      <table className={styles.grid}>
        <thead>
          <tr>
            {columns.map((c) => (
              // Postgres folds an unquoted identifier to lower case, so a
              // column written `staffNo` in the lecture comes back as
              // `staffno`. The script's `labels` map restores the spelling the
              // student is examined on. Display only — the data is untouched.
              <th key={c}>{labels?.[c] ?? c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              // Row identity is positional here: a teaching result set can
              // legitimately contain two identical rows, so the index is the
              // only stable key available.
              key={i}
              className={highlightFrom != null && i >= highlightFrom ? styles.rowNew : undefined}
            >
              {columns.map((c) => (
                <td key={c}>{formatCell(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(value) {
  if (value === null || value === undefined) return 'NULL'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function NoteSqlConsole({ scriptId }) {
  const [entry, setEntry] = useState(null)
  const [resolved, setResolved] = useState(false)
  const [sqlText, setSqlText] = useState([])
  const [log, setLog] = useState([])
  const [watched, setWatched] = useState([])
  const [cursor, setCursor] = useState(0)
  const [busy, setBusy] = useState(false)
  const [booting, setBooting] = useState(false)
  const [editing, setEditing] = useState(false)
  const dbRef = useRef(null)
  const logEndRef = useRef(null)

  useEffect(() => {
    if (!SQL_SCRIPT_ID_RE.test(String(scriptId ?? ''))) {
      setResolved(true)
      return undefined
    }
    let live = true
    loadRegistry()
      .then((mod) => {
        if (!live) return
        const found = mod.getSqlScript(scriptId)
        setEntry(found ?? null)
        setSqlText(found ? found.steps.map((s) => s.sql) : [])
        setResolved(true)
      })
      .catch(() => {
        if (live) setResolved(true)
      })
    return () => {
      live = false
    }
  }, [scriptId])

  // One database per console, torn down with the component so a reader who
  // scrolls away is not holding a Postgres instance open.
  useEffect(() => () => {
    dbRef.current?.close?.()
    dbRef.current = null
  }, [])

  const ensureDb = useCallback(async () => {
    if (dbRef.current) return dbRef.current
    setBooting(true)
    try {
      const { PGlite } = await loadPglite()
      const db = await PGlite.create()
      if (entry?.setup) await db.exec(entry.setup)
      dbRef.current = db
      return db
    } finally {
      setBooting(false)
    }
  }, [entry])

  const readWatched = useCallback(async (db) => {
    if (!entry?.watch?.length) return []
    const out = []
    for (const table of entry.watch) {
      try {
        // The table may legitimately not exist yet — the script is often in the
        // middle of creating it — so a failure here is a normal state, not an
        // error worth showing.
        const res = await db.query(`select * from ${table}`)
        out.push({ table, fields: res.fields, rows: res.rows })
      } catch {
        out.push({ table, missing: true })
      }
    }
    return out
  }, [entry])

  const runStep = useCallback(async () => {
    if (!entry || cursor >= entry.steps.length) return
    setBusy(true)
    try {
      const db = await ensureDb()
      const step = entry.steps[cursor]
      const sql = sqlText[cursor] ?? step.sql
      const before = await readWatched(db)
      let record
      try {
        const res = await db.query(sql)
        record = {
          sql,
          note: step.note,
          ok: true,
          status: statusLine(res),
          fields: res.fields,
          rows: res.rows,
        }
      } catch (err) {
        record = { sql, note: step.note, ok: false, status: String(err?.message ?? err) }
      }
      setLog((l) => [...l, record])
      const after = await readWatched(db)
      // Mark rows the step itself added, so "being populated" is visible rather
      // than something the reader has to diff by eye.
      setWatched(
        after.map((t) => {
          const prior = before.find((b) => b.table === t.table)
          const grew = !t.missing && !prior?.missing && (t.rows?.length ?? 0) > (prior?.rows?.length ?? 0)
          return grew ? { ...t, highlightFrom: prior.rows.length } : t
        })
      )
      setCursor((c) => c + 1)
    } finally {
      setBusy(false)
    }
  }, [entry, cursor, sqlText, ensureDb, readWatched])

  const runAll = useCallback(async () => {
    if (!entry) return
    setBusy(true)
    try {
      const db = await ensureDb()
      const records = []
      for (let i = cursor; i < entry.steps.length; i += 1) {
        const step = entry.steps[i]
        const sql = sqlText[i] ?? step.sql
        try {
          const res = await db.query(sql)
          records.push({ sql, note: step.note, ok: true, status: statusLine(res), fields: res.fields, rows: res.rows })
        } catch (err) {
          records.push({ sql, note: step.note, ok: false, status: String(err?.message ?? err) })
          setLog((l) => [...l, ...records])
          setCursor(i + 1)
          setWatched(await readWatched(db))
          return
        }
      }
      setLog((l) => [...l, ...records])
      setCursor(entry.steps.length)
      setWatched(await readWatched(db))
    } finally {
      setBusy(false)
    }
  }, [entry, cursor, sqlText, ensureDb, readWatched])

  const reset = useCallback(async () => {
    await dbRef.current?.close?.()
    dbRef.current = null
    setLog([])
    setWatched([])
    setCursor(0)
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [log.length])

  if (!resolved || !entry) return null

  const done = cursor >= entry.steps.length
  const next = done ? null : entry.steps[cursor]

  return (
    <div className={styles.wrapper} contentEditable={false}>
      <div className={styles.header}>
        <span className={styles.title}>{entry.label}</span>
        <span className={styles.engine}>
          {entry.dialect === 'sqlserver' ? 'runs on Postgres' : 'Postgres'}
        </span>
        <span className={styles.spacer} />
        {entry.editable ? (
          <button type="button" className={styles.ghostButton} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done' : 'Edit SQL'}
          </button>
        ) : null}
        <button type="button" className={styles.ghostButton} onClick={reset} disabled={busy || (!log.length && !cursor)}>
          Reset
        </button>
        <button type="button" className={styles.stepButton} onClick={runStep} disabled={busy || done}>
          Step
        </button>
        <button type="button" className={styles.runButton} onClick={runAll} disabled={busy || done}>
          {booting ? 'Starting Postgres…' : busy ? 'Running…' : done ? 'Finished' : 'Run'}
        </button>
      </div>

      {next ? (
        <div className={styles.pending}>
          <div className={styles.pendingHead}>
            <span className={styles.stepNo}>{cursor + 1}</span>
            <span className={styles.pendingNote}>{next.note}</span>
          </div>
          {editing ? (
            <textarea
              className={styles.editor}
              value={sqlText[cursor] ?? next.sql}
              spellCheck={false}
              rows={Math.max(2, (sqlText[cursor] ?? next.sql).split('\n').length)}
              onChange={(e) => {
                const value = e.target.value
                setSqlText((t) => t.map((s, i) => (i === cursor ? value : s)))
              }}
            />
          ) : (
            <pre className={styles.sql}>{sqlText[cursor] ?? next.sql}</pre>
          )}
        </div>
      ) : null}

      {log.length ? (
        <div className={styles.log}>
          {log.map((rec, i) => (
            // Positional key again: two steps in a teaching script can run the
            // very same statement (a SELECT before and after an UPDATE).
            <div key={i} className={styles.entry}>
              <pre className={styles.ranSql}>{rec.sql}</pre>
              <p className={rec.ok ? styles.ok : styles.error}>
                {rec.ok ? '✓ ' : '✕ '}
                {rec.status}
              </p>
              {rec.ok ? <ResultGrid fields={rec.fields} rows={rec.rows} labels={entry.labels} /> : null}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      ) : null}

      {watched.length ? (
        <div className={styles.watch}>
          {watched.map((t) => (
            <div key={t.table} className={styles.watchTable}>
              <p className={styles.watchName}>
                {t.table}
                {t.missing ? <span className={styles.watchMissing}> does not exist yet</span> : null}
              </p>
              {t.missing ? null : (
                <ResultGrid
                  fields={t.fields}
                  rows={t.rows}
                  highlightFrom={t.highlightFrom}
                  labels={entry.labels}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
