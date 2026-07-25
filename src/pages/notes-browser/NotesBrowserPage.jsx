import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowUp, ArrowDown, CaretDown, CaretRight, FileText, Folder,
  ListBullets, MagnifyingGlass, SquaresFour,
} from '@phosphor-icons/react'
import PageShell from '../../components/layout/PageShell'
import { useNotesRegistry } from '../../hooks/useNotesRegistry'
import { displaySubfolder } from '../../lib/notesApi'
import { noteRoute } from '../../components/layout/Sidebar/modules'
import styles from './NotesBrowserPage.module.css'

/**
 * Public, read-only Drive-style browser: Subjects → folders → files.
 * Same navigation model as the admin AdminBrowser (T-045), rebuilt without
 * any create/rename/delete/hide/move affordance and without its auth gate —
 * data comes from useNotesRegistry(), which already drops hidden
 * Subjects/folders/notes before this component ever sees them.
 */

/** Every subfolder a Subject has — derived from its notes plus any explicit
 * (possibly empty) folder rows. Mirrors AdminBrowser's admin-side version. */
function subfoldersForModule(module) {
  const derived = module.notes ? [...new Set(module.notes.map((n) => displaySubfolder(n.filename)))] : []
  const explicit = module.subfolders ?? []
  return derived.length > 0 || explicit.length > 0
    ? [...new Set([...derived, ...explicit])]
    : []
}

function filesForFolder(module, subfolder) {
  return (module.notes ?? [])
    .filter((n) => displaySubfolder(n.filename) === subfolder)
    .map((n) => ({
      name: n.label || `${n.filename.split('/').pop()}.md`,
      path: n.filename,
      updatedAt: n.updatedAt,
    }))
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Drive-style breadcrumb, read-only: every segment but the last is a link;
// the last is the current location's plain title. "Home" always behaves as
// a link (it navigates away, never "here"), so it's just the first segment
// in the same chain rather than special-cased.
function Breadcrumb({ crumbs }) {
  return (
    <div className={styles.breadcrumb}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.key} className={styles.crumbSegment}>
            {i > 0 && <CaretRight size={16} className={styles.crumbSep} weight="bold" />}
            {isLast ? (
              <span className={styles.crumbTitle}>{crumb.label}</span>
            ) : (
              <button className={styles.crumbLink} onClick={crumb.to}>{crumb.label}</button>
            )}
          </span>
        )
      })}
    </div>
  )
}

function RowIcon({ kind }) {
  return kind === 'file'
    ? <FileText size={20} weight="regular" className={styles.fileIcon} />
    : <Folder size={20} weight="fill" className={styles.folderIcon} />
}

export default function NotesBrowserPage() {
  const navigate = useNavigate()
  const { moduleId, subfolder } = useParams()
  const { modules, loading } = useNotesRegistry()

  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'folders' | 'files'
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  const activeModule = moduleId ? modules.find((m) => m.id === moduleId) : null
  const level = subfolder ? 'files' : moduleId ? 'folders' : 'subjects'

  const items = useMemo(() => {
    if (level === 'files' && activeModule) {
      return filesForFolder(activeModule, subfolder).map((f) => ({
        kind: 'file', key: f.path, name: f.name, date: f.updatedAt,
        onOpen: () => navigate(noteRoute(moduleId, f.path)),
      }))
    }
    if (level === 'folders' && activeModule) {
      return subfoldersForModule(activeModule).map((name) => ({
        kind: 'folder', key: name, name, date: null,
        onOpen: () => navigate(`/notes-browser/${moduleId}/${encodeURIComponent(name)}`),
      }))
    }
    return modules.map((m) => ({
      kind: 'module', key: m.id, name: m.label, date: null,
      onOpen: () => navigate(`/notes-browser/${m.id}`),
    }))
  }, [level, activeModule, subfolder, moduleId, modules, navigate])

  const displayItems = useMemo(() => {
    let arr = items
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      arr = arr.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (typeFilter === 'folders') arr = arr.filter((i) => i.kind !== 'file')
    if (typeFilter === 'files') arr = arr.filter((i) => i.kind === 'file')
    arr = [...arr].sort((a, b) => {
      const cmp = sort.key === 'date'
        ? new Date(a.date || 0) - new Date(b.date || 0)
        : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [items, search, typeFilter, sort])

  const crumbs = [{ key: 'home', label: 'Home', to: () => navigate('/home') }]
  crumbs.push({ key: 'root', label: 'Subjects', to: () => navigate('/notes-browser') })
  if (moduleId && activeModule) {
    crumbs.push({ key: 'module', label: activeModule.label, to: () => navigate(`/notes-browser/${moduleId}`) })
  }
  if (subfolder) crumbs.push({ key: 'folder', label: subfolder })

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const sortArrow = (key) => (sort.key !== key ? null : (sort.dir === 'asc' ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />))

  const notFound = Boolean(moduleId) && !loading && !activeModule

  return (
    <PageShell variant="content">
      <div className={styles.page}>
        <div className={styles.mainHeader}>
          <Breadcrumb crumbs={crumbs} />
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

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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
                  {['all', 'folders', 'files'].map((t) => (
                    <button key={t} className={styles.menuItem} onClick={() => setTypeFilter(t)}>
                      {t === 'all' ? 'All types' : t === 'folders' ? 'Folders' : 'Files'}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            <Popover.Root>
              <Popover.Trigger asChild>
                <button className={`${styles.chip} ${sort.key === 'date' ? styles.chipActive : ''}`}>
                  Modified
                  <CaretDown size={14} weight="bold" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className={styles.menuContent} sideOffset={5} align="start">
                  <button className={styles.menuItem} onClick={() => setSort({ key: 'date', dir: 'desc' })}>Newest first</button>
                  <button className={styles.menuItem} onClick={() => setSort({ key: 'date', dir: 'asc' })}>Oldest first</button>
                  <button className={styles.menuItem} onClick={() => setSort({ key: 'name', dir: 'asc' })}>Name (A–Z)</button>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>

        {loading && level === 'subjects' ? (
          <div className={styles.emptyState}>Loading…</div>
        ) : notFound ? (
          <div className={styles.emptyState}>This subject doesn't exist.</div>
        ) : view === 'list' ? (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <button className={`${styles.thName} ${styles.thSortable}`} onClick={() => toggleSort('name')}>
                Name {sortArrow('name')}
              </button>
              <button className={`${styles.thDate} ${styles.thSortable}`} onClick={() => toggleSort('date')}>
                Date modified {sortArrow('date')}
              </button>
            </div>

            {displayItems.length === 0 ? (
              <div className={styles.emptyState}>
                {search.trim() ? 'No matches.' : level === 'files' ? 'No files here yet.' : level === 'folders' ? 'No folders here yet.' : 'No subjects yet.'}
              </div>
            ) : (
              displayItems.map((item) => (
                <div key={item.key} className={styles.row} onClick={item.onOpen}>
                  <div className={styles.cellName}>
                    <RowIcon kind={item.kind} />
                    <span className={styles.name}>{item.name}</span>
                  </div>
                  <div className={styles.cellDate}>{formatDate(item.date)}</div>
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
              displayItems.map((item) => (
                <div key={item.key} className={styles.card} onClick={item.onOpen}>
                  <RowIcon kind={item.kind} />
                  <span className={styles.cardName} title={item.name}>{item.name}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}
