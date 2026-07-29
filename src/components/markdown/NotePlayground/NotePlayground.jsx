import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PLAYGROUND_ID_RE } from '../../../constants/notePlaygrounds'
import styles from './NotePlayground.module.css'

/**
 * An editable, live-running web page embedded in a note (T-075).
 *
 * Reached from note Markdown as `::playground{id="ch02-target"}`. The id is
 * resolved against the code-defined registry in src/content/playgrounds — note
 * content can only *name* a playground, never supply its source, which is what
 * lets this exist without giving up the reader's no-raw-HTML guarantee.
 *
 * Two modes. It mounts running but read-only, so a reader scrolling past pays
 * only for an iframe. "Edit code" reveals the source panes, and only then is
 * Monaco fetched — the editor is ~2 MB of JS that a reader who never edits
 * should not download. Same on-demand pattern as the reader's KaTeX chunk.
 *
 * The frame is sandboxed WITHOUT allow-same-origin, so an edited playground
 * runs on an opaque origin: it cannot reach this page's DOM, its storage, or the
 * Supabase session. That is deliberate and is what makes an editable pane safe
 * to hand a visitor. allow-forms and allow-popups are granted because the
 * documents contain real forms and `target="_blank"` links, which are part of
 * what they teach.
 */
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox'

/** Debounce on keystrokes before the frame reloads, in ms. */
const RERENDER_DELAY = 500

const TAB_LABEL = { html: 'HTML', css: 'CSS', js: 'JS' }
const MONACO_LANGUAGE = { html: 'html', css: 'css', js: 'javascript' }

/** The playground registry, fetched once per session. Held here rather than
 *  imported statically so the ~25 KB of embedded playground documents is paid
 *  for only by a note that actually embeds one — the same on-demand shape the
 *  reader uses for KaTeX. */
let registryModule = null
let registryPromise = null

function loadRegistry() {
  if (registryModule) return Promise.resolve(registryModule)
  if (!registryPromise) {
    registryPromise = import('../../../content/playgrounds')
      .then((mod) => {
        registryModule = mod
        return registryModule
      })
      .catch((err) => {
        registryPromise = null
        throw err
      })
  }
  return registryPromise
}

/** Monaco, fetched once per session and shared across playgrounds. */
let monacoModule = null
let monacoPromise = null

function loadMonaco() {
  if (monacoModule) return Promise.resolve(monacoModule)
  if (!monacoPromise) {
    monacoPromise = import('@monaco-editor/react')
      .then((mod) => {
        monacoModule = mod.default
        return monacoModule
      })
      .catch((err) => {
        // Never cache a rejection: one flaky chunk fetch would otherwise
        // permanently disable editing for the rest of the session.
        monacoPromise = null
        throw err
      })
  }
  return monacoPromise
}

