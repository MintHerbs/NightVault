import katex from 'katex'
import 'katex/dist/katex.min.css'

// Clear all active LaTeX view zones and legacy content widgets from editor
export function clearLatexWidgets(editor) {
  if (editor._latexWidgets) {
    editor._latexWidgets.forEach(widget => editor.removeContentWidget(widget))
  }
  editor._latexWidgets = []
  // View zones are removed inside the changeViewZones callback in renderInlineLaTeX
}

// Render LaTeX inline / block preview dynamically in Monaco
export function renderInlineLaTeX(editor, monaco) {
  if (!editor || !monaco) return

  // Prevent infinite recursive event loops synchronously
  if (editor._isRenderingLaTeX) return

  const model = editor.getModel()
  if (!model) return

  // Debounce updates to avoid Monaco's synchronous rendering/layout event cycle conflicts
  if (editor._latexRenderTimeout) {
    clearTimeout(editor._latexRenderTimeout)
  }

  editor._latexRenderTimeout = setTimeout(() => {
    if (editor._isRenderingLaTeX) return
    editor._isRenderingLaTeX = true

    try {
      const text = model.getValue()
      const selection = editor.getSelection()

      // If no selection yet (initial mount), treat cursor as outside all formulas so all get rendered
      const selectionStart = selection ? model.getOffsetAt(selection.getStartPosition()) : -1
      const selectionEnd = selection ? model.getOffsetAt(selection.getEndPosition()) : -1

      const formulas = []

      // 1. Scan for block formulas: $$formula$$
      const blockRegex = /\$\$([\s\S]*?)\$\$/g
      let match
      while ((match = blockRegex.exec(text)) !== null) {
        formulas.push({
          type: 'block',
          raw: match[0],
          latex: match[1],
          startOffset: match.index,
          endOffset: match.index + match[0].length
        })
      }

      // 2. Scan for inline formulas: $formula$ (making sure not to overlap with block formulas)
      const inlineRegex = /\$([^$\n]+)\$/g
      while ((match = inlineRegex.exec(text)) !== null) {
        const startOffset = match.index
        const endOffset = startOffset + match[0].length

        // Check if this overlaps with any block formulas
        const overlaps = formulas.some(f =>
          (startOffset >= f.startOffset && startOffset < f.endOffset) ||
          (endOffset > f.startOffset && endOffset <= f.endOffset)
        )

        if (!overlaps) {
          formulas.push({
            type: 'inline',
            raw: match[0],
            latex: match[1],
            startOffset,
            endOffset
          })
        }
      }

      // Optimization: Check which formulas are active (overlapping with cursor/selection)
      const activeFormulaIndexes = formulas
        .map((f, idx) => {
          const cursorOverlaps = !(selectionEnd < f.startOffset || selectionStart > f.endOffset)
          return cursorOverlaps ? idx : null
        })
        .filter(val => val !== null)

      // State Signature optimization to prevent redrawing/flickering and layout churn
      const stateSignature = `${text.length}-${formulas.length}-${activeFormulaIndexes.join(',')}`
      if (editor._lastLatexStateSignature === stateSignature) {
        return
      }
      editor._lastLatexStateSignature = stateSignature

      // Clear legacy content widgets
      clearLatexWidgets(editor)

      const decorations = []

      // Use view zones so each rendered formula occupies its own line — no overlap possible
      editor.changeViewZones((accessor) => {
        // Remove previous view zones
        ;(editor._latexViewZoneIds || []).forEach(id => accessor.removeZone(id))
        editor._latexViewZoneIds = []

        formulas.forEach((f, idx) => {
          const startPos = model.getPositionAt(f.startOffset)
          const endPos = model.getPositionAt(f.endOffset)

          if (activeFormulaIndexes.includes(idx)) {
            // User is editing this formula — show raw text, no zone
            return
          }

          // Build the zone DOM node
          const domNode = document.createElement('div')
          const isBlock = f.type === 'block'
          domNode.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: ${isBlock ? 'center' : 'flex-start'};
            padding: ${isBlock ? '14px 24px' : '8px 16px'};
            cursor: pointer;
            border-left: 2px solid rgba(var(--color-accent-rgb), 0.35);
            background: rgba(var(--color-accent-rgb), 0.04);
            border-radius: 0 6px 6px 0;
            overflow: visible;
            box-sizing: border-box;
            color: var(--color-text);
            transition: background 150ms ease, border-color 150ms ease;
          `

          let renderedHtml
          try {
            renderedHtml = katex.renderToString(f.latex, {
              displayMode: isBlock,
              throwOnError: true,
              output: 'html'
            })
          } catch (err) {
            // Skip this view zone entirely if rendering fails
            console.warn('Skipping formula due to KaTeX error:', err.message, 'Formula:', f.latex)
            return
          }

          domNode.innerHTML = renderedHtml

          domNode.addEventListener('click', () => {
            editor.setPosition({
              lineNumber: startPos.lineNumber,
              column: startPos.column + (isBlock ? 2 : 1)
            })
            editor.focus()
          })
          domNode.addEventListener('mouseenter', () => {
            domNode.style.background = 'rgba(var(--color-accent-rgb), 0.10)'
            domNode.style.borderLeftColor = 'rgba(var(--color-accent-rgb), 0.65)'
          })
          domNode.addEventListener('mouseleave', () => {
            domNode.style.background = 'rgba(var(--color-accent-rgb), 0.04)'
            domNode.style.borderLeftColor = 'rgba(var(--color-accent-rgb), 0.35)'
          })

          // Hide the raw LaTeX text
          decorations.push({
            range: new monaco.Range(
              startPos.lineNumber, startPos.column,
              endPos.lineNumber, endPos.column
            ),
            options: {
              inlineClassName: 'monaco-latex-hidden',
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            }
          })

          const zoneId = accessor.addZone({
            afterLineNumber: endPos.lineNumber,
            heightInPx: isBlock ? 80 : 52,
            domNode,
            suppressMouseDown: false,
          })
          editor._latexViewZoneIds.push(zoneId)
        })
      })

      // Apply hidden-text decorations
      editor._latexDecorations = editor.deltaDecorations(
        editor._latexDecorations || [],
        decorations
      )
    } catch (e) {
      console.error('Error rendering LaTeX in Monaco Editor:', e)
    } finally {
      editor._isRenderingLaTeX = false
    }
  }, 16) // ~1 frame delay to batch updates smoothly
}

export function useEditorFormatting({ editorRef, setCurrentStyle }) {
  // Detect current line style (title/subtitle/body)
  const detectCurrentStyle = () => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const position = editor.getPosition()
    const model = editor.getModel()
    const lineContent = model.getLineContent(position.lineNumber)

    if (lineContent.startsWith('# ')) {
      setCurrentStyle('title')
    } else if (lineContent.startsWith('## ')) {
      setCurrentStyle('subtitle')
    } else {
      setCurrentStyle('body')
    }
  }

  // Formatting actions
  const handleFormatAction = (action) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const selection = editor.getSelection()
    const model = editor.getModel()
    const selectedText = model.getValueInRange(selection)

    let newText = ''

    switch (action) {
      case 'bold':
        newText = selectedText ? `**${selectedText}**` : '**bold**'
        break
      case 'italic':
        newText = selectedText ? `*${selectedText}*` : '*italic*'
        break
      case 'strike':
        newText = selectedText ? `~~${selectedText}~~` : '~~strikethrough~~'
        break
      case 'code':
        newText = '```\n\n```'
        break
      default:
        return
    }

    editor.executeEdits('', [{
      range: selection,
      text: newText,
    }])

    // Move cursor appropriately
    if (action === 'code') {
      const position = editor.getPosition()
      editor.setPosition({
        lineNumber: position.lineNumber + 1,
        column: 1,
      })
    } else if (!selectedText) {
      const position = editor.getPosition()
      const offset = action === 'bold' ? 2 : 1
      editor.setPosition({
        lineNumber: position.lineNumber,
        column: position.column - (action === 'bold' ? 2 : (action === 'strike' ? 2 : 1)),
      })
    }

    editor.focus()
  }

  // Style change (title/subtitle/body)
  const handleStyleChange = (style) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const position = editor.getPosition()
    const model = editor.getModel()
    const lineContent = model.getLineContent(position.lineNumber)

    // Strip existing # or ##
    let cleanedLine = lineContent.replace(/^##?\s*/, '')

    // Add new prefix
    let newLine = cleanedLine
    if (style === 'title') {
      newLine = `# ${cleanedLine}`
    } else if (style === 'subtitle') {
      newLine = `## ${cleanedLine}`
    }

    // Replace the line
    editor.executeEdits('', [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: lineContent.length + 1,
      },
      text: newLine,
    }])

    editor.focus()
    setCurrentStyle(style)
  }

  return { handleFormatAction, handleStyleChange, detectCurrentStyle }
}
