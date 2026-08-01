import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, schemaCtx, serializerCtx } from '@milkdown/kit/core'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import remarkDirective from 'remark-directive'
import CodeBlock from '../../social/CodeBlock/CodeBlock'
import NotePlayground from '../../markdown/NotePlayground'
import MoleculeStructure from '../../markdown/MoleculeStructure/MoleculeStructure'
import ReactionScheme from '../../markdown/ReactionScheme/ReactionScheme'
import { PLAYGROUND_ID_RE } from '../../../constants/notePlaygrounds'
import { loadOCL } from '../../../lib/chem/loadChem'
import {
  isValidSmiles,
  isValidLabel,
  parseReactionBlock,
  detectMolBlock,
  convertChemPaste,
} from '../../../lib/chem/noteChem'
import { resolveDraftSrc } from '../../../lib/draftImagePreviews'
import { resolveNoteImageSrc, noteImageFallbackSrc } from '../../../lib/noteImageSrc'
import { parseImageTitle, formatImageTitle, MIN_IMAGE_WIDTH } from '../../../lib/noteImageWidth'
import { normalizeNoteMath } from '../../../lib/noteMath'
import { YOUTUBE_ID_RE, youtubeThumbnailSrc, youtubeEmbedSrc } from '../../../lib/youtube'
import { isSafeUrl } from '../../../lib/url'
import { HEX_COLOR_RE } from '../../../constants/noteColors'
import {
  commonmark,
  codeBlockSchema,
  insertImageCommand,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  turnIntoTextCommand,
} from '@milkdown/kit/preset/commonmark'
import { gfm, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { history } from '@milkdown/kit/plugin/history'
import { math, katexOptionsCtx } from '@milkdown/plugin-math'
import {
  callCommand,
  replaceAll,
  getMarkdown,
  markdownToSlice,
  $prose,
  $remark,
  $command,
  $markSchema,
  $nodeSchema,
} from '@milkdown/kit/utils'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import 'katex/dist/katex.min.css'
import '@milkdown/kit/prose/view/style/prosemirror.css'
import styles from './NoteEditor.module.css'

/**
 * WYSIWYG note editor (T-036 foundation) — replaces the Monaco source editor.
 *
 * Contract preserved from Monaco: `content` is a Markdown string; the editor
 * parses it to a document on load and serialises back to Markdown on every
 * change into `onChange`. `useEditorState`/`useEditorSave`/`useEditorDrafts`
 * are unchanged — only the component producing `content` differs.
 *
 * The imperative ref exposes the toolbar/shortcut commands AdminEditor needs
 * so `EditorNavbar` and the Ctrl+B/I shortcuts drive editor commands instead
 * of Monaco `executeEdits`.
 */
const HEADING_LEVEL = { title: 1, subtitle: 2 }

// Registers remark-directive on Milkdown's own remark pipeline (the same
// extension point `remarkPluginsCtx` exposes), giving the parser generic
// `:name[text]{attr=val}` / `::name{attr=val}` syntax to build safe custom
// marks/nodes on — used below for text color, highlight and YouTube embeds
// instead of raw HTML (MarkdownRenderer deliberately has no rehype-raw; the
// editor shouldn't grow a parallel unsafe-HTML path either). See T-055.
const directiveRemark = $remark('directive', () => remarkDirective)

// Text color mark — round-trips to `:color[text]{hex="#..."}`. `hex` is
// validated on both this (write) path and MarkdownRenderer's (read) path
// before it ever reaches a `style` attribute — stored Markdown can also
// arrive via a GitHub backup restore, bypassing the editor entirely.
const colorMarkSchema = $markSchema('text_color', () => ({
  attrs: { hex: { default: '' } },
  parseDOM: [{
    tag: 'span[data-color-hex]',
    getAttrs: (dom) => {
      if (!(dom instanceof HTMLElement)) return false
      // Read the hex back from a data attribute rather than `dom.style.color`
      // — the browser normalises an inline `style="color: #.."` to `rgb(...)`
      // on the CSSOM getter, which would never match HEX_COLOR_RE.
      const hex = dom.getAttribute('data-color-hex') || ''
      return HEX_COLOR_RE.test(hex) ? { hex } : false
    },
  }],
  toDOM: (mark) => ['span', { style: `color: ${mark.attrs.hex}`, 'data-color-hex': mark.attrs.hex }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'textDirective' && node.name === 'color',
    runner: (state, node, markType) => {
      const hex = node.attributes?.hex || ''
      if (!HEX_COLOR_RE.test(hex)) {
        state.next(node.children)
        return
      }
      state.openMark(markType, { hex })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'text_color',
    runner: (state, mark) => {
      state.withMark(mark, 'textDirective', undefined, {
        name: 'color',
        attributes: { hex: mark.attrs.hex },
      })
    },
  },
}))

// Highlight mark — same shape as text_color, `background-color` instead of
// `color`, round-trips to `:mark[text]{hex="#..."}`.
const highlightMarkSchema = $markSchema('text_highlight', () => ({
  attrs: { hex: { default: '' } },
  parseDOM: [{
    tag: 'span[data-highlight-hex]',
    getAttrs: (dom) => {
      if (!(dom instanceof HTMLElement)) return false
      const hex = dom.getAttribute('data-highlight-hex') || ''
      return HEX_COLOR_RE.test(hex) ? { hex } : false
    },
  }],
  toDOM: (mark) => ['span', { style: `background-color: ${mark.attrs.hex}`, 'data-highlight-hex': mark.attrs.hex }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'textDirective' && node.name === 'mark',
    runner: (state, node, markType) => {
      const hex = node.attributes?.hex || ''
      if (!HEX_COLOR_RE.test(hex)) {
        state.next(node.children)
        return
      }
      state.openMark(markType, { hex })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'text_highlight',
    runner: (state, mark) => {
      state.withMark(mark, 'textDirective', undefined, {
        name: 'mark',
        attributes: { hex: mark.attrs.hex },
      })
    },
  },
}))

// Applying a color/highlight always sets (or clears, for `hex: null`) the
// mark across the current selection — not a toggle. A plain ProseMirror
// `toggleMark` would remove the mark on re-click regardless of which color
// was picked, so switching from one swatch straight to another would just
// delete the mark instead of changing its color. Requires a non-empty
// selection, same as Google Docs (there's no "next typed character" color).
function applyColorLikeMark(markType) {
  return (hex) => (state, dispatch) => {
    const { from, to, empty } = state.selection
    if (empty) return false
    if (dispatch) {
      let tr = state.tr.removeMark(from, to, markType)
      if (hex) tr = tr.addMark(from, to, markType.create({ hex }))
      dispatch(tr)
    }
    return true
  }
}

const setTextColorCommand = $command('SetTextColor', (ctx) => applyColorLikeMark(colorMarkSchema.type(ctx)))
const setHighlightCommand = $command('SetHighlight', (ctx) => applyColorLikeMark(highlightMarkSchema.type(ctx)))

// YouTube embed — a block atom node (like image), round-tripping to the leaf
// directive `::youtube{id="VIDEO_ID"}`. No draft/upload lifecycle needed: a
// YouTube URL is stable the instant it's typed, unlike an uploaded image.
const youtubeSchema = $nodeSchema('youtube', () => ({
  inline: false,
  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,
  attrs: { videoId: { default: '', validate: 'string' } },
  parseDOM: [{
    tag: 'div[data-type="youtube"]',
    getAttrs: (dom) => {
      if (!(dom instanceof HTMLElement)) return false
      const videoId = dom.getAttribute('data-video-id') || ''
      return YOUTUBE_ID_RE.test(videoId) ? { videoId } : false
    },
  }],
  toDOM: (node) => ['div', { 'data-type': 'youtube', 'data-video-id': node.attrs.videoId }],
  parseMarkdown: {
    match: (node) => node.type === 'leafDirective' && node.name === 'youtube',
    runner: (state, node, type) => {
      const id = node.attributes?.id || ''
      if (!YOUTUBE_ID_RE.test(id)) return
      state.addNode(type, { videoId: id })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'youtube',
    runner: (state, node) => {
      state.addNode('leafDirective', undefined, undefined, {
        name: 'youtube',
        attributes: { id: node.attrs.videoId },
      })
    },
  },
}))

// Playground embed — a block atom round-tripping to `::playground{id="…"}`
// (T-075). Same shape as youtubeSchema above and for the same reason: without a
// schema declaring this node, Milkdown has no rule matching the directive, so
// the parser drops it and the author's next save writes the note back with the
// playground gone.
//
// The id is all that lives in the Markdown. Its HTML/CSS/JS come from the
// code-defined registry, so there is nothing here to upload, validate against a
// remote service, or keep in sync with the note body.
const playgroundSchema = $nodeSchema('playground', () => ({
  inline: false,
  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,
  attrs: { playgroundId: { default: '', validate: 'string' } },
  parseDOM: [{
    tag: 'div[data-type="playground"]',
    getAttrs: (dom) => {
      if (!(dom instanceof HTMLElement)) return false
      const id = dom.getAttribute('data-playground-id') || ''
      return PLAYGROUND_ID_RE.test(id) ? { playgroundId: id } : false
    },
  }],
  toDOM: (node) => ['div', { 'data-type': 'playground', 'data-playground-id': node.attrs.playgroundId }],
  parseMarkdown: {
    match: (node) => node.type === 'leafDirective' && node.name === 'playground',
    runner: (state, node, type) => {
      const id = node.attributes?.id || ''
      if (!PLAYGROUND_ID_RE.test(id)) return
      state.addNode(type, { playgroundId: id })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'playground',
    runner: (state, node) => {
      state.addNode('leafDirective', undefined, undefined, {
        name: 'playground',
        attributes: { id: node.attrs.playgroundId },
      })
    },
  },
}))

// Molecule structure — a block atom round-tripping to
// `::molecule{smiles="..." label="..."}` (T-091). Same shape as
// youtubeSchema/playgroundSchema above, for the same reason: without a
// schema declaring this node, Milkdown has no rule matching the directive, so
// the parser drops it and the author's next save writes the note back with
// the structure gone (the T-075 lesson).
//
// `smiles` is re-validated here on the write path with the same charset/
// length gate the reader (MarkdownRenderer's remarkNoteDirectives) applies
// on read — stored Markdown can also arrive via a GitHub backup restore,
// bypassing this editor entirely.
const moleculeSchema = $nodeSchema('molecule', () => ({
  inline: false,
  group: 'block',
  atom: true,
  selectable: true,
  isolating: true,
  attrs: {
    smiles: { default: '', validate: 'string' },
    label: { default: '', validate: 'string' },
  },
  parseDOM: [{
    tag: 'div[data-type="molecule"]',
    getAttrs: (dom) => {
      if (!(dom instanceof HTMLElement)) return false
      const smiles = dom.getAttribute('data-smiles') || ''
      if (!isValidSmiles(smiles)) return false
      const label = dom.getAttribute('data-label') || ''
      return { smiles, label: isValidLabel(label) ? label : '' }
    },
  }],
  toDOM: (node) => ['div', {
    'data-type': 'molecule',
    'data-smiles': node.attrs.smiles,
    'data-label': node.attrs.label,
  }],
  parseMarkdown: {
    match: (node) => node.type === 'leafDirective' && node.name === 'molecule',
    runner: (state, node, type) => {
      const smiles = node.attributes?.smiles || ''
      if (!isValidSmiles(smiles)) return
      const label = node.attributes?.label || ''
      state.addNode(type, { smiles, label: isValidLabel(label) ? label : '' })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'molecule',
    runner: (state, node) => {
      state.addNode('leafDirective', undefined, undefined, {
        name: 'molecule',
        attributes: { smiles: node.attrs.smiles, label: node.attrs.label || '' },
      })
    },
  },
}))

// Molecule node view: renders the real reader component (MoleculeStructure),
// so the author sees exactly what a visitor gets.
//
// Registered as a raw ProseMirror `nodeViews` prop (matching
// `youtubeNodeViewPlugin` below), not via Milkdown's `$view()` utility.
// `$view()` registers into `nodeViewCtx` behind `await ctx.wait(SchemaReady)`
// — an async step that can lose the race against the EditorView's own
// creation, so the node view silently never attaches and the node falls back
// to its bare `toDOM`. Confirmed live: pasting `::molecule{...}` (or a
// `` ```reaction `` fence via the identically-`$view`-based `codeBlockView`)
// produced the correct node/attrs but rendered as the schema's raw `toDOM`,
// with no SVG — on this worktree AND on unmodified `main`, so this is a
// pre-existing gap in every `$view`-based node view here (molecule,
// playground, code block), not something new. `youtubeNodeViewPlugin`'s raw
// `Plugin({props: {nodeViews}})` registration is synchronous and reliably
// attaches, so every node view in this file now uses that shape instead.
const moleculeNodeView = $prose(() => new Plugin({
  key: new PluginKey('NOTE_EDITOR_MOLECULE_VIEW'),
  props: {
    nodeViews: {
      molecule: (node) => {
        const dom = document.createElement('div')
        const root = createRoot(dom)
        const render = (n) => queueMicrotask(() => {
          try {
            root.render(<MoleculeStructure smiles={n.attrs.smiles} label={n.attrs.label} />)
          } catch { /* editor may have torn down */ }
        })
        render(node)
        return {
          dom,
          update: (updated) => {
            if (updated.type !== node.type) return false
            render(updated)
            return true
          },
          ignoreMutation: () => true,
          destroy: () => queueMicrotask(() => root.unmount()),
        }
      },
    },
  },
}))

// Playground node view: the real reader component, so the author sees and can
// drive the same live document a visitor gets. See moleculeNodeView above for
// why this is a raw `nodeViews` prop registration rather than `$view()`.
const playgroundNodeView = $prose(() => new Plugin({
  key: new PluginKey('NOTE_EDITOR_PLAYGROUND_VIEW'),
  props: {
    nodeViews: {
      playground: (node) => {
        const dom = document.createElement('div')
        const root = createRoot(dom)
        const render = (n) => queueMicrotask(() => {
          try {
            root.render(<NotePlayground playgroundId={n.attrs.playgroundId} />)
          } catch { /* editor may have torn down */ }
        })
        render(node)
        return {
          dom,
          update: (updated) => {
            if (updated.type !== node.type) return false
            render(updated)
            return true
          },
          ignoreMutation: () => true,
          // The playground owns its own buttons, tabs and editor panes —
          // ProseMirror must not treat clicks inside them as selection changes.
          stopEvent: () => true,
          destroy: () => queueMicrotask(() => root.unmount()),
        }
      },
    },
  },
}))

// YouTube node view: rounded thumbnail + play button (mirrors imageWrap's
// rounded-corner treatment), swapped for a lazy-mounted iframe on click so
// no third-party embed/tracker loads until a viewer opts in.
const youtubeNodeView = (node) => {
  const wrap = document.createElement('div')
  wrap.className = styles.videoWrap
  wrap.contentEditable = 'false'

  const thumb = document.createElement('img')
  thumb.className = styles.videoThumb
  thumb.draggable = false
  thumb.alt = 'YouTube video'

  const playButton = document.createElement('button')
  playButton.type = 'button'
  playButton.className = styles.videoPlayButton
  playButton.setAttribute('aria-label', 'Play video')
  playButton.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'

  const applyAttrs = (n) => {
    thumb.src = youtubeThumbnailSrc(n.attrs.videoId)
  }
  applyAttrs(node)

  let frame = null
  let playing = false
  const play = () => {
    if (playing) return
    playing = true
    frame = document.createElement('iframe')
    frame.className = styles.videoFrame
    frame.src = youtubeEmbedSrc(node.attrs.videoId)
    frame.allow = 'autoplay; encrypted-media; picture-in-picture'
    frame.allowFullscreen = true
    frame.frameBorder = '0'
    wrap.replaceChildren(frame)
  }

  const swallow = (e) => { e.preventDefault(); e.stopPropagation() }
  playButton.addEventListener('mousedown', swallow)
  playButton.addEventListener('click', (e) => { swallow(e); play() })

  wrap.append(thumb, playButton)

  return {
    dom: wrap,
    ignoreMutation: () => true,
    stopEvent: (e) => playButton.contains(e.target) || (frame ? frame.contains(e.target) : false),
    update: (updated) => {
      if (updated.type !== node.type) return false
      node = updated
      if (!playing) applyAttrs(updated)
      return true
    },
    destroy: () => { frame = null },
  }
}

const youtubeNodeViewPlugin = $prose(() => new Plugin({
  key: new PluginKey('NOTE_EDITOR_YOUTUBE_VIEW'),
  props: {
    nodeViews: { youtube: youtubeNodeView },
  },
}))

// Auto-embeds a bare YouTube URL the moment it's the *sole* content of its
// own paragraph — whether that paragraph arrived via paste (this runs right
// after `markdownClipboard`'s dispatch, since both are ordinary
// doc-changing transactions) or by typing the URL out directly. A URL
// alongside other text in the same paragraph is left as a plain link/autolink
// — only a standalone line unfurls, matching Notion/Docs-style behaviour.
function bareYouTubeId(text) {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  if (!isSafeUrl(trimmed)) return null
  for (const pattern of [
    /(?:youtube(?:-nocookie)?\.com)\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
  ]) {
    const match = pattern.exec(trimmed)
    if (match && YOUTUBE_ID_RE.test(match[1])) return match[1]
  }
  return null
}

// `isLoadingRef` is `MilkdownInner`'s `applyingExternal` ref — true for the
// transaction that loads/resets a note's content (note open, draft restore,
// clear). Without this guard, an *existing* note that already contains a
// bare YouTube URL on its own line (written before this feature existed)
// would get silently rewritten into an embed the instant it's opened for
// editing — before the admin has touched anything — which breaks the
// "load → change nothing → save is a no-op diff" invariant T-036 established
// for this editor. Only actual typing/pasting should trigger the auto-embed.
function createYoutubeAutoEmbed(isLoadingRef) {
  return $prose(() => new Plugin({
    key: new PluginKey('NOTE_EDITOR_YOUTUBE_AUTOEMBED'),
    appendTransaction: (transactions, _oldState, newState) => {
      if (isLoadingRef.current) return null
      if (!transactions.some((tr) => tr.docChanged)) return null
      const paragraph = newState.schema.nodes.paragraph
      const youtube = newState.schema.nodes.youtube
      if (!paragraph || !youtube) return null

      let target = null
      newState.doc.descendants((node, pos) => {
        if (target || node.type !== paragraph) return
        let allText = true
        node.forEach((child) => { if (!child.isText) allText = false })
        if (!allText) return
        const id = bareYouTubeId(node.textContent)
        if (id) target = { pos, size: node.nodeSize, id }
      })
      if (!target) return null

      return newState.tr.replaceWith(
        target.pos,
        target.pos + target.size,
        youtube.create({ videoId: target.id })
      )
    },
  }))
}

/**
 * Teaches commonmark's `code_block` about the fence's *meta* string — the part
 * after the language, which notes use for the block's source label
 * (```python recruitment/models.py, see CodeBlock's `title` prop).
 *
 * The preset's own schema models only `language`: its parseMarkdown reads
 * `node.lang` and its toMarkdown writes `{ lang }`, so meta is dropped on
 * parse and cannot come back on serialise. Since every change round-trips
 * Markdown → doc → Markdown, that silently deletes the label from every code
 * block in a note the moment it is opened and saved here (T-075).
 *
 * Patches the schema's ctx slice rather than replacing the plugin: `$nodeSchema`
 * keeps its factory in `.key` (the same indirection `katexOptionsCtx.key` uses
 * below), so wrapping that factory extends the preset's schema in place and
 * leaves its commands, input rules and keymaps alone. `extendSchema()` would
 * instead build a second schema with the same node id, which then has to
 * displace the preset's.
 */
function configureCodeBlockMeta(ctx) {
  ctx.update(codeBlockSchema.key, (previous) => (innerCtx) => {
    const base = previous(innerCtx)
    return {
      ...base,
      attrs: { ...base.attrs, meta: { default: '', validate: 'string' } },
      parseMarkdown: {
        ...base.parseMarkdown,
        runner: (state, node, type) => {
          state.openNode(type, { language: node.lang ?? '', meta: node.meta ?? '' })
          if (node.value) state.addText(node.value)
          state.closeNode()
        },
      },
      toMarkdown: {
        ...base.toMarkdown,
        runner: (state, node) => {
          state.addNode('code', undefined, node.content.firstChild?.text || '', {
            lang: node.attrs.language,
            // An empty string would serialise as a trailing space on the fence
            // line, which then reparses as meta `''` and churns the document.
            meta: node.attrs.meta || null,
          })
        },
      },
    }
  })
}

// Render fenced code blocks with the shared social CodeBlock (themed, read-only)
// so the editor matches the reader. Reuses the real React component via a
// react-dom root; no contentDOM => not inline-editable here (reveal-to-edit is
// T-037). The node's text stays in the doc model, so Markdown round-trip is
// unaffected. React root mount/unmount is deferred a microtask to stay clear of
// ProseMirror's synchronous view-update cycle.
//
// Registered as a raw `nodeViews` prop, not `$view()` — see moleculeNodeView's
// comment above for why: `$view()`'s registration into `nodeViewCtx` is gated
// on an async `ctx.wait(SchemaReady)`, which can lose the race against the
// EditorView's own creation. Confirmed live (before this fix): every code
// block — pasted, typed, or already saved in an existing note — rendered as
// the commonmark preset's bare `<pre><code>`, never through this component,
// on this worktree and on unmodified `main` alike. This is what made
// `` ```reaction `` fall back to looking like plain formula text instead of
// rendering, exactly as reported.
const codeBlockView = $prose(() => new Plugin({
  key: new PluginKey('NOTE_EDITOR_CODE_BLOCK_VIEW'),
  props: {
    nodeViews: {
      code_block: (node) => {
        const dom = document.createElement('div')
        const root = createRoot(dom)
        const render = (n) => queueMicrotask(() => {
          try {
            // ```reaction fences are a JSON payload (T-090), not a code sample —
            // codeBlockView is the one place ALL fenced code renders, in both the
            // reader and here, so this is the only spot that needs to know about
            // it. `::reaction` gets no new $nodeSchema: fenced code already
            // round-trips losslessly through codeBlockSchema (ADR 0001), so only
            // the render branches, same as the reader's `code()` handler. A
            // malformed block (bad JSON, oversized payload, over a cap) falls
            // through to the ordinary CodeBlock rendering — never a thrown render.
            if (n.attrs.language === 'reaction') {
              const parsed = parseReactionBlock(n.textContent)
              if (parsed.ok) {
                root.render(<ReactionScheme data={{ steps: parsed.steps }} />)
                return
              }
            }
            root.render(
              <CodeBlock
                code={n.textContent}
                language={n.attrs.language || 'auto'}
                title={n.attrs.meta || undefined}
              />
            )
          } catch { /* editor may have torn down */ }
        })
        render(node)
        return {
          dom,
          update: (updated) => {
            if (updated.type !== node.type) return false
            render(updated)
            return true
          },
          // React owns this subtree — keep ProseMirror's mutation observer out of it.
          ignoreMutation: () => true,
          stopEvent: () => false,
          destroy: () => queueMicrotask(() => root.unmount()),
        }
      },
    },
  },
}))

// Image node view: renders the image with Material You hover controls —
//   • a translucent circular "×" at the top-right that removes the image after a
//     warn-before-remove confirm. Removal is an editor edit (undoable with
//     Ctrl+Z); the underlying file is untouched and can still be swept later by
//     Image Cleanup.
//   • a grip on each vertical edge that scales the image down (or back up to the
//     column width) by dragging, with a live px readout. Width-only, so the
//     aspect ratio is preserved; double-clicking a grip resets to the default
//     width.
//
// The chosen width persists in the Markdown image title as `w=<px>` (see
// lib/noteImageWidth.js), which is why Markdown round-trip stays intact: the src
// never changes, so the save path's `draft://` rewrite and Image Cleanup's path
// matching are unaffected.
//
// Registered via $prose (a real ProseMirror plugin prop), not $view: $view's
// nodeViewCtx registration is async (gated on SchemaReady) and races the
// EditorView's own construction, which snapshots nodeViews once via
// `Object.fromEntries(ctx.get(nodeViewCtx))` — whichever $view plugins haven't
// resolved by that snapshot are silently dropped forever (confirmed via
// `view.props.nodeViews` missing `image` at runtime, T-036 image bug). Plugin
// props are read dynamically by ProseMirror on every state update instead of
// snapshotted once, so this survives the same race.
const imageNodeView = (node, view, getPos) => {
  const wrap = document.createElement('span')
  wrap.className = styles.imageWrap

  const img = document.createElement('img')
  img.className = styles.image
  // PM's own image drag would fight the resize handles' pointer capture.
  img.draggable = false
  let currentTitle = ''
  // Live resize state (set while a handle is being dragged), declared up here so
  // applyAttrs can leave the in-progress width alone.
  let drag = null
  const applyAttrs = (n) => {
    // draft://<key> (not-yet-uploaded) resolves to a blob URL for preview;
    // saved /notes/img/… paths try the same-origin static path first (works
    // once promoted, committed, and deployed — see noteImageSrc.js) and fall
    // back to the note-images Storage URL on error (works immediately after
    // upload, before that promotion happens).
    img.src = resolveNoteImageSrc(resolveDraftSrc(n.attrs.src)) || ''
    img.onerror = () => {
      const fallback = noteImageFallbackSrc(resolveDraftSrc(n.attrs.src))
      if (img.src !== fallback) img.src = fallback
    }
    img.alt = n.attrs.alt || ''
    // The title doubles as the width carrier — only the human part belongs on
    // the DOM node (and on its tooltip).
    const { title, width } = parseImageTitle(n.attrs.title)
    currentTitle = title
    if (title) img.title = title
    else img.removeAttribute('title')
    if (!drag) img.style.width = width ? `${width}px` : ''
  }
  applyAttrs(node)
  wrap.appendChild(img)

  // Translucent circular delete affordance (hidden until hover).
  const del = document.createElement('button')
  del.type = 'button'
  del.className = styles.imageDelete
  del.setAttribute('aria-label', 'Delete image')
  del.textContent = '×'
  wrap.appendChild(del)

  // Warn-before-remove confirm (replaces the × while confirming).
  const confirm = document.createElement('span')
  confirm.className = styles.imageConfirm
  const label = document.createElement('span')
  label.className = styles.imageConfirmText
  label.textContent = 'Remove image?'
  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = styles.imageConfirmCancel
  cancelBtn.textContent = 'Cancel'
  const removeBtn = document.createElement('button')
  removeBtn.type = 'button'
  removeBtn.className = styles.imageConfirmRemove
  removeBtn.textContent = 'Remove'
  confirm.append(label, cancelBtn, removeBtn)
  wrap.appendChild(confirm)

  // ── Resize handles + live size readout ──────────────────────────────────
  const sizePill = document.createElement('span')
  sizePill.className = styles.imageSizePill
  wrap.appendChild(sizePill)

  const handles = ['left', 'right'].map((side) => {
    const h = document.createElement('span')
    h.className = `${styles.imageHandle} ${side === 'left' ? styles.imageHandleLeft : styles.imageHandleRight}`
    h.dataset.side = side
    wrap.appendChild(h)
    return h
  })

  // Widest the image may become: the editing column, so it can always be
  // dragged back out to the default full-width look but never overflow it.
  const maxWidth = () => {
    const parentWidth = wrap.parentElement?.getBoundingClientRect().width || 0
    return Math.max(parentWidth || img.naturalWidth || MIN_IMAGE_WIDTH, MIN_IMAGE_WIDTH)
  }

  const commitWidth = (width) => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (typeof pos !== 'number') return
    const target = view.state.doc.nodeAt(pos)
    if (!target || target.type.name !== 'image') return
    // At (or past) the column width the image is "default" again — drop the
    // marker so it stays responsive instead of pinned to today's column width.
    const title = formatImageTitle(currentTitle, width && width < maxWidth() - 1 ? width : null)
    if (title === (target.attrs.title || '')) return
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...target.attrs, title }))
  }

  const onPointerMove = (e) => {
    if (!drag) return
    const delta = (e.clientX - drag.startX) * (drag.side === 'left' ? -1 : 1)
    const width = Math.round(Math.min(Math.max(drag.startWidth + delta, MIN_IMAGE_WIDTH), drag.max))
    drag.width = width
    img.style.width = `${width}px`
    sizePill.textContent = `${width} px`
  }

  const stopDrag = () => {
    if (!drag) return null
    const { width } = drag
    drag = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
    wrap.classList.remove(styles.resizing)
    return width
  }

  function endDrag() {
    const width = stopDrag()
    if (width != null) commitWidth(width)
  }

  for (const handle of handles) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      drag = {
        side: handle.dataset.side,
        startX: e.clientX,
        startWidth: img.getBoundingClientRect().width,
        max: maxWidth(),
      }
      drag.width = Math.round(drag.startWidth)
      sizePill.textContent = `${drag.width} px`
      wrap.classList.add(styles.resizing)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', endDrag)
      window.addEventListener('pointercancel', endDrag)
    })
    // Double-click a handle → back to the default (column) width.
    handle.addEventListener('dblclick', (e) => {
      e.preventDefault()
      e.stopPropagation()
      img.style.width = ''
      commitWidth(null)
    })
  }

  const swallow = (e) => { e.preventDefault(); e.stopPropagation() }
  for (const btn of [del, cancelBtn, removeBtn]) btn.addEventListener('mousedown', swallow)

  del.addEventListener('click', (e) => { swallow(e); wrap.classList.add(styles.confirming) })
  cancelBtn.addEventListener('click', (e) => { swallow(e); wrap.classList.remove(styles.confirming) })
  removeBtn.addEventListener('click', (e) => {
    swallow(e)
    const pos = typeof getPos === 'function' ? getPos() : null
    if (typeof pos !== 'number') return
    const target = view.state.doc.nodeAt(pos)
    const size = target ? target.nodeSize : 1
    view.dispatch(view.state.tr.delete(pos, pos + size))
    view.focus()
  })

  return {
    dom: wrap,
    // React/DOM controls own this subtree; keep PM's mutation observer out.
    ignoreMutation: () => true,
    // Let PM handle clicks on the image itself (selection); intercept only
    // our own control clicks so they don't reach the editor.
    stopEvent: (e) => del.contains(e.target)
      || confirm.contains(e.target)
      || handles.some((h) => h.contains(e.target)),
    update: (updated) => {
      if (updated.type !== node.type) return false
      applyAttrs(updated)
      return true
    },
    // A drag can outlive the node view (undo/redo, note switch) — never leave
    // window listeners behind, and don't write a width through a stale position.
    destroy: () => stopDrag(),
  }
}

