// src/hooks/useNotesRegistry.js
//
// Loads the full public registry — Subjects (sidebar_modules), notes, and
// explicit folders — from Supabase and merges it into the shape the sidebar
// and admin file tree already consume (E-005/T-043, extended 2026-07-24 to
// source Subject structure from the DB too instead of the static MODULES
// array).
//
// Stale-while-revalidate: the last successful result is cached at module scope
// and used to paint instantly on mount, but EVERY mount also refetches in the
// background and updates. So navigating to a page (or expanding the sidebar)
// after a save reflects the change without a hard reload.

import { useCallback, useEffect, useState } from 'react'
import { MODULE_TOOLS } from '../components/layout/Sidebar/modules'
import { getIconOptionByName } from '../components/admin/adminIconOptions'
import { listModules } from '../lib/modulesApi'
import { listNotes, listNoteFolders, mergeNotesIntoModules } from '../lib/notesApi'

let lastModules = null

/** Resolve DB Subject rows into the structural shape (Icon component, code-side
 * tools) mergeNotesIntoModules expects. */
export function toStructuralModules(dbModules) {
  return dbModules.map((m) => ({
    id: m.id,
    label: m.label,
    Icon: getIconOptionByName(m.iconName).Icon,
    courseId: m.courseId,
    ...(MODULE_TOOLS[m.id] ? { tools: MODULE_TOOLS[m.id] } : {}),
  }))
}

// Public consumer — hidden Subjects/folders/notes (T-045 phase C) must never
// reach the sidebar or the notes listing, so they're dropped here, before the
// merge, rather than carried through and hidden by CSS.
async function fetchRegistry() {
  const [dbModules, notes, folders] = await Promise.all([
    listModules(), listNotes(), listNoteFolders(),
  ])
  const visibleModules = toStructuralModules(dbModules.filter((m) => !m.hidden))
  const visibleNotes = notes.filter((n) => !n.hidden)
  const visibleFolders = folders.filter((f) => !f.hidden)
  return mergeNotesIntoModules(visibleModules, visibleNotes, visibleFolders)
}

export function useNotesRegistry() {
  const [modules, setModules] = useState(lastModules ?? [])
  const [loading, setLoading] = useState(!lastModules)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const merged = await fetchRegistry()
      lastModules = merged
      setModules(merged)
    } catch (e) {
      // On failure keep the last good data (or an empty list) so the sidebar
      // still renders rather than blanking out or throwing.
      setError(e)
      if (!lastModules) setModules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { modules, loading, error, reload: load }
}

/** Drop the cached registry so the next mount repaints from a fresh fetch. */
export function invalidateNotesRegistry() {
  lastModules = null
}
