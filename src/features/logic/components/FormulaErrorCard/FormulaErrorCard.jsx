/**
 * FormulaErrorCard - what the visitor sees when a formula cannot be parsed.
 *
 * The parser reports where it gave up, so the input is echoed back with the offending
 * character marked rather than only quoting the message (T-084).
 *
 * @param {Object} props
 * @param {{message: string, position: number, length: number, hint: string}} props.error
 * @param {string} props.formula - the text that was submitted
 * @param {Function} props.onEdit - go back to the input, keeping the formula
 * @param {Function} props.onUseExample - fill the input with a working formula
 */
import { AlertCircle } from 'lucide-react'
import { motion } from 'motion/react'
import styles from './FormulaErrorCard.module.css'

const EXAMPLES = [
  '¬(¬(P∧Q)↔(¬P∨¬Q))',
  '(P→Q)∧(Q→R)→(P→R)',
  'P∨(Q∧¬R)'
]

export default function FormulaErrorCard({ error, formula, onEdit, onUseExample }) {
  const text = formula ?? ''
  const position = Math.max(0, Math.min(error.position ?? 0, text.length))
  const length = Math.max(0, Math.min(error.length ?? 1, text.length - position))

  const before = text.slice(0, position)
  const marked = text.slice(position, position + length)
  const after = text.slice(position + length)

  return (
    <motion.div
      className={styles.card}
      role="alert"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className={styles.icon} aria-hidden="true">
        <AlertCircle size={22} />
      </div>

      <h2 className={styles.headline}>{error.message}</h2>

      {marked.length > 0 && (
        <div className={styles.snippet}>
          <code className={styles.formulaLine}>
            {before}
            <mark className={styles.mark}>{marked}</mark>
            {after}
          </code>
          <code className={styles.caretLine} aria-hidden="true">
            {' '.repeat(position)}
            <span className={styles.caret}>{'▲'.repeat(Math.max(1, length))}</span>
          </code>
        </div>
      )}

      {error.hint && <p className={styles.hint}>{error.hint}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.primaryAction} onClick={onEdit}>
          Edit the formula
        </button>
      </div>

      <div className={styles.examples}>
        <p className={styles.examplesLabel}>Or start from one of these</p>
        <ul className={styles.exampleList}>
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                className={styles.exampleChip}
                onClick={() => onUseExample(example)}
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
