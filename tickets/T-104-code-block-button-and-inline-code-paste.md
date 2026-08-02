---
id: T-104
title: Code block toolbar button does nothing, and pasting code into an inline `code` span explodes into multiple blocks
status: done
severity: high
area: admin
epic: E-004
created: 2026-08-02
---

## Summary

The editor toolbar's "Code block" button was wired to Milkdown's *inline code*
command, which no-ops on an empty selection — so clicking it did nothing at
all, and there was no way to author a code block in the WYSIWYG editor.
Authors worked around it by typing `` `backticks` `` and pasting inside, which
ran the snippet through the Markdown parser and shredded it into several
spurious code blocks.

## Evidence

Reproduced live against the real `NoteEditor` (headless Chromium, Milkdown
document + serialised Markdown inspected after each step).

All line numbers below are **pre-fix** (`git show HEAD:<path>`), since the fix
moved them.

**Button**
- `src/components/admin/EditorNavbar.jsx:305` — button tooltipped "Code block"
  calls `onFormatAction('code')`.
- `src/components/admin/NoteEditor/NoteEditor.jsx:1127` maps `code`
  to `toggleInlineCodeCommand`.
- `node_modules/@milkdown/preset-commonmark/lib/index.js:251-253` — that
  command opens with `if (selection.empty) return false`. Confirmed: clicking
  with a bare caret left the document byte-identical; with a selection it
  produced `` `inline code` ``, never a fence.
- The Monaco path it replaced did insert a real fence
  (`src/hooks/useEditorFormatting.js:237-239`), so this is a WYSIWYG
  regression from T-036.

**Paste**
- `src/components/admin/NoteEditor/NoteEditor.jsx:932` skipped
  Markdown re-parsing only when `$from.parent.type.spec.code` — i.e. only
  inside a code *block* node. Inline code is a **mark** on a paragraph, so the
  guard missed it and the paste fell through to `insertPlainTextPaste`.
- Pasting a Python class with the caret inside `` `ab` `` produced:
  `__init__` rendered as bold, all leading indentation stripped, one extra
  fenced block per blank-line-separated indented chunk, and the inline span
  split into `` `a` `` … `` `b` ``.

**Why the button could not simply be re-pointed**
- `codeBlockView` (`NoteEditor.jsx:582`) mounts the React `CodeBlock` with no
  `contentDOM`, so code blocks are read-only in the editor — click-to-edit is
  T-037, still backlog. Confirmed: clicking a rendered block and typing changes
  nothing. `createCodeBlockCommand` would therefore have handed the author an
  empty block they could never fill.

## Impact

Any author writing a note containing code. There was no working path to a code
block: the toolbar button was inert, and the backtick workaround silently
corrupted the pasted snippet — losing indentation (fatal for Python), turning
`__dunder__` names into bold, and scattering the snippet across several blocks.
Corruption landed in the saved Markdown, so it reached published notes.

## Fix

Insert/edit via a modal, matching the existing `FormulaModal` /
`ChemistryModal` pattern, since there is nowhere in the editor to type code:

- `src/components/admin/CodeBlockModal.jsx` (new) — verbatim `<textarea>`
  (a plain textarea does no Markdown parsing, which is the paste fix), language
  select, optional title → fence meta, live `CodeBlock` preview.
- `EditorNavbar` "Code block" button opens it; double-clicking a rendered block
  reopens it seeded for editing (`handleDoubleClickOn` in `codeBlockView` fires
  `note-editor:edit-code-block`, which `NoteEditor` forwards to `AdminEditor`).
  ` ```reaction ` fences are excluded — they belong to `ChemistryModal`.
- `NoteEditor` ref gains `insertCodeBlock` / `updateCodeBlock`, which build the
  `code_block` node directly rather than parsing a fence, so code containing a
  ` ``` ` run needs no fence-length negotiation (the serialiser widens it).
- Paste guard extended to inline code (`isInInlineCode`): the clipboard goes in
  verbatim carrying the mark, newlines collapsed to spaces since an inline span
  is one line.
- `caretAfterBlock` extracted from `insertYouTube` and taught to step out of a
  code block, which holds text and so parks the caret inside itself.

## Acceptance criteria

- [x] Clicking "Code block" with a bare caret opens the modal and inserts a real
      fenced block with language and title.
- [x] Double-clicking a rendered code block reopens it seeded with its code,
      language and title; saving writes back in place.
- [x] Pasting multi-line code inside `` `backticks` `` stays one paragraph, one
      inline span, verbatim — no extra code blocks, no bolded `__init__`.
- [x] Regressions hold: Markdown paste into a paragraph still parses; paste into
      a code block is still verbatim; ` ```reaction ` double-click does not open
      the code modal; the inline-code toggle still works on a selection.
- [x] Code containing a ` ``` ` run round-trips (serialises to a ` ```` ` fence).
- [x] `vite build`, `stylelint`, and `npm test` pass.

## References

- T-037 — inline click-to-edit for code blocks; once shipped, the modal becomes
  the "edit with language/title" surface rather than the only way in.
- T-036 — the WYSIWYG foundation this regressed from.
- ADR 0001 — fenced code round-trips losslessly, so no new node schema.
