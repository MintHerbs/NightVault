/**
 * MinimalFormView - the minimised expression stage (T-089).
 *
 * States the cost rule outright. "Minimal" is not one thing: fewest terms then
 * fewest literals is the common convention, but a different tie-break gives a
 * different answer, and a student comparing against a tutor's working needs to
 * know which one produced this.
 *
 * @param {Object} props
 * @param {import('../../../../lib/circuits/quineMcCluskey.js').Solution} props.solution
 * @param {number} props.coverIndex
 * @param {string} props.original - what the student typed
 */
import { coverToExpression, implicantToTerm } from '../../../../lib/circuits/quineMcCluskey'
import { md } from '../md'
import styles from './MinimalFormView.module.css'

export default function MinimalFormView({ solution, coverIndex, original }) {
  const cover = solution.covers[coverIndex] ?? solution.covers[0]
  const expression = coverToExpression(cover, solution.vars, solution.form)
  const formName = solution.form === 'pos' ? 'Product of sums' : 'Sum of products'

  const stats = [
    { label: 'Terms', value: cover.terms },
    { label: 'Literals', value: cover.literals },
    { label: 'Prime implicants', value: solution.primeImplicants.length },
    { label: 'Essential', value: solution.essential.length },
  ]

  return (
    <div className={styles.wrap}>
      {original && (
        <div className={styles.row}>
          <span className={`${styles.rowLabel} ${md.labelMedium} ${md.variantText}`}>You entered</span>
          <code className={styles.original}>{original}</code>
        </div>
      )}

      <div className={styles.result}>
        <span className={`${styles.resultLabel} ${md.labelMedium}`}>{formName}</span>
        <code className={styles.expression}>F = {expression}</code>
      </div>

      <dl className={styles.cost}>
        {stats.map(stat => (
          <div key={stat.label} className={styles.costItem}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {cover.implicants.length > 0 && (
        <ul className={styles.terms}>
          {cover.implicants.map((implicant, index) => (
            <li key={index} className={styles.term}>
              <span className={styles.termBits}>{implicant.bits}</span>
              <span className={styles.termText}>
                <span className={styles.termExpression}>
                  {implicantToTerm(implicant, solution.vars, solution.form).text}
                </span>
                <span className={`${styles.termMeta} ${md.bodySmall}`}>
                  covers {implicant.covers.join(', ')}
                </span>
              </span>
              {solution.essential.includes(implicant) && (
                <span className={styles.termBadge}>Essential</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className={`${styles.note} ${md.bodySmall}`}>
        Minimal here means fewest terms first, then fewest literals. Other tie-breaks pick a
        different expression of the same size.
      </p>

      {!solution.exhaustive && (
        <p className={`${styles.warning} ${md.bodySmall}`}>
          The search for alternative groupings hit its budget, so this is minimal but the count
          of equally minimal alternatives may be incomplete.
        </p>
      )}
    </div>
  )
}
