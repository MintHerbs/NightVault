/**
 * AlgebraStepsView - the named-law derivation (T-089 phase 4).
 *
 * The names are the point. A minimiser gives the destination with no route, and
 * the route is the marked part of the exam question.
 *
 * When the search does not reach the K-map minimum, the steps it DID find are
 * shown and the minimal form is shown separately, labelled as coming from the
 * K-map. Never present a non-minimal result as final, and never invent a step.
 *
 * @param {Object} props
 * @param {Object} props.run - the result of simplify()
 */
import { Check, TriangleAlert } from 'lucide-react'
import { md } from '../md'
import styles from './AlgebraStepsView.module.css'

export default function AlgebraStepsView({ run }) {
  const noWork = run.steps.length === 0

  return (
    <div className={styles.wrap}>
      <ol className={styles.chain}>
        <li className={styles.start}>
          <span className={`${styles.marker} ${md.labelSmall}`}>Start</span>
          <code className={styles.expression}>{run.start}</code>
        </li>

        {/* The law leads. It used to be a small chip under the rewritten
            expression, which put the answer first and the reasoning second —
            backwards for a subject where the marks are for naming the rule you
            applied, not for the line it produced. */}
        {run.steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <span className={`${styles.marker} ${md.labelSmall}`}>{i + 1}</span>
            <div className={styles.stepBody}>
              <div className={styles.law}>
                <span className={`${styles.lawName} ${md.titleSmall}`}>{step.law}</span>
                <code className={styles.lawStatement}>{step.statement}</code>
              </div>
              <span className={`${styles.focus} ${md.bodySmall}`}>
                <code>{step.focusFrom}</code> became <code>{step.focusTo}</code>
              </span>
              <code className={styles.expression}>{step.to}</code>
            </div>
          </li>
        ))}
      </ol>

      <div className={run.reachedMinimum ? styles.result : styles.resultPartial}>
        <span className={`${styles.resultLabel} ${md.labelMedium}`}>
          {run.reachedMinimum ? 'Simplified' : 'As far as the laws got'}
        </span>
        <code className={styles.resultExpression}>F = {run.result}</code>
      </div>

      {noWork && (
        <p className={`${styles.note} ${md.bodySmall}`}>
          No law applies: this expression is already in its simplest form.
        </p>
      )}

      {/* Honesty about the search. The rewrite path is not guaranteed to reach
          the minimum, so the independently-computed minimal SOP is shown beside
          it rather than the result being passed off as final. */}
      {!run.reachedMinimum && (
        <div className={styles.fallback}>
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <p className={md.bodyMedium}>
              No short algebraic path to the minimum was found, so the steps above stop early.
            </p>
            <p className={`${md.bodySmall} ${md.variantText}`}>
              Minimal form (via K-map): <code className={styles.inlineCode}>{run.minimal}</code>
            </p>
          </div>
        </div>
      )}

      <p className={`${styles.verified} ${md.bodySmall}`}>
        {run.confirmed
          ? <><Check size={14} aria-hidden="true" /> Every step was checked against the truth table.</>
          : 'This result could not be verified against the truth table.'}
      </p>
    </div>
  )
}
