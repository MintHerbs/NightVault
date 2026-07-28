import { useState, useRef } from 'react'

export function useEditorState() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [unsaved, setUnsaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [formulaModalOpen, setFormulaModalOpen] = useState(false)
  const [socialLinkModalOpen, setSocialLinkModalOpen] = useState(false)
  const [selectedPath, setSelectedPath] = useState(null) // { moduleId, subfolder }
  const [originalPath, setOriginalPath] = useState(null) // GitHub path the loaded note came from, or null for a new note
  const [currentStyle, setCurrentStyle] = useState('body')
  const [isTooNarrow, setIsTooNarrow] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  ))

  const editorRef = useRef(null)
  const fileInputRef = useRef(null)

  return {
    title, setTitle,
    content, setContent,
    unsaved, setUnsaved,
    saving, setSaving,
    previewOpen, setPreviewOpen,
    formulaModalOpen, setFormulaModalOpen,
    socialLinkModalOpen, setSocialLinkModalOpen,
    selectedPath, setSelectedPath,
    originalPath, setOriginalPath,
    currentStyle, setCurrentStyle,
    isTooNarrow, setIsTooNarrow,
    editorRef,
    fileInputRef,
  }
}
