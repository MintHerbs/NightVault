import GridLoader from '../../effects/smoothui/grid-loader/index.tsx'

/**
 * `thinking` is local work — parsing, minimising, laying out, a circuit
 * ticking — as opposed to `waiting`, which is time spent behind something
 * else.
 *
 * It therefore gets its own look rather than borrowing WaitingAnimation's
 * frame: a ripple spreading out from the centre, which reads as computation
 * radiating rather than as a queue turning over (docs/rules.md §15.6). Same
 * grid, different character.
 *
 * `speed="fast"` originally (400ms/cell) read as frantic for a state that can
 * sit on screen for as long as a circuit keeps running — slowed to `"slow"`
 * (1500ms) so it reads as steady work rather than a glitch.
 *
 * `pattern`, when given (ThinkingPhrase.jsx, driven by useAIActivity), pins
 * the grid to that one shape — a real signal about what the sandbox is doing
 * right now, not a decoration, so it must not also be cycling on its own
 * timer. With no pattern (every other "thinking" caller — tree building, ERD
 * generating — nothing with sandbox activity to report), `mode="sequence"`
 * cycles through a few soft, organic shapes instead, so a long-running spell
 * still has some life to it.
 *
 * `circle`, set only for the free-run "running" activity, drops the label
 * entirely and marks the wrapper with a plain (non-module) class that
 * DynamicIsland.module.css targets via `:has()` to morph the pill itself into
 * a circle — a label that changes with every pulse read as noise once a
 * clock was actually ticking (owner report), so this state says nothing at
 * all and just shows the grid breathing instead of reaching for new words.
 */
const PATTERN_SEQUENCE = ['ripple-out', 'breathing', 'ripple-in', 'twinkle']

export default function ThinkingAnimation({ label, pattern, circle = false }) {
  return (
    <div
      className={circle ? 'island-circle-mode' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: circle ? 'center' : undefined,
        gap: circle ? 0 : '10px',
        width: circle ? '100%' : undefined,
        minWidth: 0,
      }}
    >
      <GridLoader
        blur={1.4}
        color="green"
        gap={1}
        mode={pattern ? 'pulse' : 'sequence'}
        pattern={pattern}
        sequence={pattern ? undefined : PATTERN_SEQUENCE}
        rounded
        size="sm"
        speed="slow"
      />
      {!circle && (
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {label}
        </span>
      )}
    </div>
  )
}
