import { getIconOptionByName } from '../components/admin/adminIconOptions'
import {
  createModule, renameModule as renameModuleInDb, deleteModule as deleteModuleInDb, setModuleHidden,
} from '../lib/modulesApi'
import {
  createFolder, renameFolder, deleteFolder, moveNote, deleteNote, deleteModuleNotes, baseName,
  setFolderHidden, setNoteHidden, upsertNote, noteExists, buildNotePath, ROOT_SEGMENT,
} from '../lib/notesApi'
import { invalidateNotesRegistry } from './useNotesRegistry'

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

function nameError(name, { allowSlash = true } = {}) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return 'Please enter a name'
  if (/['"\\]/.test(trimmed)) return 'Name cannot contain quotes or backslashes'
  if (/[\n\r\t]/.test(trimmed)) return 'Name cannot contain line breaks or tabs'
  if (!allowSlash && trimmed.includes('/')) return 'Name cannot contain a slash'
  // ROOT_SEGMENT is the URL stand-in for "no folder" (T-053); a folder
  // actually named '~' would make /:moduleId/~/:slug ambiguous.
  if (trimmed === ROOT_SEGMENT) return `"${ROOT_SEGMENT}" is reserved`
  return null
}

function refreshModuleState(setModules, updater) {
  setModules(prev => updater(prev))
}

export function useEditorModules({ showToast, setModules, setSelectedPath, unusedIconOptions, isOwner, canDelete, courseId, reloadModules }) {
  // ── Subjects (sidebar_modules table) ─────────────────────────────────────────
  // A Subject carries a live React Icon component, so `Icon` in local state is
  // still resolved client-side (getIconOptionByName) — only id/label/icon_name
  // are DB rows now. tools[] stays code-defined (MODULE_TOOLS in modules.js);
  // a brand-new Subject never has any. courseId (T-051) is required — the
  // owner-insert RLS policy (0024) rejects a row whose course doesn't match
  // the caller's own.
  const handleNewModule = async (name, iconName = unusedIconOptions[0]?.name || 'FileCode') => {
    const problem = nameError(name)
    if (problem) { showToast(problem, 'error'); return }
    const moduleId = titleToFilename(name)
    if (!moduleId) { showToast('Please enter a subject name', 'error'); return }

    showToast(`Creating subject ${moduleId}...`, 'success')
    try {
      const iconOption = getIconOptionByName(iconName)
      await createModule({ id: moduleId, label: name.trim(), iconName: iconOption.name, courseId })

      const newModule = { id: moduleId, label: name.trim(), iconName: iconOption.name, Icon: iconOption.Icon, courseId, tools: [] }
      refreshModuleState(setModules, prev => [...prev, newModule])
      showToast(`Subject ${newModule.label} created`, 'success')
    } catch (error) {
      showToast(`Failed to create subject: ${error.message}`, 'error')
    }
  }

  // Whole-Subject delete is primary-owner-only, like every other delete
  // (T-053), server-side enforced by sidebar_modules' delete-locked policy
  // (is_owner() AND admin_is_delete_authorized(), 0022). This client check is
  // a UX short-circuit, not the security boundary.
  const handleDeleteModule = async (moduleId) => {
    if (!canDelete) { showToast('Only the primary owner can delete a subject', 'error'); return }
    showToast(`Removing subject ${moduleId}...`, 'success')
    try {
      await deleteModuleInDb(moduleId)

      // Purge the subject's note content + folders from the DB.
      await deleteModuleNotes(moduleId)
      invalidateNotesRegistry()

      refreshModuleState(setModules, prev => prev.filter(module => module.id !== moduleId))
      setSelectedPath(prev => prev?.moduleId === moduleId ? null : prev)
      showToast(`Subject ${moduleId} removed`, 'success')
    } catch (error) {
      showToast(`Failed to remove subject: ${error.message}`, 'error')
    }
  }

  const handleHideModule = async (moduleId, hidden) => {
    try {
      await setModuleHidden(moduleId, hidden)
      invalidateNotesRegistry()
      await reloadModules?.()
      showToast(hidden ? `Subject ${moduleId} hidden from the live site` : `Subject ${moduleId} unhidden`, 'success')
    } catch (error) {
      showToast(`Failed to update visibility: ${error.message}`, 'error')
    }
  }

  const handleRenameModule = async (moduleId, newLabel) => {
    const problem = nameError(newLabel)
    if (problem) { showToast(problem, 'error'); return }
    showToast(`Renaming subject to ${newLabel}...`, 'success')
    try {
      await renameModuleInDb(moduleId, newLabel)

      refreshModuleState(setModules, prev => prev.map(m => m.id === moduleId ? { ...m, label: newLabel } : m))
      showToast(`Subject renamed to ${newLabel}`, 'success')
    } catch (error) {
      showToast(`Failed to rename subject: ${error.message}`, 'error')
    }
  }

  // ── Folders (note_folders table) ────────────────────────────────────────────
  const handleNewSubfolder = async (moduleId, subfolderName) => {
    const problem = nameError(subfolderName, { allowSlash: false })
    if (problem) { showToast(`Failed to create subfolder: ${problem}`, 'error'); return }
    try {
      await createFolder(moduleId, subfolderName)
      invalidateNotesRegistry()
      await reloadModules?.()
      showToast(`Subfolder ${subfolderName} created`, 'success')
    } catch (error) {
      showToast(`Failed to create subfolder: ${error.message}`, 'error')
    }
  }

  const handleRenameSubfolder = async (moduleId, oldName, newName) => {
    const problem = nameError(newName, { allowSlash: false })
    if (problem) { showToast(`Failed to rename subfolder: ${problem}`, 'error'); return }
    showToast(`Renaming ${oldName} to ${newName}...`, 'success')
    try {
      await renameFolder(moduleId, oldName, newName)
      invalidateNotesRegistry()
      await reloadModules?.()
      setSelectedPath(prev =>
        prev?.moduleId === moduleId && prev?.subfolder === oldName ? { ...prev, subfolder: newName } : prev
      )
      showToast(`Subfolder renamed to ${newName}`, 'success')
    } catch (error) {
      showToast(`Failed to rename subfolder: ${error.message}`, 'error')
    }
  }

  // Delete is primary-owner-only for every content kind (T-053), enforced by
  // `note_folders delete locked` server-side. This client check only keeps the
  // toast honest; it is not the security boundary.
  const handleDeleteSubfolder = async (moduleId, subfolderName) => {
    if (!canDelete) { showToast('Only the primary owner can delete a folder', 'error'); return }
    showToast(`Deleting subfolder ${subfolderName}...`, 'success')
    try {
      const removed = await deleteFolder(moduleId, subfolderName)
      invalidateNotesRegistry()
      await reloadModules?.()
      setSelectedPath(prev =>
        prev?.moduleId === moduleId && prev?.subfolder === subfolderName ? null : prev
      )
      showToast(
        removed > 0
          ? `Subfolder ${subfolderName} and ${removed} note${removed === 1 ? '' : 's'} deleted`
          : `Subfolder ${subfolderName} removed`,
        'success'
      )
    } catch (error) {
      showToast(`Failed to delete subfolder: ${error.message}`, 'error')
    }
  }

  const handleHideSubfolder = async (moduleId, subfolderName, hidden) => {
    try {
      await setFolderHidden(moduleId, subfolderName, hidden)
      invalidateNotesRegistry()
      await reloadModules?.()
      showToast(hidden ? `Folder ${subfolderName} hidden from the live site` : `Folder ${subfolderName} unhidden`, 'success')
    } catch (error) {
      showToast(`Failed to update visibility: ${error.message}`, 'error')
    }
  }

  // ── Notes (notes table) ──────────────────────────────────────────────────────
  // Creates an empty note row up front (named via the browser's popup, same
  // pattern as New Subject / New Folder) rather than jumping straight into the
  // editor for a note that doesn't exist yet — the file appears in the list
  // immediately, and only opens for writing once the admin clicks it.
  // `subfolder` is the real folder name, or null for a file sitting directly
  // under the Subject (T-053). Callers holding a route segment convert with
  // segmentToSubfolder first.
  const handleNewFile = async (moduleId, subfolder, title) => {
    const problem = nameError(title, { allowSlash: false })
    if (problem) { showToast(`Failed to create file: ${problem}`, 'error'); return }
    const filename = titleToFilename(title)
    if (!filename) { showToast('Please enter a file name', 'error'); return }
    const path = buildNotePath(subfolder, filename)
    try {
      if (await noteExists(moduleId, path)) {
        showToast(`A file named "${filename}" already exists in this folder`, 'error')
        return
      }
      await upsertNote({ moduleId, path, title: `${filename}.md`, contentMd: '' })
      invalidateNotesRegistry()
      await reloadModules?.()
      showToast(`${filename}.md created`, 'success')
    } catch (error) {
      showToast(`Failed to create file: ${error.message}`, 'error')
    }
  }

  const handleMoveFile = async ({ fromModule, fromSubfolder, fromPath, toModule, toSubfolder }) => {
    const base = baseName(fromPath)
    const newPath = buildNotePath(toSubfolder, base)
    if (fromModule === toModule && (fromSubfolder ?? null) === (toSubfolder ?? null)) return

    const isCrossSubject = fromModule !== toModule
    if (isCrossSubject && !isOwner) {
      showToast('Moving notes between subjects is owner-only', 'error')
      return
    }

    showToast(`Moving ${base}...`, 'success')
    try {
      await moveNote({ fromModuleId: fromModule, fromPath, toModuleId: toModule, toPath: newPath })
      invalidateNotesRegistry()
      await reloadModules?.()
      showToast(`Moved ${base} to ${toModule}${toSubfolder ? `/${toSubfolder}` : ''}`, 'success')
    } catch (error) {
      showToast(`Failed to move file: ${error.message}`, 'error')
    }
  }

  const handleDeleteFile = async (moduleId, path) => {
    if (!canDelete) { showToast('Only the primary owner can delete a file', 'error'); return }
    try {
      await deleteNote(moduleId, path)
      invalidateNotesRegistry()
      await reloadModules?.()
      showToast(`${baseName(path)} deleted`, 'success')
    } catch (error) {
      showToast(`Failed to delete ${baseName(path)}: ${error.message}`, 'error')
    }
  }

  const handleHideFile = async (moduleId, path, hidden) => {
    try {
      await setNoteHidden(moduleId, path, hidden)
      invalidateNotesRegistry()
      await reloadModules?.()
      showToast(hidden ? `${baseName(path)} hidden from the live site` : `${baseName(path)} unhidden`, 'success')
    } catch (error) {
      showToast(`Failed to update visibility: ${error.message}`, 'error')
    }
  }

  const handleRenameFile = async (moduleId, path, newName) => {
    const problem = nameError(newName, { allowSlash: false })
    if (problem) { showToast(`Failed to rename: ${problem}`, 'error'); return }
    try {
      const bareNewName = newName.replace(/\.md$/, '')
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
      const newPath = `${dir}${bareNewName}`
      await moveNote({ fromModuleId: moduleId, fromPath: path, toModuleId: moduleId, toPath: newPath, title: `${bareNewName}.md` })
      invalidateNotesRegistry()
      await reloadModules?.()
      showToast(`Renamed to ${bareNewName}`, 'success')
    } catch (error) {
      showToast(`Failed to rename: ${error.message}`, 'error')
    }
  }

  return {
    handleNewModule,
    handleDeleteModule,
    handleRenameModule,
    handleHideModule,
    handleNewSubfolder,
    handleRenameSubfolder,
    handleDeleteSubfolder,
    handleHideSubfolder,
    handleNewFile,
    handleMoveFile,
    handleDeleteFile,
    handleRenameFile,
    handleHideFile,
  }
}
