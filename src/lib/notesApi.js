// src/lib/notesApi.js
//
// Data-access layer for note CONTENT, now sourced from Supabase (E-005/T-043)
// instead of build-time `import.meta.glob` + the modules.js `notes[]` registry.
//
// Identity is (moduleId, path): `path` is the note's location relative to its
// module WITHOUT the `.md` extension — the same value the old registry stored
// as `notes[].filename`, and the on-disk `src/content/notes/<module>/<path>.md`
// layout. It may contain slashes; the first segment is the display subfolder.
//
// The merge helpers reproduce the exact `module.notes = [{ filename, label }]`
// shape the sidebar and DirectoryDrawer already consume, so those components
// keep working against `modules[].notes` — only the *source* of that array
// changes from a static import to this module.

import { supabase } from './supabaseClient'

// ─── Pure path helpers (no I/O) ───────────────────────────────────────────────

/** Strip a single trailing `.md`, if present. Paths in the DB never carry it. */
export function stripMd(path) {
  return String(path || '').replace(/\.md$/i, '')
}

/**
 * First path segment, or null when the note sits at the module root.
 *
 * `null` means "directly under the Subject, in no folder" and is a real,
 * displayable location (T-053). It used to be coerced to the string 'notes'
 * by a `displaySubfolder` wrapper, which put root notes in the same bucket as
 * notes genuinely prefixed `notes/` and left no surface on which a root file
 * could be created. That wrapper is gone; callers branch on null instead.
 */
export function deriveSubfolder(path) {
  const i = String(path || '').indexOf('/')
  return i === -1 ? null : path.slice(0, i)
}

/**
 * URL segment standing in for "no folder", so the file route can keep its
 * fixed /:moduleId/:subfolder/:slug shape. Reserved as a folder name by
 * nameError in useEditorModules, so a real folder can never collide with it.
 */
export const ROOT_SEGMENT = '~'

/** Route segment <-> subfolder value. `null` is the Subject root. */
export function subfolderToSegment(subfolder) {
  return subfolder ?? ROOT_SEGMENT
}

export function segmentToSubfolder(segment) {
  return !segment || segment === ROOT_SEGMENT ? null : segment
}

/** Join a folder (or null for the Subject root) and a bare filename. */
export function buildNotePath(subfolder, filename) {
  return subfolder ? `${subfolder}/${filename}` : filename
}

/** The basename (last path segment) without extension. */
export function baseName(path) {
  return stripMd(String(path || '').split('/').pop() || '')
}

// ─── Ordering (T-076) ───────────────────────────────────────────────────────

/** Natural ("human") ordering, so ch2 sorts before ch10 rather than after it.
 *  `numeric` is what does that; without it any run of digits compares
 *  character by character. */
const NATURAL = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** 'YYYY-MM-DD' for a timestamp, or '' when there isn't one. */
function createdDay(value) {
  if (!value) return ''
  const t = Date.parse(value)
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10)
}

/**
 * Ordering for the files inside one folder: **oldest day first, then by
 * number/name within that day.**
 *
 * Compared at DAY granularity, not by raw timestamp, and that is the whole
 * point. A batch of chapters written on the same day gets millisecond-apart
 * `created_at` values that reflect nothing but insert order, so sorting on the
 * full timestamp would scatter ch01..ch20 arbitrarily. Collapsing to the day
 * lets the natural-name tiebreak produce 1, 2, 3, … while still putting a note
 * genuinely written later below the earlier batch.
 *
 * Notes with no `created_at` (an environment where migration 0046 has not been
 * applied) sort as '' — all equal — so the whole list falls through to the name
 * comparison and stays sensible instead of ordering at random.
 *
 * Ties break on the filename rather than the display label: the label is
 * author-editable and often duplicated ("Chapter 2: …"), while the path is
 * unique per Subject, so this is a total order with no arbitrary residue.
 */
export function compareNotes(a, b) {
  const dayA = createdDay(a.createdAt)
  const dayB = createdDay(b.createdAt)
  if (dayA !== dayB) {
    // A missing day sorts last, so un-backfilled rows don't jump to the top.
    if (!dayA) return 1
    if (!dayB) return -1
    return dayA < dayB ? -1 : 1
  }
  return NATURAL.compare(baseName(a.path ?? ''), baseName(b.path ?? ''))
}