// Click-below-the-last-block → keep writing. The editable area carries a tall
// bottom padding (NoteEditor.module.css) purely as a click target, because a
// note ending in a tall image or a code block otherwise leaves nowhere to put
// the caret. ProseMirror's own handling would drop the caret at the end of the
// last block — i.e. *inside* the image's paragraph — so a click in that padding
// gets a fresh trailing paragraph instead.
//
// A mousedown whose target is the editable element itself (rather than any
// rendered child) is exactly a click in that padding, which is what keys this
// off. Doing it on click, not via a doc-normalising appendTransaction, keeps
// note loading from inventing an edit and marking a pristine note unsaved.
const trailingClickTarget = $prose(() => new Plugin({
  key: new PluginKey('NOTE_EDITOR_TRAILING_CLICK'),
  props: {
    handleDOMEvents: {
      mousedown: (view, event) => {
        if (event.target !== view.dom || event.button !== 0) return false
        const last = view.dom.lastElementChild
        if (last && event.clientY < last.getBoundingClientRect().bottom) return false

        const { doc, schema } = view.state
        const paragraph = schema.nodes.paragraph
        if (!paragraph) return false
        const lastNode = doc.lastChild
        // An empty paragraph is already there — let ProseMirror land in it.
        if (lastNode?.type === paragraph && lastNode.content.size === 0) return false

        event.preventDefault()
        const end = doc.content.size
        const tr = view.state.tr.insert(end, paragraph.create())
        view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(end + 1))).scrollIntoView())
        view.focus()
        return true
      },
    },
  },
}))

