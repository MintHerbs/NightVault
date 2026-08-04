/**
 * The Circuit Sandbox camera (T-102).
 *
 * A camera is `{ x, y, zoom }`: `x`/`y` are a translation in **screen** pixels,
 * `zoom` scales **document** units. A document point `p` therefore paints at
 * `p * zoom + (x, y)`, which is exactly what the SVG's
 * `translate(x, y) scale(zoom)` does, in that order.
 *
 * Keeping the pan in screen pixels rather than document units is what makes
 * dragging the canvas feel right at every zoom level: one pixel of hand
 * movement is one pixel of content movement, whatever the scale. It also means
 * the pan handler can add raw client deltas without knowing the zoom.
 *
 * This module is pure and DOM-free on purpose. Screen/document conversion is
 * used by six separate gestures in CircuitSandbox.jsx (pointer hit-testing,
 * component drags, palette drops, wire routing, snapping, and the wheel), and a
 * sign or an ordering error in any one of them produces the same symptom: parts
 * that land somewhere other than where they were dropped. Round-tripping a
 * point through both conversions is the kind of claim a test can hold down and
 * a screenshot cannot. See camera.test.js.
 */

/** Zoom bounds. Below 25% a 60px gate is illegible; above 300% a single gate
 *  fills the viewport and panning becomes the only way to work. */
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 3

/**
 * The rungs the zoom buttons and the keyboard step through.
 *
 * A ladder rather than a fixed multiplier so the readout lands on round,
 * recognisable numbers (50%, 100%, 200%) instead of drifting to 96% and
 * staying there. Wheel and pinch are continuous and ignore this.
 */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3]

/** The resting camera: no pan, no scale. */
export const HOME = { x: 0, y: 0, zoom: 1 }

export function clampZoom(zoom) {
  if (!Number.isFinite(zoom)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Document point to surface-relative screen point. */
export function toScreen(camera, point) {
  return {
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y,
  }
}

/** Surface-relative screen point to document point. */
export function toDocument(camera, point) {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  }
}

/**
 * Change the zoom while holding one screen point still.
 *
 * Without an anchor the circuit slides out from under the pointer on every
 * wheel notch, because scaling about the document origin moves everything else
 * proportionally to how far it sits from that origin. Solving
 * `toDocument(next, anchor) === toDocument(camera, anchor)` for the new
 * translation gives the expression below.
 *
 * @param {{x: number, y: number, zoom: number}} camera
 * @param {number} nextZoom - clamped internally, so callers can pass anything
 * @param {{x: number, y: number}} anchor - surface-relative screen coordinates
 */
export function zoomAt(camera, nextZoom, anchor) {
  const zoom = clampZoom(nextZoom)
  if (zoom === camera.zoom) return camera
  const ratio = zoom / camera.zoom
  return {
    zoom,
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
  }
}

/**
 * The next rung of ZOOM_STEPS in `direction` (+1 in, -1 out).
 *
 * Strictly past the current zoom, so a wheel gesture that left the camera at
 * 1.13 steps to 1.25 rather than back to whichever rung it happens to sit
 * beside. Returns the current zoom unchanged at either end of the ladder.
 */
export function stepZoom(zoom, direction) {
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > zoom + 1e-6) ?? clampZoom(zoom)
  }
  const below = ZOOM_STEPS.filter((step) => step < zoom - 1e-6)
  return below.length ? below[below.length - 1] : clampZoom(zoom)
}

/** Whether the ladder has anywhere left to go in `direction`. */
export function canStepZoom(zoom, direction) {
  return stepZoom(zoom, direction) !== zoom
}

/** The readout on the zoom dock: "100%", never "100.0000001%". */
export function zoomLabel(zoom) {
  return `${Math.round(zoom * 100)}%`
}
