import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowUp, ArrowDown, CaretDown, CaretRight, ChartLineUp, DotsThreeVertical,
  EyeSlash, Folder, FileText, Gear, ListBullets, MagnifyingGlass, Monitor, Plus,
  SignOut, SquaresFour, Users, Warning,
} from '@phosphor-icons/react'
import { colors } from '../../constants/colors'
import { supabase } from '../../lib/supabaseClient'
import { useAdmin } from './useAdmin'
import { useAdminModulesRegistry } from '../../hooks/useAdminModulesRegistry'
import { useEditorModules } from '../../hooks/useEditorModules'
import ToastNotification, { useToast } from '../../components/admin/ToastNotification'
import Loading from '../../components/ui/Loading'
import { ADMIN_ICON_OPTIONS, getIconNameForComponent } from '../../components/admin/adminIconOptions'
import {
  subfoldersForModule, filesForFolder, rootFilesForModule, baseName,
  compareRowsByCreated, compareRowsByName,
  subfolderToSegment, segmentToSubfolder, authorsForFolder, authorsForModule,
} from '../../lib/notesApi'
import AvatarGroup from '../../components/common/AvatarGroup/AvatarGroup'
import { listCourses } from '../../lib/coursesApi'
import { useActiveCourse, clearActiveCourse } from '../../hooks/useActiveCourse'
import { deferQuip } from '../../hooks/useSentinelQuip'
import '../../styles/adminTokens.css'
import styles from './AdminBrowser.module.css'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getUnusedIconOptions(modules, selectedIconName = null) {
  const usedIconNames = new Set(
    modules.map(module => getIconNameForComponent(module.Icon)).filter(Boolean)
  )
  return ADMIN_ICON_OPTIONS.filter(option => (
    option.name === selectedIconName || !usedIconNames.has(option.name)
  ))
}

// subfoldersForModule / filesForFolder now live in notesApi (T-053) so this
// page and the public NotesBrowserPage share one implementation of the tree.

// Drive-style breadcrumb: preceding segments are small muted links, the last
// (current location) is the large title with a caret dropdown of its actions.
function Breadcrumb({ crumbs, actions }) {
  return (
    <div className={styles.breadcrumb}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.key} className={styles.crumbSegment}>
            {i > 0 && <CaretRight size={18} className={styles.crumbSep} weight="bold" />}
            {isLast ? (
              actions && actions.length > 0 ? (
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button className={styles.crumbTitleButton}>
                      <span className={styles.crumbTitle}>{crumb.label}</span>
                      <CaretDown size={18} weight="bold" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className={styles.menuContent} sideOffset={4} align="start">
                      {actions.map(a => (
                        <button key={a.label} className={styles.menuItem} onClick={a.onSelect}>{a.label}</button>
                      ))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              ) : (
                <span className={styles.crumbTitle}>{crumb.label}</span>
              )
            ) : (
              <button className={styles.crumbLink} onClick={crumb.to}>{crumb.label}</button>
            )}
          </span>
        )
      })}
    </div>
  )
}

