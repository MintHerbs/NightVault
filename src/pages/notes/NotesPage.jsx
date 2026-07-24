import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import NoteReader from '../../components/markdown/NoteReader'
import { MODULE_TOOLS } from '../../components/layout/Sidebar/modules.js'
import { getNote } from '../../lib/notesApi'
import { listModules, isModuleHidden } from '../../lib/modulesApi'

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
  const location = useLocation()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('idle')
  const [modules, setModules] = useState([])

  useEffect(() => {
    let cancelled = false
    listModules().then((m) => { if (!cancelled) setModules(m) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

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
    // Go back when there's in-app history; otherwise land on the module so a
    // deep-linked note never strands the reader.
    if (location.key !== 'default') {
      navigate(-1)
      return
    }
    navigate(MODULE_TOOLS[section]?.[0]?.route ?? '/home')
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!section || !subpath) return

      setStatus('loading')
      try {
        const [note, subjectHidden] = await Promise.all([
          getNote(section, subpath),
          isModuleHidden(section),
        ])
        if (cancelled) return
        // A hidden note, or a note under a hidden Subject (T-045 phase C), is
        // treated as absent for public visitors — including by direct URL,
        // not just from the listing.
        if (!note || note.hidden || subjectHidden) {
          setStatus('not_found')
          setContent('')
          return
        }
        setContent(note.contentMd)
        setStatus('loaded')
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
    return <NoteReader content={content} eyebrow={eyebrow} onBack={handleBack} />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '80px 24px' }}>
      {status === 'loading' && (
        <div style={{ color: '#E8E0D5', fontSize: '18px' }}>Loading...</div>
      )}
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
