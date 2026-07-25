import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import NoteEditor from '../../components/admin/NoteEditor'
import { resolveNoteImageSrc } from '../../lib/noteImageSrc'
import { segmentToSubfolder } from '../../lib/notesApi'
import { useDropzone } from 'react-dropzone'
import { colors } from '../../constants/colors'
import { supabase } from '../../lib/supabaseClient'
import '../../styles/adminTokens.css'
import { useAdmin } from './useAdmin'
import EditorNavbar from '../../components/admin/EditorNavbar'
import PreviewModal from '../../components/admin/PreviewModal'
import ImageCleanupDrawer from '../../components/admin/ImageCleanupDrawer'
import ChangePasswordModal from '../../components/admin/ChangePasswordModal'
import FormulaModal from '../../components/admin/FormulaModal'
import SocialLinkModal from '../../components/admin/SocialLinkModal'
import ToastNotification, { useToast } from '../../components/admin/ToastNotification'
import { Monitor } from '@phosphor-icons/react'
import styles from './AdminEditor.module.css'
import { useEditorState } from '../../hooks/useEditorState'
import { useEditorSave } from '../../hooks/useEditorSave'
import { useEditorImages } from '../../hooks/useEditorImages'
import { useAdminModulesRegistry } from '../../hooks/useAdminModulesRegistry'
import { useEditorFormatting, renderInlineLaTeX } from '../../hooks/useEditorFormatting'
import { useEditorFiles } from '../../hooks/useEditorFiles'
import { useEditorDrafts } from '../../hooks/useEditorDrafts'
import { clearActiveCourse } from '../../hooks/useActiveCourse'

// Feature flag for the WYSIWYG migration (T-036). While true the Milkdown
// NoteEditor replaces Monaco; Monaco stays importable behind the flag until
// acceptance passes, then it's deleted (spec §6.1, §10).
const USE_WYSIWYG = true

// Create Monaco content widget for inline image preview
function createImageWidget(editor, monaco, src, alt, startPos, endPos, fullMatch, onDelete, onReplace) {
  const resolvedSrc = resolveNoteImageSrc(src)
  const widgetId = `image-widget-${startPos.lineNumber}-${startPos.column}`

  return {
    getId: () => widgetId,
    getDomNode: () => {
      const container = document.createElement('div')
      container.className = 'monaco-image-widget'
      container.style.cssText = `
        position: relative;
        display: inline-block;
        max-width: 400px;
        margin: 8px 0;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid ${colors.border};
        background: ${colors.surface};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        animation: imageWidgetFadeIn 200ms ease-out;
        z-index: 100;
      `

      // Keep widget visible when hovering over it
      container.addEventListener('mouseenter', () => {
        clearTimeout(editor._imageWidgetHideTimeout)
      })

      container.addEventListener('mouseleave', () => {
        editor._imageWidgetHideTimeout = setTimeout(() => {
          hideImageWidget(editor)
        }, 300)
      })

      const img = document.createElement('img')
      img.src = resolvedSrc
      img.alt = alt || 'Image'
      img.style.cssText = `
        display: block;
        max-width: 100%;
        max-height: 400px;
        object-fit: contain;
        cursor: pointer;
      `

      // Context menu on right-click
      img.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        showImageContextMenu(e, container, editor, startPos, endPos, onDelete, onReplace)
      })

      // Click to view full size
      img.addEventListener('click', (e) => {
        e.stopPropagation()
        window.open(resolvedSrc, '_blank')
      })

      const caption = document.createElement('div')
      caption.textContent = src
      caption.style.cssText = `
        padding: 6px 10px;
        font-size: 11px;
        color: ${colors.textMuted};
        background: ${colors.surface};
        border-top: 1px solid ${colors.border};
        font-family: 'JetBrains Mono', monospace;
      `

      container.appendChild(img)
      container.appendChild(caption)

      return container
    },
    getPosition: () => ({
      position: {
        lineNumber: endPos.lineNumber,
        column: endPos.column,
      },
      preference: [monaco.editor.ContentWidgetPositionPreference.BELOW]
    })
  }
}

