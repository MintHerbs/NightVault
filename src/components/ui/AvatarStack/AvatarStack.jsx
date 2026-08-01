// Overlapping run of seeded avatars, capped and ringed so the edges stay
// separable where they sit on top of one another. TypingIndicator and
// SeenIndicator each grew their own copy of this; T-087 folded both onto
// this primitive so the two read as the same affordance.
import AgentAvatar from '../../effects/smoothui/agent-avatar'
import styles from './AvatarStack.module.css'

const DEFAULT_MAX = 3

export default function AvatarStack({
  seeds = [],
  size = 24,
  max = DEFAULT_MAX,
  // The ring colour has to match whatever the stack is sitting on, or the
  // separator reads as a halo. Callers on a non-page background pass their
  // own surface token.
  ringColor = 'var(--color-bg)',
  label,
}) {
  if (!seeds.length) return null

  const shown = seeds.slice(0, max)
  const overflow = seeds.length - shown.length

  return (
    <div className={styles.stack} role={label ? 'img' : undefined} aria-label={label}>
      {shown.map((seed, index) => (
        <div
          key={seed}
          className={styles.avatar}
          // Earlier avatars sit on top so the run reads left to right.
          style={{ zIndex: shown.length - index, '--ring-color': ringColor }}
        >
          <AgentAvatar seed={seed} size={size} animated={true} />
        </div>
      ))}

      {overflow > 0 && (
        <div
          className={styles.overflow}
          style={{ width: size, height: size, '--ring-color': ringColor }}
          aria-hidden="true"
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
