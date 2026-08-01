/**
 * FsmCopyStep - step 2 of the manual flow (T-095 follow-up).
 *
 * Deliberately the same shape as ERDStep2: same three numbered instructions,
 * same copy card, same pagination dots, same "Next: paste the JSON" action. The
 * two tools ask for the same thing from the visitor, and it should not be a
 * `<details>` here and a guided flow there.
 *
 * Not shared code with ERDStep2 — that component is bound to ERD's own copy and
 * its three-step numbering; the duplication is the layout, which is the part
 * that has to match, and the parts that differ are exactly the strings.
 *
 * @param {Object} props
 * @param {string} props.prompt
 * @param {Function} props.onNext
 * @param {Function} props.onBack
 * @param {string} [props.reason] - why the automatic path is unavailable
 * @param {Function} [props.onRetry]
 */
import { useState } from 'react'
import { motion } from 'motion/react'
import PaginationDots from '../../../../components/ui/PaginationDots/PaginationDots'
import { Button, md } from '../md'
import styles from './FsmManualSteps.module.css'

const COPY_FEEDBACK_MS = 1800

export default function FsmCopyStep({ prompt, onNext, onBack, reason, onRetry }) {
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
      {reason && (
        <div className={styles.notice} role="status">
          <span className={`${styles.noticeTitle} ${md.labelLarge}`}>{reason}</span>
          <span className={`${md.bodySmall} ${md.variantText}`}>
            You can still build the machine by hand. It takes two extra steps.
          </span>
          {onRetry && (
            <Button variant="text" onClick={onRetry}>Try generating again</Button>
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
          <span className={`${styles.cardLabel} ${md.labelMedium}`}>Prompt</span>
          <Button variant={copied ? 'tonal' : 'outlined'} onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy prompt'}
          </Button>
        </div>
        <pre className={styles.code}>{prompt}</pre>
      </section>

      {copyFailed && (
        <p className={`${styles.error} ${md.bodySmall}`} role="alert">
          Your browser blocked the clipboard. Select the text above and copy it manually.
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="text" onClick={onBack}>Back</Button>
        <Button variant="filled" onClick={onNext}>Next: paste the JSON</Button>
      </div>

      <PaginationDots total={3} current={2} />
    </motion.div>
  )
}
