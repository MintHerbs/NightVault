// Registry for the `::playground{id="…"}` note directive (T-075).
//
// Playgrounds are CODE-DEFINED, not authored in note content, and that is the
// security boundary: a note's Markdown can only name a playground by id, never
// supply HTML/CSS/JS of its own. So the reader keeps its no-rehype-raw
// guarantee (see MarkdownRenderer) while still being able to embed a live,
// editable document. An unknown id renders nothing.
//
// Each entry:
//   id       stable slug used in note content — renaming one orphans the note
//   label    shown in the playground header
//   height   px height of the preview pane; pick it from the tallest state the
//            document can reach, since the iframe cannot size itself (its
//            document is cross-origin to us by design, see buildPlaygroundDoc)
//   jquery   true to load jQuery into the document from a CDN
//   files    { html, css, js } — the editable panes. An empty string means the
//            pane exists but starts empty; omit the key to hide the tab.

import { PLAYGROUND_ID_RE } from '../../constants/notePlaygrounds'
import { ch02Playgrounds } from './ch02'
import { ch04Playgrounds } from './ch04'
import { ch07Playgrounds } from './ch07'
import { ch08Playgrounds } from './ch08'
import { ch09Playgrounds } from './ch09'
import { ch12Playgrounds } from './ch12'

const ALL = [
  ...ch02Playgrounds,
  ...ch04Playgrounds,
  ...ch07Playgrounds,
  ...ch08Playgrounds,
  ...ch09Playgrounds,
  ...ch12Playgrounds,
]

const BY_ID = new Map(ALL.map((entry) => [entry.id, entry]))

/** The playground for an id, or null. Never throws on unknown input. */
export function getPlayground(id) {
  if (!PLAYGROUND_ID_RE.test(String(id ?? ''))) return null
  return BY_ID.get(id) ?? null
}

export const JQUERY_CDN = 'https://code.jquery.com/jquery-3.7.1.min.js'

/** Message tag the in-frame error bridge posts under. */
export const PLAYGROUND_ERROR_MESSAGE = 'note-playground-error'

// Forwards syntax and runtime errors out to the parent so the playground can
// show them inline. Without this a student editing the JS pane into a broken
// state sees the preview simply stop working, with the reason buried in a
// devtools console they may never open.
//
// `event.lineno` counts from the top of the assembled DOCUMENT, so an error on
// the first line of the JS pane reports as line ~158 — a number that matches
// nothing the student can see. JS_LINE_OFFSET is substituted with the number of
// lines this file puts above their code, so the reported line matches the
// editor's own gutter. Errors from above that point (an inline handler in the
// HTML pane, say) get no line number rather than a misleading one.
//
// postMessage crosses the sandbox boundary by design, so this still works with
// the frame on an opaque origin (no allow-same-origin). The parent verifies
// `event.source` against its own frame before believing any of it.
const errorBridge = (jsLineOffset) => `<script>
(function () {
  var offset = ${jsLineOffset};
  var send = function (message) {
    try {
      parent.postMessage({ tag: ${JSON.stringify(PLAYGROUND_ERROR_MESSAGE)}, message: String(message) }, "*");
    } catch (e) { /* parent gone */ }
  };
  window.addEventListener("error", function (event) {
    var line = event.lineno && event.lineno > offset ? event.lineno - offset : 0;
    send(event.message + (line ? " (JS line " + line + ")" : ""));
  });
  window.addEventListener("unhandledrejection", function (event) {
    send("Uncaught (in promise) " + (event.reason && event.reason.message ? event.reason.message : event.reason));
  });
})();
</script>`

/**
 * → a complete HTML document string for the iframe's `srcdoc`.
 *
 * Two details that are load-bearing:
 *
 *   • `<base href>` points at the playground asset folder, so the HTML pane can
 *     use ordinary relative paths (`src="habitat-thumb.svg"`) the way a real
 *     project would. A srcdoc document has no useful base URL of its own, so
 *     without this every relative reference silently fails to resolve.
 *   • the JS goes in a `<script>` at the end of `<body>`, so the DOM the script
 *     queries already exists. This mirrors the conventional script placement the
 *     course teaches rather than needing a DOMContentLoaded wrapper.
 *
 * The document is NOT sanitised, and does not need to be: every byte of it is
 * either from this repo's own playground files or typed by the viewer into their
 * own sandboxed frame. Nothing a note author wrote reaches it.
 */
export function buildPlaygroundDoc({ html = '', css = '', js = '', jquery = false }, baseHref) {
  const jqueryTag = jquery ? `<script src="${JQUERY_CDN}"></script>` : ''
  const base = baseHref ? `<base href="${baseHref}">` : ''

  // Assembled in two passes so the bridge can be told how many lines sit above
  // the JS pane. Pass one uses a placeholder offset purely to count lines;
  // substituting the real number cannot change that count, since it only ever
  // replaces digits on a single line.
  const compose = (bridge) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${base}
${bridge}
<style>
${css}
</style>
</head>
<body>
${html}
${jqueryTag}
<script>
${js}
</script>
</body>
</html>`

  const probe = compose(errorBridge(0))
  const jsLineOffset = probe.slice(0, probe.lastIndexOf(`<script>\n${js}`)).split('\n').length
  return compose(errorBridge(jsLineOffset))
}