/**
 * The same ordering for a browser ROW (`{ name, created }`) rather than a note
 * record. Both the public notes browser and the admin browser build rows and
 * then sort them for their own column headers, so they need a comparator that
 * speaks their shape — sharing this one is what keeps the two lists identical.
 *
 * Compares on the display name rather than the path, because that is the column
 * the user is looking at, and does it naturally: plain `localeCompare` orders
 * "Chapter 10" before "Chapter 2", which is what these lists used to show.
 */
export function compareRowsByCreated(a, b) {
  const dayA = createdDay(a.created)
  const dayB = createdDay(b.created)
  if (dayA !== dayB) {
    if (!dayA) return 1
    if (!dayB) return -1
    return dayA < dayB ? -1 : 1
  }
  return compareRowsByName(a, b)
}

/**
 * Natural ordering on a row: 1, 2, …, 9, 10, 11, not 1, 10, 11, 2.
 *
 * Prefers `sortKey` (the filename, for a file row) over `name` (the title).
 * The filename is the author's deliberate ordering key — it is why chapters get
 * zero-padded as `ch01` — whereas the title is prose and need not encode order
 * at all. For these notes both give the same 1…20 run, but only the filename
 * puts an index note (`00-module-overview`, titled "Web & Mobile Development…")
 * at the top where it belongs rather than filing it under W.
 */
export function compareRowsByName(a, b) {
  const keyA = a.sortKey ?? a.name ?? ''
  const keyB = b.sortKey ?? b.name ?? ''
  return NATURAL.compare(String(keyA), String(keyB))
}

/**
 * Merge DB note + folder rows into a copy of the structural MODULES array,
 * attaching `notes` and `subfolders` in the shape existing consumers expect.
 * Never mutates the input modules (they hold live React Icon components).
 *
 *   notes:   [{ moduleId, path, title }]
 *   folders: [{ moduleId, name }]      // explicit empty subfolders
 */
export function mergeNotesIntoModules(modules, notes, folders = [], authorsByNoteId = new Map()) {
  const byModule = new Map()
  for (const n of notes) {
    if (!byModule.has(n.moduleId)) byModule.set(n.moduleId, [])
    byModule.get(n.moduleId).push({
      id: n.id,
      filename: n.path,
      label: n.title || `${baseName(n.path)}.md`,
      hidden: !!n.hidden,
      updatedAt: n.updatedAt ?? null,
      createdAt: n.createdAt ?? null,
      authors: authorsByNoteId.get(n.id) ?? [],
    })
  }
  const foldersByModule = new Map()
  for (const f of folders) {
    if (!foldersByModule.has(f.moduleId)) foldersByModule.set(f.moduleId, [])
    foldersByModule.get(f.moduleId).push(f.name)
  }

  return modules.map((m) => {
    const moduleNotes = byModule.get(m.id)
    const moduleFolders = foldersByModule.get(m.id)
    const next = { ...m }
    // Only attach `notes` when there are some, so a genuinely empty module
    // still renders as "coming soon" in ExpandedView (its check keys off the
    // presence of the property), exactly as before.
    if (moduleNotes && moduleNotes.length > 0) {
      // Ordered here as well as in filesForFolder (T-076) so that anything
      // reading `module.notes` straight off a merged Subject inherits the same
      // order, instead of the order depending on which helper the caller used.
      // compareNotes reads `path`, which is `filename` in this shape.
      next.notes = [...moduleNotes].sort((a, b) =>
        compareNotes({ ...a, path: a.filename }, { ...b, path: b.filename }))
    } else {
      delete next.notes
    }
    if (moduleFolders && moduleFolders.length > 0) {
      next.subfolders = [...new Set([...(m.subfolders ?? []), ...moduleFolders])]
    }
    return next
  })
}

// ─── Tree shape (pure, over an already-merged module) ─────────────────────
// Hoisted out of AdminBrowser and NotesBrowserPage, which each carried their
// own copy (T-053). Both pages render the same tree, so a divergence between
// the two copies showed up as content visible in the admin panel but missing
// from the live site.

/**
 * Every named subfolder a Subject has: derived from its notes, plus any
 * explicit (possibly empty) folder rows. Root-level notes contribute no
 * folder — they sit alongside these, not inside one.
 */
export function subfoldersForModule(module) {
  const derived = (module.notes ?? [])
    .map((n) => deriveSubfolder(n.filename))
    .filter((name) => name !== null)
  const explicit = module.subfolders ?? []
  return [...new Set([...derived, ...explicit])]
}

