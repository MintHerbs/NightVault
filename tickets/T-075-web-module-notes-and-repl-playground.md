---
id: T-075
title: Import the Web module notes (ch1-20) with an interactive REPL playground node
status: done
severity: medium
area: notes
epic: E-004
created: 2026-07-28
---

## Summary

A 20-chapter "Web & Mobile Development" course document exists as one
standalone HTML file (`module-notes-ch1-20_1.html`, 1421 lines) and has to
become 20 notes under the existing `web` Subject, read through the normal
`NoteReader`. Three things in it have no representation in the note format
today: eight embedded live site previews (interactive jQuery demos, plus two
"this is what no CSS looks like" comparison previews), seven inline SVG
diagrams, and a per-code-block filename label on all 37 code blocks.

## Evidence

- `MarkdownRenderer.jsx:91-95` — the reader deliberately has no `rehype-raw`,
  so raw HTML in `content_md` renders as literal text. The only sanctioned
  escape hatch is the remark-directive → hast mapping at
  `MarkdownRenderer.jsx:26-55` that backs `::youtube{id="…"}` (T-055).
- `CodeBlock.jsx:20-31` — the header renders only the language label. There is
  no title/filename slot, so the 37 `<div class="bar">recruitment/models.py</div>`
  labels in the source have nowhere to go.
- `codeHighlighter.js:1-19` — `LANGUAGE_ALIASES` has no `bash`, `shell`, `http`
  or `text` entry, so `getLanguageLabel` falls through to
  `String(language)` (`codeHighlighter.js:62`) and a terminal block would be
  labelled lowercase "bash".
- `NoteEditor.jsx:171-204` — `youtubeSchema` exists precisely so a custom
  directive survives a Milkdown round-trip. Any new directive without an
  equivalent schema is destroyed the first time the note is opened and saved
  in the admin editor.
- The seven diagrams are inline `<svg>` with no `xmlns`, and their `#0b0d17`
  background lives on the wrapping `<div>`, not in the SVG
  (`module-notes-ch1-20_1.html:177-189` is representative).
- `NoteReader.module.css:10` uses `background: var(--bg)`, which resolves via
  `adminTokens.css:50` to the theme-aware `--color-bg` (`#fafafa` in light).
- `vercel.json` is rewrites-only and `index.html` sets no CSP meta tag, so an
  `<iframe srcDoc>` carrying inline `<script>` executes. Under a
  `script-src 'self'` policy it would not, since srcdoc frames inherit the
  parent policy in Chromium.
- `imageToWebp.js:34` passes `image/svg+xml` through un-rasterised, and the
  `note-images` bucket is created with no `allowed_mime_types` restriction
  (`0023_sidebar_modules_and_images.sql:124`), so SVG is already supported
  end to end.

## Impact

Without a playground node, the eight previews can only ship as screenshots or
be dropped, and Chapters 2, 4, 7, 8, 9 and 12 lose the demo their prose
refers to directly ("Try it above, submit empty, submit with a bad email").
Without an editor-side schema for the node, the first admin edit of any such
chapter silently deletes the playground. Extracting the SVGs naively produces
white-on-transparent diagrams that are invisible in light theme.

## Suggested fix

Four parts, in this order:

