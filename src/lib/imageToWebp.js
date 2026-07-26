// src/lib/imageToWebp.js
//
// Converts an image picked in the note editor to WebP, downscaled to the
// reader's display width, BEFORE it is uploaded to Storage.
//
// Why: note images used to go up as whatever the author pasted — typically
// full-resolution PNG screenshots. A 1017x724 RGBA PNG is ~675 KB and renders
// into a ~720 px column, so a single image-heavy note shipped multiple MB of
// pixels nobody could see. WebP at MAX_WIDTH cuts that by roughly 10-20x, and
// doing it at upload time means Storage, the repo (after
// scripts/pull-images-from-supabase.mjs promotes them), and the reader all
// hold the small version. scripts/convert-images-to-webp.mjs did the same
// thing once for everything uploaded before this existed.
//
// Conversion is best-effort: if anything fails, or the result isn't actually
// smaller, the ORIGINAL file is uploaded unchanged. A slow upload is a much
// better outcome than a broken image.

/** 2x the ~720 px reader column, so the image still looks sharp on HiDPI. */
const MAX_WIDTH = 1440

/** Visually lossless for screenshots and diagrams at a fraction of PNG size. */
const QUALITY = 0.82

/**
 * Formats deliberately passed through untouched:
 *   • GIF — canvas only captures the first frame, so converting silently
 *     destroys the animation.
 *   • SVG — vector; rasterising it to WebP throws away the resolution
 *     independence that made it worth using, and it's already tiny.
 */
const PASSTHROUGH_TYPES = new Set(['image/gif', 'image/svg+xml'])

/** Decode to something drawable, preferring createImageBitmap's off-thread path. */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    // `imageOrientation` is passed explicitly because its default has changed
    // across the spec's history ('none' originally, 'from-image' now) and is
    // not consistent between browser versions. Left implicit, a phone photo
    // carrying an EXIF rotation would be drawn unrotated and land sideways —
    // a regression against uploading the untouched file, where the browser
    // applies the rotation at display time.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('decode failed'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Draw `source` at `width`x`height` and encode the canvas as WebP. */
async function encodeWebp(source, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(source, 0, 0, width, height)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
  // toBlob yields null when the browser can't encode the requested type. Safari
  // only gained WebP encoding in 16.x, so this is a real branch, not a formality.
  if (!blob || blob.type !== 'image/webp') throw new Error('webp encoding unsupported')
  return blob
}

/**
 * → { blob, ext }. `blob` is a WebP when conversion helped, otherwise the
 * input file itself with its original extension. Never throws.
 */
export async function toWebp(file) {
  // `file` is usually a real File from a picker or a drop, but callers also
  // build one from a pasted data URI — hence no assumption that `name` exists.
  const fromName = file.name?.split('.').pop()
  const fromType = file.type?.split('/').pop()
  const originalExt = (fromName || fromType || 'png').toLowerCase()
  const unchanged = { blob: file, ext: originalExt }

  if (PASSTHROUGH_TYPES.has(file.type)) return unchanged

  let source
  try {
    source = await decode(file)
    const srcWidth = source.width
    const srcHeight = source.height
    if (!srcWidth || !srcHeight) return unchanged

    const scale = Math.min(1, MAX_WIDTH / srcWidth)
    const width = Math.round(srcWidth * scale)
    const height = Math.round(srcHeight * scale)

    const blob = await encodeWebp(source, width, height)

    // A small PNG (flat-colour icons, tiny diagrams) can encode LARGER as
    // WebP. Only take the conversion when it actually wins on bytes —
    // uploading something bigger is a loss however few pixels it has.
    if (blob.size >= file.size) return unchanged
    return { blob, ext: 'webp' }
  } catch {
    return unchanged
  } finally {
    // ImageBitmaps hold decoded pixels outside the JS heap; the GC won't
    // reclaim them promptly, so release on every path including failure.
    source?.close?.()
  }
}
