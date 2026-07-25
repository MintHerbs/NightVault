---
id: T-055
title: Text color/highlight marks + YouTube video embeds (modal + bare-link auto-embed) in the note editor
status: in-progress
severity: medium
area: admin
epic: E-004
created: 2026-07-25
---

## Summary

Admins want two new authoring capabilities in the Milkdown note editor: (1) Google-Docs-style text
color and highlight — toolbar buttons opening a swatch picker with a custom-hex option, applied live
in both the editor and the published reader; (2) YouTube links rendered as a playable embed (rounded
thumbnail + play button, like an image) instead of a plain link/chip — both when inserted via the
existing "Insert Social Link" modal and when a bare YouTube URL is pasted or typed alone on its own
line in the editor body. Both features are built on the same new safe-extension mechanism
(`remark-directive`) so this ticket lands them together.

## Evidence

**Editor/reader architecture (current state):**
- `src/components/admin/NoteEditor/NoteEditor.jsx` is the Milkdown (ProseMirror) WYSIWYG editor;
  `content` is a Markdown string in, Markdown string out (`getMarkdown`, `replaceAll`). It already
  uses `commonmark` + `gfm` presets and has exactly one custom node view today: `imageNodeView`
  (`:115-292`), registered via `imageDeleteView` (`:332-337`). `insertImage` (`:453-489`) is the
  precedent for "insert a node, then land the caret in a paragraph below it," which the video-embed
  insert must reuse.
- `src/components/markdown/MarkdownRenderer.jsx:12-14` deliberately omits `rehype-raw` — raw HTML in
  contributor notes is treated as an XSS surface, on purpose, not an oversight. Any new syntax must
  stay inside the mdast/hast pipeline (react-markdown `components` overrides), never raw HTML strings.
- `RichPopover` (the existing YouTube/Instagram/LinkedIn chip) is **not** a Milkdown node — it's a
  literal `<RichPopover .../>` string inserted into the Markdown source by
  `src/components/admin/SocialLinkModal.jsx:54-62`, only rendered rich by `MarkdownRenderer.jsx`'s
  regex-based `splitContentByRichPopovers` (`:77-98`) in read mode. In the editor itself it sits as raw
  text — not a model for "visible and playable while editing," which is what's being asked for here.
- Milkdown exposes `remarkPluginsCtx` (`node_modules/@milkdown/core/lib/index.js:71,101,139`) as the
  sanctioned way to add extra remark plugins to its parse pipeline, and `$mark`/`$markSchema`/
  `$markAttr`/`$node` composables (`node_modules/@milkdown/utils/lib/composable/`) for defining new
  marks/nodes with `parseMarkdown`/`toMarkdown` round-trip — the GFM strikethrough mark
  (`node_modules/@milkdown/preset-gfm/lib/index.js:23-48`) is a direct, working template for both the
  color/highlight marks and the youtube node's parse/serialize pair.
- `$pasteRule` and `$inputRule` composables also exist
  (`node_modules/@milkdown/utils/lib/composable/$paste-rule.d.ts`,
  `.../$input-rule.d.ts`) but the editor already has a **custom paste interceptor**,
  `markdownClipboard` (`NoteEditor.jsx:349-376`), which swallows any pasted text/plain payload and
  parses it wholesale as Markdown — its interaction with a separate `$pasteRule` registration is
  unverified, so the recommended approach for bare-URL auto-embed is a `$prose`
  `appendTransaction`-based plugin (same pattern already used by `trailingClickTarget`, `:305-330`,
  and `imageDeleteView`), not a second paste-hook mechanism.

**YouTube-specific groundwork (none of this exists today):**
- No YouTube URL parsing / video-ID extraction utility exists anywhere in `src/` (confirmed by
  repo-wide search). `SocialLinkModal.jsx` only holds a static platform label/icon; `MarkdownRenderer
  .jsx:42-49` just swaps an icon by platform string.
- `src/components/ui/smoothui/rich-popover/index.tsx` is purely static — icon + manually-typed
  title/description/meta/actionLabel from the modal's form fields. No thumbnail fetch, no oEmbed call,
  no video-ID use at all.
- No metadata/oEmbed/unfurl utility or edge function exists (`supabase/functions/` only has
  `admin-github-write`, `admin-delete-user`, `admin-create-user`).
