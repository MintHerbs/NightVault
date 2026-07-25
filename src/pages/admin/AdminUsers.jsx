import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowLeft, CaretDown, DotsThreeVertical, Eye, EyeSlash, MagnifyingGlass,
  Plus, UsersThree, Warning,
} from '@phosphor-icons/react'
import { colors } from '../../constants/colors'
import { supabase } from '../../lib/supabaseClient'
import { useAdmin } from './useAdmin'
import { useActiveCourse } from '../../hooks/useActiveCourse'
import { listCourses, createCourse, updateCourse, deleteCourse } from '../../lib/coursesApi'
import { listModules } from '../../lib/modulesApi'
import ToastNotification, { useToast } from '../../components/admin/ToastNotification'
import Loading from '../../components/ui/Loading'
import '../../styles/adminTokens.css'
import styles from './AdminUsers.module.css'

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) password += chars.charAt(Math.floor(Math.random() * chars.length))
  return password
}

const ROLE_LABEL = { primary: 'Primary owner', owner: 'Owner', admin: 'Admin', contributor: 'Contributor' }
const ROLE_ORDER = { owner: 0, admin: 1, contributor: 2 }

function RoleChip({ role }) {
  return <span className={`${styles.roleChip} ${styles[role]}`}>{ROLE_LABEL[role] ?? role}</span>
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
            <button key={item.label} className={styles.menuItem} onClick={(e) => { e.stopPropagation(); item.onSelect() }}>
              {item.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function AdminUsersContent() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, isPrimaryOwner } = useAdmin()
  const { showToast } = useToast()

  const role = profile?.role
  const canManage = role === 'owner' || role === 'admin'
  const canCreate = role === 'owner'

  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [courses, setCourses] = useState([])
  const [modules, setModules] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [courseRename, setCourseRename] = useState(null)
  const [courseDeleteConfirm, setCourseDeleteConfirm] = useState(null)
  const [deletingCourse, setDeletingCourse] = useState(false)

  // Primary owner lands on a "which course" picker; everyone else has only
  // ever one course, so there's nothing to pick. activeCourseId is shared
  // with AdminBrowser (useActiveCourse) — picking a course here and jumping
  // to "View content" lands in that same course's file browser.
  const [showCards, setShowCards] = useState(true)
  const [activeCourseId, setActiveCourseId] = useActiveCourse(profile, isPrimaryOwner)
  const viewingCourseId = isPrimaryOwner ? activeCourseId : profile?.course_id

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data ?? [])
    } catch (error) {
      showToast(`Failed to load users: ${error.message}`, 'error')
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (!canManage) return
    loadUsers()
    listModules().then(setModules).catch(() => {})
    if (isPrimaryOwner) listCourses().then(setCourses).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, isPrimaryOwner])

  const courseName = (courseId) => courses.find((c) => c.id === courseId)?.name
  const memberCount = (courseId) => users.filter((u) => u.course_id === courseId).length
  const moduleCount = (courseId) => modules.filter((m) => m.courseId === courseId).length

  // The primary owner isn't necessarily a real row in whichever course is
  // being viewed (their own admin_users row only ever belongs to one course),
  // so they're rendered as a pinned entry using their own profile, separate
  // from — and always ahead of — that course's actual members.
  const courseMembers = useMemo(() => {
    let arr = users.filter((u) => u.course_id === viewingCourseId)
    if (isPrimaryOwner) arr = arr.filter((u) => u.id !== user?.id)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      arr = arr.filter((u) => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    }
    if (roleFilter !== 'all') arr = arr.filter((u) => u.role === roleFilter)
    return [...arr].sort((a, b) => (
      (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || (a.username ?? '').localeCompare(b.username ?? '')
    ))
  }, [users, viewingCourseId, isPrimaryOwner, user?.id, search, roleFilter])

  const canDeleteRow = (target) => {
    if (target.id === user?.id) return false
    if (isPrimaryOwner) return true
    if (role === 'owner') return target.role !== 'owner'
    if (role === 'admin') return target.role === 'contributor'
    return false
  }

  const menuFor = (target) => (
    canDeleteRow(target)
      ? [{ label: 'Remove', onSelect: () => setDeleteConfirm(target) }]
      : []
  )

  // Rename/delete are primary-owner-only server-side (RLS, 0026) — this menu
  // only ever renders inside the cards view, which is already
  // primary-owner-gated, but the real boundary is the DB policy, not this.
  const courseMenuFor = (c) => [
    { label: 'Rename', onSelect: () => setCourseRename({ id: c.id, name: c.name }) },
    {
      label: 'Delete',
      onSelect: () => {
        const blockers = []
        const members = memberCount(c.id)
        const mods = moduleCount(c.id)
        if (members > 0) blockers.push(`${members} ${members === 1 ? 'person' : 'people'}`)
        if (mods > 0) blockers.push(`${mods} ${mods === 1 ? 'subject' : 'subjects'}`)
        if (blockers.length > 0) {
          showToast(`Move or remove ${blockers.join(' and ')} first`, 'error')
          return
        }
        setCourseDeleteConfirm(c)
      },
    },
  ]

  const runDeleteCourse = async () => {
    if (!courseDeleteConfirm) return
    setDeletingCourse(true)
    try {
      await deleteCourse(courseDeleteConfirm.id)
      showToast(`${courseDeleteConfirm.name} deleted`, 'success')
      setCourses((prev) => prev.filter((c) => c.id !== courseDeleteConfirm.id))
      if (activeCourseId === courseDeleteConfirm.id) setActiveCourseId(null)
      setCourseDeleteConfirm(null)
    } catch (error) {
      showToast(`Failed to delete course: ${error.message}`, 'error')
    } finally {
      setDeletingCourse(false)
    }
  }

  const runDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: deleteConfirm.id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      showToast(`${deleteConfirm.username} removed`, 'success')
      setDeleteConfirm(null)
      await loadUsers()
    } catch (error) {
      showToast(`Failed to remove user: ${error.message}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading) {
    return <div className={styles.fullLoading}><Loading color="var(--accent)" /></div>
  }

  if (!canManage) {
    return (
      <div className={styles.forbidden}>
        <Warning size={32} weight="fill" style={{ color: colors.warning }} />
        <h1>403</h1>
        <p>Only owners and admins can manage users.</p>
        <button className={styles.btnPrimary} onClick={() => navigate('/admin/editor')}>Back to content</button>
      </div>
    )
  }

  const inCardsView = isPrimaryOwner && showCards

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <button className={styles.backButton} onClick={() => navigate('/admin/editor')} title="Back to content">
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className={styles.brand}>
          <UsersThree size={22} weight="fill" className={styles.brandIcon} />
          <span className={styles.brandName}>Team</span>
        </div>
        {!inCardsView && (
          <>
            <div className={styles.searchWrap}>
              <MagnifyingGlass size={18} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Search people"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.topRight}>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button className={`${styles.chip} ${roleFilter !== 'all' ? styles.chipActive : ''}`}>
                    {roleFilter === 'all' ? 'Role' : ROLE_LABEL[roleFilter]}
                    <CaretDown size={14} weight="bold" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content className={styles.menuContent} sideOffset={5} align="end">
                    {['all', 'owner', 'admin', 'contributor'].map((r) => (
                      <button key={r} className={styles.menuItem} onClick={() => setRoleFilter(r)}>
                        {r === 'all' ? 'All roles' : ROLE_LABEL[r]}
                      </button>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              {canCreate && (
                <CreateUserButton
                  isPrimaryOwner={isPrimaryOwner}
                  viewingCourseId={viewingCourseId}
                  courses={courses}
                  modules={modules}
                  showToast={showToast}
                  onCreated={loadUsers}
                />
              )}
            </div>
          </>
        )}
      </header>

      <main className={styles.main}>
        {inCardsView ? (
          <>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Courses</h2>
              <NewCourseButton onCreated={(c) => setCourses((prev) => [...prev, c])} showToast={showToast} />
            </div>
            <div className={styles.courseGrid}>
              {courses.map((c) => (
                <div key={c.id} className={styles.courseCard}>
                  <button
                    className={styles.courseCardMain}
                    onClick={() => { setActiveCourseId(c.id); setShowCards(false) }}
                  >
                    <span className={styles.courseCardName}>{c.name}</span>
                    <span className={styles.courseCardMeta}>
                      {memberCount(c.id)} {memberCount(c.id) === 1 ? 'person' : 'people'}
                    </span>
                  </button>
                  {isPrimaryOwner && (
                    <div className={styles.courseCardMenu}>
                      <RowMenu items={courseMenuFor(c)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={styles.sectionHeader}>
              {isPrimaryOwner && (
                <button className={styles.backButton} onClick={() => setShowCards(true)} title="All courses">
                  <ArrowLeft size={18} weight="bold" />
                </button>
              )}
              <h2 className={styles.sectionTitle}>{isPrimaryOwner ? (courseName(viewingCourseId) ?? 'Course') : 'Team'}</h2>
              <button className={styles.viewContentButton} onClick={() => navigate('/admin/editor')}>
                View content
              </button>
            </div>

            {loadingUsers ? (
              <div className={styles.skeletonList}>
                {[0, 1, 2].map((i) => <div key={i} className={styles.skeletonRow} />)}
              </div>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHead}>
                  <div className={styles.thName}>Name</div>
                  <div className={styles.thRole}>Role</div>
                  <div className={styles.thDirs}>Directories</div>
                  <div className={styles.thMenu} />
                </div>

                {isPrimaryOwner && (
                  <div className={`${styles.row} ${styles.pinnedRow}`}>
                    <div className={styles.cellName}>
                      <span className={styles.avatar}>{(profile?.username || user?.email || '?').charAt(0).toUpperCase()}</span>
                      <div className={styles.nameCol}>
                        <span className={styles.username}>{profile?.username} (you)</span>
                        <span className={styles.email}>{user?.email}</span>
                      </div>
                    </div>
                    <div className={styles.cellRole}><RoleChip role="primary" /></div>
                    <div className={styles.cellDirs}><span className={styles.allAccess}>All</span></div>
                    <div className={styles.cellMenu} />
                  </div>
                )}

                {courseMembers.length === 0 ? (
                  <div className={styles.emptyState}>
                    {search.trim() ? 'No matches.' : isPrimaryOwner ? 'No one else here yet.' : 'No one here yet.'}
                  </div>
                ) : (
                  courseMembers.map((u) => (
                    <div key={u.id} className={styles.row}>
                      <div className={styles.cellName}>
                        <span className={styles.avatar}>{(u.username || u.email || '?').charAt(0).toUpperCase()}</span>
                        <div className={styles.nameCol}>
                          <span className={styles.username}>{u.username}</span>
                          <span className={styles.email}>{u.email || u.id}</span>
                        </div>
                      </div>
                      <div className={styles.cellRole}><RoleChip role={u.role} /></div>
                      <div className={styles.cellDirs}>
                        {u.role !== 'contributor' ? (
                          <span className={styles.allAccess}>All</span>
                        ) : u.allowed_directories?.length > 0 ? (
                          <span className={styles.directories}>
                            {u.allowed_directories.slice(0, 3).join(', ')}
                            {u.allowed_directories.length > 3 && ` +${u.allowed_directories.length - 3}`}
                          </span>
                        ) : (
                          <span className={styles.noDirs}>None</span>
                        )}
                      </div>
                      <div className={styles.cellMenu}><RowMenu items={menuFor(u)} /></div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>

      {deleteConfirm && (
        <Popover.Root open onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <Popover.Anchor className={styles.centerAnchor} />
          <Popover.Portal>
            <Popover.Content className={styles.confirmPopover} sideOffset={5}>
              <div className={styles.confirmHeader}>
                <Warning size={20} weight="fill" style={{ color: colors.warning }} />
                <span className={styles.confirmTitle}>Remove {deleteConfirm.username}?</span>
              </div>
              <p className={styles.confirmMessage}>
                They'll immediately lose access to the admin panel. This can't be undone.
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.btnText} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className={styles.btnDanger} onClick={runDelete} disabled={deleting}>
                  {deleting ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      {courseDeleteConfirm && (
        <Popover.Root open onOpenChange={(open) => !open && setCourseDeleteConfirm(null)}>
          <Popover.Anchor className={styles.centerAnchor} />
          <Popover.Portal>
            <Popover.Content className={styles.confirmPopover} sideOffset={5}>
              <div className={styles.confirmHeader}>
                <Warning size={20} weight="fill" style={{ color: colors.warning }} />
                <span className={styles.confirmTitle}>Delete {courseDeleteConfirm.name}?</span>
              </div>
              <p className={styles.confirmMessage}>This can't be undone.</p>
              <div className={styles.confirmActions}>
                <button className={styles.btnText} onClick={() => setCourseDeleteConfirm(null)}>Cancel</button>
                <button className={styles.btnDanger} onClick={runDeleteCourse} disabled={deletingCourse}>
                  {deletingCourse ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      {courseRename && (
        <CourseRenameDialog
          course={courseRename}
          onClose={() => setCourseRename(null)}
          onRenamed={(updated) => setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ── Rename-course dialog (primary owner only) ───────────────────────────────
function CourseRenameDialog({ course, onClose, onRenamed, showToast }) {
  const [name, setName] = useState(course.name)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const updated = await updateCourse({ id: course.id, name: name.trim() })
      onRenamed(updated)
      showToast(`Renamed to ${updated.name}`, 'success')
      onClose()
    } catch (error) {
      showToast(`Failed to rename course: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover.Root open onOpenChange={(open) => !open && onClose()}>
      <Popover.Anchor className={styles.centerAnchor} />
      <Popover.Portal>
        <Popover.Content className={styles.createPopover} sideOffset={5}>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.formGroup}>
              <span className={styles.label}>Course name</span>
              <input
                className={styles.input}
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.btnText} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── New-course dialog (primary owner only) ─────────────────────────────────
function NewCourseButton({ onCreated, showToast }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const created = await createCourse({ id, name: name.trim() })
      onCreated(created)
      showToast(`${created.name} created`, 'success')
      setOpen(false)
      setName('')
    } catch (error) {
      showToast(`Failed to create course: ${error.message}`, 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setName('') }}>
      <Popover.Trigger asChild>
        <button className={styles.newButton}>
          <Plus size={18} weight="bold" />
          <span>New course</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.createPopover} align="end" sideOffset={8}>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.formGroup}>
              <span className={styles.label}>Course name</span>
              <input
                className={styles.input}
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Applied Computing"
                required
              />
            </label>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.btnText} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── Create-user dialog ────────────────────────────────────────────────────
