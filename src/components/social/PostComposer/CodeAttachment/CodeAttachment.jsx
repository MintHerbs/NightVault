import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { detectCodeLanguage, getLanguageLabel, normalizeLanguage } from '../../../../lib/social/codeHighlighter'
import styles from './CodeAttachment.module.css'

const MAX_LINES = 1000
const INDENT = '  '

const LANG_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
]

function clampToMaxLines(value) {
  const lines = String(value ?? '').split('\n')
  if (lines.length <= MAX_LINES) return { text: String(value ?? ''), clamped: false }
  return { text: lines.slice(0, MAX_LINES).join('\n'), clamped: true }
}

// Removal is the tray's job now (AttachmentTray), so this component no longer
// carries its own delete button next to the copy one.
export default function CodeAttachment({ code, language, onChange }) {
  const [copied, setCopied] = useState(false)
  const [wasClamped, setWasClamped] = useState(false)
  const textareaRef = useRef(null)
  const gutterRef = useRef(null)

  const normalizedLanguage = normalizeLanguage(language) || 'auto'
  const detectedLanguage = useMemo(() => detectCodeLanguage(code), [code])

  const lineNumbers = useMemo(() => {
    const count = Math.max(String(code ?? '').split('\n').length, 1)
    return Array.from({ length: count }, (_, i) => i + 1)
  }, [code])

  const handleLangChange = (e) => {
    onChange(code ?? '', e.target.value)
  }

  const handleCodeChange = (e) => {
    const { text, clamped } = clampToMaxLines(e.target.value)
    setWasClamped(clamped)
    onChange(text, normalizedLanguage)
  }

  /* The gutter is its own non-scrolling element, so it has to be driven from
     the textarea's scroll position. Without this the numbers sat still while
     the code moved and stopped matching their lines entirely. */
  const handleScroll = (e) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
  }

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || e.shiftKey) return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart, selectionEnd, value } = el
    const next = `${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`
    onChange(clampToMaxLines(next).text, normalizedLanguage)
    requestAnimationFrame(() => {
      el.selectionStart = selectionStart + INDENT.length
      el.selectionEnd = selectionStart + INDENT.length
    })
  }

  const handleCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {/* M3 outlined select. The old one set appearance:none without
              supplying a chevron, so it did not read as a dropdown at all. */}
          <div className={styles.selectField}>
            <select
              className={styles.select}
              value={normalizedLanguage}
              onChange={handleLangChange}
              aria-label="Code language"
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className={styles.selectChevron} aria-hidden="true" />
          </div>

          {normalizedLanguage === 'auto' && code ? (
            <span className={styles.detectedChip}>{getLanguageLabel(detectedLanguage)}</span>
          ) : null}
        </div>

        <div className={styles.headerRight}>
          <span className={styles.lineCount}>
            {lineNumbers.length} {lineNumbers.length === 1 ? 'line' : 'lines'}
          </span>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleCopy}
            disabled={!code}
            title="Copy code"
            aria-label="Copy code"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      <div className={styles.editor}>
        <div className={styles.gutter} ref={gutterRef} aria-hidden="true">
          {lineNumbers.map((num) => (
            <div key={num} className={styles.gutterLine}>
              {num}
            </div>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={code || ''}
          onChange={handleCodeChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          placeholder="Paste or write your code"
          aria-label="Code"
        />
      </div>

      {wasClamped && (
        <div className={styles.notice} role="status">
          Trimmed to the first {MAX_LINES} lines.
        </div>
      )}
    </div>
  )
}
