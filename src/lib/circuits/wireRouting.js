/**
 * Connector routing (T-096).
 *
 * FigJam's "smart connector" behaviour, as pure geometry: leave the source pin
 * heading the way it faces, run orthogonally, arrive at the target pin heading
 * the way *it* faces, and round every corner. The sandbox draws committed wires
 * and the connector in flight through the same two functions, so a gesture
 * previews the route it is going to produce rather than a straight dashed line
 * that snaps into an elbow on release (T-095 shipped exactly that mismatch).
 *
 * Nothing here knows about React, SVG elements or the document model. It takes
 * two points with a facing and gives back a polyline, then that polyline as path
 * data. Both halves are separately testable, which matters because "does this
 * path go around the gate or through it" is a question about the polyline.
 */

/** How far a connector runs straight out of a pin before it may turn. */
export const STUB = 14

/** Corner radius, capped per corner by the segments either side of it. */
export const CORNER = 10

/** How far below both endpoints a backward (feedback) route detours. */
export const LANE = 44

/**
 * @typedef {Object} RoutePoint
 * @property {number} x
 * @property {number} y
 * @property {'in'|'out'} [side] - which kind of pin this is. An output faces
 *   right, an input is approached from the left. Omitted for a free end (the
 *   pointer, mid-drag), which is approached from wherever the route arrives.
 */

/**
 * The polyline for one connector.
 *
 * Three cases, and the third is the one a naive router gets wrong:
 *
 *  1. **Aligned and ahead** — one straight segment.
 *  2. **Ahead** — out, across to a mid-x, over, in. The classic elbow.
 *  3. **Behind** (the target is to the *left* of the source: a feedback wire,
 *     a flip-flop's Q back to its own D) — out, down to a clear lane below both
 *     endpoints, back, up, in. Routing case 2's mid-x here puts the vertical
 *     run straight through whatever sits between the two components, which for
 *     a feedback loop is always the gates the loop is made of.
 *
 * @param {RoutePoint} from
 * @param {RoutePoint} to
 * @param {{stub?: number, lane?: number}} [options]
 * @returns {{x: number, y: number}[]}
 */
export function elbowPoints(from, to, options = {}) {
  const stub = options.stub ?? STUB
  const lane = options.lane ?? LANE

  // Signed by which way the pin faces: an output leaves to the right, an input
  // is approached from the left. A free end has no facing and so gets no stub —
  // the connector should end under the pointer, not 14px short of it.
  const startStub = from.side === 'in' ? -stub : stub
  const endStub = to.side === undefined ? 0 : to.side === 'out' ? stub : -stub

  const a = { x: from.x, y: from.y }
  const b = { x: to.x, y: to.y }
  const a1 = { x: a.x + startStub, y: a.y }
  const b1 = { x: b.x + endStub, y: b.y }

  const aligned = Math.abs(a.y - b.y) < 0.5

  if (aligned && b1.x >= a1.x - 0.5) return dedupe([a, b])

  if (b1.x >= a1.x + 1) {
    const midX = Math.round((a1.x + b1.x) / 2)
    return dedupe([a, a1, { x: midX, y: a.y }, { x: midX, y: b.y }, b1, b])
  }

  const laneY = Math.max(a.y, b.y) + lane
  return dedupe([a, a1, { x: a1.x, y: laneY }, { x: b1.x, y: laneY }, b1, b])
}

/**
 * A polyline as SVG path data, with rounded corners.
 *
 * Each corner is rounded by at most half the shorter of its two segments, so a
 * short jog never produces an arc that overshoots the next corner and doubles
 * back — which looks like a knot in the wire, not a bend.
 *
 * @param {{x: number, y: number}[]} points
 * @param {number} [radius]
 * @returns {string} path data, '' for fewer than two points
 */
export function roundedPath(points, radius = CORNER) {
  const p = dedupe(points)
  if (p.length < 2) return ''
  if (p.length === 2) return `M${n(p[0].x)},${n(p[0].y)} L${n(p[1].x)},${n(p[1].y)}`

  let d = `M${n(p[0].x)},${n(p[0].y)}`

  for (let i = 1; i < p.length - 1; i += 1) {
    const previous = p[i - 1]
    const corner = p[i]
    const next = p[i + 1]
    const r = Math.min(radius, distance(previous, corner) / 2, distance(corner, next) / 2)

    const enter = towards(corner, previous, r)
    const leave = towards(corner, next, r)

    d += ` L${n(enter.x)},${n(enter.y)}`
    if (r > 0.05) d += ` Q${n(corner.x)},${n(corner.y)} ${n(leave.x)},${n(leave.y)}`
  }

  const end = p[p.length - 1]
  return `${d} L${n(end.x)},${n(end.y)}`
}

/**
 * The whole job: two pins in, path data out.
 *
 * @param {RoutePoint} from
 * @param {RoutePoint} to
 * @param {{stub?: number, lane?: number, radius?: number}} [options]
 * @returns {string}
 */
export function routeWire(from, to, options = {}) {
  return roundedPath(elbowPoints(from, to, options), options.radius ?? CORNER)
}

/**
 * Drops repeated points and collapses runs of three collinear ones.
 *
 * Both matter for the corner maths, not for looks: a zero-length segment makes
 * the radius cap zero and swallows the corner, and a collinear triple produces
 * a "corner" with no turn in it, which rounds into a visible dent.
 */
export function dedupe(points) {
  const out = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) continue
    out.push({ x: point.x, y: point.y })
  }

  if (out.length < 3) return out

  const kept = [out[0]]
  for (let i = 1; i < out.length - 1; i += 1) {
    const previous = kept[kept.length - 1]
    const current = out[i]
    const next = out[i + 1]
    const cross = (current.x - previous.x) * (next.y - previous.y)
      - (current.y - previous.y) * (next.x - previous.x)
    if (Math.abs(cross) < 0.5) continue
    kept.push(current)
  }
  kept.push(out[out.length - 1])
  return kept
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** `length` px from `origin` in the direction of `target`. */
function towards(origin, target, length) {
  const d = distance(origin, target)
  if (d === 0) return { x: origin.x, y: origin.y }
  return {
    x: origin.x + ((target.x - origin.x) / d) * length,
    y: origin.y + ((target.y - origin.y) / d) * length,
  }
}

/** Two decimal places, so path data stays readable and diffs cleanly. */
function n(value) {
  return Math.round(value * 100) / 100
}
