import { useRef } from 'react'
import { registerDraftPreview } from '../lib/draftImagePreviews'

export function useEditorImages({ selectedPath, showToast, editorRef, noteEditorRef, useWysiwyg, setContent }) {
  const imageQueueRef = useRef({}) // shape: { 'draft://img-1.png': { file: File, ext: string } }

  // Image upload handler
  const handleImageUpload = async (file) => {
    if (!selectedPath) {
      showToast('Please select a directory first', 'error')
      return
    }

    try {
      // Generate draft key
      const ext = file.name.split('.').pop()
      const draftKey = `draft-img-${Date.now()}.${ext}`

      // Store file in queue + register a blob URL so it previews immediately
      // (the editor's image node view resolves draft://<key> to this URL).
      imageQueueRef.current[draftKey] = { file, ext }
      registerDraftPreview(draftKey, file)

      // Insert draft markdown at cursor
      const imageMarkdown = `![image](draft://${draftKey})`

      // WYSIWYG (Milkdown): insert an image node at the cursor. The node view
      // resolves draft://<key> to the blob URL so it previews immediately, and
      // useEditorSave rewrites it to /notes/img/… on save.
      if (useWysiwyg) {
        if (noteEditorRef?.current?.insertImage) {
          noteEditorRef.current.insertImage({ src: `draft://${draftKey}`, alt: 'image' })
        } else {
          // Editor not ready yet — fall back to appending to the content prop.
          setContent(prev => (prev ? `${prev}\n\n${imageMarkdown}` : imageMarkdown))
        }
        showToast('Image queued — will upload when you save', 'success')
        return
      }

      if (editorRef.current) {
        const editor = editorRef.current

        // Check if this is a replacement operation
        if (editor._imageReplacePosition) {
          const { startPos, endPos } = editor._imageReplacePosition
          const range = {
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
          }
          editor.executeEdits('', [{
            range,
            text: imageMarkdown,
          }])
          editor._imageReplacePosition = null
        } else {
          // Normal insertion at cursor
          const position = editor.getPosition()
          const range = {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          }
          editor.executeEdits('', [{
            range,
            text: imageMarkdown,
          }])
          editor.setPosition({
            lineNumber: position.lineNumber,
            column: position.column + imageMarkdown.length,
          })
        }

        editor.focus()
      } else {
        setContent(prev => prev + '\n' + imageMarkdown)
      }

      showToast('Image queued — will upload when you save', 'success')

    } catch (error) {
      console.error('Image queue failed:', error)
      showToast(`Failed to queue image: ${error.message}`, 'error')
    }
  }

  const handleFileInputChange = (e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])

  return { imageQueueRef, handleImageUpload, handleFileInputChange }
}
