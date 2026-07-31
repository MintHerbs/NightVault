// ERD Step 2 - Manual flow: hand the prompt to an LLM of the user's choice
import { useState } from 'react'
import { motion } from 'motion/react'
import PaginationDots from '../../../../components/ui/PaginationDots/PaginationDots'
import styles from './ERDStep2.module.css'

const COPY_FEEDBACK_MS = 1800

function ERDStep2({ prompt, onNext, currentStep, totalSteps, fallbackReason, onRetry }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopyFailed(false)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
    } catch {
      // Clipboard is blocked without a secure context or permission. Say so,
      // rather than leaving a button that silently does nothing.
      setCopyFailed(true)
    }
  }

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {fallbackReason && (
        <div className={styles.notice} role="status">
          <span className={styles.noticeTitle}>{fallbackReason}</span>
          <span className={styles.noticeBody}>
            You can still build the diagram by hand. It takes two extra steps.
          </span>
          {onRetry && (
            <button type="button" className={styles.textButton} onClick={onRetry}>
              Try generating again
            </button>
          )}
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>Use your own LLM</h1>
        <p className={styles.subtitle}>
          Copy the prompt, run it anywhere, then bring the JSON back.
        </p>
      </header>

      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.stepMarker} aria-hidden="true">1</span>
          <span>Copy the prompt below.</span>
        </li>
        <li className={styles.step}>
          <span className={styles.stepMarker} aria-hidden="true">2</span>
          <span>Paste it into ChatGPT, Claude, Gemini, or any other assistant.</span>
        </li>
        <li className={styles.step}>
          <span className={styles.stepMarker} aria-hidden="true">3</span>
          <span>Copy the JSON it replies with, and paste it on the next screen.</span>
        </li>
      </ol>

      <section className={styles.card} aria-label="Generated prompt">
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Prompt</span>
          <button
            type="button"
            className={`${styles.tonalButton} ${copied ? styles.tonalButtonDone : ''}`}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
        </div>
        <pre className={styles.code}>{prompt}</pre>
      </section>

      {copyFailed && (
        <p className={styles.supportingError} role="alert">
          Your browser blocked the clipboard. Select the text above and copy it manually.
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.filledButton} onClick={onNext}>
          Next: paste the JSON
        </button>
      </div>

      <PaginationDots total={totalSteps} current={currentStep} />
    </motion.div>
  )
}

export default ERDStep2