- `src/lib/url.js`'s `isSafeUrl` allow-lists schemes only (`http:`/`https:`/`mailto:`), no domain
  check — so an arbitrary fetched thumbnail URL shouldn't be trusted; a thumbnail built from a
  regex-validated 11-char video ID (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`) needs no fetch and no
  domain trust decision at all.
- `src/components/layout/MusicPlayer/MusicPlayer.jsx` confirms the codebase's established YouTube
  pattern is a **raw iframe / IFrame API** (it loads `youtube.com/iframe_api` directly) — no
  `react-youtube` or similar dependency in `package.json`. The new embed should follow the same
  no-extra-dependency pattern: a hand-rolled `<iframe>` swapped in on click.

**Bug found while tracing the insert path (blocks this ticket, not just adjacent):**
- `SocialLinkModal`'s `onInsert` **and** `FormulaModal`'s `onInsert` are both wired to
  `handleInsertFormula` (`src/pages/admin/AdminEditor.jsx:493-508`, used at `:627` and `:633`), which
  calls `editor.getSelection()` / `editor.executeEdits()` — Monaco-only APIs — against `editorRef`, the
  **Monaco** ref. With `USE_WYSIWYG = true` (`:34`), Monaco isn't mounted (`:679-689` conditional), so
  `editorRef.current` is null and `handleInsertFormula`'s guard makes both insertions silently no-op
  today. This must be fixed as part of building a working YouTube-modal insert path, since it needs a
  real Milkdown-native (`noteEditorRef`-based) insert call to land the new node at all.

**Design tokens (for the color/highlight swatch palette):**
- `docs/design/colors.md` documents the app's three color-token sources and the brand palette
  (`#8B5CF6` purple, `#EA6C0A` orange) — the note-content swatch palette is a deliberate exception to
  the "no new colors without updating a token file" rule (these are user-content colors, not app-chrome
  tokens), kept in its own constants file rather than `constants/colors.js`. The reader renders on
  `colors.bg = #000000`, so highlight swatches need dark-background-tuned tones, not a direct port of
  Google Docs' light-mode pastel palette.

## Impact

Admins currently have no way to color or highlight note text, and no way to embed a playable video —
YouTube links only ever render as a small static hover chip. Separately, the Insert Social Link and
Insert Formula toolbar buttons are already silently broken in the live WYSIWYG editor (dead
Monaco-only handler, see bug above), so today an admin clicking either button sees the modal open,
fills it in, hits Insert, and nothing happens — no error, no content added.

## Suggested fix

**A. Shared foundation**
- Add `remark-directive` as a dependency. Register it via Milkdown's `remarkPluginsCtx` on the editor
  side and as a `remarkPlugins` entry in `MarkdownRenderer.jsx` on the read side — one extension
  mechanism for every new safe custom construct in this ticket (color, highlight, youtube), instead of
  three bespoke regex formats.
- Fix the insert-path bug: rewire `SocialLinkModal`'s and `FormulaModal`'s `onInsert` in
  `AdminEditor.jsx` off `handleInsertFormula`/`editorRef` (Monaco) onto `noteEditorRef`-based Milkdown
  commands.

**B. Text color & highlight**
- Two new marks via `$mark`/`$markAttr`/`$markSchema`, modeled on `strikethroughSchema`
  (`@milkdown/preset-gfm`): `color` (`toDOM` → `<span style="color:...">`) and `highlight`
  (`<span style="background-color:...">`), each parsing/serializing to a text directive —
  `:color[text]{hex="#..."}` / `:mark[text]{hex="#..."}`.
- Validate `hex` against `/^#[0-9a-f]{3,8}$/i` on **both** the editor's mark-creation path and the
  renderer's parse path (defense in depth — Markdown can also arrive via GitHub backup restore,
  bypassing the editor). Never string-interpolate an unvalidated value into a `style` attribute.
