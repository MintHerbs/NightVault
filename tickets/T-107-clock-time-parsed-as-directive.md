---
id: T-107
title: A clock time in note prose parses as a directive and crashes the editor
status: done
severity: critical
area: admin
epic: none
created: 2026-08-06
---

## Summary

`micromark-extension-directive` v4 accepts digits in a directive name, so
`09:30` written in ordinary prose parses `:30` as a `textDirective`. Milkdown
has no parser registered for it and throws `Cannot match target parser for
node`, which takes the whole NoteEditor down — the note cannot be opened at
all, only `EditorErrorBoundary`'s "This note couldn't be displayed" fallback.
The reader doesn't crash but silently drops the `:30` and splices an empty
`<div>` into the middle of the paragraph.

## Evidence

- `node_modules/micromark-extension-directive@4.0.0` — parsing
  `The time is now 09:30.` with `remark-parse` + `remark-directive` yields
  `{type: 'textDirective', name: '30'}`. No `:color`/`:mark` syntax involved.
- Reproduced by mounting [NoteEditor.jsx](src/components/admin/NoteEditor/NoteEditor.jsx)
  on the stored Markdown of note `2eb662a3-e3d9-41da-86ea-5e4b221aadc6`
  (`math :: notes • sem 1/discrete-integers`, line 234:
  `***Clock Arithmetic Problem***: The time is now 09:30. …`):

  ```
  MilkdownError: Cannot match target parser for node:
  {"type":"textDirective","name":"30", … "line":234,"column":51}
  ```

  thrown from `@milkdown/transformer`'s `parserMatchError`, escaping the
  ProseMirror parse with nothing below the boundary to catch it.
- Reader path: `mdast-util-to-hast`'s `unknown` handler turns the valueless
  directive node into `<div></div>`, so the paragraph renders as
  `The time is now 09` + empty block + `. What next?`.
- Prod scan of all 144 notes: 1 note affected today
  (`math :: notes • sem 1/discrete-integers`).

## Impact

Any author writing a time of day, or any other `:` followed by an
alphanumeric run, in note prose makes that note permanently unopenable in the
admin editor. Because the parse fails, the note also can't be edited to
remove the offending text through the UI — the only repair path was direct
SQL. Five directives are real (`:color`, `:mark`, `::youtube`,
`::playground`, `::molecule`); every other name the grammar admits was a
crash.

## Suggested fix

Rewrite unhandled directives back to the literal source they were parsed
from, before either pipeline acts on the tree, so a parser that only knows
the five real directives can never meet one it has no rule for.

## Acceptance criteria

- [x] A note containing `09:30` opens in the editor and renders the text
      verbatim.
- [x] The reader renders the same text with no injected block element.
- [x] `:color` / `:mark` / `::youtube` / `::playground` / `::molecule` still
      resolve on both paths, including with invalid attributes.
- [x] Flattening reaches a fixed point: re-parsing what the editor saves
      produces identical Markdown.

## References

- `src/lib/noteDirectives.js` — the shared fallback plugin
- `src/lib/noteDirectives.test.js` — `npm run test:directives`
- T-055 — the directive syntax this rides on
- `src/components/admin/NoteEditor/EditorErrorBoundary.jsx` — the fallback the
  user actually saw
