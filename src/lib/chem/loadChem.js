// Lazy-loads OpenChemLib, mirroring `loadKatex()`'s cached-promise shape in
// MarkdownRenderer.jsx (T-091/ADR 0002).
//
// Unlike mhchem (34 KB, a static import even in the admin editor),
// OpenChemLib gzips to ~343 KB — meaningfully heavier — so this must be
// called lazily from INSIDE the component that actually renders a structure
// (MoleculeStructure / ReactionScheme), never as a module-level static
// import anywhere, including the admin editor's node views.
let oclModule = null
let oclPromise = null

export function loadOCL() {
  if (oclModule) return Promise.resolve(oclModule)
  if (!oclPromise) {
    oclPromise = import('openchemlib')
      .then((mod) => {
        oclModule = mod.default ?? mod
        return oclModule
      })
      .catch((err) => {
        // Never cache a rejection: one flaky chunk fetch would otherwise
        // permanently disable structure rendering for the rest of the
        // session, matching the same guard on loadKatex/loadMonaco.
        oclPromise = null
        throw err
      })
  }
  return oclPromise
}