const imageDeleteView = $prose(() => new Plugin({
  key: new PluginKey('NOTE_EDITOR_IMAGE_VIEW'),
  props: {
    nodeViews: { image: imageNodeView },
  },
}))

// Markdown-first clipboard. Milkdown's stock clipboard plugin only runs the
// Markdown parser when the clipboard is *pure* plain text; if any text/html is
// present (copying from a browser, a rendered source, or the editor itself) it
// takes the HTML branch and pasted `$x^2$` / fences stay literal. For a
// Markdown notes editor we always want pasted text parsed as Markdown, so this
// replaces the stock plugin:
//   • paste  → parse text/plain as Markdown (LaTeX, code, headings, lists all
//              auto-render); code blocks keep raw text. Bare LaTeX is wrapped
//              in `$`/`$$` first (lib/noteMath.js) — Milkdown's math plugin,
//              like remark-math, only typesets delimited maths, so an
//              undelimited formula would otherwise paste in as plain text.
//   • copy   → serialise the selection back to Markdown (so copying a formula
//              yields its `$…$` source).
// Parses `markdown` and replaces the current selection with it, reading
// `view.state` fresh at call time — shared by the synchronous paste branch
// below and the deferred MOL-block conversion, where "fresh at call time"
// is the whole point (the view may have moved on by the time OCL resolves).
function dispatchMarkdownInsert(view, ctx, markdown) {
  let slice
  try {
    slice = markdownToSlice(markdown)(ctx)
  } catch {
    return false
  }
  if (!slice || typeof slice === 'string') return false
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
  return true
}

