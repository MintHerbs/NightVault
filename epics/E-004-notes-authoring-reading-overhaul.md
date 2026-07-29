---
id: E-004
title: Notes authoring & reading overhaul — WYSIWYG editor, full-bleed reader, one code theme
status: backlog
created: 2026-07-22
---

## Goal

Notes are authored in a Monaco **source** editor (`src/pages/admin/AdminEditor.jsx` +
`src/hooks/useEditor*.js`) but read through a `react-markdown` renderer
(`src/components/markdown/MarkdownRenderer.jsx`). Because the two surfaces don't share a rendering
language, the author never sees the finished note while writing it — the "eye icon" preview
(`PreviewModal.jsx`) exists only as a crutch — and styling forks have crept in between the surfaces
(two code-block themes; a warm 860px card on the live page vs. the flat 720px preview document).

This epic makes the note the same everywhere: **editor render === reader render === published
render.** A WYSIWYG editor renders LaTeX, code, headings, bold, tables, images and social-link chips
inline using the *same* KaTeX config, code-block component and typography as the public reader, so
the preview modal becomes obsolete. It also unifies the code-block theme on the social `CodeBlock`
and makes live note pages a full-bleed document identical to the reader.

Full requirements, current-state analysis and acceptance criteria:
[docs/specs/notes-wysiwyg-and-reader.md](../docs/specs/notes-wysiwyg-and-reader.md).

Locked decisions (confirmed with the owner): (1) **true WYSIWYG rewrite**, not an enhancement of
Monaco; (2) **full-bleed reader** shared by the live page and preview.

## Tickets

- [ ] T-035 — Reader parity: full-bleed shared `NoteReader` + unified code-block theme — Parts A + B
- [ ] T-036 — WYSIWYG editor foundation: replace Monaco, lossless Markdown round-trip, formatting (incl. library spike) — Part C
- [ ] T-037 — Inline WYSIWYG nodes with click-to-edit: LaTeX, code, images, RichPopover, drafts — Part C
- [ ] T-038 — Retire the eye-icon preview — Part C
- [ ] T-055 — Text color/highlight marks + YouTube video embeds (modal + bare-link auto-embed)
- [x] T-075 — Web module notes (ch1-20) + interactive REPL playground node + code-block filenames
- [x] T-080 — Expand web notes ch10-20 to full depth, with 13 new diagrams

Consolidated 2026-07-22 from an initial 8-ticket breakdown to reduce ticket
count: former code-theme + reader tickets folded into **T-035**; former
library-spike + foundation into **T-036**; former inline-LaTeX + inline-code +
media-nodes into **T-037**; former retire-preview became **T-038**. IDs
T-039–T-042 are retired and not reused.

**Suggested order:** T-035 (independent, ship first) → T-036 (foundation, after
T-035) → T-037 (inline nodes) → T-038 (last).

## Non-goals

- Not changing the storage format. Notes stay plain Markdown committed to GitHub
  (`src/content/notes/**/*.md`); the editor must round-trip Markdown losslessly.
- Not changing the save / registry / image-upload pipeline behaviour (`useEditorSave`,
  `modules.js` registry, `draft://` scheme) — only its editor-side call sites move.
- Not rewriting the public `MarkdownRenderer` engine — it stays `react-markdown`; only its code
  component and container chrome change.
- Not tokenising the social `CodeBlock`'s neon palette to the purple brand — the explicit ask is
  "same as social"; an on-brand pass would be separate (see spec §5.2).
- Not collaborative editing, comments, or version history.
