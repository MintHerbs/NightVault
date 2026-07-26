/**
 * Card — Material You (M3) filled card.
 *
 * The project's single card primitive. Interaction follows the M3 model: a
 * tonal state layer on hover/press plus a ripple, rather than a hover lift.
 * All colour, shape, and motion values come from the --md-* token set in
 * src/styles/global.css.
 *
 * Navigation:
 *   `to`      internal route — renders a react-router <Link> so navigation
 *             stays client-side. A bare <a href> would full-page reload.
 *   `href`    external URL — renders a plain <a>.
 *   `onClick` renders a <button>.
 *   none of the above — renders a non-interactive <div>.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RippleButton,
  RippleButtonRipples,
} from '@/components/animate-ui/primitives/buttons/ripple';
import styles from './Card.module.css';

const RIPPLE_COLOR = 'rgba(255, 163, 26, 0.3)';

export default function Card({
  title,
  description,
  icon,
  onClick,
  to,
  href,
  className = '',
  children,
  ...rest
}) {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  // Respect user's motion preferences — same pattern as ScrambleText
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setShouldReduceMotion(motionQuery.matches);

    const handleMotionChange = (e) => {
      setShouldReduceMotion(e.matches);
    };

    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  const isInteractive = Boolean(onClick || href || to);
  const classes = `${styles.card} ${isInteractive ? styles.interactive : ''} ${className}`.trim();

  const content = (
    <>
      {(icon || title) && (
        <div className={styles.header}>
          {icon && <span className={styles.icon}>{icon}</span>}
          {title && <h3 className={styles.title}>{title}</h3>}
        </div>
      )}
      {description && <p className={styles.description}>{description}</p>}
      {children && <div className={styles.body}>{children}</div>}
    </>
  );

  if (!isInteractive) {
    return (
      <div className={classes} {...rest}>
        {content}
      </div>
    );
  }

  // Reduced motion: skip the ripple and the tap/hover scale entirely.
  // The CSS state layer still responds, it just doesn't transition.
  if (shouldReduceMotion) {
    if (to) {
      return (
        <Link to={to} className={classes} {...rest}>
          {content}
        </Link>
      );
    }
    if (href) {
      return (
        <a href={href} className={classes} {...rest}>
          {content}
        </a>
      );
    }
    return (
      <button type="button" onClick={onClick} className={classes} {...rest}>
        {content}
      </button>
    );
  }

  // M3 cards don't scale on hover, so neutralise RippleButton's defaults.
  const rippleProps = { hoverScale: 1, tapScale: 0.98 };

  if (to) {
    return (
      <RippleButton asChild {...rippleProps}>
        <Link to={to} className={classes} {...rest}>
          {content}
          <RippleButtonRipples color={RIPPLE_COLOR} />
        </Link>
      </RippleButton>
    );
  }

  if (href) {
    return (
      <RippleButton asChild {...rippleProps}>
        <a href={href} className={classes} {...rest}>
          {content}
          <RippleButtonRipples color={RIPPLE_COLOR} />
        </a>
      </RippleButton>
    );
  }

  return (
    <RippleButton
      type="button"
      onClick={onClick}
      className={classes}
      {...rippleProps}
      {...rest}
    >
      {content}
      <RippleButtonRipples color={RIPPLE_COLOR} />
    </RippleButton>
  );
}
