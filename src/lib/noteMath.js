// src/lib/noteMath.js
//
// Turns *bare* LaTeX in note Markdown into delimited math, so every formula
// typesets and not just the ones that happened to arrive with delimiters.
//
// remark-math (reader) and @milkdown/plugin-math (editor) recognise exactly two
// things: `$…$` and `$$…$$`. LaTeX copied out of lecture slides, a PDF or an LLM
// answer usually has no delimiters at all:
//
//   \text{Average Waiting Time} = \frac{0 + 24 + 27}{3} = 17 \text{ seconds}
//
// so no math node is produced and the raw source is what the reader sees. What
// *did* work before was TeX's own `\[ … \]` / `\( … \)`, which is why pasted
// matrices rendered (that is how they are commonly copied) while a plain
// equation did not. This module closes the gap by rewriting four shapes into
// `$`/`$$` before the Markdown is parsed:
//
//   1. `\[ … \]` → `$$ … $$`,  `\( … \)` → `$ … $`
//   2. `\begin{env} … \end{env}` → `$$ … $$`   (bmatrix, align, cases, …)
//   3. a line that is *nothing but* a formula → `$$ … $$` (display)
//   4. a formula embedded in a prose line → `$ … $` (inline)
//
// Rules 3 and 4 are heuristics, so the guiding rule is "never corrupt
// non-maths": anything inside a fenced or indented code block, an inline code
// span, or an existing `$…$` region is left strictly alone, and so is any line
// still carrying an unpaired `$` after those are accounted for. A missed
// formula shows as raw TeX (what already happens today); a false positive would
// mangle someone's prose, which is much worse.
//
// Both sides call this: the editor's paste handler (write path) and
// MarkdownRenderer (read path), so a formula pasted today and a note saved
// before this existed render identically and the two can't drift.

/** Opening/closing fence of a fenced code block. */
const FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})/
/** A CommonMark indented code block line: its content is code, not maths. */
const INDENTED_CODE_RE = /^(?: {4,}|\t)/
/** Inline code spans, then `$$…$$`, then `$…$`. Order matters: a code span
 *  wins over any `$` inside it. */
const INLINE_PROTECT_RE = /(`+)[^`]*?\1|\$\$[^\n]*?\$\$|\$[^$\n]+\$/g
/** Markdown block markers. A line starting with one of these is structural, so
 *  rule 3 leaves it to rule 4 rather than wrapping the whole line in `$$`.
 *  List markers require the trailing space, so `-\frac{1}{2}` still counts as a
 *  formula line rather than a bullet. */