export default function NotePlayground({ playgroundId }) {
  const [registry, setRegistry] = useState(() => registryModule)
  const [activeTab, setActiveTab] = useState('html')
  const [editing, setEditing] = useState(false)
  const [Monaco, setMonaco] = useState(() => monacoModule)
  const [monacoFailed, setMonacoFailed] = useState(false)
  const [runtimeError, setRuntimeError] = useState('')
  const frameRef = useRef(null)

  useEffect(() => {
    if (registry) return
    let cancelled = false
    // A failed fetch leaves `registry` null, which renders nothing — the same
    // outcome as an unknown id, and better than a broken frame.
    loadRegistry().then((mod) => { if (!cancelled) setRegistry(mod) }, () => {})
    return () => { cancelled = true }
  }, [registry])

  const playground = useMemo(() => {
    if (!registry || !PLAYGROUND_ID_RE.test(String(playgroundId ?? ''))) return null
    return registry.getPlayground(playgroundId)
  }, [registry, playgroundId])

  // Editable copy of the registry's files. Keyed off the playground so
  // navigating between notes never carries one document's edits into another.
  const [files, setFiles] = useState({})

  const tabs = useMemo(
    () => ['html', 'css', 'js'].filter((key) => typeof playground?.files?.[key] === 'string'),
    [playground],
  )

  // The frame reloads from scratch on every committed change (a srcdoc swap is
  // a navigation), which is what makes a broken edit recoverable: there is no
  // accumulated state to corrupt. Debounced so a burst of typing costs one
  // reload rather than one per character.
  const [committed, setCommitted] = useState({})

  useEffect(() => {
    const fresh = { ...(playground?.files ?? {}) }
    setFiles(fresh)
    // Committed too, not just `files` — leaving it to the debounce below would
    // keep the *previous* playground on screen for RERENDER_DELAY after
    // navigating between two notes that both embed one.
    setCommitted(fresh)
    setActiveTab('html')
    setEditing(false)
    setRuntimeError('')
  }, [playground])

  useEffect(() => {
    const timer = setTimeout(() => setCommitted(files), RERENDER_DELAY)
    return () => clearTimeout(timer)
  }, [files])

  const baseHref = useMemo(
    () => (typeof window === 'undefined' ? '' : `${window.location.origin}/playgrounds/`),
    [],
  )

  const srcDoc = useMemo(() => {
    if (!registry || !playground) return ''
    return registry.buildPlaygroundDoc({ ...committed, jquery: playground.jquery }, baseHref)
  }, [registry, playground, committed, baseHref])

  // A fresh document means whatever error the last one reported is stale.
  useEffect(() => { setRuntimeError('') }, [srcDoc])

  // Errors are relayed by the in-document bridge (see buildPlaygroundDoc).
  // `event.source` is checked against this frame specifically: any page can
  // postMessage here, so an unverified listener would let an unrelated frame
  // put arbitrary text in this component's error strip.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow) return
      if (!registry || event.data?.tag !== registry.PLAYGROUND_ERROR_MESSAGE) return
      setRuntimeError(String(event.data.message ?? '').slice(0, 300))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [registry])

  const startEditing = useCallback(() => {
    setEditing(true)
    if (Monaco || monacoFailed) return
    loadMonaco().then(
      (mod) => setMonaco(() => mod),
      () => setMonacoFailed(true),
    )
  }, [Monaco, monacoFailed])

  const reset = useCallback(() => {
    setFiles({ ...(playground?.files ?? {}) })
    setRuntimeError('')
  }, [playground])

  const isDirty = useMemo(
    () => tabs.some((key) => files[key] !== playground?.files?.[key]),
    [tabs, files, playground],
  )

  // Nothing to show while the registry chunk is in flight, and nothing to show
  // for an id that isn't in it — the same degradation as an unrecognised
  // directive elsewhere in the reader, rather than an error box.
  if (!playground) return null

  return (
    <div
      className={editing ? `${styles.block} ${styles.blockEditing}` : styles.block}
      contentEditable={false}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.dots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
          <span className={styles.kind}>Playground</span>
          {playground.label && <span className={styles.label}>{playground.label}</span>}
        </div>

        <div className={styles.actions}>
          {isDirty && (
            <button type="button" className={styles.action} onClick={reset}>
              Reset
            </button>
          )}
          <button
            type="button"
            className={styles.action}
            onClick={() => (editing ? setEditing(false) : startEditing())}
            aria-expanded={editing}
          >
            {editing ? 'Hide code' : 'Edit code'}
          </button>
        </div>
      </div>

      <div className={editing ? styles.bodySplit : styles.body}>
        {editing && (
          <div className={styles.editorPane}>
            <div className={styles.tabs} role="tablist">
              {tabs.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  className={activeTab === key ? styles.tabActive : styles.tab}
                  onClick={() => setActiveTab(key)}
                >
                  {TAB_LABEL[key]}
                </button>
              ))}
            </div>

            <div className={styles.editorHost}>
              {Monaco ? (
                <Monaco
                  language={MONACO_LANGUAGE[activeTab]}
                  value={files[activeTab] ?? ''}
                  onChange={(value) => setFiles((prev) => ({ ...prev, [activeTab]: value ?? '' }))}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    lineHeight: 20,
                    fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                    wordWrap: 'on',
                    padding: { top: 10, bottom: 10 },
                    renderLineHighlight: 'none',
                    overviewRulerLanes: 0,
                    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                  }}
                />
              ) : (
                // No Monaco (still fetching, or the chunk failed): a plain
                // textarea still edits the same state and still re-renders the
                // preview, so the playground never becomes uneditable.
                <textarea
                  className={styles.fallbackEditor}
                  value={files[activeTab] ?? ''}
                  spellCheck={false}
                  aria-label={`${TAB_LABEL[activeTab]} source`}
                  onChange={(e) => setFiles((prev) => ({ ...prev, [activeTab]: e.target.value }))}
                />
              )}
            </div>
          </div>
        )}

        <div className={styles.previewPane}>
          <iframe
            ref={frameRef}
            className={styles.frame}
            // Handed to CSS as a custom property rather than as a height, so
            // the stylesheet decides when the registry's own height applies and
            // when the frame should instead fill the taller side-by-side row.
            // As an inline `height` it could not be overridden by the stacked
            // media query, which collapsed the preview to ~150px there.
            style={{ '--playground-height': `${playground.height ?? 400}px` }}
            srcDoc={srcDoc}
            sandbox={SANDBOX}
            title={playground.label || 'Playground'}
            loading="lazy"
          />
          {runtimeError && (
            <div className={styles.error} role="status">
              {runtimeError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