- Toolbar: two new buttons in `EditorNavbar.jsx` row 2 after Strikethrough — `TextAUnderline` (text
  color) and `Highlighter` (`@phosphor-icons/react`, both already available) — each opening a Radix
  `Popover` (same primitive as `StyleDropdown`) with a preset swatch grid + custom hex input +
  live preview. Curate ~8-10 swatches (brand purple/orange first, then standard hues), with highlight
  swatches tuned for legibility on the reader's black background. Pin an explicit "Remove color" /
  "Remove highlight" entry at the top of each grid rather than toggle-off-by-reclicking (avoids
  ambiguous behavior on a selection with mixed/partial color). Track last-used custom hex so the
  toolbar button can offer a one-click repeat.
- Marks are independent/non-exclusive (color + highlight can stack, same as bold/italic).
- `MarkdownRenderer.jsx`: map the `color`/`mark` directives to `hName: 'span'` +
  validated `hProperties.style` via a small custom unified plugin — no `rehype-raw` introduced.

**C. YouTube embeds**
- New `$node` `youtube` schema — block-level (like image, not a mark) — round-tripping to a leaf
  directive `::youtube{id="VIDEO_ID"}`. Node view modeled directly on `imageNodeView`: rounded-corner
  container, thumbnail `<img src="https://i.ytimg.com/vi/<id>/hqdefault.jpg">` + centered play-button
  overlay; click swaps the thumbnail for a lazy-mounted `<iframe src="https://www.youtube-nocookie.com
  /embed/<id>?autoplay=1">` (click-to-play — no iframe/tracker loads until a viewer opts in).
- New `src/lib/youtube.js`: `extractYouTubeId(url)` — regex-only (`youtu.be/<id>`,
  `youtube.com/watch?v=<id>`, `youtube.com/shorts/<id>`, with query params/timestamps stripped),
  returns `null` on no match. No network call anywhere in this feature — the thumbnail URL is
  constructed from the validated 11-char ID, never fetched or trusted from elsewhere.
- Insert via the modal: extend `SocialLinkModal.jsx` — when `platform === 'youtube'`, drop the
  Title/Description/Meta/Action-Label fields (meaningless for an embed), require only the URL, extract
  the ID on submit, and insert the `youtube` node instead of a `RichPopover` string. Instagram/LinkedIn
  keep today's chip behavior unchanged. Reuse `insertImage`'s cursor-below-placement logic (`NoteEditor
  .jsx:453-489`) so the caret lands in a paragraph under the embed.
- Insert via bare link (paste **or** typed): a `$prose` `appendTransaction` plugin (same pattern as
  `trailingClickTarget`/`imageDeleteView`) detecting a paragraph whose entire content is, on its own,
  a YouTube URL — after a paste, or after typing followed by Enter/space — and replacing that paragraph
  with the embed node (same cursor-below placement as the modal path). Scoped to a URL that is the
  **sole** content of its paragraph — a URL alongside other text stays a plain link/autolink, matching
  Notion/Docs-style unfurl behavior. The Insert Social Link modal remains the explicit path when the
  admin wants the old-style link chip instead (e.g. for Instagram/LinkedIn, or a YouTube link they
  don't want auto-embedded — no override UI needed for v1 since the modal path is unaffected either
  way).
- `MarkdownRenderer.jsx`: map the `youtube` leaf directive to a custom element (e.g. `data-youtube-
  embed` with a `data-video-id` attribute) via the same directive→hast plugin as B, with a new
  `components` entry (same override pattern as the existing `img`/`code` entries) rendering the
  click-to-play component — same visual/behavior as the editor's node view.

## Acceptance criteria

- [ ] Selecting text and choosing a preset swatch or entering a custom hex applies a visible text-color
      mark, live in the editor.
- [ ] Selecting text and choosing a preset swatch or entering a custom hex applies a visible highlight
      (background) mark, live in the editor; legible against the reader's black background.
- [ ] Color and highlight marks persist through save/reload and render identically in the published
      reader and the admin preview (same `MarkdownRenderer` path).
- [ ] An explicit "Remove color" / "Remove highlight" control clears the respective mark from a
      selection.
- [ ] Invalid/malformed hex input is rejected client-side; malformed `hex` in a directive parsed from
      stored Markdown (e.g. hand-edited or restored from GitHub backup) never reaches a `style`
      attribute unvalidated.
- [ ] Inserting a YouTube link via "Insert Social Link" renders a rounded thumbnail + play button in
      the editor immediately, with the caret landing in a new/existing paragraph below it; clicking the
      thumbnail plays the video in place.
