/**
 * AvatarForge - the avatar being made, rather than the avatar.
 *
 * The boot sequence's fourth beat (T-099). Cells start as flat grey and resolve
 * to their real colour one at a time, in an order drawn from the seed, so the
 * visitor watches their own avatar assemble out of nothing.
 *
 * The maths comes from the same ./generator.js `AgentAvatar` uses, and the
 * terminal frame is `cellColor(..., 0)` for every cell, which is precisely what
 * `AgentAvatar` paints with animation off. That is what lets the pill hand the
 * avatar to the sidebar without the two disagreeing: they are not two
 * implementations that happen to match, they are one.
 *
 * Deliberately not a `GridLoader`. Every other Sentinel moment is a 3x3 glyph;
 * this is 6x6 and is the only one in the app, which is how it satisfies T-094's
 * unique-animation rule without spending a pattern from the shared budget.
 */
import { useEffect, useRef } from 'react'
import {
  BACKGROUND,
  GLOW_RADIUS_RATIO,
  GRID_SIZE,
  buildAvatar,
  cellColor,
  createRng,
} from '../../effects/smoothui/agent-avatar/generator'

const CELL_COUNT = GRID_SIZE * GRID_SIZE

/** Share of the run spent revealing cells; the rest is the glow ring settling. */
const REVEAL_SHARE = 0.78

/**
 * How long one cell takes to go from grey to its colour, as a share of the run.
 *
 * Generous on purpose, and it overlaps heavily with its neighbours: a short
 * fade makes 36 cells pop on one after another like a fault, where a long one
 * reads as the whole grid warming through.
 */
const CELL_FADE_SHARE = 0.3

/** Lightness added at the moment a cell lands, decaying over its fade. */
const LANDING_FLASH = 26

/** Grey a cell sits at before it resolves. Dark enough to read as "not yet". */
const DORMANT_LIGHT = 26

const clamp01 = (n) => Math.min(1, Math.max(0, n))

/** Smoothstep, so cells ease in rather than ramping linearly. */
const ease = (t) => t * t * (3 - 2 * t)

/**
 * The order cells resolve in: a seeded shuffle, so it is stable for a given
 * visitor but different between visitors. Offset by 2 from the grid's own rng
 * stream (generator.js uses hash and hash + 1) so the order is not correlated
 * with the colours it is revealing.
 */
function revealOrder(hash) {
  const rng = createRng(hash + 2)
  const order = Array.from({ length: CELL_COUNT }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * @param {object} props
 * @param {string} props.seed - the session id
 * @param {number} [props.size] - diameter in px
 * @param {number} props.durationMs - how long the forge has to complete
 * @param {boolean} [props.reducedMotion] - paint the finished avatar immediately
 */
export default function AvatarForge({ seed, size = 72, durationMs, reducedMotion = false }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const { hash, palette, grid } = buildAvatar(seed)
    const order = revealOrder(hash)
    const cellSize = size / GRID_SIZE
    const half = size / 2

    // Position in the reveal queue, by flat cell index, so the draw loop is a
    // lookup rather than an indexOf per cell per frame.
    const slot = new Array(CELL_COUNT)
    order.forEach((cellIndex, position) => {
      slot[cellIndex] = position
    })

    // Last cell must still have its full fade inside the reveal window.
    const stagger = (REVEAL_SHARE - CELL_FADE_SHARE) / Math.max(1, CELL_COUNT - 1)

    const draw = (progress) => {
      ctx.clearRect(0, 0, size, size)

      ctx.save()
      ctx.beginPath()
      ctx.arc(half, half, half, 0, Math.PI * 2)
      ctx.clip()

      ctx.fillStyle = BACKGROUND
      ctx.fillRect(0, 0, size, size)

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = grid[y][x]
          const index = y * GRID_SIZE + x
          const startAt = slot[index] * stagger
          const t = ease(clamp01((progress - startAt) / CELL_FADE_SHARE))

          // The colour this cell is heading for. Offset 0, which is the frame
          // AgentAvatar paints when it is not animating.
          const target = cellColor(palette[cell.colorIndex], cell, 0)

          // Saturation and lightness travel from a flat grey to the real
          // values; hue is already correct, it is simply invisible at zero
          // saturation. The flash rides on top and decays as t completes, so a
          // cell lands with a spark rather than easing in politely.
          const flash = LANDING_FLASH * t * (1 - t) * 4
          const s = target.s * t
          const l = DORMANT_LIGHT + (target.l - DORMANT_LIGHT) * t + flash
          const color = `hsl(${target.h}, ${s}%, ${Math.min(96, l)}%)`

          ctx.shadowColor = color
          ctx.shadowBlur = cellSize * 0.45 * t
          ctx.fillStyle = color
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        }
      }

      ctx.shadowBlur = 0
      ctx.restore()

      // The ring closes last: it reads as the avatar being sealed, and it is
      // the visual cue that the forge is finished and the handoff can start.
      const ringIn = ease(clamp01((progress - REVEAL_SHARE) / (1 - REVEAL_SHARE)))
      const [gh, gs, gl] = palette[0]
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.shadowColor = `hsla(${gh}, ${gs}%, ${gl}%, ${0.6 * ringIn})`
      ctx.shadowBlur = size * GLOW_RADIUS_RATIO * ringIn
      ctx.beginPath()
      ctx.arc(half, half, half - 1, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${gh}, ${gs}%, ${gl}%, ${0.15 * ringIn})`
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }

    // Nothing to watch being built, so show the built thing. Same stance the
    // island's entrance takes (docs/rules.md §10.3).
    if (reducedMotion || !durationMs) {
      draw(1)
      return undefined
    }

    let start = null
    const step = (now) => {
      if (start === null) start = now
      const progress = clamp01((now - start) / durationMs)
      draw(progress)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    return () => cancelAnimationFrame(rafRef.current)
  }, [seed, size, durationMs, reducedMotion])

  return (
    <canvas
      // Decorative: the island's live region announces the stage's line, and a
      // half-built avatar is not something to describe.
      aria-hidden="true"
      ref={canvasRef}
      style={{ width: size, height: size, borderRadius: '50%' }}
    />
  )
}
