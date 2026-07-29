// AsciiCanvas — renders one ASCII density field (src/lib/asciiArt) as an
// animated monospace character grid (T-077). Pure presentation: the field
// function supplies the shape and motion, this component owns the canvas
// lifecycle, resize, theming, and motion/visibility gating.
import { useEffect, useRef, useState } from 'react'
import { drawAsciiField } from '../../../lib/asciiArt/renderAsciiField'
import {
  COLOR_FADE_MS, readAccentRgb, mixRgb, rgbCss, sameRgb,
} from '../../../lib/asciiArt/coverColor'
import styles from './AsciiCard.module.css'

// Column count for a full-size card cover. Small previews (the admin cover
// picker's preset thumbnails) pass a lower count — cost scales with cols^2
// once rows are derived, and a dozen animating thumbnails at card resolution
// is a lot of field evaluation for something 84px wide.
const DEFAULT_COLS = 56
const FRAME_INTERVAL_MS = 1000 / 16 // a card cover reads as alive well below 60fps
const STATIC_FRAME_T = 0.6 // representative, non-degenerate moment for reduced-motion

// Attributes ThemeProvider (and index.html's no-flash script) write to <html>
// when the theme changes: the two data-* for presets, `style` for a custom
// seed's inline custom properties.
const THEME_ATTRS = ['data-color-theme', 'data-mode', 'style']

export default function AsciiCanvas({ field, cols = DEFAULT_COLS }) {
  const canvasRef = useRef(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(query.matches)
    const onChange = (e) => setReduceMotion(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    // Accent colour state. `current` is what's on screen, `target` is where
    // the theme says it should be, and the pair is crossfaded rather than
    // swapped so a theme change eases in instead of snapping.
    let current = readAccentRgb()
    let target = current
    let fadeFrom = current
    let fadeStart = -Infinity
    // Set by the theme observer, consumed by the loop. The loop stamps
    // fadeStart from its own rAF timestamp rather than the observer calling
    // performance.now(): the two are different clock domains, and if the
    // stamp lands ahead of the next frame's timestamp the fade progress goes
    // negative, mixRgb clamps to 0, and the cover sticks on the OLD colour
    // forever instead of easing to the new one.
    let pendingFade = false

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    }

    const draw = (tSeconds) => {
      drawAsciiField(ctx, {
        width: canvas.width,
        height: canvas.height,
        cols,
        field,
        t: tSeconds,
        color: rgbCss(current),
      })
    }

    resize()

    // Why an observer and not a `useTheme()` dependency: ThemeProvider writes
    // data-color-theme/data-mode to <html> from its own effect, and React runs
    // child effects BEFORE parent effects — so a child re-running on a theme
    // change reads getComputedStyle before the attribute has actually changed
    // and picks up the OLD accent, which only looked right after a reload.
    // A MutationObserver fires after the DOM has changed, so it can't race.
    // It also covers index.html's pre-React no-flash script for free, and
    // keeps a theme change from tearing down the animation loop below (which
    // would reset every cover's motion to t=0).
    const onThemeChange = () => {
      const next = readAccentRgb()
      if (sameRgb(next, target)) return
      target = next
      pendingFade = true
      if (reduceMotion) {
        current = target
        pendingFade = false
        draw(STATIC_FRAME_T)
      }
    }

    const themeObserver = new MutationObserver(onThemeChange)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: THEME_ATTRS,
    })

    if (reduceMotion) {
      draw(STATIC_FRAME_T)
      const sizeObserver = new ResizeObserver(() => { resize(); draw(STATIC_FRAME_T) })
      sizeObserver.observe(canvas)
      return () => {
        themeObserver.disconnect()
        sizeObserver.disconnect()
      }
    }

    // Several covers animate on one page, so a card that isn't on screen must
    // not burn a frame budget — the home grid and a course page can both push
    // cards below the fold. Ditto a backgrounded tab.
    let visible = true
    let raf = null
    let lastFrameTime = 0
    let elapsed = 0
    let lastNow = null

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (!visible || document.hidden) {
        lastNow = null // don't bank the paused time as elapsed animation time
        return
      }
      if (lastNow === null) lastNow = now
      elapsed += now - lastNow
      lastNow = now

      if (pendingFade) {
        fadeFrom = current
        fadeStart = now
        pendingFade = false
      }

      // A colour crossfade is short and its smoothness is the whole point, so
      // it runs at display rate; the field's own motion stays frame-gated.
      const fadeT = (now - fadeStart) / COLOR_FADE_MS
      const fading = fadeT < 1
      if (fading) current = mixRgb(fadeFrom, target, fadeT)
      else if (!sameRgb(current, target)) current = target
      else if (now - lastFrameTime < FRAME_INTERVAL_MS) return

      lastFrameTime = now
      draw(elapsed / 1000)
    }
    raf = requestAnimationFrame(loop)

    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting },
      { rootMargin: '120px' },
    )
    observer.observe(canvas)

    // ResizeObserver, not a window 'resize' listener: a cover can be laid out
    // *after* this effect runs — inside a Radix popover portal the element is
    // still 0x0 at mount, so a one-shot measure produced a 1x1 bitmap and the
    // cover rendered blank forever (every thumbnail in the admin cover picker
    // was empty). This also picks up flex/grid reflows that never resize the
    // window, which the old listener missed.
    const sizeObserver = new ResizeObserver(() => resize())
    sizeObserver.observe(canvas)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      observer.disconnect()
      themeObserver.disconnect()
      sizeObserver.disconnect()
    }
  }, [field, cols, reduceMotion])

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
}
