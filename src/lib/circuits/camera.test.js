/**
 * Camera tests (T-102).
 * Run with: npm run test:circuits
 *
 * The claims worth testing are the ones whose failure looks like "the sandbox
 * is broken" rather than "the sandbox looks wrong":
 *
 *  - screen and document conversion round-trip, because every drop, drag and
 *    wire hit-test goes through them and a sign error moves parts away from the
 *    pointer;
 *  - zooming holds its anchor still, which is the whole reason zoomAt exists;
 *  - panning stays in screen pixels, so the hand and the content agree at every
 *    scale;
 *  - the ladder always makes progress and always stops at the ends, because a
 *    step that returns the current zoom is a dead button.
 */

import {
  HOME, MIN_ZOOM, MAX_ZOOM, ZOOM_STEPS,
  canStepZoom, clampZoom, stepZoom, toDocument, toScreen, zoomAt, zoomLabel,
} from './camera.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps
const closePoint = (a, b, eps = 1e-9) => close(a.x, b.x, eps) && close(a.y, b.y, eps)

const CAMERAS = [
  HOME,
  { x: 0, y: 0, zoom: 0.25 },
  { x: 0, y: 0, zoom: 3 },
  { x: 137, y: -84, zoom: 1 },
  { x: -412, y: 260, zoom: 0.5 },
  { x: 33.5, y: 7.25, zoom: 2.5 },
]

const POINTS = [
  { x: 0, y: 0 },
  { x: 20, y: 40 },
  { x: -260, y: 180 },
  { x: 1024, y: -768 },
  { x: 7.5, y: 0.25 },
]

// ---------------------------------------------------------------------------
console.log('1. screen and document conversion round-trip')
// ---------------------------------------------------------------------------
{
  for (const camera of CAMERAS) {
    for (const point of POINTS) {
      const there = toScreen(camera, point)
      const back = toDocument(camera, there)
      assert(
        closePoint(back, point, 1e-9),
        `doc->screen->doc lost ${JSON.stringify(point)} at zoom ${camera.zoom}: got ${JSON.stringify(back)}`,
      )

      const thereFirst = toDocument(camera, point)
      const backFirst = toScreen(camera, thereFirst)
      assert(
        closePoint(backFirst, point, 1e-9),
        `screen->doc->screen lost ${JSON.stringify(point)} at zoom ${camera.zoom}`,
      )
    }
  }

  // The identity camera must be a genuine no-op, since that is the state every
  // mount starts in.
  for (const point of POINTS) {
    assert(closePoint(toScreen(HOME, point), point), 'HOME must not move a point')
    assert(closePoint(toDocument(HOME, point), point), 'HOME must not move a point back')
  }
}

// ---------------------------------------------------------------------------
console.log('2. zoom scales document units and translation is screen pixels')
// ---------------------------------------------------------------------------
{
  // A document span of 100 units is 50 screen pixels at 50% and 200 at 200%,
  // whatever the pan happens to be.
  for (const camera of CAMERAS) {
    const a = toScreen(camera, { x: 0, y: 0 })
    const b = toScreen(camera, { x: 100, y: 100 })
    assert(close(b.x - a.x, 100 * camera.zoom), `x span wrong at zoom ${camera.zoom}`)
    assert(close(b.y - a.y, 100 * camera.zoom), `y span wrong at zoom ${camera.zoom}`)
  }

  // Panning must not be scaled: shifting the camera by 10 screen pixels moves
  // the painted point by exactly 10, at every zoom. This is the property that
  // makes dragging the canvas track the hand 1:1.
  for (const camera of CAMERAS) {
    const panned = { ...camera, x: camera.x + 10, y: camera.y - 4 }
    const before = toScreen(camera, { x: 42, y: 42 })
    const after = toScreen(panned, { x: 42, y: 42 })
    assert(close(after.x - before.x, 10), `pan x scaled at zoom ${camera.zoom}`)
    assert(close(after.y - before.y, -4), `pan y scaled at zoom ${camera.zoom}`)
  }
}

