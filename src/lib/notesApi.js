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

/** First path segment, or null when the note sits at the module root. */
export function deriveSubfolder(path) {
  const i = String(path || '').indexOf('/')
  return i === -1 ? null : path.slice(0, i)
}

/**
 * The subfolder a note is *displayed* under: root-level notes (no "/") are
 * grouped into "notes", matching the old DirectoryDrawer / useEditorModules
 * behaviour.
 */
export function displaySubfolder(path) {
  return deriveSubfolder(path) ?? 'notes'
}

/** The basename (last path segment) without extension. */
export function baseName(path) {
  return stripMd(String(path || '').split('/').pop() || '')
}

/**
 * Merge DB note + folder rows into a copy of the structural MODULES array,
 * attaching `notes` and `subfolders` in the shape existing consumers expect.
 * Never mutates the input modules (they hold live React Icon components).
 *
 *   notes:   [{ moduleId, path, title }]
 *   folders: [{ moduleId, name }]      // explicit empty subfolders
 */
export function mergeNotesIntoModules(modules, notes, folders = []) {
  const byModule = new Map()
  for (const n of notes) {
    if (!byModule.has(n.moduleId)) byModule.set(n.moduleId, [])
    byModule.get(n.moduleId).push({
      filename: n.path,
      label: n.title || `${baseName(n.path)}.md`,
      hidden: !!n.hidden,
      updatedAt: n.updatedAt ?? null,
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
      next.notes = moduleNotes
    } else {
      delete next.notes
    }
    if (moduleFolders && moduleFolders.length > 0) {
      next.subfolders = [...new Set([...(m.subfolders ?? []), ...moduleFolders])]
    }
    return next
  })
}

// ─── Reads ─────────────────────────────────────────────────────────────────

/** Every note's identity + label (no content) — for building the registry. */
export async function listNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('module_id, path, title, updated_at, hidden')
    .order('module_id', { ascending: true })
    .order('path', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    moduleId: r.module_id,
    path: r.path,
    title: r.title,
    updatedAt: r.updated_at,
    hidden: !!r.hidden,
  }))
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
    .select('module_id, path, title, content_md, hidden')
    .eq('module_id', moduleId)
    .eq('path', clean)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    moduleId: data.module_id,
    path: data.path,
    title: data.title,
    contentMd: data.content_md,
    hidden: !!data.hidden,
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

/** Notes whose display subfolder is `subfolder` within a module. */
export async function listNotesInFolder(moduleId, subfolder) {
  const all = await listNotes()
  return all.filter((n) => n.moduleId === moduleId && displaySubfolder(n.path) === subfolder)
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
 * Rename a subfolder: rewrite the leading segment of every note whose display
 * subfolder matches, and rename the explicit folder row if present. Root-level
 * notes (displayed under "notes") are only affected when oldName === 'notes'
 * and they actually carry a "notes/" prefix — a bare root note has no prefix
 * to rewrite, matching the old deriveSubfolder-based behaviour.
 */
export async function renameFolder(moduleId, oldName, newName) {
  const notes = await listNotes()
  const targets = notes.filter(
    (n) => n.moduleId === moduleId && n.path.startsWith(`${oldName}/`)
  )
  for (const n of targets) {
    const rest = n.path.slice(oldName.length + 1)
    await moveNote({
      fromModuleId: moduleId,
      fromPath: n.path,
      toModuleId: moduleId,
      toPath: `${newName}/${rest}`,
    })
  }
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
 * Delete a subfolder and every note under it. Owner-only in practice (the UI
 * gates this to owners, and note deletes are owner-only server-side).
 * Returns the number of notes removed.
 */
export async function deleteFolder(moduleId, subfolder) {
  const notes = await listNotes()
  const targets = notes.filter(
    (n) => n.moduleId === moduleId && displaySubfolder(n.path) === subfolder
  )
  for (const n of targets) {
    await deleteNote(moduleId, n.path)
  }
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
