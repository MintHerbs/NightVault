// src/lib/noteCache.js
//
// Module-scope cache + prefetch for note CONTENT, mirroring the
// stale-while-revalidate approach useNotesRegistry.js already uses for the
// Subject/note listing.
//
// Two problems it solves:
//
//   • Re-opening a note refetched it every time. A note fetch costs a full
//     Supabase round trip (~0.4s from Mauritius, more for large notes), so
//     going back and re-entering a note paid the wait again for bytes the tab
//     already had.
//   • Opening a note started the fetch only after the route chunk had loaded
//     and NotesPage had mounted. `prefetchNote` lets the listing kick the
//     request off on hover instead, so the network is already busy while the
//     user is still moving the mouse toward the row.
//
// Cached content is served immediately AND revalidated in the background, so
// an admin's save shows up on the next open rather than needing a hard reload.

import { getNote, stripMd } from './notesApi'

const key = (moduleId, path) => `${moduleId}::${stripMd(path)}`

/** Resolved notes, by key. `null` is a real value here — "known absent". */
const cache = new Map()

/** In-flight fetches, so hover + click don't fire the same request twice. */
const inflight = new Map()

/**
 * Bumped by every invalidation. A fetch that was already in flight when an
 * admin saved would otherwise land AFTER the invalidation and repopulate the
 * cache with pre-save content — the one case where clearing the map alone
 * isn't enough, since an in-flight request can't be recalled.
 */
let generation = 0

function fetchNote(moduleId, path) {
  const k = key(moduleId, path)
  const existing = inflight.get(k)
  if (existing) return existing

  const startedAt = generation
  const promise = getNote(moduleId, path)
    .then((note) => {
      if (startedAt === generation) cache.set(k, note)
      return note
    })
    .finally(() => inflight.delete(k))

  inflight.set(k, promise)
  return promise
}

/** The cached note, or undefined when this note has never been loaded. */
export function getCachedNote(moduleId, path) {
  return cache.get(key(moduleId, path))
}

/**
 * Start loading a note without waiting for it — for hover/focus on a listing
 * row. Resolves with the note (or null) so a caller can chain further warming
 * off the content. Deliberately never rejects: a prefetch that fails must not
 * surface anything, the real load will report it.
 */
export function prefetchNote(moduleId, path) {
  if (!moduleId || !path) return Promise.resolve(null)
  const k = key(moduleId, path)
  if (cache.has(k)) return Promise.resolve(cache.get(k))
  return fetchNote(moduleId, path).catch(() => null)
}

/**
 * The note, plus a revalidation promise when it came from cache.
 * → { note, revalidate }  where `revalidate` is null on a cold load.
 *
 * `revalidate` is pre-caught, because callers that only want the cached value
 * legitimately ignore it — and an ignored rejecting promise is an unhandled
 * rejection. A failed revalidation is not interesting to the reader: it
 * already has content on screen, and the next open tries again.
 */
export async function loadNote(moduleId, path) {
  const k = key(moduleId, path)
  if (cache.has(k)) {
    return { note: cache.get(k), revalidate: fetchNote(moduleId, path).catch(() => null) }
  }
  return { note: await fetchNote(moduleId, path), revalidate: null }
}

/** Drop one note (after a save) or the whole cache. */
export function invalidateNote(moduleId, path) {
  generation++
  if (moduleId === undefined) cache.clear()
  else cache.delete(key(moduleId, path))
}
