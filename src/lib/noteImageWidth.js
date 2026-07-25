// src/lib/noteImageWidth.js
//
// A note image's display width, persisted inside the Markdown image *title*.
//
// Markdown has no width syntax, and the image `src` is load-bearing elsewhere
// (Image Cleanup matches stored files against the exact `/notes/img/…` paths it
// finds in note bodies, and the save path rewrites `draft://` markers by src),
// so the width must not touch it. The title is the one image attribute the
// CommonMark image node already carries and round-trips, and nothing else in the
// app reads it, so it is the carrier:
//
//   ![alt](/notes/img/m/x.png "w=480")            → 480px wide, no title
//   ![alt](/notes/img/m/x.png "A caption w=480")  → 480px wide, title "A caption"
//   ![alt](/notes/img/m/x.png)                    → natural / column width
//
// A real title in front of the marker is preserved, so an existing title is
// never eaten by a resize. Both renderers (the WYSIWYG image node view and the
// reader's MarkdownRenderer) go through here so the two can't drift.

const WIDTH_MARKER = /(?:^|\s)w=(\d{1,5})$/

/** Smallest width a resize may produce (px) — below this the image is unusable. */
export const MIN_IMAGE_WIDTH = 80

/**
 * Split a Markdown image title into its human part and its stored width.
 * Returns `{ title, width }` where `width` is a positive integer or `null`.
 */
export function parseImageTitle(rawTitle) {
  const raw = typeof rawTitle === 'string' ? rawTitle : ''
  const match = raw.match(WIDTH_MARKER)
  if (!match) return { title: raw, width: null }

  const width = Number.parseInt(match[1], 10)
  const title = raw.slice(0, raw.length - match[0].length).trim()
  return { title, width: width > 0 ? width : null }
}

/**
 * Rebuild a Markdown image title from a human title and a width. Passing
 * `null`/`0` for the width drops the marker (back to natural width).
 */
export function formatImageTitle(title, width) {
  const human = (title || '').trim()
  const px = Number.isFinite(width) && width > 0 ? Math.round(width) : null
  if (!px) return human
  return human ? `${human} w=${px}` : `w=${px}`
}

/** The stored width of an image node/element title, or `null` if unset. */
export function imageWidthFromTitle(rawTitle) {
  return parseImageTitle(rawTitle).width
}
