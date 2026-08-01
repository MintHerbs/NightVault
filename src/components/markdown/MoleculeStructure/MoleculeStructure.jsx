import { useEffect, useId, useState } from 'react'
import { loadOCL } from '../../../lib/chem/loadChem'
import { renderMoleculeSvg } from '../../../lib/chem/renderStructureSvg'
import { isValidSmiles } from '../../../lib/chem/noteChem'
import styles from './MoleculeStructure.module.css'

const START_WIDTH = 300
const START_HEIGHT = 200

/**
 * Renders a `::molecule{smiles="..." label="..."}` directive as an SVG
 * structure via OpenChemLib (T-091, ADR 0002). Used by both the note reader
 * (MarkdownRenderer) and the admin editor's node view, so an author sees
 * exactly what a visitor gets.
 *
 * OpenChemLib is ~343 KB gzipped, so it is fetched lazily on mount, never a
 * static import (see loadChem.js). A parse failure (bad SMILES charset, or a
 * syntactically-valid-but-chemically-nonsensical string OCL itself rejects)
 * degrades to a small visible inline error — this must never throw past the
 * component, matching how `@milkdown/plugin-math`'s `throwOnError: false`
 * already degrades a malformed formula elsewhere in this app.
 */
export default function MoleculeStructure({ smiles, label }) {
  const cleanSmiles = typeof smiles === 'string' ? smiles : ''
  const [state, setState] = useState({ status: 'loading' })
  // OCL's toSVG embeds `id` into a `<style>` block scoping its own font/
  // pointer-events rules (`#${id} text {...}`) plus per-bond/atom element
  // ids — a fixed literal here means every `::molecule` on the page (a note
  // commonly has more than one) renders a duplicate DOM id, which is invalid
  // HTML and would silently break any future id-scoped behaviour. useId()
  // gives each instance a real one; stripped of `:` since that "reserved
  // name" punctuation would need escaping in the unescaped CSS selector OCL
  // emits, and is otherwise inert here (harmless, not a correctness risk).
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    if (!isValidSmiles(cleanSmiles)) {
      setState({ status: 'error' })
      return undefined
    }

    let cancelled = false
    setState({ status: 'loading' })

    loadOCL().then(
      (OCL) => {
        if (cancelled) return
        try {
          const rendered = renderMoleculeSvg(OCL, cleanSmiles, {
            width: START_WIDTH,
            height: START_HEIGHT,
            id: `note-molecule-${instanceId}`,
          })
          setState({ status: 'ready', ...rendered })
        } catch {
          setState({ status: 'error' })
        }
      },
      () => { if (!cancelled) setState({ status: 'error' }) },
    )

    return () => { cancelled = true }
  }, [cleanSmiles, instanceId])

  const ariaLabel = (typeof label === 'string' && label.trim()) || cleanSmiles || 'Chemical structure'

  if (state.status === 'error') {
    return (
      <span className={styles.error} role="img" aria-label={ariaLabel} contentEditable={false}>
        {cleanSmiles || 'Invalid structure'}
      </span>
    )
  }

  if (state.status !== 'ready') {
    return <span className={styles.placeholder} aria-hidden="true" contentEditable={false} />
  }

  return (
    <span
      className={styles.wrapper}
      role="img"
      aria-label={ariaLabel}
      contentEditable={false}
      style={{ width: state.width, height: state.height }}
      // Safe: `state.svg` has already been through renderStructureSvg's
      // allowlist sanitisation pass (elements + attributes), never the raw,
      // unvalidated string OpenChemLib returned. See docs/adr/0002 and the
      // spec's "Rendering safety" section — no rehype-raw-equivalent path
      // for unvalidated markup exists anywhere else in this component.
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  )
}