const BLOCK_PREFIX_RE = /^(?:#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\||!\[|\[)/

/** A LaTeX control word. Two letters minimum, so a Markdown backslash-escape
 *  (`\_`, `\*`) is never mistaken for one. */
const LATEX_COMMAND_RE = /\\[a-zA-Z]{2,}/
/** Commands whose braces hold prose by design, so their contents must not
 *  count against the "is this line a formula?" test below. */
const TEXT_COMMAND_RE = /\\(?:text|textbf|textit|textrm|textsf|texttt|mathrm|mathbf|mathit|mathsf|mathtt|operatorname|mbox|hbox|label|tag|ref)\*?\s*\{[^{}]*\}/g
const ENV_DELIM_RE = /\\(?:begin|end)\s*\{[a-zA-Z*]+\}/g
const COMMAND_RE = /\\[a-zA-Z]+\*?/g

const MATH_ENV_RE = /\\begin\s*\{([a-zA-Z*]+)\}[\s\S]*?\\end\s*\{\1\}/g
// Closing delimiters tolerate a missing backslash (`\[ … ]`), which some
// sources produce.
const TEX_DISPLAY_RE = /\\\[([\s\S]*?)\\?\]/g
const TEX_INLINE_RE = /\\\(([\s\S]*?)\\?\)/g

/** Gap between two formula fragments that is itself pure maths, so the two are
 *  one run (`\alpha + \beta` is one formula, not two). Deliberately excludes
 *  letters, which is what stops a merge from swallowing the prose in
 *  `\alpha, and then \beta`. */
const MERGEABLE_GAP_RE = /^[\s0-9+\-*/=<>^_(),.:;|&!~'"[\]{}]*$/
const MAX_MERGE_GAP = 24

/** A lone variable written after a command belongs to it: `\log_2 n`,
 *  `\Delta t`, `\sqrt x`. One character with a boundary after it, so a prose
 *  word is never absorbed. */
const LONE_VARIABLE_RE = /^ ([A-Za-z0-9])(?![A-Za-z0-9])/
/** …except English's one-letter words, which are the collision that matters:
 *  without this, "\frac{1}{2} a bit later" pulls "a" into the formula. */
const ENGLISH_ONE_LETTER_WORDS = new Set(['a', 'A', 'I'])

/** Delimiters remark-math actually understands, used to decide whether the
 *  reader needs the (heavy) KaTeX chunk at all. `$$…$$` may span lines. */
export const MATH_DELIMITED_RE = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/

/**
 * Strip Markdown backslash-escapes that leak into LaTeX when a formula is
 * copied from a Markdown-escaped source (`a\_{11}` → `a_{11}`, so it renders as
 * a subscript instead of a literal underscore — Markdown does not process
 * escapes inside `$…$`, so KaTeX would otherwise receive the backslash).
 * Never touches `\\` (a LaTeX row break) or `\{` / `\}`.
 */
function unescapeMath(body) {
  return body.replace(/\\([_*#~|])/g, '$1')
}

function countDoubleDollar(text) {
  let count = 0
  for (let i = 0; i < text.length - 1; i += 1) {
    if (text[i] === '$' && text[i + 1] === '$') {
      count += 1
      i += 1
    }
  }
  return count
}

/**
 * Marks the regions that must not be rewritten: code (fenced, indented,
 * inline) and anything already delimited as maths. Also returns the line table,
 * since both this scan and the line-level rules need it.
 *
 * → { isProtected(start, end), lines: { start, end, text, open }[] }
 *
 * `open: false` means "skip this line entirely" and covers the two cases a
 * marked region can't express: a line inside a multi-line `$$ … $$` block, and
 * a line left holding an unpaired `$`. Wrapping a formula on either would emit
 * a `$` that re-pairs with the stray one and swallow the text between them.
 *
 * The result is a prefix sum rather than a list of ranges so that the overlap
 * test every candidate rewrite runs is O(1). Scanning a range list instead is
 * O(ranges) per candidate, which on a maths-heavy note is quadratic in the note
 * size, and this runs inside the reader's render.
 */
function scanProtected(md) {
  const marked = new Uint8Array(md.length)
  const lines = []
  let offset = 0
  let fence = null
  let inMathBlock = false

  for (const text of md.split('\n')) {
    const start = offset
    const end = start + text.length
    offset = end + 1

    const fenceMatch = FENCE_RE.exec(text)
    if (fence) {
      // Inside a fenced block: only a matching fence of at least the opening
      // length closes it, so ``` inside a ~~~ block stays content.
      if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length) fence = null
      marked.fill(1, start, end)
      lines.push({ start, end, text, open: false })
      continue
    }
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length }
      marked.fill(1, start, end)
      lines.push({ start, end, text, open: false })
      continue
    }
    if (inMathBlock) {
      if (countDoubleDollar(text) % 2 === 1) inMathBlock = false
      marked.fill(1, start, end)
      lines.push({ start, end, text, open: false })
      continue
    }
    if (INDENTED_CODE_RE.test(text)) {
      marked.fill(1, start, end)
      lines.push({ start, end, text, open: false })
      continue
    }

    // Blank out the paired code spans / maths regions, then judge what's left.
    let masked = text
    INLINE_PROTECT_RE.lastIndex = 0
    let match
    while ((match = INLINE_PROTECT_RE.exec(text)) !== null) {
      marked.fill(1, start + match.index, start + match.index + match[0].length)
      masked = masked.slice(0, match.index) + ' '.repeat(match[0].length) + masked.slice(match.index + match[0].length)
    }

    const looseDollar = masked.includes('$')
    if (looseDollar) {
      if (countDoubleDollar(masked) % 2 === 1) inMathBlock = true
      marked.fill(1, start, end)
    }
    lines.push({ start, end, text, open: !looseDollar })
  }

  const protectedBefore = new Int32Array(md.length + 1)
  for (let i = 0; i < md.length; i += 1) protectedBefore[i + 1] = protectedBefore[i] + marked[i]

  return {
    lines,
    isProtected: (start, end) => protectedBefore[end] - protectedBefore[start] > 0,
  }
}

/**
 * Is this the *whole* of a formula rather than a sentence that mentions one?
 *
 * Strips the parts that are LaTeX by definition (control words, environment
 * delimiters, row breaks, and the prose inside `\text{…}`-style commands) and
 * requires what remains to hold no word of three or more letters. Maths
 * variables are one or two characters (`x`, `n`, `dx`), so "seconds" or
 * "Average" surviving the strip means the line is prose.
 */
function isWholeFormula(text) {
  const body = text.trim()
  if (!body) return false
  if (!LATEX_COMMAND_RE.test(body)) return false
  if (BLOCK_PREFIX_RE.test(body)) return false

  const residue = body
    .replace(TEXT_COMMAND_RE, ' ')
    .replace(ENV_DELIM_RE, ' ')
    .replace(/\\\\/g, ' ')
    .replace(COMMAND_RE, ' ')
    .replace(/\\[^a-zA-Z]/g, ' ')

  return !/[A-Za-z]{3,}/.test(residue)
}

/** End of a `{…}` / `[…]` group at `i`, or -1. Honours backslash-escapes. */
function scanGroup(text, i, open, close) {
  if (text[i] !== open) return -1
  let depth = 0
  for (let j = i; j < text.length; j += 1) {
    const ch = text[j]
    if (ch === '\\') {
      j += 1
      continue
    }
    if (ch === open) depth += 1
    else if (ch === close) {
      depth -= 1
      if (depth === 0) return j + 1
    }
  }
  return -1
}

/** End of the smallest maths unit at `i` (a group, a control word, or a single
 *  alphanumeric), or -1. */
function scanAtom(text, i) {
  const ch = text[i]
  if (ch === undefined) return -1
  if (ch === '{') return scanGroup(text, i, '{', '}')
  if (ch === '\\') {
    const match = /^\\([a-zA-Z]+\*?|.)/.exec(text.slice(i))
    return match ? i + match[0].length : -1
  }
  if (/[A-Za-z0-9]/.test(ch)) return i + 1
  return -1
}

/**
 * End of the command at `i` together with everything bound to it: its `{…}` and
 * `[…]` arguments, any `^`/`_` scripts, and digits written straight after it
 * (`\frac12`). Stops at the first character that isn't part of the command, so
 * the trailing prose in `\frac{1}{2} of the total` is not absorbed.
 */
function scanCommand(text, i) {
  let end = scanAtom(text, i)
  if (end < 0) return -1

  for (;;) {
    const ch = text[end]
    let next = -1
    if (ch === '{') next = scanGroup(text, end, '{', '}')
    else if (ch === '[') next = scanGroup(text, end, '[', ']')
    else if (ch === '^' || ch === '_') next = scanAtom(text, end + 1)
    else if (ch !== undefined && /[0-9]/.test(ch)) next = end + 1
    else if (ch === ' ') {
      const variable = LONE_VARIABLE_RE.exec(text.slice(end))
      if (variable && !ENGLISH_ONE_LETTER_WORDS.has(variable[1])) next = end + variable[0].length
    }
    if (next < 0) break
    end = next
  }
  return end
}

/** Formula runs inside one line, as `[start, end]` offsets into it. */
function inlineFormulaRuns(text) {
  const runs = []
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '\\') continue
    if (!/^\\[a-zA-Z]{2,}/.test(text.slice(i))) continue
    const end = scanCommand(text, i)
    if (end < 0) continue
    const last = runs[runs.length - 1]
    // Two commands separated by nothing but maths are one formula.
    if (last && end - last[1] <= MAX_MERGE_GAP && MERGEABLE_GAP_RE.test(text.slice(last[1], i))) last[1] = end
    else runs.push([i, end])
    i = end - 1
  }
  return runs
}

