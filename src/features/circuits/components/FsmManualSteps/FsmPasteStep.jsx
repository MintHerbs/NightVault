/**
 * FsmPasteStep - step 3 of the manual flow (T-092 follow-up).
 *
 * Mirrors ERDStep3: paste area, "Paste from clipboard", Ctrl/Cmd+Enter to
 * submit, and the error text that names what to check rather than just saying
 * the JSON was bad.
 *
 * @param {Object} props
 * @param {Function} props.onSubmit - called with the pasted text
 * @param {Function} props.onBack
 * @param {Object|null} props.failure - the last parse failure, if any
 * @param {Function} props.onAIStateChange
 */
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import PaginationDots from '../../../../components/ui/PaginationDots/PaginationDots'
import { Button, md } from '../md'
import styles from './FsmManualSteps.module.css'

export default function FsmPasteStep({ onSubmit, onBack, failure, onAIStateChange }) {
  const [value, setValue] = useState('')

  // The island watches this box the same way the pill watches the question:
  // something in it means there is work to look at.
  useEffect(() => {
    if (typeof onAIStateChange !== 'function') return
    onAIStateChange(value.trim() ? 'observing' : 'waiting')
  }, [value, onAIStateChange])

  const handleSubmit = () => {
    if (!value.trim()) return
    onSubmit(value)
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setValue(text)
    } catch {
      // Read permission is commonly denied; the textarea is still there to
      // paste into by hand, so this needs no error of its own.
    }
  }

  // Ctrl/Cmd+Enter submits. A bare Enter has to stay available for newlines,
  // since what gets pasted here is multi-line JSON.
  const handleKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>Paste the JSON</h1>
        <p className={styles.subtitle}>
          Paste everything your assistant replied with. Surrounding code fences are fine.
        </p>
      </header>

      <div className={`${styles.field} ${failure ? styles.fieldError : ''}`}>
        <div className={styles.cardHeader}>
          <span className={`${styles.cardLabel} ${md.labelMedium}`}>Machine JSON</span>
          <Button variant="text" onClick={handlePasteFromClipboard}>Paste from clipboard</Button>
        </div>
        <textarea
          className={styles.textarea}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'{\n  "states": [ ... ],\n  "inputs": [ ... ],\n  "transitions": [ ... ]\n}'}
          spellCheck="false"
          autoComplete="off"
          rows={10}
          aria-invalid={failure ? 'true' : 'false'}
        />
      </div>

      {failure ? (
        <div className={`${styles.error} ${md.bodySmall}`} role="alert">
          <p>{failure.error}</p>
          {failure.detail?.kind === 'incomplete' && (
            <p>
              {failure.detail.missing.length} transition
              {failure.detail.missing.length === 1 ? ' is' : 's are'} missing.
            </p>
          )}
        </div>
      ) : (
        <p className={`${styles.supporting} ${md.bodySmall} ${md.variantText}`}>
          Tip: Ctrl or Cmd + Enter to build.
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="text" onClick={onBack}>Back</Button>
        <Button variant="filled" onClick={handleSubmit} disabled={!value.trim()}>
          Build the machine
        </Button>
      </div>

      <PaginationDots total={3} current={3} />
    </motion.div>
  )
}
