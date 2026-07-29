/**
 * AsciiCard — animated-cover card (T-077).
 *
 * A distinct visual language from `ui/Card` (M3 filled card): a full-width
 * animated ASCII/halftone cover on top, title + description below, and a
 * solid CTA bar footer — rather than an icon-header/description/ripple
 * layout. Used for course cards on the home page and tool cards on a
 * course's landing page.
 *
 * Navigation follows `ui/Card`'s convention: `to` renders a router `Link`
 * (client-side nav), `href` renders a plain `<a>`, neither renders a
 * non-interactive `div`. The whole card is the single interactive element —
 * the CTA bar is a visual affordance, not a nested button.
 */
import { Link } from 'react-router-dom'
import AsciiCanvas from './AsciiCanvas'
import styles from './AsciiCard.module.css'

export default function AsciiCard({ title, description, field, to, href, cta = 'Open', className = '' }) {
  const classes = `${styles.card} ${className}`.trim()

  const content = (
    <>
      <div className={styles.cover}>
        <AsciiCanvas field={field} />
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <div className={styles.ctaBar}>{cta}</div>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    )
  }
  return <div className={classes}>{content}</div>
}
