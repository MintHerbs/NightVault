import { registerDraftPreview, revokeDraftPreview } from '../lib/draftImagePreviews'
import { uploadNoteImage } from '../lib/noteImagesApi'

export function useEditorImages({ selectedPath, showToast, noteEditorRef, useWysiwyg, setContent }) {
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

  return { handleImageUpload, handleFileInputChange }
}
