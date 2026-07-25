import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import { visit } from 'unist-util-visit'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import CodeBlock from '../social/CodeBlock/CodeBlock'
import RichTooltip, { YouTubeIcon, InstagramIcon, LinkedInIcon } from '../ui/smoothui/rich-popover/index.tsx'
import { resolveNoteImageSrc, noteImageFallbackSrc } from '../../lib/noteImageSrc'
import { parseImageTitle } from '../../lib/noteImageWidth'
import { HEX_COLOR_RE } from '../../constants/noteColors'
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

    return isBlock ? (
      <CodeBlock code={codeString} language={language || 'auto'} />
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

function MarkdownRenderer({ content }) {
  const parts = splitContentByRichPopovers(content)

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
            remarkPlugins={[remarkGfm, remarkMath, remarkBrToBreak, remarkDirective, remarkNoteDirectives]}
            rehypePlugins={[rehypeKatex]}
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
