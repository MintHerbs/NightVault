import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import { visit } from 'unist-util-visit'
import CodeBlock from '../social/CodeBlock/CodeBlock'
import NotePlayground from './NotePlayground'
import NoteAnimation from './NoteAnimation'
import NoteSqlConsole from './NoteSqlConsole'
import MoleculeStructure from './MoleculeStructure/MoleculeStructure'
import ReactionScheme from './ReactionScheme/ReactionScheme'
import { PLAYGROUND_ID_RE } from '../../constants/notePlaygrounds'
import { ANIMATION_ID_RE } from '../../constants/noteAnimations'
import { SQL_SCRIPT_ID_RE } from '../../constants/noteSql'
import { isValidSmiles, isValidLabel, parseReactionBlock } from '../../lib/chem/noteChem'
import RichTooltip, { YouTubeIcon, InstagramIcon, LinkedInIcon } from '../ui/smoothui/rich-popover/index.tsx'
import { resolveNoteImageSrc, noteImageFallbackSrc } from '../../lib/noteImageSrc'
import { parseImageTitle } from '../../lib/noteImageWidth'
import { HEX_COLOR_RE } from '../../constants/noteColors'
import { normalizeNoteMath, noteHasMath, MATH_DELIMITED_RE } from '../../lib/noteMath'
import { remarkNoteDirectiveFallback } from '../../lib/noteDirectives'
import { YOUTUBE_ID_RE, youtubeThumbnailSrc, youtubeEmbedSrc } from '../../lib/youtube'
import styles from './MarkdownRenderer.module.css'

// Maps the note-editor's directive syntax (`:color[...]{hex="..."}`,
// `:mark[...]{hex="..."}`, `::youtube{id="..."}` — see
// NoteEditor.jsx's colorMarkSchema/highlightMarkSchema/youtubeSchema, T-055)
// to real hast elements via `data.hName`/`data.hProperties`. This keeps
// everything inside the safe mdast/hast pipeline — no rehype-raw, no raw
// HTML string ever reaches the DOM from note content. `hex`/`id` are
// re-validated here independently of the editor's own validation, since
// stored Markdown can also arrive via a GitHub backup restore. An invalid
// value is left as an unrecognised directive node (renders as plain
// children/nothing) rather than passed through unchecked.
//
// Only the five names below ever reach here: remarkNoteDirectiveFallback runs
// first and has already rewritten every other directive back to the literal
// text it was written as, which is what stops a stray `09:30` in prose from
// being parsed as `:30` and dropped (T-107).
function remarkNoteDirectives() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'textDirective' && node.type !== 'leafDirective') return
      const data = node.data || (node.data = {})
      const attrs = node.attributes || {}

      if (node.type === 'textDirective' && node.name === 'color') {
        const hex = attrs.hex || ''
        if (!HEX_COLOR_RE.test(hex)) return
        data.hName = 'span'
        data.hProperties = { style: `color: ${hex}` }
        return
      }
      if (node.type === 'textDirective' && node.name === 'mark') {
        const hex = attrs.hex || ''
        if (!HEX_COLOR_RE.test(hex)) return
        data.hName = 'span'
        data.hProperties = { style: `background-color: ${hex}` }
        return
      }
      if (node.type === 'leafDirective' && node.name === 'youtube') {
        const id = attrs.id || ''
        if (!YOUTUBE_ID_RE.test(id)) return
        data.hName = 'youtube-embed'
        data.hProperties = { videoId: id }
        return
      }
      // `::playground{id="ch02-target"}` (T-075). The id names an entry in the
      // code-defined registry under src/content/playgrounds — note content
      // supplies no markup of its own, so this adds a live editable document to
      // the reader without weakening the no-raw-HTML rule above. Validated for
      // shape here and resolved (or dropped) in NotePlayground.
      if (node.type === 'leafDirective' && node.name === 'playground') {
        const id = attrs.id || ''
        if (!PLAYGROUND_ID_RE.test(id)) return
        data.hName = 'note-playground'
        data.hProperties = { playgroundId: id }
        return
      }
      // `::molecule{smiles="..." label="..."}` (T-093). SMILES is re-validated
      // here independently of the editor's own validation — stored Markdown
      // can also arrive via a GitHub backup restore — same double-validation
      // discipline as HEX_COLOR_RE above. An invalid smiles/label drops the
      // directive entirely (renders as nothing), matching how an invalid
      // hex/id already degrades for :color/:mark/::youtube.
      // `::anim{id="db-norm-flatten"}` and `::sqlrun{id="ddl-create-staff"}`.
      // Both follow the ::playground rule above exactly: the id names an entry
      // in a code-defined registry (src/content/animations, src/content/sql),
      // so note content can only ever *choose* a figure or a script, never
      // supply SVG or SQL of its own. Unknown or malformed ids render nothing.
      if (node.type === 'leafDirective' && node.name === 'anim') {
        const id = attrs.id || ''
        if (!ANIMATION_ID_RE.test(id)) return
        data.hName = 'note-animation'
        data.hProperties = { animationId: id }
        return
      }
      if (node.type === 'leafDirective' && node.name === 'sqlrun') {
        const id = attrs.id || ''
        if (!SQL_SCRIPT_ID_RE.test(id)) return
        data.hName = 'note-sql-console'
        data.hProperties = { scriptId: id }
        return
      }
      if (node.type === 'leafDirective' && node.name === 'molecule') {
        const smiles = attrs.smiles || ''
        const label = attrs.label || ''
        if (!isValidSmiles(smiles) || !isValidLabel(label)) return
        data.hName = 'note-molecule'
        data.hProperties = { smiles, label }
      }
    })
  }
}

