// ERD Step 2 - Show generated prompt with copy button
import { useState } from 'react'
import { motion } from 'motion/react'
import PaginationDots from '../../../../components/ui/PaginationDots/PaginationDots'
import styles from './ERDStep2.module.css'

function ERDStep2({ prompt, onNext, currentStep, totalSteps, fallbackReason, onRetry }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
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
        <div className={styles.fallbackNotice} role="status">
          <span className={styles.fallbackReason}>{fallbackReason}</span>
          <span>You can still build the diagram by hand, it just takes two extra steps.</span>
          {onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              Try generating again
            </button>
          )}
        </div>
      )}

      <p className={styles.instruction}>
        Copy the prompt below and paste it into ChatGPT, Claude, Gemini, or any LLM.
        Then copy the JSON it returns and paste it in the next step.
      </p>

      <div className={styles.codeBlock}>
        <div className={styles.codeHeader}>
          <span className={styles.codeLabel}>PROMPT</span>
          <button className={styles.copyButton} onClick={handleCopy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <pre className={styles.codeContent}>{prompt}</pre>
      </div>

      <div className={styles.buttons}>
        <button className={styles.nextButton} onClick={onNext}>
          Next: paste the JSON
        </button>
      </div>
      
      <PaginationDots total={totalSteps} current={currentStep} />
    </motion.div>
  )
}

export default ERDStep2
