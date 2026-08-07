// src/lib/noteDirectives.js
//
// Turns directive nodes nobody handles back into the literal text the author
// typed, before either Markdown pipeline gets to act on them.
//
// Notes define exactly seven directives (`:color`, `:mark`, `::youtube`,
// `::playground`, `::molecule`, `::anim`, `::sqlrun` – see NoteEditor.jsx's
// schemas and MarkdownRenderer.jsx's remarkNoteDirectives). remark-directive's *name*
// grammar is far wider than that: micromark-extension-directive v4 accepts
// digits anywhere in a name, so ordinary prose produces directives by accident.
// A clock time is the one that bites — "The time is now 09:30." parses `:30` as
// a textDirective named "30", and any note mentioning a time at all is affected.
//
// The two pipelines then fail in different ways, both wrong:
//
//   * The editor throws. Milkdown has no parser registered for the node, so
//     `Cannot match target parser for node` escapes the ProseMirror parse and
//     takes the whole NoteEditor down — the note becomes unopenable and only
//     EditorErrorBoundary's fallback is left (T-107).
//   * The reader silently drops it. mdast-util-to-hast's `unknown` handler
//     turns a valueless node into a `<div>`, so `:30` vanishes from the
//     sentence and a block element is spliced into the middle of a paragraph.
//
// Running this on both paths means an accidental directive renders as the text
// it always was, on both sides, and a note that round-trips through the editor
// saves back byte-identical.
import { visit, SKIP } from 'unist-util-visit'

/** Directives with a parser on both paths, by node type. A name registered for
 *  one type is still unhandled as another (`::color{…}` has no leaf parser),
 *  so the type is part of the key rather than an afterthought. Adding a
 *  directive means adding it here too — miss it and the new directive degrades
 *  to visible literal text rather than crashing, which is the failure this
 *  module exists to guarantee. */
const HANDLED_DIRECTIVES = {
  textDirective: new Set(['color', 'mark']),
  leafDirective: new Set(['youtube', 'playground', 'molecule', 'anim', 'sqlrun']),
  containerDirective: new Set(),
}

/** The `:`-run that opens each directive form. */
const DIRECTIVE_MARKER = {
  textDirective: ':',
  leafDirective: '::',
  containerDirective: ':::',
}

/**
 * The exact source the node was parsed from.
 *
 * Both callers hand unified the original Markdown (react-markdown builds a
 * real VFile; Milkdown passes the string as the file — see its
 * `remark.runSync(remark.parse(markdown), markdown)`), and remark-parse always
 * records offsets, so this is the normal path and it is byte-exact.
 */
function sourceSlice(node, source) {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  if (!source || typeof start !== 'number' || typeof end !== 'number') return null
  return source.slice(start, end) || null
}

/**
 * Rebuild `:name[label]{key="value"}` from the node alone, for the case where
 * the source is unavailable. Close enough to survive a round-trip; the label is
 * flattened to its text, so nested emphasis inside an *accidental* directive
 * would lose its markers. Never reached while the caller passes the source.
 */
function reconstruct(node) {
  const label = node.children?.length
    ? `[${node.children.map((child) => child.value ?? '').join('')}]`
    : ''
  const entries = Object.entries(node.attributes || {})
  const attrs = entries.length
    ? `{${entries.map(([key, value]) => `${key}="${value ?? ''}"`).join(' ')}}`
    : ''
  return `${DIRECTIVE_MARKER[node.type]}${node.name}${label}${attrs}`
}

/**
 * remark plugin: replace every unhandled directive with its literal source.
 *
 * A textDirective becomes a text node (it sits among phrasing content); the
 * block forms become a paragraph, since that is what a block-level directive
 * occupied. The result holds no directive node, so a parser that only knows the
 * five real ones can never meet one it has no rule for.
 */
export function remarkNoteDirectiveFallback() {
  return (tree, file) => {
    const source = typeof file?.value === 'string' ? file.value : ''
    visit(tree, (node, index, parent) => {
      if (!parent || index === null || index === undefined) return undefined
      const handled = HANDLED_DIRECTIVES[node.type]
      if (!handled || handled.has(node.name)) return undefined

      const raw = sourceSlice(node, source) ?? reconstruct(node)
      parent.children[index] = node.type === 'textDirective'
        ? { type: 'text', value: raw }
        : { type: 'paragraph', children: [{ type: 'text', value: raw }] }
      // Continue past the replacement: it is plain text now, and re-entering it
      // would only walk a node this plugin has nothing left to do to.
      return [SKIP, index + 1]
    })
  }
}

export default remarkNoteDirectiveFallback
