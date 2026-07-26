import { useCallback, useEffect, useRef, useState } from 'react'
import { hexToHsl, hslToHex, normalizeHex } from '../../../lib/theme/palette'
import styles from './ColorWheel.module.css'

// Conic hue wheel + radial saturation, with a lightness slider and a hex
// field. Built from CSS gradients rather than a canvas so it stays crisp at
// any DPI and needs no redraw on theme change (T-062).
//
// Geometry: angle around the wheel is hue, distance from centre is
// saturation. Lightness is the separate slider — putting all three on the
// wheel would make the outer ring unreachable.

const WHEEL_SIZE = 168
const RADIUS = WHEEL_SIZE / 2

export default function ColorWheel({ value, onChange }) {
  const wheelRef = useRef(null)
  const draggingRef = useRef(false)

  const { h, s, l } = hexToHsl(normalizeHex(value) ?? '#ffa31a')
  const [hexDraft, setHexDraft] = useState(normalizeHex(value) ?? '#ffa31a')
  const [hexError, setHexError] = useState(false)

  // Keep the text field in step when the colour changes from the wheel or
  // from outside (preset selection), but never while the user is typing.
  useEffect(() => {
    const normalized = normalizeHex(value)
    if (normalized && document.activeElement?.dataset?.colorHexInput !== 'true') {
      setHexDraft(normalized)
      setHexError(false)
    }
  }, [value])

  const pickFromPoint = useCallback(
    (clientX, clientY) => {
      const rect = wheelRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = clientX - (rect.left + rect.width / 2)
      const dy = clientY - (rect.top + rect.height / 2)
      const distance = Math.min(Math.sqrt(dx * dx + dy * dy), RADIUS)
      // atan2 gives -180..180 with 0 pointing right; the conic-gradient
      // starts at the top, so rotate by 90deg to keep them in agreement.
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      const nextHue = (angle + 90 + 360) % 360
      const nextSat = Math.round((distance / RADIUS) * 100)
      onChange(hslToHex(nextHue, nextSat, l))
    },
    [l, onChange]
  )

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return
      e.preventDefault()
      const point = e.touches?.[0] ?? e
      pickFromPoint(point.clientX, point.clientY)
    }
    const onUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [pickFromPoint])

  const handlePointerDown = (e) => {
    draggingRef.current = true
    pickFromPoint(e.clientX, e.clientY)
  }

  const commitHex = (raw) => {
    const normalized = normalizeHex(raw)
    if (!normalized) {
      setHexError(true)
      return
    }
    setHexError(false)
    onChange(normalized)
  }

  // Thumb position: polar (hue angle, saturation radius) -> cartesian.
  const thumbAngle = ((h - 90) * Math.PI) / 180
  const thumbRadius = (s / 100) * RADIUS
  const thumbX = RADIUS + Math.cos(thumbAngle) * thumbRadius
  const thumbY = RADIUS + Math.sin(thumbAngle) * thumbRadius

  return (
    <div className={styles.root}>
      <div
        ref={wheelRef}
        className={styles.wheel}
        style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
        onPointerDown={handlePointerDown}
        role="application"
        aria-label="Colour wheel"
      >
        <div className={styles.wheelHue} />
        <div className={styles.wheelSaturation} />
        {/* Darkens/lightens the whole wheel to preview the chosen lightness */}
        <div
          className={styles.wheelLightness}
          style={{
            background: l < 50 ? '#000' : '#fff',
            opacity: Math.abs(l - 50) / 50,
          }}
        />
        <span
          className={styles.thumb}
          style={{ left: thumbX, top: thumbY, backgroundColor: normalizeHex(value) ?? '#ffa31a' }}
        />
      </div>

      <label className={styles.sliderRow}>
        <span className={styles.sliderLabel}>Lightness</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(l)}
          className={styles.slider}
          style={{
            background: `linear-gradient(to right, #000, ${hslToHex(h, s, 50)}, #fff)`,
          }}
          onChange={(e) => onChange(hslToHex(h, s, Number(e.target.value)))}
        />
      </label>

      <div className={styles.hexRow}>
        <span
          className={styles.preview}
          style={{ backgroundColor: normalizeHex(value) ?? '#ffa31a' }}
        />
        <input
          type="text"
          data-color-hex-input="true"
          className={`${styles.hexInput} ${hexError ? styles.hexInputError : ''}`}
          value={hexDraft}
          spellCheck={false}
          maxLength={7}
          aria-label="Hex colour"
          onChange={(e) => {
            setHexDraft(e.target.value)
            if (hexError) setHexError(false)
          }}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitHex(e.currentTarget.value)
            }
          }}
        />
      </div>
      {hexError && <div className={styles.hexError}>Enter a hex colour, e.g. #ffa31a or #f0a</div>}
    </div>
  )
}