function YouTubeEmbed({ videoId }) {
  const [playing, setPlaying] = useState(false)

  if (!YOUTUBE_ID_RE.test(videoId || '')) return null

  return (
    <div className={styles.videoWrapper} contentEditable={false}>
      {playing ? (
        <iframe
          className={styles.videoFrame}
          src={youtubeEmbedSrc(videoId)}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          frameBorder="0"
          title="YouTube video"
        />
      ) : (
        <button
          type="button"
          className={styles.videoThumbButton}
          onClick={() => setPlaying(true)}
          aria-label="Play video"
        >
          <img className={styles.videoThumb} src={youtubeThumbnailSrc(videoId)} alt="" loading="lazy" />
          <span className={styles.videoPlayIcon}>
            <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
      )}
    </div>
  )
}

// Milkdown serialises blank-line spacing as literal `<br />` HTML. react-markdown
// renders raw HTML as text (there is deliberately no rehype-raw, since arbitrary HTML
// from contributor-authored notes would be an XSS surface), so those tags would
// otherwise show as the characters "<br />". This remark plugin converts ONLY a
// standalone <br> HTML node into a real hard-break, leaving every other raw HTML
// node untouched (still inert, still rendered as text). See T-050.
function remarkBrToBreak() {
  const BR = /^<\s*\/?\s*br\s*\/?\s*>$/i
  const walk = (node) => {
    if (!node || !Array.isArray(node.children)) return
    for (const child of node.children) walk(child)
    node.children = node.children.map((child) =>
      child.type === 'html' && BR.test((child.value || '').trim())
        ? { type: 'break' }
        : child
    )
  }
  return (tree) => walk(tree)
}

function parseRichPopoverProps(attrString) {
  const props = {}
  const attrRegex = /(\w+)="((?:[^"\\]|\\.)*)"/g
  let match
  while ((match = attrRegex.exec(attrString)) !== null) {
    props[match[1]] = match[2].replace(/\\"/g, '"')
  }
  return props
}

function getPlatformTriggerIcon(platform) {
  switch (platform) {
    case 'youtube': return <YouTubeIcon className="h-3.5 w-3.5 fill-red-600" />
    case 'instagram': return <InstagramIcon className="h-3.5 w-3.5" />
    case 'linkedin': return <LinkedInIcon className="h-3.5 w-3.5 fill-[#0A66C2]" />
    default: return null
  }
}

function RichPopoverChip({ platform, title, href, description, meta, actionLabel }) {
  const triggerIcon = getPlatformTriggerIcon(platform)

  const trigger = (
    <button className={styles.richPopoverTrigger} type="button">
      {triggerIcon}
      <span>{title}</span>
    </button>
  )

  return (
    <RichTooltip
      trigger={trigger}
      platform={platform}
      title={title}
      href={href}
      description={description}
      meta={meta}
      actionLabel={actionLabel}
      actionHref={href}
      side="top"
      align="center"
    />
  )
}

function splitContentByRichPopovers(content) {
  const parts = []
  // Matches <RichPopover ... /> potentially spanning multiple lines
  const regex = /<RichPopover([\s\S]*?)\/>/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'markdown', content: content.slice(lastIndex, match.index) })
    }
    const props = parseRichPopoverProps(match[1])
    parts.push({ type: 'richpopover', props })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'markdown', content: content.slice(lastIndex) })
  }

  return parts
}

