import { commitFileWithRetry } from '../lib/githubApi'
import { upsertNote, moveNote, baseName } from '../lib/notesApi'
import { revokeDraftPreview } from '../lib/draftImagePreviews'
import { invalidateNotesRegistry } from './useNotesRegistry'
import { supabase } from '../lib/supabaseClient'
import { NOTE_IMAGES_BUCKET } from '../lib/noteImageSrc'

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

// Resolves the `draft://` image queue: uploads each queued image to the
// `note-images` Supabase Storage bucket and rewrites its draft URL to the
// uploaded path. Storage serves a new upload instantly (no GitHub-commit /
// Vercel-redeploy lag), matching the instant-publish property note text
// already has via the `notes` table.
//
// Filenames are random (crypto.randomUUID()), not a sequential per-module
// counter like the old GitHub-numbered scheme (1.png, 2.png, ...). A counter
// seeded from Storage alone would collide with pre-migration on-disk images
// under public/notes/img/<module>/ the first time a module gets a new
// upload — Storage starts empty regardless of what already exists in the
// repo from before this migration, so "next number" there isn't actually
// next. Confirmed by testing: a fresh upload to `database` computed `1.png`
// from an empty Storage listing and silently landed on top of an unrelated
// pre-existing public/notes/img/database/1.png once pulled to disk.
async function resolveImageQueue(content, moduleId, imageQueueRef) {
  let finalContent = content
  for (const [draftKey, { file, ext }] of Object.entries(imageQueueRef.current)) {
    const imgName = `${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(NOTE_IMAGES_BUCKET)
      .upload(`${moduleId}/${imgName}`, file, { contentType: file.type })
    if (uploadError) throw new Error(uploadError.message)
    finalContent = finalContent.replaceAll(`draft://${draftKey}`, `/notes/img/${moduleId}/${imgName}`)
    revokeDraftPreview(draftKey)
  }
  imageQueueRef.current = {}
  return { finalContent }
}

export function useEditorSave({
  title, content, selectedPath, showToast, setSaving, setUnsaved, setTitle, setContent,
  imageQueueRef, originalPath, setOriginalPath, isOwner, clearDraft, reloadModules,
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

    const { moduleId, subfolder } = selectedPath
    const newPath = `${subfolder}/${filename}`
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
      const { finalContent } = await resolveImageQueue(content, moduleId, imageQueueRef)

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
          subfolder: original.subfolder ?? 'notes',
          filename: baseName(original.path),
        })
      }

      showToast('Saved.', 'success')
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
    const mdPath = `src/content/notes/${moduleId}/${subfolder}/${filename}.md`
    try {
      showToast('Backing up to GitHub…', 'success')
      await commitFileWithRetry(mdPath, content, `backup: ${moduleId}/${subfolder}/${filename}.md`)
      showToast('Backed up to GitHub', 'success')
    } catch (error) {
      showToast(`Backup failed (note is still saved): ${error.message}`, 'error')
    }
  }

  return { handleSave, handleBackupToGithub }
}
