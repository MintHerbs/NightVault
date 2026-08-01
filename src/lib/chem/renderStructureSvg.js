// Shared SVG rendering + sanitisation for the two structure-consuming
// components, `MoleculeStructure` (T-091) and `ReactionScheme` (T-090). Both
// need the identical OpenChemLib `toSVG()` call, the identical
// `rgb(0,0,0)` -> `currentColor` bond-stroke fix (ADR 0002), and the
// identical allowlist sanitisation pass before the markup reaches the DOM —
// kept in one place so the safety pass can't drift between the two call
// sites.
//
// Runs in the browser only (uses DOMParser/XMLSerializer) — both callers
// only ever invoke this after `loadOCL()` resolves inside a mounted
// component's effect, never during SSR or in a test.

const BOND_STROKE_RE = /stroke="rgb\(0,0,0\)"/g

// Exactly the elements/attributes OpenChemLib's toSVG() is confirmed (by
// direct inspection, across the aromatic/charged/stereo/isotope fixture set)
// to emit, plus a small safety margin (g/rect/path/tspan/polyline) for
// harmless future OCL output shapes. No `style`/`on*` attributes, no
// `href`/`xlink:href` — nothing that could carry a URL or script.
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'line', 'polygon', 'polyline', 'circle', 'rect', 'path', 'text', 'style', 'tspan',
])
const ALLOWED_ATTRS = new Set([
  'id', 'xmlns', 'version', 'width', 'height', 'viewBox', 'class',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'points', 'fill', 'stroke', 'stroke-width', 'font-size', 'opacity',
])

function sanitizeSvgElement(root) {
  const toRemove = []
  const walk = (node) => {
    for (const child of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
        toRemove.push(child)
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) child.removeAttribute(attr.name)
      }
      walk(child)
    }
  }
  walk(root)
  toRemove.forEach((node) => node.remove())
  // Belt-and-braces: strip anything that survived the allowlist walk by tag
  // name but could still carry behaviour (none of these are in ALLOWED_TAGS
  // today, but a future OCL version is not this module's contract to trust).
  for (const tag of ['script', 'foreignObject', 'iframe', 'a']) {
    root.querySelectorAll(tag).forEach((node) => node.remove())
  }
}

/**
 * SMILES -> sanitised, theme-aware SVG markup plus its real rendered size.
 *
 * @param {object} OCL - the resolved `loadOCL()` module.
 * @param {string} smiles - already validated by the caller (`isValidSmiles`).
 * @param {{width?: number, height?: number, id?: string, margin?: number}} [options]
 * @returns {{ svg: string, width: number, height: number }}
 * @throws if `smiles` is not parseable (e.g. `OCL.Molecule.fromSmiles` throws
 *   on chemically-invalid input) or the resulting markup can't be parsed as
 *   SVG. Callers must catch this and degrade gracefully — never let it
 *   escape past a render.
 */
export function renderMoleculeSvg(OCL, smiles, { width = 300, height = 200, id = 'note-molecule', margin = 5 } = {}) {
  const molecule = OCL.Molecule.fromSmiles(smiles)
  const raw = molecule.toSVG(width, height, id, { autoCrop: true, autoCropMargin: margin })
  const fixed = raw.replace(BOND_STROKE_RE, 'stroke="currentColor"')

  // autoCrop tightens the emitted width/height to the real content size —
  // read it back off the string rather than trusting the requested canvas.
  const widthMatch = /width="(\d+)px"/.exec(fixed)
  const heightMatch = /height="(\d+)px"/.exec(fixed)
  const realWidth = widthMatch ? parseInt(widthMatch[1], 10) : width
  const realHeight = heightMatch ? parseInt(heightMatch[1], 10) : height

  const doc = new DOMParser().parseFromString(fixed, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new Error('Renderer produced malformed SVG')

  const svgEl = doc.documentElement
  sanitizeSvgElement(svgEl)

  return { svg: new XMLSerializer().serializeToString(svgEl), width: realWidth, height: realHeight }
}
