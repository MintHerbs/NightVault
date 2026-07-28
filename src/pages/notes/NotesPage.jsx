import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NoteReader from '../../components/markdown/NoteReader'
import Loading from '../../components/ui/Loading'
import { deriveSubfolder, getNoteAuthors } from '../../lib/notesApi'
import { loadNote } from '../../lib/noteCache'
import { listModulesCached } from '../../lib/modulesApi'

/** "getting-started" / "notes/img-push" → "Getting Started" (last segment, humanised). */
function humaniseFilename(subpath) {
  const leaf = String(subpath || '').split('/').filter(Boolean).pop() || ''
  return leaf
    .replace(/\.md$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Registry label for a module id, else a title-cased fallback of the id. */
function moduleLabel(section, modules) {
  const found = modules.find((m) => m.id === section)
  if (found?.label) return found.label
  return String(section || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function NotesPage() {
  const { section } = useParams()
  const subpath = useParams()['*']
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('idle')
  const [modules, setModules] = useState([])
  const [authors, setAuthors] = useState([])

  const noteKey = useMemo(() => {
    if (!section || !subpath) return null
    return `${section}::${subpath}`
  }, [section, subpath])

  const eyebrow = useMemo(() => {
    if (!section) return ''
    const file = humaniseFilename(subpath)
    return file ? `${moduleLabel(section, modules)} · ${file}` : moduleLabel(section, modules)
  }, [section, subpath, modules])

  const handleBack = () => {
    // Deterministic, not history-based (T-049) — a note reached by direct
    // link or a shared URL has no "back" to fall through to, so back always
    // returns to the read-only browser at this note's own folder, or to the
    // Subject itself when the note sits at the root (T-053).
    const folder = deriveSubfolder(subpath)
    navigate(folder
      ? `/notes-browser/${section}/${encodeURIComponent(folder)}`
      : `/notes-browser/${section}`)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!section || !subpath) return

      setStatus('loading')
      setAuthors([])
      try {
        // One request for the Subject list (cached across notes — it also
        // supplies the breadcrumb label below, and carries the `hidden` flag
        // the visibility gate used to fetch separately) and one for the note,
        // served instantly from noteCache when the listing prefetched it.
        const [{ note }, allModules] = await Promise.all([
          loadNote(section, subpath),
          listModulesCached(),
        ])
        if (cancelled) return
        setModules(allModules)
        // A hidden note, or a note under a hidden Subject (T-045 phase C), is
        // treated as absent for public visitors — including by direct URL,
        // not just from the listing.
        const subjectHidden = !!allModules.find((m) => m.id === section)?.hidden
        if (!note || note.hidden || subjectHidden) {
          setStatus('not_found')
          setContent('')
          return
        }
        setContent(note.contentMd)
        setStatus('loaded')
        // Fired off rather than awaited: the reader shouldn't wait on a second
        // round trip just to show the byline. getNoteAuthors() never rejects.
        getNoteAuthors(note.id).then((a) => { if (!cancelled) setAuthors(a) })
      } catch {
        if (cancelled) return
        setStatus('error')
        setContent('')
      }
    }

    load()
    return () => { cancelled = true }
  }, [noteKey])

  if (status === 'loaded') {
    return <NoteReader content={content} eyebrow={eyebrow} authors={authors} onBack={handleBack} />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '80px 24px' }}>
      {status === 'loading' && <Loading />}
      {status === 'not_found' && (
        <div style={{ color: '#ff6b6b', fontSize: '18px' }}>Note not found.</div>
      )}
      {status === 'error' && (
        <div style={{ color: '#ff6b6b', fontSize: '18px' }}>Failed to load note.</div>
      )}
    </div>
  )
}

export default NotesPage