// Helper function to hide widget (needs to be accessible)
function hideImageWidget(editor) {
  if (editor._currentImageWidget) {
    editor.removeContentWidget(editor._currentImageWidget)
    editor._currentImageWidget = null
  }
}

// Show context menu for image widget
function showImageContextMenu(e, container, editor, startPos, endPos, onDelete, onReplace) {
  // Remove any existing context menu
  const existingMenu = document.querySelector('.monaco-image-context-menu')
  if (existingMenu) existingMenu.remove()

  const menu = document.createElement('div')
  menu.className = 'monaco-image-context-menu'
  menu.style.cssText = `
    position: fixed;
    left: ${e.clientX}px;
    top: ${e.clientY}px;
    background: ${colors.surface};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 10000;
    min-width: 160px;
  `

  const replaceOption = createMenuOption('Replace image', () => {
    menu.remove()
    onReplace(editor, startPos, endPos)
  })

  const deleteOption = createMenuOption('Delete image', () => {
    menu.remove()
    onDelete(editor, startPos, endPos)
  }, colors.error)

  menu.appendChild(replaceOption)
  menu.appendChild(deleteOption)
  document.body.appendChild(menu)

  // Close menu on click outside
  const closeMenu = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove()
      document.removeEventListener('click', closeMenu)
    }
  }
  setTimeout(() => document.addEventListener('click', closeMenu), 0)
}

function createMenuOption(text, onClick, color = colors.text) {
  const option = document.createElement('button')
  option.textContent = text
  option.style.cssText = `
    display: block;
    width: 100%;
    background: transparent;
    border: none;
    padding: 8px 12px;
    font-size: 13px;
    color: ${color};
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    transition: all 150ms ease;
    font-family: inherit;
  `

  option.addEventListener('mouseenter', () => {
    option.style.background = 'rgba(255, 255, 255, 0.06)'
  })

  option.addEventListener('mouseleave', () => {
    option.style.background = 'transparent'
  })

  option.addEventListener('click', onClick)

  return option
}

