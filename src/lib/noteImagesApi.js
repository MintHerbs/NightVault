// src/lib/noteImagesApi.js
//
// Uploads a note image to the `note-images` Supabase Storage bucket and returns
// its canonical `/notes/img/<moduleId>/<file>` reference; the same string the
// reader/editor resolve via noteImageSrc.js.
//
// Images are uploaded at insert time (T-050), not queued for save: a `draft://`
// marker only resolves within the browser session that created it, so anything
// that persists content between sessions (autosave, publish) must see a real,
// reload-safe path. Uploading up front guarantees that.
//
// Filenames are random UUIDs (not a sequential per-module counter): Storage can
// start empty relative to pre-migration on-disk images under
// public/notes/img/<module>/, so a counter seeded from Storage would collide
// with those. A UUID never does. (See useEditorSave.js history for the incident
// this avoids.)

import { supabase } from './supabaseClient'
import { NOTE_IMAGES_BUCKET } from './noteImageSrc'
import { toWebp } from './imageToWebp'

export async function uploadNoteImage(file, moduleId) {
  // Every upload is transcoded to WebP at reader width first — see
  // imageToWebp.js. It falls back to the untouched file for formats that must
  // not be rasterised (GIF/SVG) and whenever conversion wouldn't help, so the
  // extension comes back from there rather than from the picked filename.
  const { blob, ext } = await toWebp(file)
  const imgName = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(NOTE_IMAGES_BUCKET)
    .upload(`${moduleId}/${imgName}`, blob, { contentType: blob.type || file.type })
  if (error) throw new Error(error.message)
  return `/notes/img/${moduleId}/${imgName}`
}