// A separate component so its own form state resets cleanly each time it's
// opened, without leaking into the parent's render cycle.
function CreateUserButton({ isPrimaryOwner, viewingCourseId, courses, modules, showToast, onCreated }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('contributor')
  const [courseId, setCourseId] = useState(viewingCourseId ?? '')
  const [selectedDirectories, setSelectedDirectories] = useState([])
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)

  const roleOptions = isPrimaryOwner ? ['owner', 'admin', 'contributor'] : ['admin', 'contributor']
  const targetCourseId = isPrimaryOwner ? courseId : viewingCourseId
  const courseModules = modules.filter((m) => m.courseId === targetCourseId)

  const resetAndOpen = () => {
    setEmail(''); setUsername(''); setRole('contributor')
    setCourseId(viewingCourseId ?? '')
    setSelectedDirectories([]); setPassword(''); setShowPassword(false)
    setOpen(true)
  }

  const toggleDirectory = (moduleId) => {
    setSelectedDirectories((prev) => (
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    ))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!email || !username || !password) {
      showToast('Please fill in every field', 'error'); return
    }
    if (password.length < 8) {
      showToast('Password must be at least 8 characters', 'error'); return
    }
    if (role === 'contributor' && selectedDirectories.length === 0) {
      showToast('Contributors need at least one allowed directory', 'error'); return
    }

    setCreating(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email, password, username, role,
          allowedDirectories: role === 'contributor' ? selectedDirectories : [],
          courseId: targetCourseId,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      showToast(`${username} created`, 'success')
      setOpen(false)
      await onCreated()
    } catch (error) {
      showToast(`Failed to create user: ${error.message}`, 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? resetAndOpen() : setOpen(false))}>
      <Popover.Trigger asChild>
        <button className={styles.newButton}>
          <Plus size={18} weight="bold" />
          <span>New person</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.createPopover} align="end" sideOffset={8}>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.formGroup}>
              <span className={styles.label}>Email</span>
              <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" required />
            </label>
            <label className={styles.formGroup}>
              <span className={styles.label}>Username</span>
              <input className={styles.input} type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" required />
            </label>
            <label className={styles.formGroup}>
              <span className={styles.label}>Role</span>
              <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value)}>
                {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>

            {isPrimaryOwner && (
              <label className={styles.formGroup}>
                <span className={styles.label}>Course</span>
                <select className={styles.select} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}

            {role === 'contributor' && (
              <div className={styles.formGroup}>
                <span className={styles.label}>Allowed directories</span>
                <div className={styles.directoryGrid}>
                  {courseModules.map((m) => (
                    <label key={m.id} className={styles.checkbox}>
                      <input type="checkbox" checked={selectedDirectories.includes(m.id)} onChange={() => toggleDirectory(m.id)} />
                      <span>{m.label}</span>
                    </label>
                  ))}
                  {courseModules.length === 0 && <span className={styles.noDirs}>No subjects in this course yet</span>}
                </div>
              </div>
            )}

            <label className={styles.formGroup}>
              <span className={styles.label}>Password</span>
              <div className={styles.passwordGroup}>
                <input
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Type or generate"
                  minLength={8}
                  required
                />
                <button type="button" className={styles.iconBtn} onClick={() => setPassword(generatePassword())} title="Generate">Generate</button>
                <button type="button" className={styles.iconBtn} onClick={() => setShowPassword((s) => !s)} title={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div className={styles.confirmActions}>
              <button type="button" className={styles.btnText} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default function AdminUsers() {
  return (
    <ToastNotification>
      <AdminUsersContent />
    </ToastNotification>
  )
}