const markdownComponents = {
  code({ node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const language = match ? match[1] : ''
    const codeString = String(children).replace(/\n$/, '')
    const isBlock = Boolean(match) || codeString.includes('\n')
    // Anything after the language on the fence line is the block's source
    // label: ```python recruitment/models.py. mdast-util-to-hast preserves it
    // on the code element as `data.meta` (it is dropped from `className`,
    // which only ever carries the first word), so this is the only place it
    // can be read from.
    const title = typeof node?.data?.meta === 'string' ? node.data.meta.trim() : ''

    // ```reaction — a fenced JSON payload (T-092), not a code sample. A
    // malformed block (bad JSON, oversized payload, over a step/item cap)
    // falls through to the ordinary CodeBlock rendering below rather than
    // throwing — the raw block stays visible as code, same degradation as an
    // invalid `::molecule`.
    if (language === 'reaction') {
      const parsed = parseReactionBlock(codeString)
      if (parsed.ok) return <ReactionScheme data={{ steps: parsed.steps }} />
    }

    return isBlock ? (
      <CodeBlock code={codeString} language={language || 'auto'} title={title || undefined} />
    ) : (
      <code className={styles.inlineCode} {...props}>
        {children}
      </code>
    )
  },
  table({ children }) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>{children}</table>
      </div>
    )
  },
  thead({ children }) {
    return <thead className={styles.thead}>{children}</thead>
  },
  tbody({ children }) {
    return <tbody className={styles.tbody}>{children}</tbody>
  },
  tr({ children }) {
    return <tr className={styles.tr}>{children}</tr>
  },
  th({ children }) {
    return <th className={styles.th}>{children}</th>
  },
  td({ children }) {
    return <td className={styles.td}>{children}</td>
  },
  h1({ children }) {
    return <h1 className={styles.h1}>{children}</h1>
  },
  h2({ children }) {
    return <h2 className={styles.h2}>{children}</h2>
  },
  h3({ children }) {
    return <h3 className={styles.h3}>{children}</h3>
  },
  blockquote({ children }) {
    return <blockquote className={styles.blockquote}>{children}</blockquote>
  },
  hr() {
    return <hr className={styles.hr} />
  },
  p({ children }) {
    return <p className={styles.paragraph}>{children}</p>
  },
  ul({ children }) {
    return <ul className={styles.ul}>{children}</ul>
  },
  ol({ children }) {
    return <ol className={styles.ol}>{children}</ol>
  },
  li({ children }) {
    return <li className={styles.li}>{children}</li>
  },
  'youtube-embed': function YouTubeEmbedComponent({ videoId }) {
    return <YouTubeEmbed videoId={videoId} />
  },
  'note-playground': function NotePlaygroundComponent({ playgroundId }) {
    return <NotePlayground playgroundId={playgroundId} />
  },
  'note-molecule': function NoteMoleculeComponent({ smiles, label }) {
    return <MoleculeStructure smiles={smiles} label={label} />
  },
  'note-animation': function NoteAnimationComponent({ animationId }) {
    return <NoteAnimation animationId={animationId} />
  },
  'note-sql-console': function NoteSqlConsoleComponent({ scriptId }) {
    return <NoteSqlConsole scriptId={scriptId} />
  },
  img({ src, alt, title }) {
    // The image title carries the width chosen in the editor (`w=<px>`), so the
    // reader shows the same size the author saw. See lib/noteImageWidth.js.
    const { title: caption, width } = parseImageTitle(title)
    return (
      <img
        className={styles.image}
        src={resolveNoteImageSrc(src)}
        alt={alt || ''}
        title={caption || undefined}
        style={width ? { width: `${width}px` } : undefined}
        loading="lazy"
        onError={(e) => {
          const fallback = noteImageFallbackSrc(src)
          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback
        }}
      />
    )
  },
}

// KaTeX is by far the heaviest thing the reader pulls in — ~258 KB of JS plus
// a 29 KB stylesheet and its web fonts — and most notes contain no maths at
// all. So it's loaded on demand, keyed off the content, instead of being a
// static import every note pays for.
//
// Whether a note needs it is `noteHasMath` (lib/noteMath.js), which tests the
// *normalised* content, so a note whose formulas are bare LaTeX still pulls
// KaTeX in. That test is deliberately loose: a false positive costs the
// download we used to make unconditionally, while a false negative would show
// unformatted TeX.