function AdminEditorContent() {
  const navigate = useNavigate()
  const { moduleId, subfolder, slug } = useParams()
  const { user, profile, loading, isPrimaryOwner } = useAdmin()
  const { showToast } = useToast()

  const {
    title, setTitle, content, setContent,
    unsaved, setUnsaved, saving, setSaving,
    previewOpen, setPreviewOpen,
    changePasswordOpen, setChangePasswordOpen,
    formulaModalOpen, setFormulaModalOpen, socialLinkModalOpen, setSocialLinkModalOpen,
    selectedPath, setSelectedPath, originalPath, setOriginalPath,
    currentStyle, setCurrentStyle,
    isTooNarrow, setIsTooNarrow, editorRef, fileInputRef,
  } = useEditorState()

  const [cleanupOpen, setCleanupOpen] = useState(false)

  // Subjects/folders/files list — shared with AdminBrowser so both pages see
  // the same admin-scoped registry (T-045 phase A).
  const { modules, reload: reloadModules } = useAdminModulesRegistry()

  // Imperative handle to the WYSIWYG editor's commands (bold/italic/insert
  // image/etc.). Created here so image upload can insert at the cursor via
  // Milkdown instead of the legacy Monaco path.
  const noteEditorRef = useRef(null)

  const { handleImageUpload } = useEditorImages({
    selectedPath, showToast, editorRef, noteEditorRef, useWysiwyg: USE_WYSIWYG, setContent,
  })

  const { restoreDraftIfExists, clearDraft } = useEditorDrafts({
    userId: user?.id, title, content, selectedPath, unsaved,
    showToast, setTitle, setContent, setUnsaved,
  })

  const { handleSave, handleBackupToGithub } = useEditorSave({
    title, content, selectedPath, showToast, setSaving, setUnsaved, setTitle, setContent,
    originalPath, setOriginalPath,
    isOwner: profile?.role === 'owner', clearDraft, reloadModules,
  })

  const { handleFormatAction, handleStyleChange, detectCurrentStyle } = useEditorFormatting({
    editorRef, setCurrentStyle,
  })

  // Route toolbar/shortcut actions to the active editor: Milkdown commands when
  // the flag is on, Monaco `executeEdits` otherwise.
  const onFormat = (action) => (
    USE_WYSIWYG ? noteEditorRef.current?.format(action) : handleFormatAction(action)
  )
  const onStyle = (style) => (
    USE_WYSIWYG ? noteEditorRef.current?.setStyle(style) : handleStyleChange(style)
  )

  const { handleLoadFile } = useEditorFiles({
    showToast, setContent, setTitle, setUnsaved, setSelectedPath, setOriginalPath,
    restoreDraftIfExists,
  })

  useEffect(() => {
    const handleResize = () => {
      setIsTooNarrow(window.innerWidth < 960)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Drive the editor's target/loaded note from the route (T-045 phase A) —
  // replaces the old DirectoryDrawer click handlers. `/new` loads a blank
  // note pre-targeted at :moduleId/:subfolder; any other :slug is the note's
  // encoded (module-relative) path and is loaded from Supabase.
  useEffect(() => {
    if (loading || !moduleId || !subfolder) return

    if (slug === 'new') {
      setContent('')
      setTitle('')
      setUnsaved(false)
      setSelectedPath({ moduleId, subfolder })
      setOriginalPath(null)
      return
    }

    if (slug) {
      handleLoadFile({ moduleId, path: decodeURIComponent(slug) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, moduleId, subfolder, slug])

  const subjectLabel = moduleId ? (modules.find(m => m.id === moduleId)?.label ?? moduleId) : null

  // Monaco theme setup
  const handleBeforeMount = (monaco) => {
    monaco.editor.defineTheme('mooner-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': colors.bg,
        'editor.foreground': colors.text,
        'editorLineNumber.foreground': colors.border,
        'editor.selectionBackground': `${colors.accent}40`,
        'editor.lineHighlightBackground': 'transparent',
      }
    })
  }

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor

    // Listen for cursor position changes to detect current style and toggle LaTeX edit mode
    editor.onDidChangeCursorPosition(() => {
      detectCurrentStyle()
      renderInlineLaTeX(editor, monaco)
    })

    // Render inline image and LaTeX decorations
    renderInlineImages(editor, monaco)
    renderInlineLaTeX(editor, monaco)

    // Re-render decorations when content changes
    editor.onDidChangeModelContent(() => {
      renderInlineImages(editor, monaco)
      renderInlineLaTeX(editor, monaco)
      // Hide widget when content changes (user is typing)
      hideImageWidget(editor)
    })

    // Hide widget when mouse leaves editor
    const editorDomNode = editor.getDomNode()
    if (editorDomNode) {
      editorDomNode.addEventListener('mouseleave', () => {
        editor._imageWidgetHideTimeout = setTimeout(() => {
          hideImageWidget(editor)
        }, 300)
      })
    }
  }

  // Render inline image previews as hover decorations
  const renderInlineImages = (editor, monaco) => {
    if (!editor || !monaco) return

    const model = editor.getModel()
    if (!model) return

    const text = model.getValue()
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const decorations = []
    let match

    while ((match = imageRegex.exec(text)) !== null) {
      const [fullMatch, alt, src] = match
      const startOffset = match.index
      const endOffset = startOffset + fullMatch.length
      const startPos = model.getPositionAt(startOffset)
      const endPos = model.getPositionAt(endOffset)

      // Add decoration for hover detection
      decorations.push({
        range: new monaco.Range(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        ),
        options: {
          inlineClassName: 'monaco-image-markdown',
          hoverMessage: {
            value: `**Image Preview** - Hover to see preview, right-click to manage`,
            isTrusted: true
          },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      })
    }

    // Apply decorations
    editor._imageDecorations = editor.deltaDecorations(
      editor._imageDecorations || [],
      decorations
    )

    // Set up hover provider if not already done
    if (!editor._imageHoverProviderRegistered) {
      editor.onMouseMove((e) => {
        handleImageHover(editor, monaco, e)
      })
      editor._imageHoverProviderRegistered = true
    }
  }

  // Handle hover over image markdown
  const handleImageHover = (editor, monaco, e) => {
    if (!e.target || !e.target.position) return

    const model = editor.getModel()
    if (!model) return

    const position = e.target.position
    const text = model.getValue()
    const offset = model.getOffsetAt(position)

    // Find if cursor is over an image markdown
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    let match

    while ((match = imageRegex.exec(text)) !== null) {
      const [fullMatch, alt, src] = match
      const startOffset = match.index
      const endOffset = startOffset + fullMatch.length

      if (offset >= startOffset && offset <= endOffset) {
        const startPos = model.getPositionAt(startOffset)
        const endPos = model.getPositionAt(endOffset)

        // Show widget
        showImageWidget(editor, monaco, src, alt, startPos, endPos, fullMatch)
        return
      }
    }

    // Hide widget if not hovering over image
    hideImageWidget(editor)
  }

  // Show image widget on hover
  const showImageWidget = (editor, monaco, src, alt, startPos, endPos, fullMatch) => {
    // Remove existing widget
    hideImageWidget(editor)

    const widget = createImageWidget(
      editor,
      monaco,
      src,
      alt,
      startPos,
      endPos,
      fullMatch,
      handleImageDelete,
      handleImageReplace
    )

    editor._currentImageWidget = widget
    editor.addContentWidget(widget)
  }

  // Delete image from editor
  const handleImageDelete = (editor, startPos, endPos) => {
    const model = editor.getModel()
    if (!model) return

    const range = {
      startLineNumber: startPos.lineNumber,
      startColumn: startPos.column,
      endLineNumber: endPos.lineNumber,
      endColumn: endPos.column,
    }

    editor.executeEdits('', [{
      range,
      text: '',
    }])

    showToast('Image removed', 'success')
  }

  // Replace image
  const handleImageReplace = (editor, startPos, endPos) => {
    // Trigger file input
    if (fileInputRef.current) {
      // Store position for replacement
      editor._imageReplacePosition = { startPos, endPos }
      fileInputRef.current.click()
    }
  }

  const handleContentChange = (value) => {
    setContent(value || '')
    setUnsaved(true)
  }

  const handleInsertFormula = (formula) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const selection = editor.getSelection()

    editor.executeEdits('', [{
      range: selection,
      text: formula,
    }])

    editor.focus()
  }

  // Dropzone for canvas
  const onDrop = async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      await handleImageUpload(file)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/svg+xml': ['.svg'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  })

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isModifierPressed = event.metaKey || event.ctrlKey
      if (!isModifierPressed) return

      const key = event.key.toLowerCase()

      if (key === 's') {
        event.preventDefault()
        if (saving) return
        handleSave()
      } else if (key === 'b') {
        event.preventDefault()
        onFormat('bold')
      } else if (key === 'i') {
        event.preventDefault()
        onFormat('italic')
      } else if (event.shiftKey && key === 'p') {
        event.preventDefault()
        setPreviewOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleSave, handleFormatAction])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!unsaved) return

      const message = 'You have unsaved changes. Leave anyway?'
      event.preventDefault()
      event.returnValue = message
      return message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [unsaved])

  const handleSignOut = async () => {
    clearActiveCourse()
    await supabase.auth.signOut()
    window.location.href = '/admin'
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}>Loading...</div>
      </div>
    )
  }

  if (isTooNarrow) {
    return (
      <div className={styles.responsiveGuard}>
        <Monitor size={32} weight="regular" />
        <p>Admin panel requires a larger screen.</p>
      </div>
    )
  }

  return (
    <div className={styles.adminEditor}>
      {/* Fixed overlays */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={title}
        content={content}
      />

      {profile?.role === 'owner' && (
        <ImageCleanupDrawer
          open={cleanupOpen}
          onClose={() => setCleanupOpen(false)}
          modules={modules}
          isOwner={profile?.role === 'owner'}
        />
      )}

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        userEmail={user?.email}
      />

      <FormulaModal
        open={formulaModalOpen}
        onClose={() => setFormulaModalOpen(false)}
        onInsert={handleInsertFormula}
      />

      <SocialLinkModal
        open={socialLinkModalOpen}
        onClose={() => setSocialLinkModalOpen(false)}
        onInsert={handleInsertFormula}
      />

      {/* Navbar Row 1 + Row 2 */}
      <EditorNavbar
        title={title}
        onTitleChange={setTitle}
        unsaved={unsaved}
        subjectLabel={subjectLabel}
        folderLabel={segmentToSubfolder(subfolder)}
        onNavigateRoot={() => navigate('/admin/editor')}
        onNavigateSubject={() => navigate(`/admin/editor/${moduleId}`)}
        onPreview={() => setPreviewOpen(true)}
        onSave={handleSave}
        onBackupToGithub={handleBackupToGithub}
        saving={saving}
        onToggleUsers={() => navigate('/admin/users')}
        onToggleCleanup={() => setCleanupOpen(o => !o)}
        cleanupOpen={cleanupOpen}
        isOwner={profile?.role === 'owner'}
        canManageUsers={profile?.role === 'owner' || profile?.role === 'admin'}
        roleLabel={isPrimaryOwner ? 'Primary owner' : profile?.role === 'owner' ? 'Owner' : profile?.role === 'admin' ? 'Admin' : 'Contributor'}
        username={profile?.username}
        onSignOut={handleSignOut}
        onChangePassword={() => setChangePasswordOpen(true)}
        editorRef={editorRef}
        onFormatAction={onFormat}
        onInsertImage={() => fileInputRef.current?.click()}
        onInsertFormula={() => setFormulaModalOpen(true)}
        onInsertSocialLink={() => setSocialLinkModalOpen(true)}
        currentStyle={currentStyle}
        onStyleChange={onStyle}
      />

      {/* Canvas */}
      <div className={styles.canvas} {...getRootProps()}>
        <input {...getInputProps()} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
        />

        <div className={styles.writingArea}>
          {content === '' && !USE_WYSIWYG && (
            <div className={styles.emptyPlaceholder}>Start writing…</div>
          )}
          {USE_WYSIWYG ? (
            <NoteEditor
              ref={noteEditorRef}
              content={content}
              onChange={handleContentChange}
            />
          ) : (
            <Editor
              height="100%"
              defaultLanguage="markdown"
              theme="mooner-dark"
              value={content}
              onChange={handleContentChange}
              onMount={handleEditorMount}
              beforeMount={handleBeforeMount}
              options={{
                fontSize: 15,
                lineHeight: 28,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                wordWrap: 'on',
                minimap: { enabled: false },
                lineNumbers: 'off',
                scrollBeyondLastLine: true,
                renderLineHighlight: 'none',
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                scrollbar: {
                  vertical: 'hidden',
                  horizontal: 'hidden',
                },
                padding: { top: 0, bottom: 120 },
              }}
            />
          )}
        </div>

        {isDragActive && (
          <div className={styles.dropOverlay}>
            <p>Drop images here...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminEditor() {
  return (
    <ToastNotification>
      <AdminEditorContent />
    </ToastNotification>
  )
}