const markdownClipboard = $prose((ctx) => new Plugin({
  key: new PluginKey('NOTE_EDITOR_MD_CLIPBOARD'),
  props: {
    handlePaste: (view, event) => {
      const clip = event.clipboardData
      if (!clip) return false
      // Inside a code block, paste raw text verbatim (don't re-parse).
      if (view.state.selection.$from.parent.type.spec.code) return false
      const text = clip.getData('text/plain')
      if (!text) return false

      // Reaction SMILES (`reactants>agents>products`, T-090) is unambiguous
      // and needs no OCL to convert — a plain string splitter (noteChem.js)
      // — so this path stays fully synchronous, unlike the MOL-block path
      // below. `conditionsAbove` is always empty here: reaction SMILES
      // carries no condition text, a documented gap (chemistry-notes.md),
      // not a bug — the author fills conditions in via the toolbar after.
      const converted = convertChemPaste(text)
      if (converted && dispatchMarkdownInsert(view, ctx, converted)) return true

      // MOL block (T-091): unambiguous (a V2000/V3000 counts line), but
      // converting it to SMILES needs OpenChemLib, which is lazy-loaded —
      // detection is a cheap synchronous string check, but the conversion
      // itself cannot run inside this synchronous handler. Claim the paste
      // event now (returning true prevents the browser's own plain-text
      // paste) and insert the `::molecule` node once loadOCL()'s conversion
      // resolves, dispatching against the LATEST view state at that time —
      // same as the synchronous dispatch above, just deferred, mirroring how
      // codeBlockView/playgroundNodeView defer React work with
      // queueMicrotask for "must run after this synchronous PM cycle".
      if (detectMolBlock(text)) {
        loadOCL().then((OCL) => {
          let smiles
          try {
            smiles = OCL.Molecule.fromMolfile(text).toSmiles()
          } catch {
            return
          }
          if (!isValidSmiles(smiles)) return
          dispatchMarkdownInsert(view, ctx, `::molecule{smiles="${smiles}"}`)
        }).catch(() => {})
        return true
      }

      let slice
      try {
        slice = markdownToSlice(normalizeNoteMath(text))(ctx)
      } catch {
        return false
      }
      if (!slice || typeof slice === 'string') return false
      view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
      return true
    },
    clipboardTextSerializer: (slice) => {
      const serializer = ctx.get(serializerCtx)
      const schema = ctx.get(schemaCtx)
      const doc = schema.topNodeType.createAndFill(undefined, slice.content)
      return doc ? serializer(doc) : ''
    },
  },
}))