/** The rehype-katex plugin once loaded, shared across every renderer instance
 * so only the first maths note in a session pays for the chunk. */
let katexModule = null
let katexPromise = null

function loadKatex() {
  if (katexModule) return Promise.resolve(katexModule)
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('rehype-katex'),
      import('katex/dist/katex.min.css'),
    ])
      .then(([mod]) => {
        katexModule = mod.default
        return katexModule
      })
      .catch((err) => {
        // Do NOT keep a rejected promise here: one transient chunk fetch
        // failure (flaky network, or a stale chunk hash after a redeploy)
        // would otherwise be replayed to every later caller and permanently
        // break maths for the rest of the session.
        katexPromise = null
        throw err
      })
  }
  return katexPromise
}

/**
 * Warm the KaTeX chunk before it's needed — called from the notes listing on
 * hover, so a maths note doesn't spend a round trip on it after opening.
 */
export function prefetchKatex(content) {
  if (noteHasMath(content)) loadKatex().catch(() => {})
}

/**
 * → { plugin, failed }. `plugin` is the rehype-katex attacher, or null while
 * it's still loading / not needed. `failed` means the chunk couldn't be
 * fetched, and the caller should render without maths support rather than
 * showing nothing at all.
 *
 * rehype-katex's default export is itself a FUNCTION, which makes both of
 * React's function-valued-state traps live here: `useState(fn)` would run
 * `fn` as a lazy initialiser and `setPlugin(fn)` would run it as an updater.
 * Either one stores `rehypeKatex()` — a transformer — where a plugin belongs,
 * and unified then throws "Cannot use 'in' operator to search for 'children'
 * in undefined" mid-render. Hence the `() => …` wrappers in both places; do
 * not "simplify" them away.
 */
function useKatexPlugin(needed) {
  const [plugin, setPlugin] = useState(() => katexModule)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!needed || plugin) return
    let cancelled = false
    loadKatex().then(
      (mod) => { if (!cancelled) setPlugin(() => mod) },
      () => { if (!cancelled) setFailed(true) },
    )
    return () => { cancelled = true }
  }, [needed, plugin])

  return { plugin: needed ? plugin : null, failed }
}

function MarkdownRenderer({ content }) {
  // Bare LaTeX (no `$`/`$$` around it) is wrapped before parsing, so a formula
  // typesets whether or not whoever pasted it included delimiters. Notes saved
  // before this existed are covered too — the fix is on the read path, so
  // nothing has to be re-saved. See lib/noteMath.js.
  //
  // Split first, normalise second: each part is already parsed by its own
  // ReactMarkdown below, so per-part is exactly the parse boundary, and it
  // keeps the normaliser away from the innards of a `<RichPopover />` tag.
  const parts = useMemo(() => (
    splitContentByRichPopovers(String(content ?? '')).map((part) => (
      part.type === 'markdown' ? { ...part, content: normalizeNoteMath(part.content) } : part
    ))
  ), [content])
  const needsKatex = useMemo(
    () => parts.some((part) => part.type === 'markdown' && MATH_DELIMITED_RE.test(part.content)),
    [parts],
  )
  const { plugin: katexPlugin, failed: katexFailed } = useKatexPlugin(needsKatex)

  // Rendering maths before KaTeX arrives would flash raw `$\frac{a}{b}$` at
  // the reader, so a maths note waits for the chunk (one fetch, usually
  // already warm from the listing's hover prefetch). Prose-only notes never
  // reach this branch — and neither does a note whose KaTeX fetch FAILED,
  // which falls through and renders unformatted maths: readable, if ugly,
  // where waiting forever would leave a blank page.
  if (needsKatex && !katexPlugin && !katexFailed) {
    return <div className={styles.markdownContainer} />
  }

  return (
    <div className={styles.markdownContainer}>
      {parts.map((part, i) => {
        if (part.type === 'richpopover') {
          return (
            <span key={i} className={styles.richPopoverWrapper}>
              <RichPopoverChip {...part.props} />
            </span>
          )
        }
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm, remarkMath, remarkBrToBreak, remarkDirective, remarkNoteDirectiveFallback, remarkNoteDirectives]}
            rehypePlugins={katexPlugin ? [katexPlugin] : []}
            components={markdownComponents}
          >
            {part.content}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}

export default MarkdownRenderer
