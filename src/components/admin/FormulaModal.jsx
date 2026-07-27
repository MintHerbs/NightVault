import { useState, useEffect, useMemo } from 'react'
import { X } from '@phosphor-icons/react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import styles from './FormulaModal.module.css'

const EMPTY_PREVIEW = { html: '', error: '' }

export default function FormulaModal({ open, onClose, onInsert }) {
  const [latex, setLatex] = useState('')
  const [displayMode, setDisplayMode] = useState(false)

  useEffect(() => {
    if (!open) {
      setLatex('')
      setDisplayMode(false)
    }
  }, [open])

  // Both the preview and the parse error are derived from the input, NOT state.
  // They used to be computed in a `renderPreview()` called from the JSX, which
  // meant a `setError` on every render: a render-phase state update takes no
  // part in React's bail-out-on-equal-value path, so it re-rendered until it
  // hit the 25-pass limit and threw "Too many re-renders". Nothing catches that
  // (there's no error boundary above the editor), so React unmounted the whole
  // root and the screen went black the moment anything was typed here.
  const preview = useMemo(() => {
    if (!latex.trim()) return EMPTY_PREVIEW
    try {
      return { html: katex.renderToString(latex, { displayMode, throwOnError: true, output: 'html' }), error: '' }
    } catch (err) {
      return { html: '', error: err.message }
    }
  }, [latex, displayMode])

  const handleInsert = () => {
    if (!latex.trim() || preview.error) return
    // Display mode needs the `$$` on their own lines. `$$x$$` all on one line is
    // parsed as *inline* maths (the opening `$$` treats the rest of the line as
    // its info string, which then fails and falls back to inline), so the
    // checkbox used to make no difference to what came out.
    onInsert(displayMode ? `$$\n${latex.trim()}\n$$` : `$${latex.trim()}$`)
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Insert Formula</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label className={styles.label}>LaTeX Code</label>
            <textarea
              className={styles.textarea}
              placeholder="e.g., \frac{a}{b} or x^2 + y^2 = z^2"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              rows={4}
              autoFocus
            />
          </div>

          <div className={styles.modeToggle}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={displayMode}
                onChange={(e) => setDisplayMode(e.target.checked)}
              />
              <span>Display mode (block formula)</span>
            </label>
          </div>

          {preview.error && (
            <div className={styles.error}>
              <strong>Error:</strong> {preview.error}
            </div>
          )}

          <div className={styles.preview}>
            <div className={styles.previewLabel}>Preview:</div>
            <div className={styles.previewContent}>
              {preview.html ? (
                <div dangerouslySetInnerHTML={{ __html: preview.html }} />
              ) : (
                <span className={styles.emptyPreview}>
                  {latex.trim() ? 'Not valid LaTeX yet' : 'Type LaTeX to see preview'}
                </span>
              )}
            </div>
          </div>

          <div className={styles.examples}>
            <div className={styles.examplesLabel}>Examples:</div>
            <div className={styles.examplesList}>
              <button
                className={styles.exampleButton}
                onClick={() => setLatex('\\frac{a}{b}')}
              >
                Fraction
              </button>
              <button
                className={styles.exampleButton}
                onClick={() => setLatex('x^2 + y^2 = z^2')}
              >
                Equation
              </button>
              <button
                className={styles.exampleButton}
                onClick={() => setLatex('\\sum_{i=1}^{n} i')}
              >
                Summation
              </button>
              <button
                className={styles.exampleButton}
                onClick={() => setLatex('\\int_{a}^{b} f(x) dx')}
              >
                Integral
              </button>
              <button
                className={styles.exampleButton}
                onClick={() => setLatex('\\sqrt{x^2 + y^2}')}
              >
                Square Root
              </button>
              <button
                className={styles.exampleButton}
                onClick={() => setLatex('\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}')}
              >
                Matrix
              </button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.insertButton}
            onClick={handleInsert}
            disabled={!latex.trim() || !!preview.error}
          >
            Insert Formula
          </button>
        </div>
      </div>
    </>
  )
}
