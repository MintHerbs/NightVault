import { useEffect, useRef } from 'react'
import { registerDraftPreview, revokeDraftPreview } from '../lib/draftImagePreviews'
import { uploadNoteImage } from '../lib/noteImagesApi'

/**
 * A base64 image embedded directly in Markdown. The colon is optionally
 * backslash-escaped because that is how Milkdown serialises it (`data\:image/…`)
 * — the ProseMirror node's `src` attribute holds the unescaped form, so both
 * spellings have to be recognised and the two are not interchangeable when
 * matching a node.
 */
const INLINE_IMAGE_RE = /data\\?:image\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi

/** The `data\:` → `data:` form a ProseMirror image node actually carries. */
const unescapeDataUri = (token) => token.replace(/^data\\:/, 'data:')

/** A pasted data URI as a File, so it can take the ordinary upload path. */
function dataUriToFile(dataUri) {
  const [header, b64] = dataUri.split(',')
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png'
  const bytes = atob(b64)
  const buf = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
  const ext = mime.split('/').pop()
  return new File([buf], `pasted.${ext}`, { type: mime })
}

export function useEditorImages({ selectedPath, showToast, noteEditorRef, useWysiwyg, setContent, content }) {
  // Image upload handler.
  //
  // Previews instantly via an in-session blob URL, uploads to Supabase Storage
  // in the background, then swaps the node's src to the real /notes/img/… path.
  // The image becomes a reload-safe reference the moment the upload resolves;
  // nothing is left "queued" for save, so autosave/publish/reload can no longer
  // strip a not-yet-uploaded image (the `draft://` marker only ever resolves in
  // the session that created it). See T-050.
  const handleImageUpload = async (file) => {
    if (!selectedPath) {
      showToast('Please select a directory first', 'error')
      return
    }

    const ext = file.name.split('.').pop()
    const draftKey = `draft-img-${Date.now()}.${ext}`
    const draftSrc = `draft://${draftKey}`
    registerDraftPreview(draftKey, file)

    const wysiwyg = useWysiwyg && noteEditorRef?.current
    const insertPlaceholder = () => {
      if (wysiwyg && noteEditorRef.current.insertImage) {
        noteEditorRef.current.insertImage({ src: draftSrc, alt: 'image' })
      } else {
        setContent(prev => (prev ? `${prev}\n\n![image](${draftSrc})` : `![image](${draftSrc})`))
      }
    }
    const swapPlaceholder = (realSrc) => {
      if (wysiwyg && noteEditorRef.current.updateImageSrc) {
        noteEditorRef.current.updateImageSrc(draftSrc, realSrc)
      } else {
        setContent(prev => prev.replaceAll(draftSrc, realSrc))
      }
    }
    const removePlaceholder = () => {
      if (wysiwyg && noteEditorRef.current.removeImageBySrc) {
        noteEditorRef.current.removeImageBySrc(draftSrc)
      } else {
        setContent(prev => prev.replaceAll(`![image](${draftSrc})`, '').replaceAll(draftSrc, ''))
      }
    }

    insertPlaceholder()
    showToast('Uploading image…', 'success')

    try {
      const realSrc = await uploadNoteImage(file, selectedPath.moduleId)
      swapPlaceholder(realSrc)
      showToast('Image added', 'success')
    } catch (error) {
      console.error('Image upload failed:', error)
      removePlaceholder()
      showToast(`Image upload failed: ${error.message}`, 'error')
    } finally {
      revokeDraftPreview(draftKey)
    }
  }

  const handleFileInputChange = (e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])

  // ─── Inline base64 images ──────────────────────────────────────────────────
  //
  // Every FILE route into the editor (picker, drop zone) goes through
  // handleImageUpload above, so those images are converted and uploaded. But
  // pasting a Markdown document is not a file route: NoteEditor's
  // handlePaste parses text/plain as Markdown, and any `data:` URI in it
  // becomes an image node whose src is the base64 payload. That lands in
  // content_md on save.
  //
  // It is the worst shape for the reader — base64 inflates the bytes ~33%, the
  // pixels are unoptimised, and being part of the note row it blocks the render
  // instead of lazy-loading. Three lecture notes reached 96-100% base64 by
  // weight (382 KB for one) before scripts/convert-images-to-webp.mjs pulled
  // them out. This closes the door the script had to clean up after: any data
  // URI that appears in the editor is uploaded and swapped for a normal
  // reference, so it can never reach the database.
  //
  // Keyed on `content` rather than the paste event so it also catches a note
  // opened with legacy inline images (e.g. restored from a GitHub backup),
  // which then self-heal on the next save.
  const processedInline = useRef(new Set())

  useEffect(() => {
    if (!content || !selectedPath) return

    const fresh = [...content.matchAll(INLINE_IMAGE_RE)]
      .map((m) => m[0])
      .filter((token) => !processedInline.current.has(token))
    if (!fresh.length) return

    // Marked before the upload starts, and deliberately never unmarked: a
    // token that fails must not be retried on every keystroke, and one that
    // succeeds is gone from `content` anyway.
    fresh.forEach((token) => processedInline.current.add(token))

    let cancelled = false
    showToast(
      `Optimising ${fresh.length} pasted image${fresh.length > 1 ? 's' : ''}…`,
      'success'
    )

    ;(async () => {
      let failed = 0
      for (const token of fresh) {
        try {
          const realSrc = await uploadNoteImage(dataUriToFile(unescapeDataUri(token)), selectedPath.moduleId)
          if (cancelled) return
          if (useWysiwyg && noteEditorRef?.current?.updateImageSrc) {
            // The node attribute holds the unescaped URI; the Markdown may
            // carry either form, so try both rather than guessing.
            noteEditorRef.current.updateImageSrc(unescapeDataUri(token), realSrc)
            noteEditorRef.current.updateImageSrc(token, realSrc)
          } else {
            setContent((prev) => prev.replaceAll(token, realSrc))
          }
        } catch (error) {
          console.error('Inline image upload failed:', error)
          failed++
        }
      }
      if (cancelled) return
      if (failed) showToast(`${failed} pasted image(s) could not be optimised`, 'error')
      else showToast('Pasted images optimised', 'success')
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, selectedPath])

  return { handleImageUpload, handleFileInputChange }
}
