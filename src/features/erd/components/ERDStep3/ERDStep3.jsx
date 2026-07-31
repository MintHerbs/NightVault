// ERD Step 3 - Manual flow: paste back the JSON the user's own LLM produced
import { useState } from 'react'
import { motion } from 'motion/react'
import PaginationDots from '../../../../components/ui/PaginationDots/PaginationDots'
import styles from './ERDStep3.module.css'

function ERDStep3({ onSubmit, error, currentStep, totalSteps }) {
  const [value, setValue] = useState('')

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
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
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

      <div className={`${styles.field} ${error ? styles.fieldError : ''}`}>
        <div className={styles.fieldHeader}>
          <span className={styles.fieldLabel}>ERD JSON</span>
          <button type="button" className={styles.textButton} onClick={handlePasteFromClipboard}>
            Paste from clipboard
          </button>
        </div>
        <textarea
          className={styles.textarea}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'{\n  "entities": [ ... ],\n  "relationships": [ ... ],\n  "isA": [ ... ]\n}'}
          spellCheck="false"
          autoComplete="off"
          rows={10}
          aria-invalid={error ? 'true' : 'false'}
        />
      </div>

      <p className={error ? styles.supportingError : styles.supporting} role={error ? 'alert' : undefined}>
        {error
          ? 'That JSON could not be read. Make sure you copied the whole reply, from the first { to the last }.'
          : 'Tip: Ctrl or Cmd + Enter to build.'}
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.filledButton}
          onClick={handleSubmit}
          disabled={!value.trim()}
        >
          Build diagram
        </button>
      </div>

      <PaginationDots total={totalSteps} current={currentStep} />
    </motion.div>
  )
}

export default ERDStep3
