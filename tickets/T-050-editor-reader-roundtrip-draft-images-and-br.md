---
id: T-050
title: Note editor/reader round-trip loses draft images and mis-renders <br />
status: in-progress
severity: high
area: notes
epic: none
created: 2026-07-25
---

## Summary

Two independent defects where content produced by the Milkdown WYSIWYG editor
diverges from what the autosave-restore path and the public reader can handle:

- **A. `draft://` images lost on reload.** Autosave persists the editor's
  content verbatim, including session-only `![image](draft://<key>)`
  placeholders. After a reload those placeholders are unresolvable, so
  restoring the draft renders the image as its alt text (the literal word
  "image") and the queued file is gone; the image cannot be recovered.
- **B. `<br />` shown as literal text in the reader.** Milkdown serialises
  empty paragraphs (blank-line spacing) as literal `<br />` HTML. The editor
  round-trips it back to spacing, but the public reader renders raw HTML as
  literal text, so readers see the characters `<br />`.

## Evidence

### A. draft:// autosave loss
- Insert queues the file in memory and inserts a `draft://` marker; the real
  upload + rewrite only happens on explicit Save:
  [src/hooks/useEditorImages.js:32](../src/hooks/useEditorImages.js#L32),
  [src/hooks/useEditorSave.js:34-46](../src/hooks/useEditorSave.js#L34-L46).
- `draft://` previews via an in-memory blob URL only; an unregistered key
  resolves to the raw `draft://` string:
  [src/lib/draftImagePreviews.js:23-29](../src/lib/draftImagePreviews.js#L23-L29).
- Autosave writes `content` (with `draft://`) verbatim into
  `admin_note_drafts` every 10s while dirty:
  [src/hooks/useEditorDrafts.js:44-52](../src/hooks/useEditorDrafts.js#L44-L52).
- Opening a note loads the correct saved content, then overrides it with the
  draft and marks it unsaved:
  [src/hooks/useEditorFiles.js:25-34](../src/hooks/useEditorFiles.js#L25-L34),
  [src/hooks/useEditorDrafts.js:90-93](../src/hooks/useEditorDrafts.js#L90-L93).
- The image node view then sets `img.src` to the unloadable `draft://` string
  and the Storage fallback passes it through untouched, so the browser paints
  the `alt` text:
  [src/components/admin/NoteEditor/NoteEditor.jsx:118-122](../src/components/admin/NoteEditor/NoteEditor.jsx#L118-L122),
  [src/lib/noteImageSrc.js:38-46](../src/lib/noteImageSrc.js#L38-L46).
- Data confirmation: local `admin_note_drafts` had 7 rows, all containing
  `draft://` + an image; local `notes` had 0 rows containing `draft://` (real
  saves always rewrite it). The screenshot's orange "unsaved" dot is
  `restoreDraftIfExists`'s `setUnsaved(true)`; the user was viewing a restored
  draft, not the published note.

### B. <br /> literal in reader
- Reader uses `react-markdown` with only `remarkGfm` + `remarkMath` and no
  `rehype-raw`, so raw HTML is not processed and prints as text:
  [src/components/markdown/MarkdownRenderer.jsx:173-180](../src/components/markdown/MarkdownRenderer.jsx#L173-L180).
- No code emits or handles `<br>` (grep: zero matches); the tags come from
  Milkdown's serializer preserving empty paragraphs.
- Data confirmation: stored `hello-world` content is
  `weshhh\n\n<br />\n\n![image](/notes/img/labs/6f31…png)\n\n<br />\n\n<br />`;
  1 local note (`labs/suiiii/uiiiii`) also contains `<br />`.

## Impact

- **A:** An author adds an image; autosave fires (10s) before/around an
  explicit Save; on the next reload/reopen the restored draft shows the image
  as the word "image" and the file is unrecoverable. Silent data loss of the
  image and an apparently corrupted note. Environment-independent (happens on
  prod too).
- **B:** Every note where the author used blank-line spacing renders literal
  `<br />` in the public reader, breaking the reading experience. Cosmetic but
  visible to all readers.

## Suggested fix

- **A (recommended):** Upload images to Supabase Storage at insert time and
  insert the real `/notes/img/<module>/<uuid>.png` path directly, removing the
  `draft://` queue/blob indirection entirely so autosave/publish/reload are all
  naturally correct. Orphans from abandoned notes are handled by the existing
  Image Cleanup. (Alternatives considered: resolve the queue during autosave;
  or refuse to autosave `draft://` content; both weaker.)
- **B (recommended):** Teach the reader to render `<br>` safely: a targeted
  transform / minimal rehype step allowing only `<br>` (not arbitrary raw HTML,
  to avoid an XSS hole in contributor-authored notes) so the reader matches the
  editor's spacing.
- Backfill: existing notes/drafts already containing `draft://` or stray
  `<br />` may need a one-off cleanup pass.

## Acceptance criteria

- [ ] Inserting an image, waiting for autosave, reloading, and reopening the
      note shows the image (not the word "image"), and the image survives.
- [ ] Saved note content never contains `draft://` after an autosave cycle.
- [ ] A note authored with blank-line spacing renders as spacing (not literal
      `<br />`) in the public reader.
- [ ] The reader does not render arbitrary/unsafe raw HTML from note content.
- [ ] Existing affected notes/drafts are cleaned up or render correctly.

## References

- Follows the WYSIWYG editor work (T-036) and notes-in-Supabase (E-005/T-043),
  and the autosave draft table (T-032/T-033).
- Related image pipeline: T-045 (images moved to Supabase Storage).
