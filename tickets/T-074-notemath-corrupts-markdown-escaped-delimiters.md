---
id: T-074
title: Stop noteMath corrupting Markdown backslash-escaped $ and [
status: done
severity: high
area: notes
epic: none
created: 2026-07-28
---

## Summary

`normalizeNoteMath` (`src/lib/noteMath.js`) does not understand Markdown
backslash-escapes for `$` and `[`. It injects real `$` delimiters *inside*
`\$\$ ... \$\$` regions and misreads an escaped literal `\[` as TeX display
math. Both produce visibly corrupted output plus KaTeX parse errors, on the
reader and in the admin editor alike, because both call this same normaliser.

## Evidence

Verified by calling `normalizeNoteMath` directly on the real `content_md` of
the `math` / `notes • sem 2/discrete-random-variable` note (Supabase `notes`
table, id `5554e088-e91f-4095-938a-98a56e8b9d8a`):

| Input | Current output |
|---|---|
| `\$\$\text{Standard deviation of } X = \sqrt{\text{Var}(X)}\$\$` | `\$\$$\text{Standard deviation of } X = \sqrt{\text{Var}(X)}$\$\$` |
| `> \$\$\text{Var}(X) = 0\$\$` | `> \$\$$\text{Var}$(X) = 0\$\$` |
| `\text{Var}(X) = E(X^2) - \[E(X)]^2` | `$\text{Var}$(X) = E(X^2) - $$\nE(X)\n$$^2` |

Two distinct defects:

1. **Escaped dollars are protected only by accident.** `INLINE_PROTECT_RE`
   (`src/lib/noteMath.js:41`) matches `\$[^$\n]+\$`, so a two-dollar
   `\$ ... \$` region happens to be marked as an existing math region and is
   left alone. The four-dollar `\$\$ ... \$\$` shape has no two *adjacent*
   `$` characters (the bytes are `\`,`$`,`\`,`$`), so neither the `\$\$...\$\$`
   alternative nor `countDoubleDollar` (`:100`) ever sees it. The body is left
   unprotected and rule 4 (`inlineFormulaRuns`, `:283`) wraps a fragment of it
   in real `$...$`, stranding literal `$$` around a live math node.
2. **`\[` is read as TeX display math.** `TEX_DISPLAY_RE` (`:63`) is
   `/\\\[([\s\S]*?)\\?\]/g`; the optional `\\?` on the closing bracket lets it
   match `\[E(X)]`, which in Markdown is an escaped literal `[`. Rule 1 rewrites
   it to a `$$ ... $$` block mid-paragraph, which also blocks rule 3 from
   wrapping that line coherently (rule 1 wins the priority sort at `:346`), so
   the line splits into three broken pieces.

`unescapeMath` (`:92`) already strips `\_ \* \# \~ \|` from formula bodies for
exactly this "copied from a Markdown-escaped source" reason, but does not cover
`[` or `]`.

## Impact

An author pastes a formula from an LLM answer or a Markdown-escaped document, so
the dollars and brackets arrive escaped (`\$\$\text{Var}(X) = 0\$\$`). On save
the note is stored verbatim, which is correct. On *read*, the normaliser mangles
it:

- The reader (`MarkdownRenderer`) shows literal `$$` characters wrapped around a
  red `katex-error` span, since fragments like `\` and `X\` end up inside `$...$`.
  This is what is live on the `discrete-random-variable` note today.
- The admin editor (`@milkdown/plugin-math`) fed the same fragments and, before
  `52c5745`/`6c2fb64`, threw an uncaught `ParseError` that unmounted the whole
  React root (black screen). Those commits made it degrade to a red span instead,
  but the underlying corruption is still what generates the bad input.

No workaround exists short of hand-editing every affected note's `content_md`,
and the corruption is applied on the read path, so re-saving does not clear it.

## Suggested fix

Teach the normaliser that a backslash-escaped delimiter is a literal, and repair
the over-escaped shape only when it is unambiguously maths:

- Recognise `\$ ... \$` and `\$\$ ... \$\$` as an over-escaped delimiter pair and
  rewrite to `$ ... $` / `$$ ... $$`, but **only** when the enclosed body holds a
  LaTeX control word (`LATEX_COMMAND_RE`) or is a single bare letter. This is what
  keeps prose such as `it costs \$5 and \$10` untouched: a digit body never
  qualifies.
- When that guard fails, mark the escaped region *protected* so rules 3 and 4 can
  never inject a delimiter into it. Today's pass on those shapes is incidental,
  not intentional.
- Require a LaTeX control word before honouring `TEX_DISPLAY_RE`'s tolerant bare
  `]` closing, so `\[E(X)]` stops being read as display math. A properly paired
  `\[ ... \]` keeps working as it does now.
- Add `[` and `]` to `unescapeMath` so escaped brackets inside a formula body
  become literal brackets.

## Acceptance criteria

- [x] `\$\$\text{Var}(X) = 0\$\$` normalises to a single `$$ ... $$` block with no
      literal `$` characters left around it.
- [x] `\text{Var}(X) = E(X^2) - \[E(X)]^2` normalises to one coherent maths region
      whose body contains literal `[E(X)]`, not a nested `$$` block.
- [x] `it costs \$5 and \$10 total` and `costs \$5 and \frac{1}{2} of it` are
      returned unchanged.
- [x] A properly paired `\[ \frac{a}{b} \]` still becomes a `$$ ... $$` block.
- [x] Every `$`/`$$` region produced from the real `discrete-random-variable`
      `content_md` renders under `katex.renderToString(..., { throwOnError: true })`
      without throwing.
- [x] `npm run test:math` passes, with the shapes above pinned as new cases
      (including the "must not touch" money cases).

## Outcome

Fixed on `fix/T-074-notemath-escaped-delimiters`.

- New rule 0 in `normalizeNoteMath` repairs a paired escaped-delimiter run
  (`\$ … \$`, `\$\$ … \$\$`) to real maths, gated on the body carrying a LaTeX
  control word or being a lone variable. Non-repairable pairs (currency) are
  returned as a protected span so rules 3 and 4 can no longer reach inside them;
  that pass was previously incidental, via `INLINE_PROTECT_RE` mistaking the
  escaped dollars for a real `$ … $` region, and it failed outright on the
  four-dollar shape.
- `scanProtected` now also returns `isCode`, the code-only subset of its mask, so
  a `\$\$` sample written inside a fence or an inline code span is never repaired.
- `TEX_DISPLAY_RE` / `TEX_INLINE_RE` capture whether the closing backslash was
  present; the tolerant bare `]` / `)` form is honoured only when the body holds a
  LaTeX control word, so `\[E(X)]` stops being read as display maths.
- `unescapeMath` also strips `\[` / `\]`.

Verified: `npm run test:math` 68 passed / 0 failed (52 before, 16 added).
Feeding both the originally reported `content_md` and the current prod row
through the normaliser and then `katex.renderToString(..., { throwOnError: true })`
yields 0 throws and 0 stray literal `\$`; the reported content previously threw on
22 of 44 regions. `npm run build` succeeds.

Note the prod row was hand-edited at 2026-07-28T18:12Z, which removed the escaped
dollars but left `\[E(X)]`, so the second half of this fix is still what that note
needs to render.

## References

- `52c5745` set `throwOnError: false` on the editor's KaTeX options; `6c2fb64`
  corrected it to target `katexOptionsCtx.key`. Both contain the symptom, not
  this root cause.
- `src/lib/noteMath.js`, `src/lib/noteMath.test.js`
- Affected note: `notes` table id `5554e088-e91f-4095-938a-98a56e8b9d8a`
  (`math` / `notes • sem 2/discrete-random-variable`)
