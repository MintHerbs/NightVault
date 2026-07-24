// src/lib/noteImageSrc.js
//
// Single source of truth for turning a note's `/notes/img/…` image path into
// a loadable URL. An image is uploaded straight to the `note-images` Supabase
// Storage bucket (instant — no GitHub-commit / Vercel-redeploy lag) and stays
// there, served live, until the admin explicitly runs
// scripts/pull-images-from-supabase.mjs to promote it into the repo as a
// static asset AND scripts/prune-images-from-supabase.mjs to remove the
// Storage copy. Until that promotion, Storage is authoritative.
//
// So every renderer needs TWO URLs, tried in order:
//   1. resolveNoteImageSrc  — the same-origin static path. 404s until the
//      image has been promoted, committed, and deployed.
//   2. noteImageFallbackSrc — the Storage public URL. Always correct until
//      the admin deletes the Storage copy post-promotion.
//
// This used to be copy-pasted into the reader (MarkdownRenderer) and the
// WYSIWYG editor's image node view — and was briefly MISSING from the latter,
// so images showed only their alt text there. Keep every renderer pointed at
// these two functions so they can't drift again.

export const NOTE_IMAGES_BUCKET = 'note-images'

/**
 * The same-origin static path for a `/notes/img/…` src — what a promoted,
 * committed-and-deployed image resolves to. Passes everything else (blob
 * URLs, absolute http(s) URLs, `draft://` markers) through untouched.
 */
export function resolveNoteImageSrc(src = '') {
  return src
}

/**
 * The `note-images` Storage public URL for a `/notes/img/<module>/<file>`
 * src — what an image not yet promoted to the repo resolves to. Returns the
 * input unchanged for anything that isn't a `/notes/img/…` path.
 */
export function noteImageFallbackSrc(src = '') {
  if (!src.startsWith('/notes/img/')) return src

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) return src

  const objectPath = src.slice('/notes/img/'.length)
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${NOTE_IMAGES_BUCKET}/${objectPath}`
}
