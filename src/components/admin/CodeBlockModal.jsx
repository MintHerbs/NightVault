import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import CodeBlock from '../social/CodeBlock/CodeBlock'
import { LANGUAGE_OPTIONS, getLanguageLabel, normalizeLanguage } from '../../lib/social/codeHighlighter'
import styles from './CodeBlockModal.module.css'

const EMPTY = { code: '', language: 'auto', meta: '' }

/**
 * Insert/edit a fenced code block (T-104).
 *
 * The editor renders code blocks read-only (`codeBlockView` mounts the shared
 * `CodeBlock` with no contentDOM — click-to-edit is T-037), so there is nowhere
 * to type code once a block exists. This modal is that surface, following the
 * same insert-via-modal pattern as FormulaModal/ChemistryModal.
 *
 * The textarea also fixes the paste problem the toolbar button used to push
 * authors into: a plain `<textarea>` takes the clipboard verbatim, so
 * indentation, blank lines and `__dunder__` names survive instead of being run
 * through the Markdown parser (which turned indented chunks into extra code
 * blocks and `__init__` into bold — the reported bug).
 *
 * `initial` non-null puts the modal in edit mode for an existing block; the
 * caller keeps the document position and applies the result.
 */
export default function CodeBlockModal({ open, onClose, onSubmit, initial = null }) {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('auto')
  const [meta, setMeta] = useState('')

  const editing = !!initial

  // Seed from `initial` on open (and clear on close) so reopening the modal for
  // a different block never shows the previous one's code.
  useEffect(() => {
    if (!open) return
    const seed = initial || EMPTY
    setCode(seed.code || '')
    setLanguage(normalizeLanguage(seed.language || 'auto'))
    setMeta(seed.meta || '')
  }, [open, initial])

  // An unknown language (a block authored elsewhere with, say, ```rust) must
  // still be selectable, or opening that block to edit would silently retag it.
  const languages = LANGUAGE_OPTIONS.includes(language)
    ? LANGUAGE_OPTIONS
    : [language, ...LANGUAGE_OPTIONS]

  // Tab belongs to the code, not to focus traversal — without this you cannot
  // indent a line in the one field whose whole purpose is indented text.
  // `setRangeText` edits the textarea and moves the caret synchronously, then
  // state is synced from the element: rebuilding the string in state instead
  // would leave the caret to be restored after React's commit, which is a race
  // no ordering guarantee covers.
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || e.shiftKey) return
    e.preventDefault()
    const el = e.target
    el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
    setCode(el.value)
  }

  const handleSubmit = () => {
    if (!code.trim()) return
    onSubmit({
      code: code.replace(/\r\n?/g, '\n').replace(/\s+$/, ''),
      // `auto` is this editor's "let the highlighter decide" sentinel, not a
      // real language — it must not be written onto the fence line.
      language: language === 'auto' ? '' : language,
      // Meta rides the fence's own line, so a newline or backtick in it would
      // break out of the fence and corrupt the note.
      meta: meta.replace(/[\r\n`]/g, '').trim(),
    })
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
          <h2 className={styles.title}>{editing ? 'Edit Code Block' : 'Insert Code Block'}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="code-block-source">Code</label>
            <textarea
              id="code-block-source"
              className={styles.textarea}
              placeholder="Paste or type your code here"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={12}
              spellCheck={false}
              autoFocus
            />
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="code-block-language">Language</label>
              <select
                id="code-block-language"
                className={styles.select}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang === 'auto' ? 'Auto-detect' : getLanguageLabel(lang)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="code-block-title">Title (optional)</label>
              <input
                id="code-block-title"
                className={styles.input}
                placeholder="e.g., btree/node.py"
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.preview}>
            <div className={styles.previewLabel}>Preview:</div>
            <div className={styles.previewContent}>
              {code.trim() ? (
                <CodeBlock code={code} language={language} title={meta.trim() || undefined} />
              ) : (
                <span className={styles.emptyPreview}>Paste some code to see the preview</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.insertButton}
            onClick={handleSubmit}
            disabled={!code.trim()}
          >
            {editing ? 'Save Changes' : 'Insert Code Block'}
          </button>
        </div>
      </div>
    </>
  )
}
