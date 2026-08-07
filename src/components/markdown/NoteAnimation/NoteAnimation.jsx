import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ANIMATION_ID_RE } from '../../../constants/noteAnimations'
import styles from './NoteAnimation.module.css'

/**
 * A stepped, playable figure embedded in a note.
 *
 * Reached from note Markdown as `::anim{id="db-erd-build"}`. The id is resolved
 * against the code-defined registry in src/content/animations — note content
 * supplies no markup of its own, so this adds a playable figure to the reader
 * without weakening the no-raw-HTML rule in MarkdownRenderer.
 *
 * It plays on its own by default, which is what a reader skimming wants. The
 * transport ( ‹ ⏸ › ) sits underneath at low contrast and comes up to full on
 * hover or keyboard focus, so it is there for the student who wants to stop on
 * one frame and read it without being the loudest thing on the page. Touching
 * ‹ or › pauses, because someone stepping by hand does not want the timer
 * yanking the frame away mid-sentence.
 *
 * Frames are groups inside ONE inline SVG rather than one SVG per frame: the
 * document is parsed once and stepping is a class flip, so scrubbing back and
 * forth costs nothing and CSS can cross-fade between frames.
 *
 * The registry is fetched on demand — it carries the SVG source for every
 * animation on the site, which a reader on a note with no animation should not
 * download. Same pattern as the reader's KaTeX and Monaco chunks.
 */

/** The animation registry, fetched once per session. */
let registryModule = null
let registryPromise = null

function loadRegistry() {
  if (registryModule) return Promise.resolve(registryModule)
  if (!registryPromise) {
    registryPromise = import('../../../content/animations').then((mod) => {
      registryModule = mod
      return mod
    })
  }
  return registryPromise
}

/** Matches the reader's own reduced-motion handling: no timer, land on the end. */
function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function NoteAnimation({ animationId }) {
  const [entry, setEntry] = useState(null)
  const [resolved, setResolved] = useState(false)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(true)
  const stageRef = useRef(null)

  useEffect(() => {
    if (!ANIMATION_ID_RE.test(String(animationId ?? ''))) {
      setResolved(true)
      return undefined
    }
    let live = true
    loadRegistry()
      .then((mod) => {
        if (!live) return
        const found = mod.getAnimation(animationId)
        setEntry(found ? { ...found, holdMs: mod.HOLD_MS } : null)
        // Reduced motion gets the finished figure, held still, rather than a
        // frame-1 fragment that never resolves into anything.
        if (found && prefersReducedMotion()) {
          setFrame(found.frames.length - 1)
          setPlaying(false)
        }
        setResolved(true)
      })
      .catch(() => {
        if (live) setResolved(true)
      })
    return () => {
      live = false
    }
  }, [animationId])

  const count = entry?.frames?.length ?? 0

  // Playback. Each frame may set its own hold, so a step with a lot to read can
  // sit longer than one that just moves a pointer.
  useEffect(() => {
    if (!playing || count < 2) return undefined
    const hold = entry.frames[frame]?.hold ?? entry.holdMs
    const timer = setTimeout(() => setFrame((f) => (f + 1) % count), hold)
    return () => clearTimeout(timer)
  }, [playing, frame, count, entry])

  // Frames live in the DOM as sibling groups; showing one is a class flip
  // rather than a re-parse of the SVG.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const build = entry?.mode === 'build'
    for (const node of stage.querySelectorAll('[data-fr]')) {
      const i = Number(node.getAttribute('data-fr'))
      const on = build ? i <= frame : i === frame
      node.classList.toggle(styles.frameOn, on)
      node.classList.toggle(styles.frameOff, !on)
    }
  }, [frame, entry])

  const step = useCallback(
    (delta) => {
      setPlaying(false)
      setFrame((f) => (f + delta + count) % count)
    },
    [count]
  )

  const markup = useMemo(() => {
    if (!entry) return ''
    const frames = entry.frames
      .map((f, i) => `<g data-fr="${i}" class="${styles.frameOff}">${f.svg}</g>`)
      .join('')
    return `${entry.defs ?? ''}${frames}`
  }, [entry])

  if (!resolved || !entry) return null

  const caption = entry.frames[frame]?.caption ?? ''

  return (
    <div className={styles.wrapper} contentEditable={false}>
      <div
        className={styles.stage}
        ref={stageRef}
        role="img"
        aria-label={`${entry.alt}. Step ${frame + 1} of ${count}: ${caption}`}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${entry.width} ${entry.height}`}
          xmlns="http://www.w3.org/2000/svg"
          // Registry-authored SVG, never note content — see the header comment.
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      </div>

      {caption ? (
        <p className={styles.caption} aria-hidden="true">
          {caption}
        </p>
      ) : null}

      {count > 1 ? (
        <div className={styles.transport}>
          <button
            type="button"
            className={styles.button}
            onClick={() => step(-1)}
            aria-label="Previous step"
            title="Previous step"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.button}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause animation' : 'Play animation'}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className={styles.button}
            onClick={() => step(1)}
            aria-label="Next step"
            title="Next step"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M8.6 7.4 10 6l6 6-6 6-1.4-1.4 4.6-4.6z" />
            </svg>
          </button>

          <span className={styles.count} aria-hidden="true">
            {frame + 1} / {count}
          </span>

          <span className={styles.ticks} aria-hidden="true">
            {entry.frames.map((f, i) => (
              <button
                type="button"
                key={f.caption || i}
                className={i === frame ? `${styles.tick} ${styles.tickOn}` : styles.tick}
                onClick={() => {
                  setPlaying(false)
                  setFrame(i)
                }}
                tabIndex={-1}
                aria-hidden="true"
              />
            ))}
          </span>
        </div>
      ) : null}
    </div>
  )
}
