import Navbar from '../Navbar/Navbar';
import { ScrambleText } from '../../ui/ScrambleText';
import styles from './PageShell.module.css';

export default function PageShell({
  variant = 'landing',
  title,
  subtitle,
  navbar,
  children,
}) {
  const navbarProps = navbar ?? {};

  if (variant === 'result') {
    return (
      <div className={styles.resultPage}>
        <Navbar {...navbarProps} />
        {children}
      </div>
    );
  }

  if (variant === 'content') {
    return (
      <div className={styles.contentPage}>
        <Navbar {...navbarProps} />
        <main className={styles.contentMain}>{children}</main>
      </div>
    );
  }

  const hasHero = title || subtitle;

  return (
    <div className={styles.container}>
      <Navbar {...navbarProps} />
      {/* landingCenter, not heroContainer: the absolute 45% centring and the
          swipe-up entrance the guide promises live on .landingCenter, and this
          used the inner hero class instead, so the landing variant never
          centred anything. Every consumer so far has been variant="content",
          which is why it went unnoticed — T-105 is the first landing page to
          go through the shell. */}
      <main className={styles.landingCenter}>
        {hasHero && (
          <div className={styles.heroContainer}>
            {title && (
              <h1 className={styles.title}>
                <ScrambleText duration={500} speed={125} skipInitialAnimation>
                  {title}
                </ScrambleText>
              </h1>
            )}
            {subtitle && (
              <p className={styles.subtitle}>
                <ScrambleText duration={500} speed={125} skipInitialAnimation>
                  {subtitle}
                </ScrambleText>
              </p>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

export function SplitPanel({ left, right }) {
  return (
    <div className={styles.splitPanel}>
      <div className={styles.leftPanel}>{left}</div>
      <div className={styles.rightPanel}>{right}</div>
    </div>
  );
}

export function ErrorBox({
  title = 'Error',
  message,
  onRetry,
  retryText = '← Try Again',
}) {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorBox}>
        <h3 className={styles.errorTitle}>{title}</h3>
        {message && <p className={styles.errorMessage}>{message}</p>}
        {onRetry && (
          <button className={styles.retryButton} onClick={onRetry}>
            {retryText}
          </button>
        )}
      </div>
    </div>
  );
}