- [ ] Pasting a bare YouTube URL alone on its own line in the editor body auto-embeds it the same way,
      without opening the modal.
- [ ] Typing a bare YouTube URL alone on its own line (no other text in that paragraph) and pressing
      Enter/space auto-embeds it the same way.
- [ ] A YouTube URL that is *not* alone in its paragraph (has other text alongside it) stays a plain
      link — no unintended embed.
- [ ] Instagram/LinkedIn insertion via the modal is unchanged (still the static `RichPopover` chip).
- [ ] Embeds round-trip losslessly through save/reload (`::youtube{id="..."}` → node → same directive).
- [ ] `SocialLinkModal` and `FormulaModal` insertions actually work again in the live (`USE_WYSIWYG`)
      editor — the dead Monaco-only `onInsert` wiring is fixed.
- [ ] No `rehype-raw` introduced; no raw HTML string is ever passed through to the DOM from note
      content for any of the above.

## Implementation notes (2026-07-25)

All items in "Suggested fix" are implemented: `remark-directive` dependency added;
`colorMarkSchema`/`highlightMarkSchema`/`youtubeSchema` + node view + `youtubeAutoEmbed`
appendTransaction plugin in `NoteEditor.jsx`; `ColorPickerPopover.jsx` + toolbar wiring in
`EditorNavbar.jsx`; matching directive→hast handling + `YouTubeEmbed` component in
`MarkdownRenderer.jsx`; `SocialLinkModal.jsx` YouTube branch; the dead Monaco-only
`onInsert` wiring in `AdminEditor.jsx` fixed (`insertMarkdown`/`insertYouTube` now go
through `noteEditorRef`).

Verification done: `npx vite build` passes clean across every touched file. The
MarkdownRenderer-side directive→hast logic (color/highlight/youtube, including the
invalid-hex/invalid-id fail-safe paths) was verified directly against the real
`remark-directive`/`remark-rehype` pipeline in isolation, output matched exactly as
designed. The Milkdown editor-side marks/node/commands were modeled line-for-line on this
same file's existing working patterns (`strikethroughSchema`, `imageSchema`,
`imageNodeView`) using the same library APIs.

**Manual pass:** confirmed working live by the user against a local dev server + local
Supabase stack (started this session; `owner@local.test` seed account, password reset
for the purpose).

**Self-review (2026-07-26):** found and fixed 3 real issues — (1) the bare-URL
auto-embed plugin ran on note *load*, not just live editing, so opening an existing note
with a standalone YouTube URL silently rewrote it before any edit, breaking the
"load → no edits → save is a no-op diff" invariant from T-036 (now gated on the
editor's own external-load ref); (2) the color/highlight marks' `parseDOM` read
`dom.style.color`, which browsers normalise to `rgb(...)`, so it could never match
`HEX_COLOR_RE` (now round-trips via a `data-color-hex`/`data-highlight-hex` attribute
instead); (3) the youtube node's `parseDOM` didn't validate `videoId` against
`YOUTUBE_ID_RE` like every other boundary in this feature (now does). A fourth,
lower-severity item was noted but left as-is: registering `remark-directive` applies
directive syntax to *all* note content, not just admin-inserted marks, so a
coincidentally directive-shaped bare pattern in some note could theoretically be
silently swallowed — checked the actual local corpus (58 notes) and found zero
pre-existing collisions; accepted as an inherent tradeoff of the directive-based
design, not a bug.

Status left `in-progress` rather than `done` since I (the assistant) didn't independently
re-verify the fixes in the live app after this review pass — only the user's earlier
manual pass and the build/pipeline checks below cover that.

## References

- Epic: E-004 (`epics/E-004-notes-authoring-reading-overhaul.md`) — this ticket extends the same
  editor/reader system as T-036/T-037.
- `docs/design/colors.md` — brand token rules the swatch palette deliberately sits outside of.
- Precedent code: `@milkdown/preset-gfm` strikethrough mark; `imageNodeView` +
  `insertImage`/`trailingClickTarget`/`imageDeleteView` in `NoteEditor.jsx`; `MusicPlayer.jsx`'s raw
  YouTube IFrame API usage.