/**
 * Wrap every bare LaTeX formula in `$`/`$$` so the Markdown pipeline typesets
 * it. Idempotent: running it over already-delimited content is a no-op, since
 * everything inside `$…$` is protected.
 */
export function normalizeNoteMath(input) {
  const md = typeof input === 'string' ? input : String(input ?? '')
  // No backslash means no LaTeX, and that is the overwhelming majority of notes.
  if (!md.includes('\\')) return md

  const { isProtected, lines } = scanProtected(md)
  const edits = []
  const add = (priority, start, end, text) => {
    if (isProtected(start, end)) return
    edits.push({ priority, start, end, text })
  }

  // 1. TeX's own delimiters.
  for (const m of md.matchAll(TEX_DISPLAY_RE)) {
    add(1, m.index, m.index + m[0].length, `$$\n${unescapeMath(m[1].trim())}\n$$`)
  }
  for (const m of md.matchAll(TEX_INLINE_RE)) {
    add(1, m.index, m.index + m[0].length, `$${unescapeMath(m[1].trim())}$`)
  }

  // 2. Environments are unambiguously maths wherever they appear.
  for (const m of md.matchAll(MATH_ENV_RE)) {
    add(2, m.index, m.index + m[0].length, `$$\n${unescapeMath(m[0].trim())}\n$$`)
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.open) continue

    // 3. A line that is only a formula becomes display maths. `$$` on its own
    //    line is block maths only when the line stands alone as a paragraph;
    //    mid-paragraph it would be parsed as inline anyway, so wrap it as such
    //    rather than inserting newlines that split the author's paragraph.
    if (isWholeFormula(line.text)) {
      const body = unescapeMath(line.text.trim())
      const leading = line.text.length - line.text.trimStart().length
      const standalone = !lines[i - 1]?.text.trim() && !lines[i + 1]?.text.trim()
      add(3, line.start + leading, line.start + line.text.trimEnd().length, standalone ? `$$\n${body}\n$$` : `$${body}$`)
    }

    // 4. Formulas embedded in prose become inline maths. Emitted for every open
    //    line: where rule 3 also fired it loses on priority.
    for (const [runStart, runEnd] of inlineFormulaRuns(line.text)) {
      add(4, line.start + runStart, line.start + runEnd, `$${unescapeMath(line.text.slice(runStart, runEnd))}$`)
    }
  }

  if (!edits.length) return md

  // Lowest priority wins a contested region, so rule 1 beats rule 3 on a line
  // that is nothing but `\[ … \]`, and rule 3 beats rule 4 on a formula line.
  edits.sort((a, b) => a.priority - b.priority || a.start - b.start)
  const taken = new Uint8Array(md.length)
  const accepted = []
  for (const edit of edits) {
    let clash = false
    for (let i = edit.start; i < edit.end; i += 1) {
      if (taken[i]) { clash = true; break }
    }
    if (clash) continue
    taken.fill(1, edit.start, edit.end)
    accepted.push(edit)
  }

  // Rebuild in one pass. Splicing the string per edit re-copies the whole note
  // each time, which is quadratic on a note with many formulas.
  accepted.sort((a, b) => a.start - b.start)
  const out = []
  let cursor = 0
  for (const edit of accepted) {
    out.push(md.slice(cursor, edit.start), edit.text)
    cursor = edit.end
  }
  out.push(md.slice(cursor))
  return out.join('')
}

/** Does this note contain maths once bare LaTeX is accounted for? */
export function noteHasMath(content) {
  return MATH_DELIMITED_RE.test(normalizeNoteMath(content))
}
