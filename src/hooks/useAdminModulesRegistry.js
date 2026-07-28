import { useCallback, useEffect, useState } from 'react'
import { toStructuralModules, invalidateNotesRegistry } from './useNotesRegistry'
import { listModules } from '../lib/modulesApi'
import { listNotes, listNoteFolders, listNoteAuthors, mergeNotesIntoModules } from '../lib/notesApi'

async function fetchAll() {
  const [dbModules, notes, folders, authorsByNoteId] = await Promise.all([
    listModules(), listNotes(), listNoteFolders(), listNoteAuthors(),
  ])
  return { dbModules, notes, folders, authorsByNoteId }
}

// Shared by AdminBrowser and AdminEditor so both pages see the same
// admin-scoped module/note/folder/visibility state without duplicating the
// fetch — the browser needs it to list Subjects/folders/files (and which are
// hidden), the editor needs it for useEditorSave's reloadModules and
// useEditorModules' create/rename/delete/hide handlers.
//
// Unlike useNotesRegistry (the public registry), hidden Subjects/folders/notes
// are kept here, not dropped — the admin browser shows them de-emphasized
// (T-045 phase C) rather than hiding them from the person managing them.
export function useAdminModulesRegistry() {
  const [modules, setModules] = useState([])
  // Raw folder rows, kept alongside the merged `modules` shape (which only
  // carries a per-note `hidden` flag — see notesApi.js) so AdminBrowser can
  // look up a folder's own hidden state too.
  const [folders, setFolders] = useState([])
  const [hiddenModuleIds, setHiddenModuleIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const { dbModules, notes, folders: nextFolders, authorsByNoteId } = await fetchAll()
      const base = toStructuralModules(dbModules)
      setModules(mergeNotesIntoModules(base, notes, nextFolders, authorsByNoteId))
      setFolders(nextFolders)
      setHiddenModuleIds(new Set(dbModules.filter((m) => m.hidden).map((m) => m.id)))
    } catch (err) {
      console.error('Failed to reload notes registry:', err)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    invalidateNotesRegistry()

    ;(async () => {
      try {
        const { dbModules, notes, folders: nextFolders, authorsByNoteId } = await fetchAll()
        if (cancelled) return
        const base = toStructuralModules(dbModules)
        setModules(mergeNotesIntoModules(base, notes, nextFolders, authorsByNoteId))
        setFolders(nextFolders)
        setHiddenModuleIds(new Set(dbModules.filter((m) => m.hidden).map((m) => m.id)))
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load notes registry:', err)
        setModules([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { modules, setModules, folders, hiddenModuleIds, loading, reload }
}
