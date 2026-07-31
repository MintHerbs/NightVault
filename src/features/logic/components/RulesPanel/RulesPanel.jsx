// RulesPanel - reference drawer for the tableau rules.
//
// Modal drawer following the M3 pattern: scrim, trailing-edge surface, Escape and
// scrim-click to dismiss, focus moved in on open and restored on close.
import { useEffect, useId, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import styles from './RulesPanel.module.css'

// Each rule is drawn as the shape it makes in the tree rather than listed in a table,
// so the reference and the canvas reinforce each other.
const ALPHA_RULES = [
  { formula: '¬¬A', results: ['A'], name: 'Double negation' },
  { formula: 'A∧B', results: ['A', 'B'], name: 'Conjunction' },
  { formula: '¬(A∨B)', results: ['¬A', '¬B'], name: 'Negated disjunction' },
  { formula: '¬(A→B)', results: ['A', '¬B'], name: 'Negated implication' }
]

const BETA_RULES = [
  { formula: 'A∨B', left: ['A'], right: ['B'], name: 'Disjunction' },
  { formula: '¬(A∧B)', left: ['¬A'], right: ['¬B'], name: 'Negated conjunction' },
  { formula: 'A→B', left: ['¬A'], right: ['B'], name: 'Implication' },
  { formula: 'A↔B', left: ['A', 'B'], right: ['¬A', '¬B'], name: 'Biconditional' },
  { formula: '¬(A↔B)', left: ['¬A', 'B'], right: ['A', '¬B'], name: 'Negated biconditional' }
]

const NOTATION = [
  { symbol: '¬', typed: '~', name: 'not' },
  { symbol: '∧', typed: '&', name: 'and' },
  { symbol: '∨', typed: '|', name: 'or' },
  { symbol: '→', typed: '->', name: 'if' },
  { symbol: '↔', typed: '<->', name: 'if and only if' }
]

function Chip({ children }) {
  return <span className={styles.chip}>{children}</span>
}

function AlphaShape({ formula, results }) {
  return (
    <div className={styles.shape}>
      <Chip>{formula}</Chip>
      <svg className={styles.connector} width="2" height="18" aria-hidden="true">
        <line x1="1" y1="0" x2="1" y2="18" />
      </svg>
      <div className={styles.stack}>
        {results.map((result, i) => (
          <Chip key={i}>{result}</Chip>
        ))}
      </div>
    </div>
  )
}

function BetaShape({ formula, left, right }) {
  return (
    <div className={styles.shape}>
      <Chip>{formula}</Chip>
      <svg className={styles.connector} width="120" height="18" viewBox="0 0 120 18" aria-hidden="true">
        <line x1="60" y1="0" x2="18" y2="18" />
        <line x1="60" y1="0" x2="102" y2="18" />
      </svg>
      <div className={styles.fork}>
        <div className={styles.stack}>
          {left.map((item, i) => <Chip key={i}>{item}</Chip>)}
        </div>
        <div className={styles.stack}>
          {right.map((item, i) => <Chip key={i}>{item}</Chip>)}
        </div>
      </div>
    </div>
  )
}

export default function RulesPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const titleId = useId()
  const closeButtonRef = useRef(null)
  const triggerRef = useRef(null)

  const close = () => setIsOpen(false)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Send focus back where it came from, so keyboard users are not dropped at the
      // top of the document.
      triggerRef.current?.focus()
    }
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Tableau rules reference"
        title="Tableau rules reference"
      >
        ?
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className={styles.scrim}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
            />

            <motion.aside
              className={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            >
              <header className={styles.header}>
                <div>
                  <h2 className={styles.title} id={titleId}>Tableau rules</h2>
                  <p className={styles.subtitle}>How each connective breaks down</p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className={styles.closeButton}
                  onClick={close}
                  aria-label="Close rules reference"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </header>

              <div className={styles.content}>
                <section className={styles.section}>
                  <p className={styles.lede}>
                    A tableau breaks a formula down until only propositions and their
                    negations are left. Every root-to-leaf path is one attempt at making
                    the formula true.
                  </p>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.badge}>α</span>
                    Stack on the same branch
                  </h3>
                  <p className={styles.sectionDescription}>
                    Both parts have to hold together, so they go one under the other. These
                    are applied first: they keep the tree narrow, and often close a branch
                    before any split is needed.
                  </p>
                  <ul className={styles.ruleGrid}>
                    {ALPHA_RULES.map((rule) => (
                      <li className={styles.ruleCard} key={rule.formula}>
                        <AlphaShape formula={rule.formula} results={rule.results} />
                        <span className={styles.ruleName}>{rule.name}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.badge}>β</span>
                    Split into two branches
                  </h3>
                  <p className={styles.sectionDescription}>
                    Either part could be what makes the formula true, so the branch forks
                    and each case is followed separately.
                  </p>
                  <ul className={styles.ruleGrid}>
                    {BETA_RULES.map((rule) => (
                      <li className={styles.ruleCard} key={rule.formula}>
                        <BetaShape formula={rule.formula} left={rule.left} right={rule.right} />
                        <span className={styles.ruleName}>{rule.name}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Reading the result</h3>
                  <dl className={styles.outcomes}>
                    <div className={styles.outcome}>
                      <dt className={`${styles.outcomeMark} ${styles.closedMark}`}>✗</dt>
                      <dd className={styles.outcomeText}>
                        <strong>Closed.</strong> The branch holds both A and ¬A, so nothing
                        can satisfy it. Everything below is irrelevant and is not drawn.
                      </dd>
                    </div>
                    <div className={styles.outcome}>
                      <dt className={`${styles.outcomeMark} ${styles.openMark}`}>○</dt>
                      <dd className={styles.outcomeText}>
                        <strong>Open.</strong> Nothing is left to break down and no
                        contradiction appeared. The propositions along the branch are a
                        model: a set of truth values that makes the formula true.
                      </dd>
                    </div>
                  </dl>
                  <p className={styles.sectionDescription}>
                    Every branch closing means the formula is unsatisfiable. Testing
                    validity negates the formula first, so every branch closing there means
                    the original is valid, and an open branch is a counter-example.
                  </p>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Typing formulas</h3>
                  <p className={styles.sectionDescription}>
                    Propositions are single capital letters. Symbols can be typed in plain
                    ASCII or inserted from the bar under the input.
                  </p>
                  <ul className={styles.notation}>
                    {NOTATION.map((entry) => (
                      <li className={styles.notationRow} key={entry.symbol}>
                        <span className={styles.notationSymbol}>{entry.symbol}</span>
                        <code className={styles.notationTyped}>{entry.typed}</code>
                        <span className={styles.notationName}>{entry.name}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
