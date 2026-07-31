// A titled M3 surface. Not the shared ui/Card primitive: that one is built
// around an interactive state layer and a ripple, and these panels are static
// containers — inheriting the hover treatment would suggest they were clickable.
import styles from './Panel.module.css'

export default function Panel({ title, subtitle, action, children, wide = false }) {
  return (
    <section className={`${styles.panel} ${wide ? styles.wide : ''}`}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
