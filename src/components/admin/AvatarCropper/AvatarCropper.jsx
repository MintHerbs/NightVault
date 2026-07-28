// src/components/admin/AvatarCropper/AvatarCropper.jsx
//
// Drag-to-reposition, scroll/pinch-to-zoom avatar cropper (T-072). No cropping
// library exists in this repo (package.json checked) — this hand-rolls a
// canvas export on top of a plain <img>, matching imageToWebp.js's existing
// no-dependency style rather than adding one.
//
// The output is a plain 512x512 square WebP, not a circular-cropped file:
// every place an avatar/contributor photo renders (AvatarGroup, AboutPage's
// MemberCard) already clips a square image to a circle with CSS, so baking
// an actual circle into the pixels would be redundant and would show
// square corners if that CSS ever changes. The circular viewport here is
// just a framing guide matching how the photo will actually be displayed.
import { useCallback, useEffect, useRef, useState } from 'react'
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { encodeCanvasToWebp } from '../../../lib/encodeCanvasToWebp'
import styles from './AvatarCropper.module.css'

const VIEWPORT_SIZE = 240
const OUTPUT_SIZE = 512
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const QUALITY = 0.85

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value, max) {
  return Math.min(max, Math.max(-max, value))
}

/**
 * `file`: a picked File/Blob (image/*). `onConfirm(blob)` receives the
 * cropped WebP; `onCancel()` closes without saving. `onError(message)`
 * reports a decode/encode failure — the caller owns the toast, so this
 * component never fails silently (see `fail()` below).
 */
export default function AvatarCropper({ file, onCancel, onConfirm, onError }) {
  const [imgUrl, setImgUrl] = useState(null)
  const [naturalSize, setNaturalSize] = useState(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const imgRef = useRef(null)
  const viewportRef = useRef(null)
  const dragRef = useRef(null)
  const pointersRef = useRef(new Map())

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // "Cover" fit at zoom 1: the shorter side exactly fills the viewport, so
  // there's never a gap at any zoom level from MIN_ZOOM up.
  const baseScale = naturalSize ? VIEWPORT_SIZE / Math.min(naturalSize.w, naturalSize.h) : 1
  const dispW = naturalSize ? naturalSize.w * baseScale * zoom : 0
  const dispH = naturalSize ? naturalSize.h * baseScale * zoom : 0
  const maxOffsetX = Math.max(0, (dispW - VIEWPORT_SIZE) / 2)
  const maxOffsetY = Math.max(0, (dispH - VIEWPORT_SIZE) / 2)

  const clampOffset = useCallback((o, maxX, maxY) => ({
    x: clamp(o.x, maxX),
    y: clamp(o.y, maxY),
  }), [])

  /** Report upward and close — nothing here is recoverable in-place. */
  const fail = (message) => {
    onError?.(message)
    onCancel()
  }

  const onImgLoad = () => {
    const el = imgRef.current
    // A 0-dimension decode has to be rejected, not stored: `{w: 0, h: 0}` is a
    // truthy object, so it would satisfy the Save button's `!naturalSize`
    // guard while making baseScale Infinity and every derived width NaN —
    // drawImage would then encode a blank 512x512 square. Same `!w || !h`
    // check imageToWebp.js makes before trusting a decode.
    if (!el.naturalWidth || !el.naturalHeight) {
      fail("That image couldn't be read. Try a JPEG, PNG, or WebP.")
      return
    }
    setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
  }

  const applyZoom = useCallback((nextZoom) => {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
    const nextDispW = naturalSize ? naturalSize.w * baseScale * clampedZoom : 0
    const nextDispH = naturalSize ? naturalSize.h * baseScale * clampedZoom : 0
    const nextMaxX = Math.max(0, (nextDispW - VIEWPORT_SIZE) / 2)
    const nextMaxY = Math.max(0, (nextDispH - VIEWPORT_SIZE) / 2)
    setZoom(clampedZoom)
    setOffset((prev) => clampOffset(prev, nextMaxX, nextMaxY))
  }, [naturalSize, baseScale, clampOffset])

  // Kept fresh every render so the native wheel listener below (mounted once)
  // never closes over a stale zoom/applyZoom.
  const latestRef = useRef({ zoom, applyZoom })
  latestRef.current = { zoom, applyZoom }

  // React registers onWheel as a PASSIVE listener (matching the browser's own
  // recommendation for scroll performance), so e.preventDefault() inside a
  // JSX onWheel handler is silently ignored and the page behind this modal
  // scrolls while the user tries to zoom. Attaching natively with
  // { passive: false } is the only way to actually block that.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      const { zoom: currentZoom, applyZoom: currentApplyZoom } = latestRef.current
      currentApplyZoom(currentZoom - e.deltaY * 0.0025)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 1) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      dragRef.current = { pinchStartDist: distance(a, b), pinchStartZoom: zoom }
    }
  }

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2 && dragRef.current?.pinchStartDist) {
      const [a, b] = [...pointersRef.current.values()]
      const ratio = distance(a, b) / dragRef.current.pinchStartDist
      applyZoom(dragRef.current.pinchStartZoom * ratio)
      return
    }

    if (pointersRef.current.size === 1 && dragRef.current?.startOffset) {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setOffset(clampOffset(
        { x: dragRef.current.startOffset.x + dx, y: dragRef.current.startOffset.y + dy },
        maxOffsetX,
        maxOffsetY,
      ))
    }
  }

  // Lifting one finger of a pinch shouldn't freeze dragging — hand off to a
  // fresh single-pointer drag anchored at the remaining finger.
  const endPointer = (e) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size === 1) {
      const [remaining] = [...pointersRef.current.values()]
      dragRef.current = { startX: remaining.x, startY: remaining.y, startOffset: offset }
    } else if (pointersRef.current.size === 0) {
      dragRef.current = null
    }
  }

  const confirm = async () => {
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      const outScale = OUTPUT_SIZE / VIEWPORT_SIZE
      const outW = dispW * outScale
      const outH = dispH * outScale
      const outX = (VIEWPORT_SIZE / 2 + offset.x - dispW / 2) * outScale
      const outY = (VIEWPORT_SIZE / 2 + offset.y - dispH / 2) * outScale
      ctx.drawImage(imgRef.current, outX, outY, outW, outH)
      // Throws on a browser that can't encode WebP — imageToWebp.js documents
      // that as a real branch (Safari only gained it in 16.x), not a
      // formality. Unlike the note-image path there's no
      // fall-back-to-the-original here (the whole point is the re-crop), so
      // the only correct behaviour is to say so instead of leaving the button
      // to flick back to "Save photo" with nothing having happened.
      const blob = await encodeCanvasToWebp(canvas, QUALITY)
      await onConfirm(blob)
    } catch (err) {
      fail(`Couldn't process that photo: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Reposition photo</h2>

        <div
          ref={viewportRef}
          className={styles.viewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          {imgUrl && (
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              // A format the browser can't decode at all (HEIC from an iPhone
              // is the realistic one) fires this and never onLoad, so without
              // it the dialog would just sit there with Save permanently
              // disabled and no explanation.
              onError={() => fail("That image couldn't be read. Try a JPEG, PNG, or WebP.")}
              className={styles.image}
              style={{
                width: dispW || undefined,
                height: dispH || undefined,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        <div className={styles.zoomRow}>
          <MagnifyingGlassMinus size={16} className={styles.zoomIcon} />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className={styles.zoomSlider}
            aria-label="Zoom"
          />
          <MagnifyingGlassPlus size={16} className={styles.zoomIcon} />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnText} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={confirm} disabled={saving || !naturalSize}>
            {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
