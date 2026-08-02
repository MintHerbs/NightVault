// AgentAvatar component - generates unique deterministic avatar patterns from a seed string
//
// The seed-to-pixels maths lives in ./generator.js, shared with the Sentinel
// boot sequence's AvatarForge so the avatar it forges is provably this one.
import { memo, useEffect, useRef } from 'react'
import {
  BACKGROUND,
  BREATHE_AMPLITUDE,
  BREATHE_SPEED,
  GLOW_RADIUS_RATIO,
  GRID_SIZE,
  PULSE_AMPLITUDE,
  PULSE_SPEED,
  SCALE_PULSE_AMOUNT,
  SCALE_PULSE_SPEED,
  SPARKLE_BOOST,
  SPARKLE_SPEED,
  SPARKLE_THRESHOLD,
  WAVE_AMPLITUDE,
  WAVE_LENGTH,
  WAVE_SPEED,
  buildAvatar,
  cellColor,
} from './generator'

function AgentAvatar({
  seed,
  size = 64,
  animated = true,
  className = '',
  ...props
}) {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const { palette, grid } = buildAvatar(seed)
    const cellSize = size / GRID_SIZE
    const half = size / 2

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let shouldAnimate = animated && !motionQuery.matches
    let isOnScreen = false
    let isRunning = false

    const draw = (time) => {
      ctx.clearRect(0, 0, size, size)

      // Scale pulse — whole avatar breathes
      const scale = shouldAnimate
        ? 1 + Math.sin(time * SCALE_PULSE_SPEED) * SCALE_PULSE_AMOUNT
        : 1

      ctx.save()

      // Clip to circle BEFORE applying the breathe scale. Clipping inside
      // the transform scaled the clip path too, pushing it past the canvas
      // edges at the top of each pulse and flattening the avatar's sides.
      ctx.beginPath()
      ctx.arc(half, half, half, 0, Math.PI * 2)
      ctx.clip()

      ctx.translate(half, half)
      ctx.scale(scale, scale)
      ctx.translate(-half, -half)

      // Dark background
      ctx.fillStyle = BACKGROUND
      ctx.fillRect(0, 0, size, size)

      // Global breathe offset for lightness
      const breatheOffset = shouldAnimate
        ? Math.sin(time * BREATHE_SPEED) * BREATHE_AMPLITUDE
        : 0

      // Draw pixel grid
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = grid[y][x]

          // Per-pixel pulse
          const pulse = shouldAnimate
            ? Math.sin(time * PULSE_SPEED + cell.phase) * PULSE_AMPLITUDE
            : 0

          // Diagonal wave sweep
          const waveDist = (x + y) / WAVE_LENGTH
          const wave = shouldAnimate
            ? Math.sin(time * WAVE_SPEED + waveDist) * WAVE_AMPLITUDE
            : 0

          // Sparkle — occasional bright flash
          const sparkleVal = shouldAnimate
            ? Math.sin(time * SPARKLE_SPEED + cell.sparklePhase)
            : 0
          const sparkle =
            sparkleVal > SPARKLE_THRESHOLD
              ? ((sparkleVal - SPARKLE_THRESHOLD) / (1 - SPARKLE_THRESHOLD)) *
                SPARKLE_BOOST
              : 0

          // Shared with AvatarForge, which passes an offset of 0 and so paints
          // exactly the frame this does with animation off.
          const { h, s, l } = cellColor(
            palette[cell.colorIndex],
            cell,
            pulse + breatheOffset + wave + sparkle
          )
          const color = `hsl(${h}, ${s}%, ${l}%)`

          // Pixel glow — subtle shadow per cell
          ctx.shadowColor = color
          ctx.shadowBlur = cellSize * 0.45

          ctx.fillStyle = color
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        }
      }

      // Reset shadow before restore
      ctx.shadowBlur = 0
      ctx.restore()

      // Outer glow ring
      const [gh, gs, gl] = palette[0]
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.shadowColor = `hsla(${gh}, ${gs}%, ${gl}%, 0.6)`
      ctx.shadowBlur = size * GLOW_RADIUS_RATIO
      ctx.beginPath()
      ctx.arc(half, half, half - 1, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${gh}, ${gs}%, ${gl}%, 0.15)`
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      if (shouldAnimate && isOnScreen && !document.hidden) {
        rafRef.current = requestAnimationFrame(draw)
      } else {
        isRunning = false
      }
    }

    // Each frame shadow-blurs GRID_SIZE² rects, and the social feed mounts one
    // of these per post and per comment. Left unchecked that is dozens of
    // permanent rAF loops fighting the main thread with the click handlers,
    // which is a large part of why the feed felt sluggish. Animate only what is
    // actually on screen, in a visible tab.
    const start = () => {
      if (isRunning || !shouldAnimate || !isOnScreen || document.hidden) return
      isRunning = true
      rafRef.current = requestAnimationFrame(draw)
    }

    const stop = () => {
      isRunning = false
      cancelAnimationFrame(rafRef.current)
    }

    const handleMotionChange = () => {
      stop()
      shouldAnimate = animated && !motionQuery.matches
      if (shouldAnimate) start()
      else draw(0)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isOnScreen = entry.isIntersecting
        if (isOnScreen) start()
        else stop()
      },
      // Spin up slightly before the avatar scrolls into view so it is never
      // caught mid-pause at the edge of the viewport.
      { rootMargin: '200px' }
    )
    observer.observe(canvas)

    motionQuery.addEventListener('change', handleMotionChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Paint a first frame unconditionally; the observer decides whether it
    // then keeps moving.
    draw(0)

    return () => {
      stop()
      observer.disconnect()
      motionQuery.removeEventListener('change', handleMotionChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [seed, size, animated])

  return (
    <canvas
      aria-label={`Avatar for ${seed}`}
      className={className}
      ref={canvasRef}
      role="img"
      style={{ width: size, height: size, borderRadius: '50%' }}
      {...props}
    />
  )
}

export default memo(AgentAvatar)
