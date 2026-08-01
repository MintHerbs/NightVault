import GridLoader from '../../effects/smoothui/grid-loader/index.tsx'

/**
 * SentinelFace - a small face rendered on the shared GridLoader grid.
 * Reserved for moments the island is speaking as itself (the entrance
 * greeting, an error) rather than reporting on work in progress; every
 * aiState keeps its own abstract pattern (docs/rules.md §15.5).
 */
export default function SentinelFace({ variant = 'grin', blink = false, color }) {
  if (blink) {
    return (
      <GridLoader
        blur={1}
        color={color ?? 'white'}
        gap={2}
        mode="sequence"
        sequence={['face-grin', 'face-wink']}
        rounded
        size="sm"
        speed="slow"
      />
    )
  }

  return (
    <GridLoader
      blur={1}
      color={color ?? (variant === 'soft' ? 'amber' : 'white')}
      gap={2}
      mode="pulse"
      pattern={variant === 'soft' ? 'face-soft' : 'face-grin'}
      rounded
      size="sm"
    />
  )
}
