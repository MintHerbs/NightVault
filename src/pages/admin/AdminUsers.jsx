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
import { listCourses, createCourse } from '../../lib/coursesApi'
import { listModules } from '../../lib/modulesApi'
import ToastNotification, { useToast } from '../../components/admin/ToastNotification'
import '../../styles/adminTokens.css'
import styles from './AdminUsers.module.css'

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) password += chars.charAt(Math.floor(Math.random() * chars.length))
  return password
}

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', contributor: 'Contributor' }

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

  const displayUsers = useMemo(() => {
    let arr = users
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      arr = arr.filter((u) => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    }
    if (roleFilter !== 'all') arr = arr.filter((u) => u.role === roleFilter)
    return arr
  }, [users, search, roleFilter])

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
    return <div className={styles.fullLoading}>Loading…</div>
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
              ownCourseId={profile?.course_id}
              courses={courses}
              setCourses={setCourses}
              modules={modules}
              showToast={showToast}
              onCreated={loadUsers}
            />
          )}
        </div>
      </header>

      <main className={styles.main}>
        {loadingUsers ? (
          <div className={styles.skeletonList}>
            {[0, 1, 2].map((i) => <div key={i} className={styles.skeletonRow} />)}
          </div>
        ) : displayUsers.length === 0 ? (
          <div className={styles.emptyState}>{search.trim() ? 'No matches.' : 'No one here yet.'}</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <div className={styles.thName}>Name</div>
              <div className={styles.thRole}>Role</div>
              {isPrimaryOwner && <div className={styles.thCourse}>Course</div>}
              <div className={styles.thDirs}>Directories</div>
              <div className={styles.thMenu} />
            </div>
            {displayUsers.map((u) => (
              <div key={u.id} className={styles.row}>
                <div className={styles.cellName}>
                  <span className={styles.avatar}>{(u.username || u.email || '?').charAt(0).toUpperCase()}</span>
                  <div className={styles.nameCol}>
                    <span className={styles.username}>{u.username}</span>
                    <span className={styles.email}>{u.email || u.id}</span>
                  </div>
                </div>
                <div className={styles.cellRole}><RoleChip role={u.role} /></div>
                {isPrimaryOwner && <div className={styles.cellCourse}>{courseName(u.course_id) || '—'}</div>}
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
            ))}
          </div>
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
    </div>
  )
}

// ── Create-user dialog ────────────────────────────────────────────────────
// A separate component so its own form state resets cleanly each time it's
// opened, without leaking into the parent's render cycle.
function CreateUserButton({ isPrimaryOwner, ownCourseId, courses, setCourses, modules, showToast, onCreated }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('contributor')
  const [courseId, setCourseId] = useState(ownCourseId ?? '')
  const [newCourseName, setNewCourseName] = useState('')
  const [selectedDirectories, setSelectedDirectories] = useState([])
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)

  const roleOptions = isPrimaryOwner ? ['owner', 'admin', 'contributor'] : ['admin', 'contributor']
  const targetCourseId = isPrimaryOwner ? courseId : ownCourseId
  const courseModules = modules.filter((m) => m.courseId === targetCourseId)

  const resetAndOpen = () => {
    setEmail(''); setUsername(''); setRole('contributor')
    setCourseId(ownCourseId ?? ''); setNewCourseName('')
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
      let resolvedCourseId = targetCourseId
      if (isPrimaryOwner && newCourseName.trim()) {
        const slug = newCourseName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const created = await createCourse({ name: newCourseName.trim(), slug })
        setCourses((prev) => [...prev, created])
        resolvedCourseId = created.id
      }

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email, password, username, role,
          allowedDirectories: role === 'contributor' ? selectedDirectories : [],
          courseId: resolvedCourseId,
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
                <select className={styles.select} value={newCourseName ? '' : courseId} onChange={(e) => { setCourseId(e.target.value); setNewCourseName('') }} disabled={!!newCourseName}>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="…or name a new course"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                />
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
