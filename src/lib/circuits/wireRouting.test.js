/**
 * Connector routing tests (T-093).
 * Run with: npm run test:circuits
 *
 * The claims worth testing are geometric, not cosmetic:
 *
 *  - every segment of a route is axis-aligned, because a diagonal is what the
 *    old renderer produced and what the owner asked to be rid of;
 *  - the route starts and ends exactly on its pins, because a hairline gap at a
 *    pin reads as "not connected";
 *  - a backward route stays clear of the box between its endpoints, which is
 *    the case a mid-x elbow gets wrong;
 *  - a corner is never rounded by more than the segments either side can spare.
 */

import { elbowPoints, roundedPath, routeWire, dedupe, STUB, CORNER, LANE } from './wireRouting.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

const out = (x, y) => ({ x, y, side: 'out' })
const into = (x, y) => ({ x, y, side: 'in' })

// ---------------------------------------------------------------------------
console.log('1. every segment is axis-aligned')
// ---------------------------------------------------------------------------
{
  const cases = [
    [out(0, 0), into(200, 0)],
    [out(0, 0), into(200, 140)],
    [out(0, 140), into(200, 0)],
    [out(300, 0), into(60, 120)],   // backward
    [out(300, 100), into(60, 100)], // backward, aligned
    [out(0, 0), into(20, 4)],       // barely any room
  ]

  for (const [from, to] of cases) {
    const points = elbowPoints(from, to)
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i]
      const b = points[i + 1]
      const axial = Math.abs(a.x - b.x) < 0.001 || Math.abs(a.y - b.y) < 0.001
      assert(axial, `segment ${i} of ${from.x},${from.y} -> ${to.x},${to.y} is diagonal`)
    }
  }
}

// ---------------------------------------------------------------------------
console.log('2. routes start and end exactly on their pins')
// ---------------------------------------------------------------------------
{
  for (const [from, to] of [[out(0, 0), into(200, 60)], [out(400, 20), into(80, 300)]]) {
    const points = elbowPoints(from, to)
    const first = points[0]
    const last = points[points.length - 1]
    assert(first.x === from.x && first.y === from.y, 'route does not start on its source pin')
    assert(last.x === to.x && last.y === to.y, 'route does not end on its target pin')
  }
}

// ---------------------------------------------------------------------------
console.log('3. aligned pins with room get one straight segment')
// ---------------------------------------------------------------------------
{
  const points = elbowPoints(out(0, 60), into(240, 60))
  assert(points.length === 2, `expected 2 points for an aligned run, got ${points.length}`)
}

// ---------------------------------------------------------------------------
console.log('4. stubs leave and arrive along the pin facing')
// ---------------------------------------------------------------------------
{
  // A backward route turns inside its stubs, so they survive as points.
  const around = elbowPoints(out(400, 40), into(100, 90))
  assert(around[1].x === 400 + STUB && around[1].y === 40, 'no stub out of the source')
  const arrival = around[around.length - 2]
  assert(arrival.x === 100 - STUB && arrival.y === 90, 'no stub into the target')

  // A forward route's stubs are collinear with the run that follows, so dedupe
  // folds them in. What has to hold is that the route leaves along the source's
  // y and arrives along the target's.
  const across = elbowPoints(out(0, 0), into(300, 120))
  assert(across[1].y === 0, 'a forward route should turn on the source line')
  assert(across[across.length - 2].y === 120, 'a forward route should arrive on the target line')
  assert(across[1].x > STUB && across[1].x < 300 - STUB, 'the crossing should be between the pins')
}

// ---------------------------------------------------------------------------
console.log('5. a backward route detours below both endpoints')
// ---------------------------------------------------------------------------
{
  const from = out(400, 40)
  const to = into(100, 90)
  const points = elbowPoints(from, to)

  const lowest = Math.max(...points.map(p => p.y))
  assert(lowest === 90 + LANE, `lane should sit ${LANE} below the lower pin, got ${lowest}`)

  // Nothing in the middle of the route may pass back through the band the two
  // components occupy: that is the whole difference from a mid-x elbow.
  const band = points.slice(1, -1).filter(p => p.y < Math.max(from.y, to.y) + 1)
  const crossing = band.filter(p => p.x < from.x + STUB - 0.5 && p.x > to.x - STUB + 0.5)
  assert(crossing.length === 0, 'a backward route cuts back through the components')
}

// ---------------------------------------------------------------------------
console.log('6. a free end (mid-drag) gets no stub')
// ---------------------------------------------------------------------------
{
  const points = elbowPoints(out(0, 0), { x: 250, y: 90 })
  const last = points[points.length - 1]
  const beforeLast = points[points.length - 2]
  assert(last.x === 250 && last.y === 90, 'the connector does not reach the pointer')
  assert(beforeLast.y === 90, 'the connector should arrive horizontally at the pointer')
}

// ---------------------------------------------------------------------------
console.log('7. dedupe drops repeats and collinear middles')
// ---------------------------------------------------------------------------
{
  const same = dedupe([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }])
  assert(same.length === 2, `repeat not dropped: ${JSON.stringify(same)}`)

  const straight = dedupe([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }])
  assert(straight.length === 2, `collinear middle kept: ${JSON.stringify(straight)}`)

  assert(dedupe([]).length === 0, 'dedupe([]) should be empty')
  assert(dedupe([{ x: 1, y: 1 }]).length === 1, 'dedupe of one point should keep it')
}

// ---------------------------------------------------------------------------
console.log('8. path data is well formed and hits both pins')
// ---------------------------------------------------------------------------
{
  const d = routeWire(out(0, 0), into(300, 120))
  assert(d.startsWith('M0,0'), `path should start at the source pin: ${d}`)
  assert(d.endsWith('L300,120'), `path should end at the target pin: ${d}`)
  assert(!/NaN|undefined|Infinity/.test(d), `path contains a non-number: ${d}`)

  // Only the commands the renderer is allowed to produce.
  const commands = d.match(/[A-Za-z]/g) ?? []
  assert(commands.every(c => 'MLQ'.includes(c)), `unexpected command in ${d}`)

  assert(roundedPath([]) === '', 'no points should give no path')
  assert(roundedPath([{ x: 1, y: 2 }]) === '', 'one point should give no path')
}

// ---------------------------------------------------------------------------
console.log('9. no corner is rounded past what its segments can spare')
// ---------------------------------------------------------------------------
{
  // A 4px vertical jog: the corner radius has to collapse to 2, not 10, or the
  // arc overshoots the next corner and the wire ties a knot in itself.
  const points = elbowPoints(out(0, 0), into(60, 4))
  const d = roundedPath(points, CORNER)
  const numbers = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]))
  assert(numbers.every(Number.isFinite), 'path has an unparseable number')

  // Every y in the path stays inside the span the route occupies.
  const ys = numbers.filter((_, i) => i % 2 === 1)
  assert(Math.min(...ys) >= -0.01 && Math.max(...ys) <= 4.01,
    `a rounded corner escaped the route's span: ${d}`)
}

// ---------------------------------------------------------------------------
console.log('10. routing is deterministic')
// ---------------------------------------------------------------------------
{
  const a = routeWire(out(13, 27), into(211, 93))
  const b = routeWire(out(13, 27), into(211, 93))
  assert(a === b, 'the same pins gave two different paths')
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nwireRouting: all checks passed')
