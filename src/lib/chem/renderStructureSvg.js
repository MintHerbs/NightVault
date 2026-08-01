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

// OpenChemLib's literal CPK-ish atom-label colours (confirmed by direct
// inspection of toSVG() output across the fixture set — see ADR 0002) mapped
// to this app's own theme-aware, validated pastel tokens (global.css,
// [data-mode="dark"|"light"]). Order matters: longer/more-specific rgb()
// strings first is unnecessary here since every value is a distinct exact
// match, but ATOM_COLOR_MAP must run before OTHER_ATOM_FILL_RE, which mops up
// anything left (metals, B, Si, and any element not explicitly listed).
const ATOM_COLOR_MAP = [
  [/fill="rgb\(255,13,13\)"/g, 'fill="var(--chem-atom-o)"'], // O
  [/fill="rgb\(48,80,248\)"/g, 'fill="var(--chem-atom-n)"'], // N
  [/fill="rgb\(205,205,38\)"/g, 'fill="var(--chem-atom-s)"'], // S
  [/fill="rgb\(144,224,80\)"/g, 'fill="var(--chem-atom-halogen)"'], // F
  [/fill="rgb\(31,240,31\)"/g, 'fill="var(--chem-atom-halogen)"'], // Cl
  [/fill="rgb\(166,41,41\)"/g, 'fill="var(--chem-atom-br)"'], // Br
  [/fill="rgb\(148,0,148\)"/g, 'fill="var(--chem-atom-i)"'], // I
  [/fill="rgb\(255,128,0\)"/g, 'fill="var(--chem-atom-p)"'], // P
]
// Anything else OpenChemLib colours a text label with (B, Si, metals, any
// element not explicitly mapped above) falls back to one neutral token,
// applied after the specific substitutions above so it only catches what
// they didn't.
const OTHER_ATOM_FILL_RE = /fill="rgb\([^)]+\)"/g

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
  let fixed = raw.replace(BOND_STROKE_RE, 'stroke="currentColor"')
  for (const [re, replacement] of ATOM_COLOR_MAP) fixed = fixed.replace(re, replacement)
  fixed = fixed.replace(OTHER_ATOM_FILL_RE, 'fill="var(--chem-atom-other)"')

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