/**
 * Notes displayed inside `subfolder`, or directly under the Subject when
 * `subfolder` is null.
 */
export function filesForFolder(module, subfolder) {
  return (module.notes ?? [])
    .filter((n) => deriveSubfolder(n.filename) === (subfolder ?? null))
    .map((n) => ({
      id: n.id,
      name: n.label || `${baseName(n.filename)}.md`,
      path: n.filename,
      moduleId: module.id,
      hidden: n.hidden,
      updatedAt: n.updatedAt,
      createdAt: n.createdAt ?? null,
      authors: n.authors ?? [],
    }))
    // Sorted here rather than in listNotes' SQL: natural ("ch2 before ch10")
    // ordering isn't expressible in a PostgREST `order`, and this is the single
    // function both the live notes browser and the admin browser read their
    // file lists from — so the two surfaces cannot drift out of agreement about
    // the order. See compareNotes.
    .sort(compareNotes)
}

/** Notes sitting directly under the Subject, in no folder. */
export function rootFilesForModule(module) {
  return filesForFolder(module, null)
}

// ─── Authorship (T-071) ─────────────────────────────────────────────────────

/**
 * Merge several notes' author lists into one deduped, richest-contributor-
 * first list — used for folder/Subject rows, which have no single note
 * behind them but should still surface every contributor across everything
 * they contain.
 */
export function mergeAuthorLists(lists) {
  const byId = new Map()
  for (const list of lists) {
    for (const a of list ?? []) {
      const existing = byId.get(a.id)
      if (existing) existing.contributionCount += a.contributionCount
      else byId.set(a.id, { ...a })
    }
  }
  return [...byId.values()].sort((a, b) => b.contributionCount - a.contributionCount)
}

/** Every distinct author across every note directly in `subfolder` (or the
 * Subject root when `subfolder` is null). */
export function authorsForFolder(module, subfolder) {
  return mergeAuthorLists(filesForFolder(module, subfolder).map((f) => f.authors))
}

/** Every distinct author across every note in a Subject, root and folders alike. */
export function authorsForModule(module) {
  return mergeAuthorLists((module.notes ?? []).map((n) => n.authors))
}

// ─── Reads ─────────────────────────────────────────────────────────────────

/** Every note's identity + label (no content) — for building the registry. */
const NOTE_COLUMNS = 'id, module_id, path, title, updated_at, updated_by, hidden'

export async function listNotes() {
  // `created_at` arrived in migration 0046 (T-076). Asking for a column that
  // doesn't exist makes PostgREST reject the whole request, which would take
  // the entire notes listing — and with it the sidebar and the public browser —
  // down on any environment the migration hasn't reached yet. So it's requested
  // optimistically and retried without on failure, the same way listNoteAuthors
  // tolerates 0042 being absent. Ordering degrades to name-only there
  // (compareNotes treats a missing created_at as equal), which is what the list
  // did before this column existed.
  let { data, error } = await supabase
    .from('notes')
    .select(`${NOTE_COLUMNS}, created_at`)
    .order('module_id', { ascending: true })
    .order('created_at', { ascending: true })
    .order('path', { ascending: true })

  if (error) {
    ({ data, error } = await supabase
      .from('notes')
      .select(NOTE_COLUMNS)
      .order('module_id', { ascending: true })
      .order('path', { ascending: true }))
  }

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    moduleId: r.module_id,
    path: r.path,
    title: r.title,
    updatedAt: r.updated_at,
    createdAt: r.created_at ?? null,
    updatedBy: r.updated_by,
    hidden: !!r.hidden,
  }))
}

/**
 * Every note's author list, keyed by note id (T-071). note_authors
 * references auth.users, not admin_users, so there's no FK PostgREST can
 * embed through — joined client-side against admin_profiles_public instead.
 *
 * Degrades to an empty map on error rather than throwing: this is called
 * alongside listNotes()/listModules()/listNoteFolders() inside a Promise.all
 * in both registry hooks, and authorship is additive on top of that data —
 * a note_authors/admin_profiles_public query failure (e.g. migration 0042
 * not yet applied to this environment) must not take down the entire
 * notes/Subjects listing, just leave every AvatarGroup empty.
 */
