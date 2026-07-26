import BackButton from '../../common/BackButton/BackButton'
import MarkdownRenderer from '../MarkdownRenderer'
import styles from './NoteReader.module.css'

/**
 * The single reader surface for a published note. Renders a flat, centred
 * ~720px document column (no warm card) so the live page and the editor
 * preview are visually identical in the content column.
 *
 * Props:
 *   • content   Markdown string (required). The first `# H1` is the visible title.
 *   • eyebrow   Optional humanised breadcrumb shown above the content
 *               (e.g. "Database · Getting Started"). No standalone title is
 *               rendered — the Markdown `# H1` carries it.
 *   • onBack    Optional handler for the floating back affordance. When omitted
 *               no control is rendered (e.g. the editor preview supplies its own
 *               close button).
 */
export default function NoteReader({ content, eyebrow, onBack }) {
  return (
    <div className={styles.scrollContainer}>
      {onBack && <BackButton onClick={onBack} />}
      <div className={styles.documentContainer}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <MarkdownRenderer content={content} />
      </div>
    </div>
  )
}
