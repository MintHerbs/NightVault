import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, schemaCtx, serializerCtx } from '@milkdown/kit/core'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import CodeBlock from '../../social/CodeBlock/CodeBlock'
import { resolveDraftSrc } from '../../../lib/draftImagePreviews'
import { resolveNoteImageSrc, noteImageFallbackSrc } from '../../../lib/noteImageSrc'
import { parseImageTitle, formatImageTitle, MIN_IMAGE_WIDTH } from '../../../lib/noteImageWidth'
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
import { math } from '@milkdown/plugin-math'
import { callCommand, replaceAll, getMarkdown, markdownToSlice, $prose, $view } from '@milkdown/kit/utils'
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

// Strip markdown backslash-escapes that leak into LaTeX when a formula is
// copied from a markdown-escaped source (e.g. `a\_{11}` → `a_{11}` so it renders
// as a subscript). Never touches `\\` (a LaTeX row break) or `\{`/`\}`.
function unescapeMath(body) {
  return body.replace(/\\([_*#~|])/g, '$1')
}

// Normalise LaTeX so pasted formulas auto-render. remark-math only knows
// `$…$` / `$$…$$`, but LaTeX is commonly copied with `\[ … \]` (display) and
// `\( … \)` (inline) delimiters. Convert them to `$$`/`$` before parsing.
// Closing delimiters tolerate a missing backslash (`\[ … ]`), which some
// sources produce.
function normalizeLatexDelimiters(text) {
  return text
    // \[ … \] → $$ … $$   (display)
    .replace(/\\\[([\s\S]*?)\\?\]/g, (_, body) => `$$\n${unescapeMath(body.trim())}\n$$`)
    // \( … \) → $ … $     (inline)
    .replace(/\\\(([\s\S]*?)\\?\)/g, (_, body) => `$${unescapeMath(body.trim())}$`)
}

// Render fenced code blocks with the shared social CodeBlock (themed, read-only)
// so the editor matches the reader. Reuses the real React component via a
// react-dom root; no contentDOM => not inline-editable here (reveal-to-edit is
// T-037). The node's text stays in the doc model, so Markdown round-trip is
// unaffected. React root mount/unmount is deferred a microtask to stay clear of
// ProseMirror's synchronous view-update cycle.
const codeBlockView = $view(codeBlockSchema, () => (node) => {
  const dom = document.createElement('div')
  const root = createRoot(dom)
  const render = (n) => queueMicrotask(() => {
    try {
      root.render(<CodeBlock code={n.textContent} language={n.attrs.language || 'auto'} />)
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
})

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
//              auto-render); code blocks keep raw text.
//   • copy   → serialise the selection back to Markdown (so copying a formula
//              yields its `$…$` source).
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
      let slice
      try {
        slice = markdownToSlice(normalizeLatexDelimiters(text))(ctx)
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
      .use(markdownClipboard)
      .use(codeBlockView)
      .use(imageDeleteView)
      .use(trailingClickTarget)
      .use(listener)
  )

  const [loading, getInstance] = useInstance()

  // Push external content changes (note load / draft restore / clear) into the
  // editor. Guarded so the editor's own emissions don't re-enter as resets.
  useEffect(() => {
    if (loading) return
    const incoming = content ?? ''
    if (incoming === lastEmitted.current) return
    applyingExternal.current = true
    lastEmitted.current = incoming
    getInstance()?.action(replaceAll(incoming))
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