const MilkdownInner = forwardRef(function MilkdownInner({ content, onChange }, ref) {
  // `lastEmitted` tracks the Markdown the editor last produced. Incoming
  // `content` equal to it means "our own change echoed back" — skip the reset
  // so typing never fights the controlled prop (the ProseMirror feedback-loop
  // trap the ADR flags); a different value means an external load → replaceAll.
  // Starts empty and loads ALL content (incl. the first note) through the
  // guarded effect below, so we never depend on whether Milkdown emits on its
  // initial parse.
  const lastEmitted = useRef('')
  // Suppresses the markdownUpdated that a programmatic replaceAll triggers, so
  // loading a note doesn't mark it unsaved / re-normalise before the user edits.
  const applyingExternal = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, '')
        // Unlike rehype-katex (MarkdownRenderer's reader path), the math
        // plugin's toDOM calls katex.render() with no try/catch, so a
        // malformed formula (e.g. stray `\=`, a real KaTeX command that needs
        // an argument) throws straight through ProseMirror's view update with
        // nothing to catch it — see EditorErrorBoundary for the same failure
        // mode from any other source. throwOnError: false makes KaTeX render
        // a red inline error span instead, matching the reader's degradation.
        // `katexOptionsCtx` is the $ctx()-produced plugin function, not the
        // slice — the slice plugin-math itself reads from is `.key` (see its
        // toDOM: `ctx.get(katexOptionsCtx.key)`), so `.set` must target that
        // same `.key` or it throws "Context not found" against the plugin
        // function instead of the slice.
        ctx.set(katexOptionsCtx.key, { throwOnError: false })
        configureCodeBlockMeta(ctx)
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          if (applyingExternal.current) {
            applyingExternal.current = false
            lastEmitted.current = markdown
            return
          }
          lastEmitted.current = markdown
          onChangeRef.current?.(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(math)
      .use(history)
      .use(directiveRemark)
      .use(colorMarkSchema)
      .use(highlightMarkSchema)
      .use(setTextColorCommand)
      .use(setHighlightCommand)
      .use(youtubeSchema)
      .use(youtubeNodeViewPlugin)
      .use(createYoutubeAutoEmbed(applyingExternal))
      .use(playgroundSchema)
      .use(playgroundNodeView)
      .use(moleculeSchema)
      .use(moleculeNodeView)
      .use(markdownClipboard)
      .use(codeBlockView)
      .use(imageDeleteView)
      .use(trailingClickTarget)
      .use(listener)
  )

  const [loading, getInstance] = useInstance()

  // Push external content changes (note load / draft restore / clear) into the
  // editor. Guarded so the editor's own emissions don't re-enter as resets.
  //
  // Loaded content goes through the same maths normalisation as a paste, so a
  // note saved before that existed shows its formulas typeset here and not just
  // in the reader (which normalises on read). `applyingExternal` swallows the
  // resulting emission, so this never marks a pristine note unsaved — the
  // delimiters are written back only once the author actually edits and saves.
  //
  // Note *what* is compared: the guard runs on the raw prop, and only the
  // replaceAll payload is normalised. Comparing the normalised form instead
  // would re-enter on every keystroke — the prop is the editor's own emission
  // once the author starts typing, and normalising bare LaTeX they are still
  // in the middle of typing makes it differ from `lastEmitted`, so each
  // character would trigger a full document replace and lose the cursor.
  useEffect(() => {
    if (loading) return
    const incoming = content ?? ''
    if (incoming === lastEmitted.current) return
    applyingExternal.current = true
    lastEmitted.current = incoming
    getInstance()?.action(replaceAll(normalizeNoteMath(incoming)))
  }, [content, loading, getInstance])

  useImperativeHandle(ref, () => ({
    isReady: () => !loading && !!getInstance(),
    getMarkdown() {
      const inst = getInstance()
      return inst ? inst.action(getMarkdown()) : ''
    },
    focus() {
      getInstance()?.action((ctx) => ctx.get(editorViewCtx).focus())
    },
    format(action) {
      const cmd = {
        bold: toggleStrongCommand,
        italic: toggleEmphasisCommand,
        strike: toggleStrikethroughCommand,
        code: toggleInlineCodeCommand,
      }[action]
      if (cmd) getInstance()?.action(callCommand(cmd.key))
    },
    // Sets (or, for a falsy `hex`, clears) the text-color / highlight mark
    // across the current selection. Requires a non-empty selection — see
    // applyColorLikeMark.
    setTextColor(hex) {
      getInstance()?.action(callCommand(setTextColorCommand.key, hex || null))
    },
    setHighlight(hex) {
      getInstance()?.action(callCommand(setHighlightCommand.key, hex || null))
    },
    // Generic Markdown-text insert at the current selection — used for the
    // formula and social-link toolbar actions, which only ever hand this a
    // markdown-ish snippet (`$x^2$`, a `<RichPopover/>` tag) rather than
    // something that needs its own dedicated command.
    insertMarkdown(markdown) {
      getInstance()?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        let slice
        try {
          slice = markdownToSlice(markdown)(ctx)
        } catch {
          return
        }
        if (!slice || typeof slice === 'string') return
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
        view.focus()
      })
    },
    // Insert a YouTube embed at the current cursor position. `videoId` must
    // already be a validated 11-char id (see lib/youtube.js) — this never
    // fetches anything, the thumbnail is derived from the id alone.
    insertYouTube(videoId) {
      if (!YOUTUBE_ID_RE.test(videoId)) return
      getInstance()?.action((ctx) => {
        ctx.get(editorViewCtx).focus()
      })
      getInstance()?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const node = youtubeSchema.type(ctx).create({ videoId })
        view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
      })
      // Same "land the caret below" treatment as insertImage, adapted for a
      // block-level (rather than inline) atom: resolve just past the node's
      // end position instead of walking up from an inline $from.
      getInstance()?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const end = state.selection.to
        const paragraph = state.schema.nodes.paragraph
        if (!paragraph) return
        const $end = state.doc.resolve(end)
        const next = state.doc.nodeAt(end)
        const parent = $end.parent
        const index = $end.index()
        const reusable = next?.type === paragraph && next.content.size === 0
        if (!reusable && !parent.canReplaceWith(index, index, paragraph)) {
          view.focus()
          return
        }
        let tr = state.tr
        if (!reusable) tr = tr.insert(end, paragraph.create())
        const $target = tr.doc.resolve(Math.min(end + 1, tr.doc.content.size))
        view.dispatch(tr.setSelection(TextSelection.near($target)).scrollIntoView())
        view.focus()
      })
    },
    // Insert an image node at the current cursor position. `src` may be a
    // real path or a `draft://<key>` marker (the node view previews it via a
    // blob URL; useEditorSave rewrites it to /notes/img/… on save).
    insertImage({ src, alt = '' }) {
      getInstance()?.action((ctx) => {
        ctx.get(editorViewCtx).focus()
      })
      getInstance()?.action(callCommand(insertImageCommand.key, { src, alt }))
      // Images are inline nodes rendered as a full-width block, so a freshly
      // inserted one leaves the caret pinned beside it with nothing below to
      // click — you couldn't keep typing after an image. Land the caret on an
      // empty paragraph under it instead (reusing one if it's already there).
      getInstance()?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const $from = state.selection.$from
        if ($from.depth < 1) return
        const after = $from.after($from.depth)
        const next = state.doc.nodeAt(after)
        const paragraph = state.schema.nodes.paragraph
        if (!paragraph) return

        // Not every parent takes a second block: a GFM table cell holds exactly
        // one paragraph, so there's nowhere to put one after the image. Leave
        // the caret beside the image in that case rather than inserting nothing
        // and then resolving a position that lands in the next cell.
        const parent = $from.node($from.depth - 1)
        const index = $from.index($from.depth - 1) + 1
        const reusable = next?.type === paragraph && next.content.size === 0
        if (!reusable && !parent.canReplaceWith(index, index, paragraph)) {
          view.focus()
          return
        }

        let tr = state.tr
        if (!reusable) tr = tr.insert(after, paragraph.create())
        const $target = tr.doc.resolve(Math.min(after + 1, tr.doc.content.size))
        view.dispatch(tr.setSelection(TextSelection.near($target)).scrollIntoView())
        view.focus()
      })
    },
    // Retarget an image node's src (used to swap a transient draft://<key>
    // preview for the real /notes/img/… path once its upload resolves, T-050).
    // Image nodes are leaves (size unchanged), so positions stay valid across
    // the setNodeMarkup calls within one transaction.
    updateImageSrc(fromSrc, toSrc) {
      getInstance()?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        let tr = view.state.tr
        let changed = false
        view.state.doc.descendants((node, pos) => {
          if (node.type.name === 'image' && node.attrs.src === fromSrc) {
            tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: toSrc })
            changed = true
          }
        })
        if (changed) view.dispatch(tr)
      })
    },
    // Remove image node(s) with the given src (used to clean up a draft://
    // preview when its upload fails, so no dead marker survives). Deletes from
    // the end so earlier positions stay valid.
    removeImageBySrc(src) {
      getInstance()?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const targets = []
        view.state.doc.descendants((node, pos) => {
          if (node.type.name === 'image' && node.attrs.src === src) {
            targets.push({ from: pos, to: pos + node.nodeSize })
          }
        })
        if (!targets.length) return
        let tr = view.state.tr
        for (const t of targets.reverse()) tr = tr.delete(t.from, t.to)
        view.dispatch(tr)
      })
    },
    setStyle(style) {
      const level = HEADING_LEVEL[style]
      const inst = getInstance()
      if (!inst) return
      if (level) inst.action(callCommand(wrapInHeadingCommand.key, level))
      else inst.action(callCommand(turnIntoTextCommand.key))
    },
  }), [loading, getInstance])

  return (
    <div className={styles.editorSurface}>
      <Milkdown />
    </div>
  )
})

const NoteEditor = forwardRef(function NoteEditor({ content, onChange }, ref) {
  return (
    <MilkdownProvider>
      <MilkdownInner content={content} onChange={onChange} ref={ref} />
    </MilkdownProvider>
  )
})

export default NoteEditor
