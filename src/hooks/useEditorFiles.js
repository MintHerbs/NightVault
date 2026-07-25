import { getNote, deriveSubfolder, subfolderToSegment, baseName } from '../lib/notesApi'

export function useEditorFiles({ showToast, setContent, setTitle, setUnsaved, setSelectedPath, setOriginalPath, restoreDraftIfExists }) {
  // Loads a note's content from Supabase. `file` is { moduleId, path } — the
  // DB identity carried by the file rows in DirectoryDrawer.
  const handleLoadFile = async (file) => {
    const moduleId = typeof file === 'object' ? file.moduleId : null
    const path = typeof file === 'object' ? file.path : null
    if (!moduleId || !path) {
      showToast('Could not resolve that note', 'error')
      return
    }

    try {
      showToast('Loading note...', 'success')
      const note = await getNote(moduleId, path)
      if (!note) {
        showToast('Note not found', 'error')
        return
      }

      // Route-segment form ('~' at the Subject root), because this value is
      // also the drafts key and admin_note_drafts.subfolder is `text not null`.
      const subfolder = subfolderToSegment(deriveSubfolder(path))
      const fileName = baseName(path)

      setContent(note.contentMd)
      setTitle(fileName)
      setUnsaved(false)
      setSelectedPath({ moduleId, subfolder })
      setOriginalPath({ moduleId, path: note.path, subfolder })

      showToast(`Loaded ${fileName}`, 'success')

      // Prefer an unsaved draft over the just-loaded published content, if one exists.
      await restoreDraftIfExists?.({ moduleId, subfolder, filename: fileName })
    } catch (error) {
      showToast(`Failed to load note: ${error.message}`, 'error')
    }
  }

  return { handleLoadFile }
}
