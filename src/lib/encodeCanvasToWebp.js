// src/lib/encodeCanvasToWebp.js
//
// Pulled out of imageToWebp.js (T-072) so the avatar cropper can encode its
// own canvas the same way, without duplicating the toBlob + null-check dance.

/** Encode `canvas` as WebP at `quality` (0-1). */
export async function encodeCanvasToWebp(canvas, quality) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  // toBlob yields null when the browser can't encode the requested type. Safari
  // only gained WebP encoding in 16.x, so this is a real branch, not a formality.
  if (!blob || blob.type !== 'image/webp') throw new Error('webp encoding unsupported')
  return blob
}