export async function listNoteAuthors() {
  const [authorsRes, profilesRes] = await Promise.all([
    supabase.from('note_authors').select('note_id, user_id, contribution_count'),
    supabase.from('admin_profiles_public').select('id, display_name, avatar_url'),
  ])
  if (authorsRes.error || profilesRes.error) {
    console.error('Failed to load note authors:', authorsRes.error || profilesRes.error)
    return new Map()
  }

  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
  const byNote = new Map()
  for (const row of authorsRes.data ?? []) {
    const profile = profileById.get(row.user_id)
    if (!byNote.has(row.note_id)) byNote.set(row.note_id, [])
    byNote.get(row.note_id).push({
      id: row.user_id,
      displayName: profile?.display_name || 'Unknown',
      avatarUrl: profile?.avatar_url || null,
      contributionCount: row.contribution_count,
    })
  }
  for (const list of byNote.values()) {
    list.sort((a, b) => b.contributionCount - a.contributionCount)
  }
  return byNote
}

/**
 * Author list for a single note, same shape as one `listNoteAuthors()` entry.
 * For the reader page, which only ever needs one note's worth rather than
 * the full-registry map the browsers use. Degrades to `[]` on error, same
 * reasoning as `listNoteAuthors()` — the note itself is already on screen by
 * the time this is called, so a failure here should lose the byline, not the
 * note.
 */
export async function getNoteAuthors(noteId) {
  if (!noteId) return []
  const { data: rows, error } = await supabase
    .from('note_authors')
    .select('user_id, contribution_count')
    .eq('note_id', noteId)
  if (error) {
    console.error('Failed to load note authors:', error)
    return []
  }
  if (!rows || rows.length === 0) return []

  const { data: profiles, error: profErr } = await supabase
    .from('admin_profiles_public')
    .select('id, display_name, avatar_url')
    .in('id', rows.map((r) => r.user_id))
  if (profErr) {
    console.error('Failed to load note author profiles:', profErr)
    return []
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  return rows
    .map((r) => {
      const profile = profileById.get(r.user_id)
      return {
        id: r.user_id,
        displayName: profile?.display_name || 'Unknown',
        avatarUrl: profile?.avatar_url || null,
        contributionCount: r.contribution_count,
      }
    })
    .sort((a, b) => b.contributionCount - a.contributionCount)
}

/** Explicit empty subfolders. */
export async function listNoteFolders() {
  const { data, error } = await supabase
    .from('note_folders')
    .select('module_id, name, hidden')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ moduleId: r.module_id, name: r.name, hidden: !!r.hidden }))
}

/**
 * Load one note's content. Accepts a path with or without a trailing `.md`
 * (older deep links carry it). Returns null when absent.
 */
export async function getNote(moduleId, path) {
  const clean = stripMd(path)
  const { data, error } = await supabase
    .from('notes')
    .select('id, module_id, path, title, content_md, hidden, updated_by')
    .eq('module_id', moduleId)
    .eq('path', clean)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id,
    moduleId: data.module_id,
    path: data.path,
    title: data.title,
    contentMd: data.content_md,
    hidden: !!data.hidden,
    updatedBy: data.updated_by,
  }
}

