import { commitFileWithRetry } from '../lib/githubApi'
import {
  upsertNote, moveNote, baseName, buildNotePath, segmentToSubfolder, ROOT_SEGMENT,
} from '../lib/notesApi'
import { invalidateNotesRegistry } from './useNotesRegistry'
import { fireAck, fireQuip } from './useSentinelQuip'

// Title to filename conversion
function titleToFilename(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function useEditorSave({
  title, content, selectedPath, showToast, setSaving, setUnsaved, setTitle, setContent,
  originalPath, setOriginalPath, isOwner, clearDraft, reloadModules,
}) {
  // Primary save: note CONTENT goes to Supabase (source of truth), so the note
  // is live on the reader's next load with no rebuild. Images still upload to
  // GitHub. `modules.js` is never touched — the sidebar is a DB query now.
  const handleSave = async () => {
    if (!title.trim()) {
      showToast('Please enter a title', 'error')
      return
    }
    if (!selectedPath) {
      showToast('Please select a directory', 'error')
      return
    }

    const filename = titleToFilename(title)
    if (!filename) {
      showToast('Invalid title - could not generate filename', 'error')
      return
    }

    // An image is still uploading: its `draft://` marker has not yet been
    // swapped for the real /notes/img/… path (T-050). Publishing now would
    // persist an unresolvable reference, so ask the user to retry in a moment.
    if (/draft:\/\//.test(content)) {
      showToast('An image is still uploading. Please wait a moment, then save.', 'error')
      return
    }

    // `subfolder` is the route segment, so ROOT_SEGMENT ('~') here means the
    // note sits directly under the Subject and its path carries no prefix.
    const { moduleId, subfolder } = selectedPath
    const newPath = buildNotePath(segmentToSubfolder(subfolder), filename)
    const label = `${filename}.md`

    // originalPath is the identity the note was loaded from: { moduleId, path,
    // subfolder } — or null for a brand-new note.
    const original = originalPath
    const isNewNote = !original
    const isSamePath = original && original.moduleId === moduleId && original.path === newPath
    const isCrossModule = original && !isSamePath && original.moduleId !== moduleId

    // Cross-subject move changes module_id, which the DB trigger allows only for
    // owners (mirrors the previous owner-only rule). Say so plainly.
    if (isCrossModule && !isOwner) {
      showToast('Moving a note to a different subject is owner-only', 'error')
      return
    }

    setSaving(true)

    try {
      // Images are uploaded to Storage at insert time (T-050), so `content`
      // already carries real /notes/img/… paths, nothing to resolve here.
      const finalContent = content

      if (original && !isSamePath) {
        // Rename and/or move: a single UPDATE that rewrites identity + label +
        // content in place. No owner-only DELETE needed (that would block a
        // contributor renaming their own note); the row keeps its history.
        await moveNote({
          fromModuleId: original.moduleId,
          fromPath: original.path,
          toModuleId: moduleId,
          toPath: newPath,
          title: label,
          contentMd: finalContent,
        })
      } else {
        // New note, or re-saving the same note: upsert content in place.
        await upsertNote({ moduleId, path: newPath, title: label, contentMd: finalContent })
      }

      // Refresh the registry so the sidebar/file tree reflect the change.
      invalidateNotesRegistry()
      await reloadModules?.()

      // Clear the autosave draft(s). A rename moves the note to a new identity,
      // so also clear the draft under the old identity.
      await clearDraft?.({ moduleId, subfolder, filename })
      if (original && !isSamePath) {
        await clearDraft?.({
          moduleId: original.moduleId,
          subfolder: original.subfolder ?? ROOT_SEGMENT,
          filename: baseName(original.path),
        })
      }

      showToast('Saved.', 'success')
      // A save is confirmed wordlessly by the island as well as by the toast:
      // the toast says what happened, the pill just acknowledges it. A brand
      // new note going live is the one that gets a word, so it stays a quip
      // while the ordinary save is an ack (T-099).
      if (isNewNote) fireQuip({ kind: 'moment', id: 'published' })
      else fireAck('save')
      setUnsaved(false)
      setOriginalPath({ moduleId, path: newPath, subfolder })

      if (isNewNote) {
        setTimeout(() => {
          setTitle('')
          setContent('')
          setOriginalPath(null)
        }, 2000)
      }
    } catch (error) {
      console.error('Save failed:', error)
      showToast(`Save failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Optional, off-critical-path backup: write the note's current content to
  // GitHub as a plain .md (no modules.js edit). Supabase stays the source of
  // truth; a failure here never unpublishes the note.
  const handleBackupToGithub = async () => {
    if (!selectedPath || !title.trim()) {
      showToast('Nothing to back up yet', 'error')
      return
    }
    const filename = titleToFilename(title)
    const { moduleId, subfolder } = selectedPath
    const relPath = buildNotePath(segmentToSubfolder(subfolder), `${filename}.md`)
    const mdPath = `src/content/notes/${moduleId}/${relPath}`
    try {
      showToast('Backing up to GitHub…', 'success')
      await commitFileWithRetry(mdPath, content, `backup: ${moduleId}/${relPath}`)
      showToast('Backed up to GitHub', 'success')
    } catch (error) {
      showToast(`Backup failed (note is still saved): ${error.message}`, 'error')
    }
  }

  return { handleSave, handleBackupToGithub }
}