1. **CodeBlock**: read fence meta as a title (` ```python recruitment/models.py `)
   and render it beside the language label; add `bash`/`shell`/`http`/`text`
   aliases. Shared with the social feed, so the title slot must be optional
   and absent-by-default.
2. **Playground node**: a `::playground{id="…"}` leaf directive resolved
   against a code-defined registry under `src/content/playgrounds/`. Rendered
   by a new `src/components/markdown/NotePlayground/` component: code-block
   chrome, HTML/CSS/JS tabs over Monaco, debounced re-render into a
   `sandbox="allow-scripts"` iframe, and a reset control. Sandboxed without
   `allow-same-origin` so an edited playground cannot reach the parent page
   or the Supabase session. Register a matching node schema in `NoteEditor`.
3. **Assets**: extract the seven SVGs, add `xmlns` and a baked background
   `<rect>`, upload to `note-images/web/`. Replace the two `placehold.co`
   references inside the Chapter 2 playground with local data so the demo has
   no third-party dependency.
4. **Content**: convert the 20 chapters to Markdown and import them into the
   `web` Subject's existing `notes/` folder, alongside — and leaving untouched
   — the contributed `web/notes/jquery` note already there.

## Acceptance criteria

Verified against the local stack (21 notes + 7 diagrams seeded, driven with
Playwright, screenshots in the session scratchpad), then run on production
2026-07-29 — 21 notes via `build/import-web-notes.prod.sql` in the dashboard SQL
editor, 7 diagrams via the service role. Confirmed after by hashing every
chapter's stored `content_md` against its source file: 21/21 byte-identical, so
the notes landed intact rather than merely as 21 rows.

- [x] Twenty notes exist under the `web` Subject and each renders through the
      normal reader — 20 chapters plus an overview index, at `web/notes/*`
- [x] The eight previews render live, and their code is editable with the
      result updating and a reset back to the original — typing
      `body { background: rgb(0,128,0) }` into the CSS pane moved the frame
      from `rgb(11,13,23)` to `rgb(0,128,0)`; Reset restored it
- [x] A playground survives opening and saving the note in the admin editor —
      two consecutive round-trips kept all 3 directives and all 6 fence
      filenames, and the second changed only the probe text (serialisation is
      idempotent)
- [x] The seven diagrams render in both light and dark theme — 5/5 load in
      light mode against a `rgb(248,247,247)` page, legible on their baked-in
      `#0b0d17` backdrop
- [x] Code blocks show their source filename where the original had one — all
      37, e.g. `JAVASCRIPT · fetch, GET and POST`
- [x] The pre-existing `web/notes/jquery` note is unchanged — holds on local,
      and on production after the import its `updated_at` still reads
      `2026-07-26T19:12:43.433396+00:00`, unchanged to the microsecond

Also verified, beyond the original criteria:

- jQuery loads and runs inside the sandboxed frame (ch08 live validation went
  "Needs an @ and a ." → "Looks good" as the value was typed)
- the in-frame error bridge reports pane-relative line numbers
  ("Uncaught ReferenceError: … (JS line 1)"), not document-relative ones
- `normalizeNoteMath` is a no-op on all 21 files, so the ~40 jQuery `$(…)`
  occurrences are not mistaken for maths
- zero console/page errors across the reader, the REPL and the editor
- the registry is code-split into its own 17 KB chunk, so a note with no
  playground does not download it (MarkdownRenderer 222.6 → 205.9 kB)

## Notes for whoever picks this up

- `mdast-util-directive` serialises the `id` attribute using the directive
  spec's `#` shorthand, so `::playground{id="x"}` comes back as
  `::playground{#x}` after any editor save. Both parse to
  `attributes: { id: 'x' }`, so this is cosmetic — but a grep for the
  `id="…"` form will appear to find nothing once a note has been edited. The
  same is already true of `::youtube` (T-055).
- 0042's authorship trigger **is** applied on production (probed directly
  2026-07-29), so a service-role import cannot work there: `auth.uid()` is null
  and `note_authors.user_id` is NOT NULL, giving `23502`.
  `scripts/import-web-module-notes.mjs` detects this and refuses rather than
  failing halfway, so it needs sign-in mode — but there is no `auth.users` row
  for `munazir.ramjhun@gmail.com`, so that path cannot authenticate either.
  The production import therefore ran as generated SQL
  (`build/import-web-notes.prod.sql`) in the dashboard SQL editor, attributing
  to uuid `662b1d4d-…`, with the diagrams uploaded separately under the service
  role (Storage has no authorship trigger).
- That SQL cannot be delivered through an MCP `execute_sql` call or pasted into
  a chat: Chapter 13 teaches SQL injection and XSS, so its body contains
  `' OR 1=1` and `<script>stealCookies()</script>`, which Cloudflare blocks at
  the Anthropic edge before the request reaches Supabase. Paste the file
  straight into the dashboard, or pipe it to `psql` from disk.

## References

- E-004 — Notes authoring & reading overhaul (this is the same
  new-content-node shape as T-055)
- `docs/specs/notes-wysiwyg-and-reader.md`
- Source document: `module-notes-ch1-20_1.html`