// ---------------------------------------------------------------------------
console.log('3. zoomAt holds its anchor still')
// ---------------------------------------------------------------------------
{
  const anchors = [{ x: 0, y: 0 }, { x: 400, y: 300 }, { x: -50, y: 620 }]
  const targets = [0.25, 0.5, 0.8, 1, 1.5, 2, 3]

  for (const camera of CAMERAS) {
    for (const anchor of anchors) {
      for (const target of targets) {
        const next = zoomAt(camera, target, anchor)
        // The document point under the anchor is the same before and after.
        const wasUnder = toDocument(camera, anchor)
        const nowUnder = toDocument(next, anchor)
        assert(
          closePoint(wasUnder, nowUnder, 1e-6),
          `anchor ${JSON.stringify(anchor)} moved zooming ${camera.zoom} -> ${target}: `
          + `${JSON.stringify(wasUnder)} vs ${JSON.stringify(nowUnder)}`,
        )
        assert(close(next.zoom, clampZoom(target)), `zoom not applied for target ${target}`)
      }
    }
  }

  // Zooming to the zoom you already have changes nothing at all.
  for (const camera of CAMERAS) {
    assert(zoomAt(camera, camera.zoom, { x: 12, y: 34 }) === camera, 'no-op zoom must return the same camera')
  }

  // A sequence of anchored zooms is still anchored: wheel gestures arrive as a
  // burst, and drift that only shows up after several notches is the failure
  // mode a single-step test would miss.
  {
    const anchor = { x: 321, y: 214 }
    let camera = { x: 60, y: -30, zoom: 1 }
    const under = toDocument(camera, anchor)
    for (const target of [1.2, 1.44, 1.728, 1.2, 0.6, 0.4, 0.9]) {
      camera = zoomAt(camera, target, anchor)
      assert(
        closePoint(toDocument(camera, anchor), under, 1e-6),
        `anchor drifted after stepping to ${target}`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
console.log('4. zoom is clamped')
// ---------------------------------------------------------------------------
{
  assert(clampZoom(0) === MIN_ZOOM, '0 clamps to MIN_ZOOM')
  assert(clampZoom(-4) === MIN_ZOOM, 'negative clamps to MIN_ZOOM')
  assert(clampZoom(1e9) === MAX_ZOOM, 'huge clamps to MAX_ZOOM')
  assert(clampZoom(Number.NaN) === 1, 'NaN falls back to 1')
  assert(clampZoom(Number.POSITIVE_INFINITY) === 1, 'Infinity falls back to 1')
  assert(clampZoom(1.5) === 1.5, 'an in-range zoom is untouched')

  // Clamping has to survive the anchored path too, or a fast trackpad pinch
  // walks straight past the bounds.
  const wild = zoomAt(HOME, 500, { x: 10, y: 10 })
  assert(wild.zoom === MAX_ZOOM, 'zoomAt clamps above MAX_ZOOM')
  const tiny = zoomAt(HOME, 0.001, { x: 10, y: 10 })
  assert(tiny.zoom === MIN_ZOOM, 'zoomAt clamps below MIN_ZOOM')
}

// ---------------------------------------------------------------------------
console.log('5. the ladder makes progress and stops at both ends')
// ---------------------------------------------------------------------------
{
  // From any rung, stepping in moves strictly up and stepping out strictly down.
  for (const rung of ZOOM_STEPS) {
    if (rung < MAX_ZOOM) assert(stepZoom(rung, 1) > rung, `stepping in from ${rung} made no progress`)
    if (rung > MIN_ZOOM) assert(stepZoom(rung, -1) < rung, `stepping out from ${rung} made no progress`)
  }

  // Off-ladder values (where a wheel gesture leaves things) still move.
  for (const odd of [0.31, 0.99, 1.13, 2.34]) {
    assert(stepZoom(odd, 1) > odd, `stepping in from ${odd} made no progress`)
    assert(stepZoom(odd, -1) < odd, `stepping out from ${odd} made no progress`)
  }

  // The ends are dead, and say so.
  assert(stepZoom(MAX_ZOOM, 1) === MAX_ZOOM, 'cannot step past MAX_ZOOM')
  assert(stepZoom(MIN_ZOOM, -1) === MIN_ZOOM, 'cannot step past MIN_ZOOM')
  assert(canStepZoom(MAX_ZOOM, 1) === false, 'zoom-in must disable at MAX_ZOOM')
  assert(canStepZoom(MIN_ZOOM, -1) === false, 'zoom-out must disable at MIN_ZOOM')
  assert(canStepZoom(1, 1) === true, 'zoom-in is available at 100%')
  assert(canStepZoom(1, -1) === true, 'zoom-out is available at 100%')

  // Walking the whole ladder in both directions arrives at the ends and stays.
  let up = MIN_ZOOM
  for (let i = 0; i < ZOOM_STEPS.length + 5; i += 1) up = stepZoom(up, 1)
  assert(up === MAX_ZOOM, 'stepping in repeatedly must settle at MAX_ZOOM')
  let down = MAX_ZOOM
  for (let i = 0; i < ZOOM_STEPS.length + 5; i += 1) down = stepZoom(down, -1)
  assert(down === MIN_ZOOM, 'stepping out repeatedly must settle at MIN_ZOOM')

  assert(ZOOM_STEPS[0] === MIN_ZOOM, 'the ladder must start at MIN_ZOOM')
  assert(ZOOM_STEPS[ZOOM_STEPS.length - 1] === MAX_ZOOM, 'the ladder must end at MAX_ZOOM')
  assert(ZOOM_STEPS.includes(1), 'the ladder must include 100%')
}

// ---------------------------------------------------------------------------
console.log('6. the readout is a whole percentage')
// ---------------------------------------------------------------------------
{
  assert(zoomLabel(1) === '100%', '1 reads as 100%')
  assert(zoomLabel(0.25) === '25%', '0.25 reads as 25%')
  assert(zoomLabel(0.67) === '67%', '0.67 reads as 67%')
  assert(zoomLabel(1.0000001) === '100%', 'float noise does not reach the readout')
  assert(zoomLabel(3) === '300%', '3 reads as 300%')
}

if (failures > 0) {
  console.error(`\ncamera: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll camera checks passed.')