/** True if a note already exists at (moduleId, path). */
export async function noteExists(moduleId, path) {
  const { data, error } = await supabase
    .from('notes')
    .select('id')
    .eq('module_id', moduleId)
    .eq('path', stripMd(path))
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

/** Notes in `subfolder` within a module, or at its root when null. */
export async function listNotesInFolder(moduleId, subfolder) {
  const all = await listNotes()
  return all.filter((n) => n.moduleId === moduleId && deriveSubfolder(n.path) === (subfolder ?? null))
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Create or update a note's content in place. Keyed on (module_id, path);
 * updated_at/updated_by are stamped by the DB trigger.
 */
export async function upsertNote({ moduleId, path, title, contentMd }) {
  const { data, error } = await supabase
    .from('notes')
    .upsert(
      { module_id: moduleId, path: stripMd(path), title: title ?? '', content_md: contentMd ?? '' },
      { onConflict: 'module_id,path' }
    )
    .select('module_id, path, title')
    .single()
  if (error) throw new Error(error.message)
  return { moduleId: data.module_id, path: data.path, title: data.title }
}

/**
 * Change a note's identity (rename and/or move) and optionally its label.
 * A single row UPDATE — cross-module moves are gated owner-only by the DB
 * trigger, surfacing as an error the caller can show.
 */
export async function moveNote({ fromModuleId, fromPath, toModuleId, toPath, title, contentMd }) {
  const patch = { module_id: toModuleId, path: stripMd(toPath) }
  if (title !== undefined) patch.title = title
  if (contentMd !== undefined) patch.content_md = contentMd
  const { error } = await supabase
    .from('notes')
    .update(patch)
    .eq('module_id', fromModuleId)
    .eq('path', stripMd(fromPath))
  if (error) throw new Error(error.message)
}

/** Delete one note. Owner-only server-side. */
export async function deleteNote(moduleId, path) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('module_id', moduleId)
    .eq('path', stripMd(path))
  if (error) throw new Error(error.message)
}

// ─── Folder ops ────────────────────────────────────────────────────────────

/** Register an explicit (possibly empty) subfolder. */
export async function createFolder(moduleId, name) {
  const { error } = await supabase
    .from('note_folders')
    .upsert({ module_id: moduleId, name }, { onConflict: 'module_id,name' })
  if (error) throw new Error(error.message)
}

/**
 * Rename a subfolder: rewrite the leading segment of every note carrying the
 * `oldName/` prefix, and rename the explicit folder row if present. Root-level
 * notes have no prefix and are never touched, whatever the folder is called.
 */
export async function renameFolder(moduleId, oldName, newName) {
  const notes = await listNotes()
  const targets = notes.filter(
    (n) => n.moduleId === moduleId && n.path.startsWith(`${oldName}/`)
  )
  // Each note's move is independent (distinct paths), so run them
  // concurrently rather than one round trip at a time.
  await Promise.all(
    targets.map((n) => {
      const rest = n.path.slice(oldName.length + 1)
      return moveNote({
        fromModuleId: moduleId,
        fromPath: n.path,
        toModuleId: moduleId,
        toPath: `${newName}/${rest}`,
      })
    })
  )
  // Move the explicit folder row (delete old, add new) if it exists.
  const { error: delErr } = await supabase
    .from('note_folders')
    .delete()
    .eq('module_id', moduleId)
    .eq('name', oldName)
  if (delErr) throw new Error(delErr.message)
  await createFolder(moduleId, newName)
}

/**
 * Delete a named subfolder and every note under it. Primary-owner-only in
 * practice (the UI gates it, and `notes delete locked` / `note_folders delete
 * locked` enforce it server-side). Returns the number of notes removed.
 *
 * There is deliberately no root case: the Subject root is not a folder and
 * cannot be deleted as one. Before T-053 this matched on the coerced
 * 'notes' bucket, so deleting a folder actually named `notes` also destroyed
 * every root-level note in the Subject.
 */
export async function deleteFolder(moduleId, subfolder) {
  if (!subfolder) throw new Error('deleteFolder requires a named subfolder')
  const notes = await listNotes()
  const targets = notes.filter(
    (n) => n.moduleId === moduleId && deriveSubfolder(n.path) === subfolder
  )
  // Each note's delete is independent, so run them concurrently rather than
  // one round trip at a time.
  await Promise.all(targets.map((n) => deleteNote(moduleId, n.path)))
  const { error } = await supabase
    .from('note_folders')
    .delete()
    .eq('module_id', moduleId)
    .eq('name', subfolder)
  if (error) throw new Error(error.message)
  return targets.length
}

/** Delete every note in a module (used when a subject is removed). */
export async function deleteModuleNotes(moduleId) {
  const { error: nErr } = await supabase.from('notes').delete().eq('module_id', moduleId)
  if (nErr) throw new Error(nErr.message)
  const { error: fErr } = await supabase.from('note_folders').delete().eq('module_id', moduleId)
  if (fErr) throw new Error(fErr.message)
}

// ─── Visibility ("hide from live site") ───────────────────────────────────

/** Hide/unhide one note. The public reader treats a hidden note as absent. */
export async function setNoteHidden(moduleId, path, hidden) {
  const { error } = await supabase
    .from('notes')
    .update({ hidden })
    .eq('module_id', moduleId)
    .eq('path', stripMd(path))
  if (error) throw new Error(error.message)
}

/** Hide/unhide a folder. Upserts the explicit row so a folder that only
 * exists implicitly (derived from note paths) gets one to carry the flag. */
export async function setFolderHidden(moduleId, name, hidden) {
  const { error } = await supabase
    .from('note_folders')
    .upsert({ module_id: moduleId, name, hidden }, { onConflict: 'module_id,name' })
  if (error) throw new Error(error.message)
}
