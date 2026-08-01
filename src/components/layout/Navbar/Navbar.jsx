// Top navigation bar - fully prop-controlled with no hardcoded content
import { Ghost } from 'lucide-react'
import styles from './Navbar.module.css'

export default function Navbar({
  showTitle = false,
  title = '',
  showReset = false,
  onReset = null,
  showResult = false,
  resultText = '',
  showNewFormula = false,
  onNewFormula = null,
  newFormulaText = '← New Formula',
  showAbout = false
}) {
  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        {showTitle && title && (
          <h2 className={styles.title}>{title}</h2>
        )}
      </div>
      <div className={styles.right}>
        {showReset && onReset && (
          <button className={styles.resetButton} onClick={onReset}>
            Reset / New Tree
          </button>
        )}
        {showResult && resultText && (
          <span className={`${styles.resultBadge} ${styles[resultText.toLowerCase()]}`}>
            {resultText}
          </span>
        )}
        {showNewFormula && onNewFormula && (
          <button className={styles.resetButton} onClick={onNewFormula}>
            {newFormulaText}
          </button>
        )}
        {showAbout && (
          <a href="/about" className={styles.teamButton}>
            <span>Team</span>
            <Ghost size={16} className={styles.teamArrow} />
          </a>
        )}
      </div>
    </nav>
  )
}
