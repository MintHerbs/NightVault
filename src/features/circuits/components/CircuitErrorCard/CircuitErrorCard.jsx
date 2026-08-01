/**
 * CircuitErrorCard - what a visitor sees when an expression will not parse.
 *
 * Same idea as the logic tool's FormulaErrorCard, copied rather than shared:
 * the examples, the notation note and the hints are all digital-logic specific,
 * and the only common part is the underline, which is six lines.
 *
 * The parser reports where it gave up, so the input is echoed back with the
 * offending slice marked. A message alone leaves the student hunting.
 *
 * @param {Object} props
 * @param {{message: string, position: number, length: number, hint: string}} props.error
 * @param {string} props.source - the text that was submitted
 * @param {Function} props.onEdit
 * @param {Function} props.onUseExample
 */
import { AlertCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { md } from '../md'
import styles from './CircuitErrorCard.module.css'

const EXAMPLES = [
  "AB' + BC",
  "(A+B)(C'+D)",
  'F(A,B,C) = Σm(0,2,5)',
]

export default function CircuitErrorCard({ error, source, onEdit, onUseExample }) {
  const text = source ?? ''
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
      transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
    >
      <div className={styles.icon} aria-hidden="true">
        <AlertCircle size={24} />
      </div>

      <h2 className={`${styles.headline} ${md.headlineSmall}`}>{error.message}</h2>

      {text.length > 0 && (
        <pre className={styles.echo}>
          <code>
            {before}
            <mark className={styles.mark}>{marked || ' '}</mark>
            {after}
          </code>
        </pre>
      )}

      {error.hint && <p className={`${styles.hint} ${md.bodyMedium}`}>{error.hint}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${md.button} ${md.stateLayer} ${styles.primaryAction}`}
          onClick={onEdit}
        >
          Edit what I wrote
        </button>
      </div>

      <div className={styles.examples}>
        <span className={`${styles.examplesLabel} ${md.labelMedium}`}>Or start from</span>
        <div className={styles.exampleChips}>
          {EXAMPLES.map(example => (
            <button
              key={example}
              type="button"
              className={`${md.chip} ${md.stateLayer} ${styles.exampleChip}`}
              onClick={() => onUseExample(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