function RowMenu({ items }) {
  if (!items.length) return null
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={styles.rowMenuButton} onClick={(e) => e.stopPropagation()} title="More actions">
          <DotsThreeVertical size={20} weight="bold" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.menuContent} sideOffset={5} align="end">
          {items.map((item) => (
            <button
              key={item.label}
              className={styles.menuItem}
              onClick={(e) => { e.stopPropagation(); item.onSelect() }}
            >
              {item.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// Deleting a folder or subject recursively deletes everything inside it
// (notesApi.js's deleteFolder / deleteModuleNotes sweep every note under it,
// however deeply nested). That's already correct — this dialog just makes
// the blast radius visible before the admin commits to it, instead of only
// finding out via a toast afterwards.
function contentsWarning(deleteConfirm) {
  const { kind, fileCount = 0, folderCount = 0 } = deleteConfirm
  if (kind === 'file' || (fileCount === 0 && folderCount === 0)) return null
  const parts = []
  if (folderCount > 0) parts.push(`${folderCount} folder${folderCount === 1 ? '' : 's'}`)
  if (fileCount > 0) parts.push(`${fileCount} file${fileCount === 1 ? '' : 's'}`)
  return `This ${kind === 'module' ? 'subject' : 'folder'} contains ${parts.join(' and ')} — they will all be permanently deleted too.`
}

function DeleteConfirm({ deleteConfirm, onCancel, onConfirm }) {
  if (!deleteConfirm) return null
  const nounByKind = { module: 'subject', folder: 'folder', file: 'file' }
  const warning = contentsWarning(deleteConfirm)
  return (
    <Popover.Root open onOpenChange={(open) => !open && onCancel()}>
      <Popover.Anchor className={styles.centerAnchor} />
      <Popover.Portal>
        <Popover.Content className={styles.confirmPopover} sideOffset={5}>
          <div className={styles.confirmHeader}>
            <Warning size={20} weight="fill" style={{ color: colors.warning }} />
            <span className={styles.confirmTitle}>Delete {nounByKind[deleteConfirm.kind]}?</span>
          </div>
          <p className={styles.confirmMessage}>
            "{deleteConfirm.name}" will be permanently deleted. This can't be undone.
          </p>
          {warning && (
            <p className={`${styles.confirmMessage} ${styles.confirmWarning}`}>{warning}</p>
          )}
          <div className={styles.confirmActions}>
            <button className={styles.btnText} onClick={onCancel}>Cancel</button>
            <button className={styles.btnDanger} onClick={onConfirm}>Delete</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function AdminBrowserContent() {
  const navigate = useNavigate()
  const { moduleId, subfolder } = useParams()
  const { user, profile, loading: authLoading, isPrimaryOwner } = useAdmin()
  const { showToast } = useToast()
  const {
    modules, setModules, folders, hiddenModuleIds, loading: modulesLoading, reload,
  } = useAdminModulesRegistry()

  // Course switcher (T-051, primary owner only) — everyone else is locked to
  // their own admin_users.course_id. activeCourseId is shared with the Team
  // page (useActiveCourse) so picking a course there and jumping here (or
  // vice versa) land on the same course instead of resetting to your own.
  const [courses, setCourses] = useState([])
  const [activeCourseId, setActiveCourseId] = useActiveCourse(profile, isPrimaryOwner)
  useEffect(() => {
    if (isPrimaryOwner) listCourses().then(setCourses).catch(() => {})
  }, [isPrimaryOwner])

  const [isTooNarrow, setIsTooNarrow] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 820 : false
  ))
  useEffect(() => {
    const onResize = () => setIsTooNarrow(window.innerWidth < 820)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isOwner = profile?.role === 'owner'
  const isAdmin = profile?.role === 'admin'
  // T-053: every admin-panel account creates and edits content anywhere, and
  // only the primary owner deletes anything. Both mirror what the DB now
  // enforces (0027 for write, 0022's admin_is_delete_authorized for delete);
  // these are UX short-circuits, not the security boundary.
  const canDelete = isPrimaryOwner
  const username = profile?.username || user?.email || 'me'

  const unusedIconOptions = useMemo(() => getUnusedIconOptions(modules), [modules])

  const {
    handleNewModule, handleDeleteModule, handleRenameModule, handleHideModule,
    handleNewSubfolder, handleRenameSubfolder, handleDeleteSubfolder, handleHideSubfolder,
    handleNewFile, handleDeleteFile, handleRenameFile, handleHideFile, handleMoveFile,
  } = useEditorModules({
    showToast, setModules, setSelectedPath: () => {}, unusedIconOptions, isOwner, canDelete,
    courseId: activeCourseId, reloadModules: reload,
  })

  // View / filter / sort state (Drive parity)
  const [view, setView] = useState('list')       // 'list' | 'grid'
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'folders' | 'files'
  const [sort, setSort] = useState({ key: 'created', dir: 'asc' })

  // Interaction state
  const [renaming, setRenaming] = useState(null) // { kind, key, value }
  const [creating, setCreating] = useState(false)
  const [createValue, setCreateValue] = useState('')
  const [createIcon, setCreateIcon] = useState(unusedIconOptions[0]?.name || '')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [movingFile, setMovingFile] = useState(null)
  const [moveTarget, setMoveTarget] = useState({ moduleId: '', subfolder: '' })

  useEffect(() => {
    if (!unusedIconOptions.some(o => o.name === createIcon)) {
      setCreateIcon(unusedIconOptions[0]?.name || '')
    }
  }, [unusedIconOptions, createIcon])

  // Course first (T-051): a course-locked account never sees another course's
  // Subjects; the primary owner sees whichever course the switcher has active.
  // Within that course everyone sees every Subject — allowed_directories no
  // longer narrows content access (T-053 / 0027), so filtering by it here
  // would only hide Subjects the DB would happily let the person write.
  const visibleModules = modules
    .filter(m => !activeCourseId || m.courseId === activeCourseId)

  const activeModule = moduleId ? visibleModules.find(m => m.id === moduleId) : null
  // Route segment -> real folder name; ROOT_SEGMENT means the Subject root,
  // which is a browsable folder level in its own right but holds only files.
  const activeSubfolder = segmentToSubfolder(subfolder)
  const level = subfolder ? 'files' : moduleId ? 'folders' : 'subjects'

  const folderHidden = (name) => folders.find(f => f.moduleId === moduleId && f.name === name)?.hidden

  // Unified item model — each level is homogeneous (subjects / folders / files).
  // `holder` is the folder a file lives in, or null at the Subject root; it
  // only decides which URL segment the editor link carries.
  const fileItem = (f, holder) => ({
    kind: 'file', key: f.path, name: f.name, hidden: !!f.hidden, sortKey: baseName(f.path),
    date: f.updatedAt, created: f.createdAt,
    onOpen: () => navigate(
      `/admin/editor/${moduleId}/${subfolderToSegment(holder)}/${encodeURIComponent(f.path)}`
    ),
    path: f.path,
    authors: f.authors,
  })

  const items = useMemo(() => {
    if (level === 'files' && activeModule) {
      return filesForFolder(activeModule, activeSubfolder).map(f => fileItem(f, activeSubfolder))
    }
    // Subject level: folders and root-level files side by side (T-053). Files
    // here sit directly under the Subject and carry no path prefix.
    if (level === 'folders' && activeModule) {
      return [
        ...subfoldersForModule(activeModule).map(name => ({
          kind: 'folder', key: name, name, hidden: !!folderHidden(name), date: null,
          onOpen: () => navigate(`/admin/editor/${moduleId}/${encodeURIComponent(name)}`),
          subfolder: name,
          authors: authorsForFolder(activeModule, name),
        })),
        ...rootFilesForModule(activeModule).map(f => fileItem(f, null)),
      ]
    }
    return visibleModules.map(m => ({
      kind: 'module', key: m.id, name: m.label, hidden: hiddenModuleIds.has(m.id), date: null,
      onOpen: () => navigate(`/admin/editor/${m.id}`),
      id: m.id,
      authors: authorsForModule(m),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, activeModule, activeSubfolder, moduleId, visibleModules, folders, hiddenModuleIds])

  const displayItems = useMemo(() => {
    let arr = items
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      arr = arr.filter(i => i.name.toLowerCase().includes(q))
    }
    if (typeFilter === 'folders') arr = arr.filter(i => i.kind !== 'file')
    if (typeFilter === 'files') arr = arr.filter(i => i.kind === 'file')
    // Default 'created' and a natural name comparator, both shared with the
    // public browser via notesApi so the two lists can't order differently
    // (T-076). The old plain localeCompare here read 1, 10, 11, 2.
    arr = [...arr].sort((a, b) => {
      let cmp
      if (sort.key === 'date') cmp = new Date(a.date || 0) - new Date(b.date || 0)
      else if (sort.key === 'created') cmp = compareRowsByCreated(a, b)
      else cmp = compareRowsByName(a, b)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [items, search, typeFilter, sort])

  // ── Create ────────────────────────────────────────────────────────────────
  // Every level creates via the same named popup, Drive-style: the item is
  // actually created (a real row, not a draft) and appears in the list; only
  // clicking it afterwards opens it for editing. This applies to files too —
  // a "New file" no longer jumps straight into the editor for a note that
  // doesn't exist yet.
  // Subject creation stays owner-only (sidebar_modules insert RLS, unchanged).
  // Folders and files are open to every admin-panel account (T-053 / 0027).
  const canCreate = level === 'subjects' ? isOwner : true

  // Inside a Subject you can make either a folder or a file; inside a folder
  // only files, which is what keeps the tree exactly two levels deep.
  const createKinds = level === 'folders' ? ['folder', 'file'] : level === 'files' ? ['file'] : ['subject']
  const [createKind, setCreateKind] = useState(createKinds[0])
  const activeCreateKind = createKinds.includes(createKind) ? createKind : createKinds[0]

  const openCreate = () => {
    setCreateValue('')
    setCreateKind(createKinds[0])
    setCreating(true)
  }
  const submitCreate = async () => {
    if (!createValue.trim()) return
    if (activeCreateKind === 'subject') await handleNewModule(createValue.trim(), createIcon)
    else if (activeCreateKind === 'folder') await handleNewSubfolder(moduleId, createValue.trim())
    // At the Subject level the new file has no folder, hence null.
    else await handleNewFile(moduleId, level === 'files' ? activeSubfolder : null, createValue.trim())
    setCreating(false)
    setCreateValue('')
  }

  // ── Rename ──────────────────────────────────────────────────────────────
  const startRename = (item) => setRenaming({ kind: item.kind, key: item.key, value: item.kind === 'file' ? item.name.replace(/\.md$/, '') : item.name })
  const commitRename = async () => {
    if (!renaming || !renaming.value.trim()) { setRenaming(null); return }
    const { kind, key, value } = renaming
    setRenaming(null)
    // 'rail-module' is the same action as 'module', just a distinct kind so
    // the left rail's copy of a Subject and its main-table row (both visible
    // at once at the Subjects root) never simultaneously match the same
    // shared `renaming` state and render two competing inputs — see the rail
    // row below.
    if (kind === 'module' || kind === 'rail-module') await handleRenameModule(key, value.trim())
    else if (kind === 'folder') await handleRenameSubfolder(moduleId, key, value.trim())
    else if (kind === 'file') await handleRenameFile(moduleId, key, value.trim())
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  const runDelete = async () => {
    if (!deleteConfirm) return
    const { kind, key, then } = deleteConfirm
    setDeleteConfirm(null)
    if (kind === 'module') await handleDeleteModule(key)
    else if (kind === 'folder') await handleDeleteSubfolder(moduleId, key)
    else if (kind === 'file') await handleDeleteFile(moduleId, key)
    then?.()
  }

  // ── Move (files only) ─────────────────────────────────────────────────────
  // moveTarget.subfolder is '' for the Subject root, since a <select> value
  // has to be a string; it converts back to null at the call boundary.
  const openMove = (item) => {
    setMovingFile(item)
    setMoveTarget({ moduleId, subfolder: activeSubfolder ?? '' })
  }
  const submitMove = async () => {
    if (!movingFile) return
    const target = moveTarget
    const toSubfolder = target.subfolder || null
    setMovingFile(null)
    if (target.moduleId === moduleId && toSubfolder === activeSubfolder) return
    await handleMoveFile({
      fromModule: moduleId, fromSubfolder: activeSubfolder, fromPath: movingFile.path,
      toModule: target.moduleId, toSubfolder,
    })
  }

  // Rename/move/hide follow write access, which every admin-panel account now
  // has everywhere (0027). Delete is the one narrow action: primary owner
  // only, matching admin_is_delete_authorized() server-side, so the entry is
  // omitted rather than shown-and-failing for everyone else.
  const menuFor = (item) => {
    if (item.kind === 'file') {
      return [
        { label: 'Rename', onSelect: () => startRename(item) },
        { label: 'Move to…', onSelect: () => openMove(item) },
        { label: item.hidden ? 'Unhide' : 'Hide on live site', onSelect: () => handleHideFile(moduleId, item.path, !item.hidden) },
        ...(canDelete ? [{
          label: 'Delete',
          onSelect: () => setDeleteConfirm({ kind: 'file', key: item.path, name: item.name }),
        }] : []),
      ]
    }
    if (item.kind === 'folder') {
      return [
        { label: 'Rename', onSelect: () => startRename(item) },
        { label: item.hidden ? 'Unhide' : 'Hide on live site', onSelect: () => handleHideSubfolder(moduleId, item.subfolder, !item.hidden) },
        ...(canDelete ? [{
          label: 'Delete',
          onSelect: () => setDeleteConfirm({
            kind: 'folder', key: item.subfolder, name: item.name,
            fileCount: filesForFolder(activeModule, item.subfolder).length,
          }),
        }] : []),
      ]
    }
    // Subject (module / rail-module) — structural, owner-only.
    if (!isOwner) return []
    return [
      { label: 'Rename', onSelect: () => startRename(item) },
      { label: item.hidden ? 'Unhide' : 'Hide on live site', onSelect: () => handleHideModule(item.id, !item.hidden) },
      ...(canDelete ? [{
        label: 'Delete',
        onSelect: () => {
          const target = visibleModules.find(m => m.id === item.id)
          setDeleteConfirm({
            kind: 'module', key: item.id, name: item.name,
            fileCount: target?.notes?.length ?? 0,
            folderCount: target ? subfoldersForModule(target).length : 0,
          })
        },
      }] : []),
    ]
  }

  // Actions for the current location's breadcrumb caret dropdown. Rename isn't
  // offered here (it needs an inline input, which only exists in the row list —
  // rename a subject/folder from its parent listing instead). Deleting the
  // container you're inside navigates back up afterwards.
  const currentActions = useMemo(() => {
    if (level === 'folders' && activeModule && isOwner) {
      const name = activeModule.label
      const hidden = hiddenModuleIds.has(activeModule.id)
      return [
        { label: hidden ? 'Unhide subject' : 'Hide on live site', onSelect: () => handleHideModule(activeModule.id, !hidden) },
        ...(canDelete ? [{
          label: 'Delete subject',
          onSelect: () => setDeleteConfirm({
            kind: 'module', key: activeModule.id, name, then: () => navigate('/admin/editor'),
            fileCount: activeModule.notes?.length ?? 0,
            folderCount: subfoldersForModule(activeModule).length,
          }),
        }] : []),
      ]
    }
    // The Subject root is not a folder, so it has no hide/delete of its own.
    if (level === 'files' && activeSubfolder) {
      const hidden = folderHidden(activeSubfolder)
      return [
        { label: hidden ? 'Unhide folder' : 'Hide on live site', onSelect: () => handleHideSubfolder(moduleId, activeSubfolder, !hidden) },
        ...(canDelete ? [{
          label: 'Delete folder',
          onSelect: () => setDeleteConfirm({
            kind: 'folder', key: activeSubfolder, name: activeSubfolder, then: () => navigate(`/admin/editor/${moduleId}`),
            fileCount: filesForFolder(activeModule, activeSubfolder).length,
          }),
        }] : []),
      ]
    }
    return []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, activeModule, activeSubfolder, isOwner, canDelete, hiddenModuleIds, folders])

  const crumbs = [{ key: 'root', label: 'Subjects', to: () => navigate('/admin/editor') }]
  if (moduleId && activeModule) crumbs.push({ key: 'module', label: activeModule.label, to: () => navigate(`/admin/editor/${moduleId}`) })
  if (activeSubfolder) crumbs.push({ key: 'folder', label: activeSubfolder })

  const handleSignOut = async () => {
    clearActiveCourse()
    // Deferred, not fired: the redirect below replaces the document, so an
    // inline quip would be thrown away before it painted. It shows once the
    // login page's island settles instead.
    deferQuip({ kind: 'chrome', id: 'logout' })
    await supabase.auth.signOut()
    window.location.href = '/admin'
  }

  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  const sortArrow = (key) => sort.key !== key ? null : (sort.dir === 'asc' ? <ArrowUp size={14} weight="bold" /> : <ArrowDown size={14} weight="bold" />)

  const targetModule = visibleModules.find(m => m.id === moveTarget.moduleId)
  const targetSubfolders = targetModule ? subfoldersForModule(targetModule) : []

  if (authLoading) {
    return <div className={styles.fullLoading}><Loading color="var(--accent)" /></div>
  }
  if (isTooNarrow) {
    return (
      <div className={styles.responsiveGuard}>
        <Monitor size={32} weight="regular" />
        <p>The content manager needs a wider screen.</p>
      </div>
    )
  }

  const RowIcon = ({ kind }) => (
    kind === 'file'
      ? <FileText size={20} weight="regular" className={styles.fileIcon} />
      : <Folder size={20} weight="fill" className={styles.folderIcon} />
  )

  const renameInput = (item) => (
    <input
      className={styles.renameInput}
      autoFocus
      value={renaming.value}
      onChange={(e) => setRenaming(r => ({ ...r, value: e.target.value }))}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
      onBlur={commitRename}
    />
  )

  const isRenaming = (item) => renaming?.kind === item.kind && renaming?.key === item.key

  return (
    <div className={styles.app}>
      {/* Top bar */}
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <Folder size={22} weight="fill" className={styles.brandIcon} />
          {isPrimaryOwner && courses.length > 0 ? (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button className={styles.courseSwitcherButton} title="Switch course">
                  <span>{courses.find(c => c.id === activeCourseId)?.name || 'Select course'}</span>
                  <CaretDown size={14} weight="bold" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className={styles.menuContent} sideOffset={8} align="start">
                  {courses.map(c => (
                    <button key={c.id} className={styles.menuItem} onClick={() => setActiveCourseId(c.id)}>
                      {c.name}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : (
            <span className={styles.brandName}>Content</span>
          )}
        </div>
        <div className={styles.searchWrap}>
          <MagnifyingGlass size={18} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.topRight}>
          {/* Same gate as Manage users below. Hiding it is presentation only —
              analytics_can_view() (0052) is what actually refuses a contributor. */}
          {(isOwner || isAdmin) && (
            <button className={styles.analyticsButton} onClick={() => navigate('/admin/analytics')} title="Analytics">
              <ChartLineUp size={20} weight="regular" />
            </button>
          )}
          {(isOwner || isAdmin) && (
            <button className={styles.manageUsersButton} onClick={() => navigate('/admin/users')} title="Manage users">
              <Users size={20} weight="regular" />
            </button>
          )}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className={styles.avatarButton} title={username}>
                <span className={styles.avatar}>{username.charAt(0).toUpperCase()}</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className={styles.menuContent} sideOffset={8} align="end">
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{username}</span>
                  <span className={styles.userRole}>
                    {isPrimaryOwner ? 'Primary owner' : isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Contributor'}
                  </span>
                </div>
                <div className={styles.menuDivider} />
                {(isOwner || isAdmin) && (
                  <button className={styles.menuItem} onClick={() => navigate('/admin/analytics')}>
                    <ChartLineUp size={16} /> Analytics
                  </button>
                )}
                <button className={styles.menuItem} onClick={() => navigate('/admin/settings')}>
                  <Gear size={16} /> Settings
                </button>
                <button className={styles.menuItem} onClick={handleSignOut}>
                  <SignOut size={16} /> Sign out
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </header>

      <div className={styles.body}>
        {/* Left rail */}
        <aside className={styles.sidebar}>
          {/* The button is always present, even where the account can't create
              anything here (a non-owner at the Subjects root). Hiding it left a
              blank gap that read as a broken layout rather than a rule, so it
              stays put, styled as unavailable, and explains itself on click. */}
          <Popover.Root open={creating} onOpenChange={(open) => (open ? openCreate() : setCreating(false))}>
            <Popover.Trigger asChild>
              <button className={`${styles.newButton} ${canCreate ? '' : styles.newButtonMuted}`}>
                <Plus size={20} weight="bold" />
                <span>New</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className={styles.createPopover} align="start" sideOffset={8}>
                {!canCreate && (
                  <>
                    <div className={styles.createHint}>
                      Open a subject first. Folders and files are created inside
                      a subject; adding a new subject here is owner-only.
                    </div>
                    <div className={styles.confirmActions}>
                      <button className={styles.btnPrimary} onClick={() => setCreating(false)}>Got it</button>
                    </div>
                  </>
                )}
                {canCreate && createKinds.length > 1 && (
                  <div className={styles.createKindTabs}>
                    {createKinds.map(kind => (
                      <button
                        key={kind}
                        type="button"
                        className={`${styles.createKindTab} ${activeCreateKind === kind ? styles.createKindTabActive : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setCreateKind(kind)}
                      >
                        {kind === 'folder' ? <Folder size={16} weight="fill" /> : <FileText size={16} />}
                        <span>{kind === 'folder' ? 'Folder' : 'File'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {canCreate && (
                  <input
                    className={styles.createInput}
                    autoFocus
                    placeholder={activeCreateKind === 'subject' ? 'Subject name' : activeCreateKind === 'folder' ? 'Folder name' : 'File name'}
                    value={createValue}
                    onChange={(e) => setCreateValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') setCreating(false) }}
                  />
                )}
                {canCreate && activeCreateKind === 'subject' && unusedIconOptions.length > 0 && (
                  <div className={styles.iconPicker}>
                    {unusedIconOptions.map(option => (
                      <button
                        key={option.name}
                        type="button"
                        className={`${styles.iconChoice} ${createIcon === option.name ? styles.iconChoiceSelected : ''}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setCreateIcon(option.name)}
                        title={option.label}
                      >
                        <option.Icon size={18} />
                      </button>
                    ))}
                  </div>
                )}
                {canCreate && (
                  <div className={styles.confirmActions}>
                    <button className={styles.btnText} onClick={() => setCreating(false)}>Cancel</button>
                    <button className={styles.btnPrimary} onClick={submitCreate}>Create</button>
                  </div>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <nav className={styles.nav}>
            <button
              className={`${styles.navItem} ${level === 'subjects' ? styles.navItemActive : ''}`}
              onClick={() => navigate('/admin/editor')}
            >
              <Folder size={20} weight={level === 'subjects' ? 'fill' : 'regular'} />
              <span>Subjects</span>
            </button>
            {visibleModules.map(m => {
              const subjectItem = { kind: 'rail-module', key: m.id, name: m.label, hidden: hiddenModuleIds.has(m.id), id: m.id }
              return (
                <div
                  key={m.id}
                  className={`${styles.navItem} ${styles.navSub} ${moduleId === m.id ? styles.navItemActive : ''}`}
                  onClick={() => !isRenaming(subjectItem) && navigate(`/admin/editor/${m.id}`)}
                  title={m.label}
                >
                  {m.Icon ? <m.Icon size={18} weight="regular" /> : <Folder size={18} />}
                  {isRenaming(subjectItem)
                    ? renameInput(subjectItem)
                    : <span className={styles.navLabel}>{m.label}</span>}
                  <div className={styles.navRowMenu}>
                    <RowMenu items={menuFor(subjectItem)} />
                  </div>
                </div>
              )
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className={styles.main}>
          <div className={styles.mainHeader}>
            <Breadcrumb crumbs={crumbs} actions={currentActions} />
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewButton} ${view === 'list' ? styles.viewButtonActive : ''}`}
                onClick={() => setView('list')}
                title="List view"
              >
                <ListBullets size={18} weight="bold" />
              </button>
              <button
                className={`${styles.viewButton} ${view === 'grid' ? styles.viewButtonActive : ''}`}
                onClick={() => setView('grid')}
                title="Grid view"
              >
                <SquaresFour size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <div className={styles.chips}>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button className={`${styles.chip} ${typeFilter !== 'all' ? styles.chipActive : ''}`}>
                  {typeFilter === 'all' ? 'Type' : typeFilter === 'folders' ? 'Folders' : 'Files'}
                  <CaretDown size={14} weight="bold" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className={styles.menuContent} sideOffset={5} align="start">
                  {['all', 'folders', 'files'].map(t => (
                    <button key={t} className={styles.menuItem} onClick={() => setTypeFilter(t)}>
                      {t === 'all' ? 'All types' : t === 'folders' ? 'Folders' : 'Files'}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            <Popover.Root>
              <Popover.Trigger asChild>
                <button className={`${styles.chip} ${sort.key !== 'created' ? styles.chipActive : ''}`}>
                  {sort.key === 'created' ? 'Sort' : sort.key === 'date' ? 'Modified' : 'Name'}
                  <CaretDown size={14} weight="bold" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className={styles.menuContent} sideOffset={5} align="start">
                  <button className={styles.menuItem} onClick={() => setSort({ key: 'created', dir: 'asc' })}>Date created</button>
                  <button className={styles.menuItem} onClick={() => setSort({ key: 'date', dir: 'desc' })}>Newest first</button>
                  <button className={styles.menuItem} onClick={() => setSort({ key: 'date', dir: 'asc' })}>Oldest first</button>
                  <button className={styles.menuItem} onClick={() => setSort({ key: 'name', dir: 'asc' })}>Name (A–Z)</button>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          {/* Content */}
          {modulesLoading && level === 'subjects' ? (
            <div className={styles.skeletonList}>
              {[0, 1, 2, 3].map(i => <div key={i} className={styles.skeletonRow} />)}
            </div>
          ) : moduleId && !activeModule ? (
            <div className={styles.emptyState}>This subject doesn't exist or you don't have access.</div>
          ) : view === 'list' ? (
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <button className={`${styles.thName} ${styles.thSortable}`} onClick={() => toggleSort('name')}>
                  Name {sortArrow('name')}
                </button>
                <div className={styles.thOwner}>Owner</div>
                <button className={`${styles.thDate} ${styles.thSortable}`} onClick={() => toggleSort(sort.key === 'created' ? 'created' : 'date')}>
                  {sort.key === 'created' ? 'Date created' : 'Date modified'} {sortArrow(sort.key === 'created' ? 'created' : 'date')}
                </button>
                <div className={styles.thSize}>File size</div>
                <div className={styles.thMenu} />
              </div>

              {displayItems.length === 0 ? (
                <div className={styles.emptyState}>
                  {search.trim() ? 'No matches.' : level === 'files' ? 'No files here yet.' : level === 'folders' ? 'No folders here yet.' : 'No subjects yet.'}
                </div>
              ) : (
                displayItems.map(item => (
                  <div
                    key={item.key}
                    className={`${styles.row} ${item.hidden ? styles.rowHidden : ''}`}
                    onClick={() => !isRenaming(item) && item.onOpen()}
                  >
                    <div className={styles.cellName}>
                      <RowIcon kind={item.kind} />
                      {isRenaming(item) ? renameInput(item) : <span className={styles.name}>{item.name}</span>}
                      {item.hidden && <span className={styles.hiddenBadge}><EyeSlash size={12} weight="bold" /> hidden</span>}
                    </div>
                    <div className={styles.cellOwner}>
                      <AvatarGroup authors={item.authors} size={26} />
                    </div>
                    <div className={styles.cellDate}>{formatDate(sort.key === 'created' ? item.created : item.date)}</div>
                    <div className={styles.cellSize}>—</div>
                    <div className={styles.cellMenu}>
                      <RowMenu items={menuFor(item)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {displayItems.length === 0 ? (
                <div className={styles.emptyState}>
                  {search.trim() ? 'No matches.' : 'Nothing here yet.'}
                </div>
              ) : (
                displayItems.map(item => (
                  <div
                    key={item.key}
                    className={`${styles.card} ${item.hidden ? styles.rowHidden : ''}`}
                    onClick={() => !isRenaming(item) && item.onOpen()}
                  >
                    <div className={styles.cardTop}>
                      <RowIcon kind={item.kind} />
                      {isRenaming(item)
                        ? renameInput(item)
                        : <span className={styles.cardName} title={item.name}>{item.name}</span>}
                      <div className={styles.cardMenu}><RowMenu items={menuFor(item)} /></div>
                    </div>
                    {item.hidden && <span className={styles.hiddenBadge}><EyeSlash size={12} weight="bold" /> hidden</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* Move-to picker */}
      {movingFile && (
        <Popover.Root open onOpenChange={(open) => !open && setMovingFile(null)}>
          <Popover.Anchor className={styles.centerAnchor} />
          <Popover.Portal>
            <Popover.Content className={styles.confirmPopover} sideOffset={5}>
              <div className={styles.confirmTitle}>Move "{movingFile.name}"</div>
              <label className={styles.moveLabel}>
                Subject
                <select
                  className={styles.moveSelect}
                  value={moveTarget.moduleId}
                  onChange={(e) => setMoveTarget({ moduleId: e.target.value, subfolder: '' })}
                >
                  {visibleModules.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
              <label className={styles.moveLabel}>
                Folder
                <select
                  className={styles.moveSelect}
                  value={moveTarget.subfolder}
                  onChange={(e) => setMoveTarget(t => ({ ...t, subfolder: e.target.value }))}
                >
                  <option value="">No folder (top level)</option>
                  {targetSubfolders.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className={styles.confirmActions}>
                <button className={styles.btnText} onClick={() => setMovingFile(null)}>Cancel</button>
                <button className={styles.btnPrimary} onClick={submitMove} disabled={!moveTarget.moduleId}>Move</button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      <DeleteConfirm deleteConfirm={deleteConfirm} onCancel={() => setDeleteConfirm(null)} onConfirm={runDelete} />
    </div>
  )
}

export default function AdminBrowser() {
  return (
    <ToastNotification>
      <AdminBrowserContent />
    </ToastNotification>
  )
}
