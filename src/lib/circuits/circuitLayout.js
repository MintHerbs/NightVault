/**
 * Netlist geometry (T-089).
 *
 * Layered left to right by gate depth, ordered within each layer to pull wires
 * straight, then routed orthogonally. Pure maths: no SVG, no React, no colours.
 * CircuitCanvas draws whatever comes out of here, and the sandbox will replace
 * it entirely once the student starts dragging things.
 */

import { componentLevels, portOwners } from './circuitSynthesis.js'

export const DEFAULTS = {
  gateWidth: 62,
  gateHeight: 44,
  pinWidth: 40,
  pinHeight: 30,
  notWidth: 44,
  notHeight: 34,
  layerGap: 74,
  rowGap: 26,
  padding: 28,
  // Wires leaving the same layer fan out across the gap so two of them running
  // to the same row do not sit on top of each other.
  laneGap: 9,
}

function sizeOf(component, options) {
  if (component.kind === 'input' || component.kind === 'output' || component.kind === 'const') {
    return { width: options.pinWidth, height: options.pinHeight }
  }
  if (component.kind === 'not') return { width: options.notWidth, height: options.notHeight }
  const pins = Math.max(2, component.inputs.length)
  return { width: options.gateWidth, height: Math.max(options.gateHeight, pins * 16 + 12) }
}

/**
 * @param {import('./circuitSynthesis.js').Netlist} netlist
 * @param {Partial<typeof DEFAULTS>} [overrides]
 */
export function layoutCircuit(netlist, overrides = {}) {
  const options = { ...DEFAULTS, ...overrides }
  const owners = portOwners(netlist)
  const levels = componentLevels(netlist)

  // Outputs are pushed to the far right even when their depth is lower, so the
  // diagram reads inputs-left / output-right regardless of how shallow the
  // logic turned out.
  const maxLevel = Math.max(0, ...netlist.components.map(c => levels.get(c.id) ?? 0))
  const layerOf = new Map()
  for (const component of netlist.components) {
    const level = component.kind === 'output' ? maxLevel : (levels.get(component.id) ?? 0)
    layerOf.set(component.id, level)
  }

  const layers = []
  for (const component of netlist.components) {
    const layer = layerOf.get(component.id)
    if (!layers[layer]) layers[layer] = []
    layers[layer].push(component)
  }
  for (let i = 0; i < layers.length; i += 1) if (!layers[i]) layers[i] = []

  const feeders = buildFeeders(netlist, owners)
  orderLayers(layers, feeders)

  // --- coordinates ---------------------------------------------------------

  const sizes = new Map(netlist.components.map(c => [c.id, sizeOf(c, options)]))

  const layerHeights = layers.map(layer => (
    layer.reduce((sum, c) => sum + sizes.get(c.id).height, 0) + Math.max(0, layer.length - 1) * options.rowGap
  ))
  const contentHeight = Math.max(options.pinHeight, ...layerHeights)

  const placed = new Map()
  let x = options.padding

  layers.forEach((layer, index) => {
    const layerWidth = Math.max(options.pinWidth, ...layer.map(c => sizes.get(c.id).width), 0)
    let y = options.padding + (contentHeight - layerHeights[index]) / 2

    for (const component of layer) {
      const size = sizes.get(component.id)
      placed.set(component.id, {
        ...component,
        layer: index,
        x: x + (layerWidth - size.width) / 2,
        y,
        width: size.width,
        height: size.height,
      })
      y += size.height + options.rowGap
    }

    x += layerWidth + options.layerGap
  })

  const totalWidth = x - options.layerGap + options.padding
  const totalHeight = contentHeight + options.padding * 2

  // --- ports ---------------------------------------------------------------

  const portPoints = new Map()
  for (const component of netlist.components) {
    const box = placed.get(component.id)
    component.inputs.forEach((port, i) => {
      const step = box.height / (component.inputs.length + 1)
      portPoints.set(port, { x: box.x, y: box.y + step * (i + 1), side: 'in' })
    })
    component.outputs.forEach((port) => {
      portPoints.set(port, { x: box.x + box.width, y: box.y + box.height / 2, side: 'out' })
    })
  }

  // --- wires ---------------------------------------------------------------

  // Lanes are assigned per source layer so wires crossing the same gap get
  // distinct vertical runs. Without this, two wires from the same layer to the
  // same row overlap exactly and read as one.
  const laneCounter = new Map()
  const wires = netlist.wires.map((wire) => {
    const from = portPoints.get(wire.from)
    const to = portPoints.get(wire.to)
    if (!from || !to) return { ...wire, points: [] }

    const sourceLayer = placed.get(owners.get(wire.from).id).layer
    const lane = laneCounter.get(sourceLayer) ?? 0
    laneCounter.set(sourceLayer, lane + 1)

    return { ...wire, points: routeOrthogonal(from, to, lane, options) }
  })

  return {
    components: [...placed.values()],
    wires,
    ports: portPoints,
    width: totalWidth,
    height: totalHeight,
  }
}

/**
 * Three-segment orthogonal route: out to a vertical lane, across, then in.
 * A straight wire stays a single segment so a level-to-level connection is not
 * drawn with a pointless dog-leg.
 */
function routeOrthogonal(from, to, lane, options) {
  // Exact equality, not a tolerance: collapsing a near-match to one horizontal
  // segment would leave the endpoint short of the pin it claims to reach, and a
  // half-pixel gap at a pin is exactly what reads as a broken connection.
  if (from.y === to.y) {
    return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }]
  }

  // The vertical run sits in the channel immediately left of the target, not at
  // the midpoint of the whole span. A wire that skips a layer (an uncomplemented
  // input reaching a gate past the inverter column) would otherwise drop its
  // vertical straight through the inverters, and since components are painted
  // over wires that reads as the wire ending at a gate it never touches.
  const base = to.x - options.layerGap / 2
  const offset = ((lane % 5) - 2) * options.laneGap
  const midX = Math.min(Math.max(from.x + 8, base + offset), to.x - 8)

  return [
    { x: from.x, y: from.y },
    { x: midX, y: from.y },
    { x: midX, y: to.y },
    { x: to.x, y: to.y },
  ]
}

function buildFeeders(netlist, owners) {
  const feeders = new Map(netlist.components.map(c => [c.id, []]))
  for (const wire of netlist.wires) {
    const from = owners.get(wire.from)
    const to = owners.get(wire.to)
    if (from && to) feeders.get(to.id).push(from.id)
  }
  return feeders
}

/**
 * Barycentre ordering: put each component near the average position of the
 * things feeding it, a few passes. Cheap, and enough for two-level logic where
 * the crossing count is small to begin with.
 */
function orderLayers(layers, feeders) {
  const positionOf = new Map()
  layers.forEach(layer => layer.forEach((c, i) => positionOf.set(c.id, i)))

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 1; index < layers.length; index += 1) {
      const layer = layers[index]
      const scored = layer.map((component, i) => {
        const sources = feeders.get(component.id) ?? []
        const known = sources.map(id => positionOf.get(id)).filter(v => v !== undefined)
        return { component, key: known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : i, i }
      })
      scored.sort((a, b) => a.key - b.key || a.i - b.i)
      layers[index] = scored.map(s => s.component)
      layers[index].forEach((c, i) => positionOf.set(c.id, i))
    }
  }
}

/**
 * SVG path data for one routed wire.
 * @param {{points: Array<{x: number, y: number}>}} wire
 */
export function wirePath(wire) {
  if (!wire.points || wire.points.length === 0) return ''
  return wire.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}
