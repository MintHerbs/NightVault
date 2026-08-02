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
import { listCourses } from '../../lib/coursesApi'
import {
  subfoldersForModule, filesForFolder, rootFilesForModule, segmentToSubfolder,
  authorsForFolder, authorsForModule, baseName,
  compareRowsByCreated, compareRowsByName,
} from '../../lib/notesApi'
import AvatarGroup from '../../components/common/AvatarGroup/AvatarGroup'
import { noteRoute } from '../../components/layout/Sidebar/modules'
import { prefetchNote } from '../../lib/noteCache'
import { fireQuip } from '../../hooks/useSentinelQuip'
import { trackToolEvent } from '../../lib/analytics/tracker'
import styles from './NotesBrowserPage.module.css'

/**
 * Public, read-only Drive-style browser: Subjects → folders → files, scoped
 * to a single course (T-077) — reached from that course's own landing page,
 * never as a cross-course listing. Same navigation model as the admin
 * AdminBrowser (T-045), rebuilt without any create/rename/delete/hide/move
 * affordance and without its auth gate — data comes from useNotesRegistry(),
 * which already drops hidden Subjects/folders/notes before this component
 * ever sees them; the course scoping below mirrors the same filter
 * AdminBrowser.jsx already applies for its own course switcher.
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
  const { courseId, moduleId, subfolder } = useParams()
  const { modules: allModules, loading } = useNotesRegistry()

  // Course-scoped (T-077): a Subject belongs to exactly one course
  // (sidebar_modules.course_id), so the Subjects-level listing must filter to
  // the course this page was opened from — mirrors the one-line filter
  // AdminBrowser.jsx already applies for its own course switcher. Without
  // this, every course's Subjects showed up mixed together here.
  const modules = useMemo(
    () => allModules.filter((m) => m.courseId === courseId),
    [allModules, courseId],
  )

  // Hiding a course has to actually take its notes out of reach, not just off
  // the home grid — otherwise /notes-browser/<hidden course> stays a public
  // door into the content the hide was meant to withhold (T-077).
  // `undefined` = still resolving, `null` = no such course, or hidden.
  const [course, setCourse] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    listCourses()
      .then((rows) => {
        if (!cancelled) setCourse(rows.find((c) => c.id === courseId && !c.hidden) ?? null)
      })
      .catch(() => { if (!cancelled) setCourse(null) })
    return () => { cancelled = true }
  }, [courseId])

  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'folders' | 'files'
  // Defaults to date created (T-076): a numbered set then reads 1, 2, 3 … 20,
  // and a note genuinely written earlier sits above a later batch.
  const [sort, setSort] = useState({ key: 'created', dir: 'asc' })

  const activeModule = moduleId ? modules.find((m) => m.id === moduleId) : null
  const activeSubfolder = segmentToSubfolder(subfolder)
  const level = subfolder ? 'files' : moduleId ? 'folders' : 'subjects'

  // Three retreats inside this window and Sentinel says something. Longer and
  // it would catch ordinary browsing; shorter and only a frantic click counts.
  const LOST_WINDOW_MS = 5000
  const backTimes = useRef([])

  // Discrete "go up one directory" step, distinct from the breadcrumb's jump
  // to an arbitrary ancestor — mirrors NotesPage's deterministic handleBack.
  const goUp = () => {
    const now = Date.now()
    backTimes.current = [...backTimes.current, now].filter((t) => now - t < LOST_WINDOW_MS)
    if (backTimes.current.length >= 3) {
      backTimes.current = []
      fireQuip({ kind: 'chrome', id: 'lost' })
    }
    if (level === 'files') navigate(`/notes-browser/${courseId}/${moduleId}`)
    else if (level === 'folders') navigate(`/notes-browser/${courseId}`)
    else navigate(`/courses/${courseId}`)
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
    onOpen: () => {
      // The browser's own use, distinct from the note read that NotesPage
      // records on arrival: this says people navigate by browsing rather than
      // through the sidebar.
      trackToolEvent('notes-browser', 'open-file')
      // Depth counts the Subject plus every path segment, so a note buried in
      // nested folders can earn a remark that a top-level one cannot.
      fireQuip({
        kind: 'file',
        name: f.name,
        updatedAt: f.updatedAt,
        depth: 1 + String(f.path ?? '').split('/').length,
      })
      navigate(noteRoute(moduleId, f.path))
    },
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
          onOpen: () => {
            fireQuip({
              kind: 'folder',
              name,
              itemCount: filesForFolder(activeModule, name).length,
              depth: 2,
            })
            navigate(`/notes-browser/${courseId}/${moduleId}/${encodeURIComponent(name)}`)
          },
          authors: authorsForFolder(activeModule, name),
        })),
        ...rootFilesForModule(activeModule).map(fileItem),
      ]
    }
    return modules.map((m) => ({
      kind: 'module', key: m.id, name: m.label, date: null,
      onOpen: () => {
        fireQuip({
          kind: 'module',
          id: m.id,
          name: m.label,
          itemCount: subfoldersForModule(m).length + rootFilesForModule(m).length,
          depth: 1,
        })
        navigate(`/notes-browser/${courseId}/${m.id}`)
      },
      authors: authorsForModule(m),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, activeModule, activeSubfolder, courseId, moduleId, modules, navigate])

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

  // Searching. Both of these key off the debounced result rather than off each
  // keystroke: a query on its way to matching something passes through several
  // states that match nothing, and remarking on those would be wrong every
  // time. The delay is what makes "no results" mean the visitor stopped typing.
  const SEARCH_SETTLE_MS = 700
  const STILL_LOOKING_WINDOW_MS = 30000
  const STILL_LOOKING_LIMIT = 3
  const searchTimes = useRef([])

  useEffect(() => {
    const query = search.trim()
    if (!query) return undefined

    const timeout = setTimeout(() => {
      const now = Date.now()
      searchTimes.current = [...searchTimes.current, now]
        .filter((t) => now - t < STILL_LOOKING_WINDOW_MS)

      if (searchTimes.current.length >= STILL_LOOKING_LIMIT) {
        searchTimes.current = []
        fireQuip({ kind: 'moment', id: 'still-looking' })
        return
      }
      if (displayItems.length === 0) fireQuip({ kind: 'moment', id: 'no-results' })
    }, SEARCH_SETTLE_MS)

    return () => clearTimeout(timeout)
    // displayItems is deliberately not a dependency: it changes as the list
    // filters down mid-query, which would restart the timer on every keystroke
    // and mean the settle never elapses. The timer only needs the value it
    // finds when it fires, and `search` changing is what should restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const crumbs = [{ key: 'home', label: 'Home', to: () => navigate('/home') }]
  crumbs.push({ key: 'root', label: 'Subjects', to: () => navigate(`/notes-browser/${courseId}`) })
  if (moduleId && activeModule) {
    crumbs.push({ key: 'module', label: activeModule.label, to: () => navigate(`/notes-browser/${courseId}/${moduleId}`) })
  }
  if (activeSubfolder) crumbs.push({ key: 'folder', label: activeSubfolder })

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const sortArrow = (key) => (sort.key !== key ? null : (sort.dir === 'asc' ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />))

  const notFound = Boolean(moduleId) && !loading && !activeModule

  // Unknown or hidden course: refuse the whole page rather than render an
  // empty Subjects list, which would imply the course exists but is bare.
  if (course === null) {
    return (
      <PageShell variant="content">
        <BackButton onClick={() => navigate('/home')} />
        <div className={styles.emptyState}>This course doesn&apos;t exist.</div>
      </PageShell>
    )
  }

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
              onFocus={() => fireQuip({ kind: 'chrome', id: 'search' })}
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
