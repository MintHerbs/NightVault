import GridLoader from '../../effects/smoothui/grid-loader/index.tsx'

/**
 * SentinelFace - a small face rendered on the shared GridLoader grid.
 * Reserved for moments the island is speaking as itself (the entrance
 * greeting, an error, the resting face when nobody is around) rather than
 * reporting on work in progress; every aiState keeps its own abstract
 * pattern (docs/rules.md §15.6).
 */

// Each variant's pattern and how it should move. Drowsy breathes slowly and
// sleep barely moves at all: a resting face that pulses at the same rate as a
// working state would read as activity rather than as absence.
const VARIANTS = {
  grin: { pattern: 'face-grin', color: 'white', speed: 'normal' },
  soft: { pattern: 'face-soft', color: 'amber', speed: 'normal' },
  drowsy: { pattern: 'face-drowsy', color: 'white', speed: 'slow' },
  sleep: { pattern: 'face-sleep', color: 'white', speed: 'slow' },
}

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

  const preset = VARIANTS[variant] ?? VARIANTS.grin

  return (
    <GridLoader
      blur={1}
      color={color ?? preset.color}
      gap={2}
      mode="pulse"
      pattern={preset.pattern}
      rounded
      size="sm"
      speed={preset.speed}
    />
  )
}
