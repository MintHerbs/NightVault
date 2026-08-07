// Dev-only harness for reading the Database Systems notes exactly as the
// reader renders them, without needing the app shell, a session, or the
// database. Served by preview-anim.html.
//
// The notes themselves come from preview-notes/, a local dump of the `notes`
// table that is deliberately NOT committed: the database is the source of
// truth for note content, and a second copy in the repo would rot.
import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownRenderer from './components/markdown/MarkdownRenderer'
import './styles/global.css'

const files = import.meta.glob('/preview-notes/*.md', { query: '?raw', import: 'default', eager: true })
const originals = import.meta.glob('/preview-notes-original/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** "Semester_1_lecture-10_Normalisation.md" -> { semester, order, title } */
function describe(path) {
  const base = path.split('/').pop().replace(/\.md$/, '')
  const semester = base.startsWith('Semester_2') ? 2 : 1
  const rest = base.replace(/^Semester_\d_/, '').replace(/_/g, ' ')
  const lecture = Number((rest.match(/lecture-?\s*(\d+)/i) || [])[1] ?? 99)
  return { semester, lecture, title: rest, path }
}

const NOTES = Object.entries(files)
  .map(([path, content]) => ({
    ...describe(path),
    content,
    original: originals[path.replace('/preview-notes/', '/preview-notes-original/')] ?? null,
  }))
  .sort((a, b) => a.semester - b.semester || a.lecture - b.lecture || a.title.localeCompare(b.title))

// A scratch page for figures and consoles that are built but not yet wired into
// a note, so they can be checked before they are placed.
const WORKBENCH = {
  semester: 0,
  lecture: 0,
  title: 'Workbench (new embeds)',
  content: `# Workbench

Figures and consoles that exist in the registries but are not yet placed in a note.

## The schema figure

::anim{id="db-dreamhome-schema"}

## Normalising CARE

::anim{id="db-normalisation-care"}

## Building Branch and Staff

::sqlrun{id="ddl-build-branch-staff"}

## INSERT, UPDATE, DELETE

::sqlrun{id="dml-insert-update-delete"}

## Grouping, joins and subqueries

::sqlrun{id="dml-grouping-and-joins"}

## Views

::sqlrun{id="views-and-privileges"}
`,
}

const ALL = [WORKBENCH, ...NOTES]

function Preview() {
  const [active, setActive] = useState(0)
  const [showOriginal, setShowOriginal] = useState(false)
  const note = ALL[active]
  const augmented = note.original != null && note.original !== note.content
  const body = showOriginal && augmented ? note.original : note.content
  const grouped = useMemo(() => {
    const out = new Map()
    ALL.forEach((n, i) => {
      const key = n.semester === 0 ? 'Workbench' : `Semester ${n.semester}`
      if (!out.has(key)) out.set(key, [])
      out.get(key).push({ ...n, index: i })
    })
    return [...out.entries()]
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'flex-start' }}>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          flex: '0 0 268px',
          maxHeight: '100vh',
          overflowY: 'auto',
          padding: '1.25rem 0.75rem',
          borderRight: '1px solid rgba(var(--color-fg-rgb), 0.12)',
          fontSize: '0.82rem',
        }}
      >
        {grouped.map(([group, items]) => (
          <div key={group} style={{ marginBottom: '1rem' }}>
            <p
              style={{
                margin: '0 0 0.35rem 0.5rem',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted)',
                fontWeight: 700,
              }}
            >
              {group}
            </p>
            {items.map((n) => (
              <button
                key={n.index}
                type="button"
                onClick={() => setActive(n.index)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.35rem 0.5rem',
                  marginBottom: '0.1rem',
                  border: 0,
                  borderRadius: '0.35rem',
                  cursor: 'pointer',
                  lineHeight: 1.35,
                  background: n.index === active ? 'rgba(var(--color-accent-rgb), 0.16)' : 'transparent',
                  color: n.index === active ? 'var(--color-accent)' : 'var(--color-text)',
                  fontWeight: n.index === active ? 600 : 400,
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                {n.title}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 760, padding: '2rem 1.25rem 6rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              margin: '0 0 1rem',
              fontSize: '0.72rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <span>{body.length.toLocaleString()} characters</span>
            {augmented ? (
              <>
                <span style={{ color: 'var(--color-accent)' }}>
                  augmented +{(note.content.length - note.original.length).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => setShowOriginal((v) => !v)}
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.35rem',
                    border: '1px solid rgba(var(--color-fg-rgb), 0.2)',
                    background: showOriginal ? 'var(--color-accent)' : 'transparent',
                    color: showOriginal ? 'var(--color-bg)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  {showOriginal ? "showing Noorie's original" : "show Noorie's original"}
                </button>
              </>
            ) : (
              <span style={{ opacity: 0.6 }}>unchanged</span>
            )}
          </div>
          <MarkdownRenderer content={body} />
        </div>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Preview />)
