import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import {
  ArrowUp, ArrowDown, CaretDown, CaretRight, FileText, Folder,
  ListBullets, MagnifyingGlass, SquaresFour,
} from '@phosphor-icons/react'
import PageShell from '../../components/layout/PageShell'
import BackButton from '../../components/common/BackButton/BackButton'
import Loading from '../../components/ui/Loading'
import { useNotesRegistry } from '../../hooks/useNotesRegistry'
import {
  subfoldersForModule, filesForFolder, rootFilesForModule, segmentToSubfolder,
  authorsForFolder, authorsForModule, baseName,
  compareRowsByCreated, compareRowsByName,
} from '../../lib/notesApi'
import AvatarGroup from '../../components/common/AvatarGroup/AvatarGroup'
import { noteRoute } from '../../components/layout/Sidebar/modules'
import { prefetchNote } from '../../lib/noteCache'
import styles from './NotesBrowserPage.module.css'

/**
 * Public, read-only Drive-style browser: Subjects → folders → files.
 * Same navigation model as the admin AdminBrowser (T-045), rebuilt without
 * any create/rename/delete/hide/move affordance and without its auth gate —
 * data comes from useNotesRegistry(), which already drops hidden
 * Subjects/folders/notes before this component ever sees them.
 */

// subfoldersForModule / filesForFolder come from notesApi (T-053); this page
// used to keep its own copies, which had to stay in step with AdminBrowser's
// by hand or content would render differently here than in the admin panel.

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Chip label per sort key (T-076). 'created' is the default, so its chip reads
// as the neutral "Sort" rather than as an active filter.
const SORT_LABEL = { created: 'Sort', date: 'Modified', name: 'Name' }

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
  // Defaults to date created (T-076): a numbered set then reads 1, 2, 3 … 20,
  // and a note genuinely written earlier sits above a later batch.
  const [sort, setSort] = useState({ key: 'created', dir: 'asc' })

  const activeModule = moduleId ? modules.find((m) => m.id === moduleId) : null
  const activeSubfolder = segmentToSubfolder(subfolder)
  const level = subfolder ? 'files' : moduleId ? 'folders' : 'subjects'

  // Discrete "go up one directory" step, distinct from the breadcrumb's jump
  // to an arbitrary ancestor — mirrors NotesPage's deterministic handleBack.
  const goUp = () => {
    if (level === 'files') navigate(`/notes-browser/${moduleId}`)
    else if (level === 'folders') navigate('/notes-browser')
    else navigate('/home')
  }

  // Opening a note costs a Supabase round trip plus, for a maths note, the
  // KaTeX chunk. Both start on hover instead of on click, so by the time the
  // reader mounts the content is usually already in hand.
  //
  // The delay matters: a note's `content_md` is the whole document (the
  // largest here is ~380 KB), so firing on raw mouseenter meant a mouse
  // sweeping down a listing pulled every note in the folder — 600 KB for one
  // idle gesture. HOVER_INTENT_MS is long enough that only a deliberate pause
  // on a row triggers the fetch, short enough to still beat the click.
  const HOVER_INTENT_MS = 120
  const warmTimer = useRef(null)

  const cancelWarm = () => {
    if (warmTimer.current) clearTimeout(warmTimer.current)
    warmTimer.current = null
  }

  const warmNote = (path) => () => {
    cancelWarm()
    warmTimer.current = setTimeout(() => {
      Promise.all([
        prefetchNote(moduleId, path),
        // Importing the renderer also pulls in the reader's chunk, which the
        // route would otherwise only start fetching after the click.
        import('../../components/markdown/MarkdownRenderer'),
      ])
        .then(([note, renderer]) => renderer.prefetchKatex(note?.contentMd))
        .catch(() => {})
    }, HOVER_INTENT_MS)
  }

  // A pending prefetch must not outlive the page.
  useEffect(() => cancelWarm, [])

  const fileItem = (f) => ({
    // sortKey is the filename, not the display label: the label is prose and
    // need not encode order, while an index note called `00-module-overview`
    // but titled "Web & Mobile Development…" has to sort first, not under W.
    kind: 'file', key: f.path, name: f.name, sortKey: baseName(f.path),
    date: f.updatedAt, created: f.createdAt,
    onOpen: () => navigate(noteRoute(moduleId, f.path)),
    onWarm: warmNote(f.path),
    onWarmCancel: cancelWarm,
    authors: f.authors,
  })

  const items = useMemo(() => {
    if (level === 'files' && activeModule) {
      return filesForFolder(activeModule, activeSubfolder).map(fileItem)
    }
    // Subject level lists folders and root-level files together, matching the
    // admin browser (T-053).
    if (level === 'folders' && activeModule) {
      return [
        ...subfoldersForModule(activeModule).map((name) => ({
          kind: 'folder', key: name, name, date: null,
          onOpen: () => navigate(`/notes-browser/${moduleId}/${encodeURIComponent(name)}`),
          authors: authorsForFolder(activeModule, name),
        })),
        ...rootFilesForModule(activeModule).map(fileItem),
      ]
    }
    return modules.map((m) => ({
      kind: 'module', key: m.id, name: m.label, date: null,
      onOpen: () => navigate(`/notes-browser/${m.id}`),
      authors: authorsForModule(m),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, activeModule, activeSubfolder, moduleId, modules, navigate])

  const displayItems = useMemo(() => {
    let arr = items
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      arr = arr.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (typeFilter === 'folders') arr = arr.filter((i) => i.kind !== 'file')
    if (typeFilter === 'files') arr = arr.filter((i) => i.kind === 'file')
    // Comparators live in notesApi and are shared with the admin browser, so the
    // two listings cannot order differently (T-076). The plain localeCompare
    // this replaced had no `numeric` option, so it read 1, 10, 11, 2.
    arr = [...arr].sort((a, b) => {
      let cmp
      if (sort.key === 'date') cmp = new Date(a.date || 0) - new Date(b.date || 0)
      else if (sort.key === 'created') cmp = compareRowsByCreated(a, b)
      else cmp = compareRowsByName(a, b)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [items, search, typeFilter, sort])

  const crumbs = [{ key: 'home', label: 'Home', to: () => navigate('/home') }]
  crumbs.push({ key: 'root', label: 'Subjects', to: () => navigate('/notes-browser') })
  if (moduleId && activeModule) {
    crumbs.push({ key: 'module', label: activeModule.label, to: () => navigate(`/notes-browser/${moduleId}`) })
  }
  if (activeSubfolder) crumbs.push({ key: 'folder', label: activeSubfolder })

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const sortArrow = (key) => (sort.key !== key ? null : (sort.dir === 'asc' ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />))

  const notFound = Boolean(moduleId) && !loading && !activeModule

  return (
    <PageShell variant="content">
      <BackButton onClick={goUp} />
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
                <button className={`${styles.chip} ${sort.key !== 'created' ? styles.chipActive : ''}`}>
                  {SORT_LABEL[sort.key] ?? 'Sort'}
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
        </div>

        {loading && level === 'subjects' ? (
          <div className={styles.emptyState}><Loading /></div>
        ) : notFound ? (
          <div className={styles.emptyState}>This subject doesn't exist.</div>
        ) : view === 'list' ? (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <button className={`${styles.thName} ${styles.thSortable}`} onClick={() => toggleSort('name')}>
                Name {sortArrow('name')}
              </button>
              <div className={styles.thOwner}>Author</div>
              <button
                className={`${styles.thDate} ${styles.thSortable}`}
                onClick={() => toggleSort(sort.key === 'created' ? 'created' : 'date')}
              >
                {sort.key === 'created' ? 'Date created' : 'Date modified'}{' '}
                {sortArrow(sort.key === 'created' ? 'created' : 'date')}
              </button>
            </div>

            {displayItems.length === 0 ? (
              <div className={styles.emptyState}>
                {search.trim() ? 'No matches.' : level === 'files' ? 'No files here yet.' : level === 'folders' ? 'No folders here yet.' : 'No subjects yet.'}
              </div>
            ) : (
              displayItems.map((item) => (
                <div
                  key={item.key}
                  className={styles.row}
                  onClick={item.onOpen}
                  onMouseEnter={item.onWarm}
                  onMouseLeave={item.onWarmCancel}
                >
                  <div className={styles.cellName}>
                    <RowIcon kind={item.kind} />
                    <span className={styles.name}>{item.name}</span>
                  </div>
                  <div className={styles.cellOwner}>
                    <AvatarGroup authors={item.authors} size={24} />
                  </div>
                  <div className={styles.cellDate}>
                    {formatDate(sort.key === 'created' ? item.created : item.date)}
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
              displayItems.map((item) => (
                <div
                  key={item.key}
                  className={styles.card}
                  onClick={item.onOpen}
                  onMouseEnter={item.onWarm}
                  onMouseLeave={item.onWarmCancel}
                >
                  <div className={styles.cardTop}>
                    <RowIcon kind={item.kind} />
                    <span className={styles.cardName} title={item.name}>{item.name}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <AvatarGroup authors={item.authors} size={18} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}
