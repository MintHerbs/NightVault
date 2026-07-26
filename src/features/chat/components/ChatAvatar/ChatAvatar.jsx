// Wrapper around AgentAvatar - renders unique avatar for each session UUID
import AgentAvatar from '../../../../components/effects/smoothui/agent-avatar'

export default function ChatAvatar({ sessionId, size }) {
  const resolved = size || 36

  return (
    <div
      style={{
        // Explicit box + line-height 0. Without them the wrapper sized
        // itself from an inline <canvas>, which adds baseline descender
        // space below — making the box taller than wide, so borderRadius
        // 50% clipped an *ellipse* and shaved the avatar's edges (T-062).
        width: resolved,
        height: resolved,
        lineHeight: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <AgentAvatar seed={sessionId} size={resolved} animated={true} />
    </div>
  )
}
