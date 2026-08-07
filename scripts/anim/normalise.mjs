// Normalisation to 3NF, following the procedure the lecture teaches:
// identify the key, remove partial dependencies to reach 2NF, then remove
// transitive dependencies to reach 3NF.
//
// This is the textbook peel-off procedure rather than Bernstein synthesis. The
// two can disagree on the final set of relations, and the peel-off one is what
// the module's worked example uses and what a marker expects.
//
// Every answer in the notes is computed here rather than typed, so a question's
// table, its dependencies and its decomposition cannot drift apart.

const eq = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
const subset = (a, b) => a.every((x) => b.includes(x))
const properSubset = (a, b) => subset(a, b) && a.length < b.length
const uniq = (a) => [...new Set(a)]

/** Standard attribute closure: everything `start` determines, directly or not. */
export function closure(start, fds) {
  const out = new Set(start)
  let grew = true
  while (grew) {
    grew = false
    for (const f of fds) {
      if (f.l.every((a) => out.has(a)) && f.r.some((a) => !out.has(a))) {
        for (const a of f.r) out.add(a)
        grew = true
      }
    }
  }
  return [...out]
}

const isSuperkey = (attrs, of, fds) => subset(of, closure(attrs, fds))

/**
 * Takes one relation to 3NF by repeatedly peeling off any dependency whose
 * determinant is not a superkey. Returns the reduced relation plus whatever
 * was split out of it.
 */
function toThirdNormalForm(rel, fds, nameFor) {
  let attrs = [...rel.attrs]
  const key = rel.key
  const split = []

  let changed = true
  while (changed) {
    changed = false
    for (const f of fds) {
      if (!f.l.every((a) => attrs.includes(a))) continue
      const rhs = f.r.filter((a) => attrs.includes(a) && !key.includes(a) && !f.l.includes(a))
      if (!rhs.length) continue
      // A dependency is fine if its determinant identifies the whole relation.
      if (isSuperkey(f.l, attrs, fds)) continue
      split.push({ name: nameFor(), attrs: uniq([...f.l, ...rhs]), key: [...f.l], from: f })
      attrs = attrs.filter((a) => !rhs.includes(a))
      changed = true
      break
    }
  }

  return { reduced: { ...rel, attrs }, split }
}

/**
 * @param {object} spec
 * @param {string}   spec.name    relation name, e.g. 'ORDER'
 * @param {string[]} spec.attrs   every attribute, in display order
 * @param {string[]} spec.key     the primary key
 * @param {{l: string[], r: string[]}[]} spec.fds  functional dependencies
 * @param {Array<Array<string|number>>} spec.rows  sample data, in `attrs` order
 */
export function normalise({ name, attrs, key, fds, rows }) {
  let counter = 1
  const nextName = () => `${name}${++counter}`

  // ── 2NF. A determinant that is only PART of the key takes with it everything
  // it determines, transitively included: leaving a transitively dependent
  // attribute behind would strand it in a relation that no longer holds its
  // determinant, which is not a decomposition at all.
  const partial = fds.filter((f) => properSubset(f.l, key) && f.r.some((a) => !key.includes(a)))

  let main = [...attrs]
  const after2 = []
  for (const f of partial) {
    const carried = closure(f.l, fds).filter((a) => !key.includes(a) && main.includes(a))
    if (!carried.length) continue
    after2.push({ name: nextName(), attrs: uniq([...f.l, ...carried]), key: [...f.l] })
    main = main.filter((a) => !carried.includes(a))
  }

  const mainRel = { name: `${name}1`, attrs: main, key: [...key] }
  const after2nf = [mainRel, ...after2]

  // ── 3NF, applied to every relation 2NF produced, not just the first. A
  // transitive dependency very often ends up inside one of the split relations
  // rather than in what is left of the original.
  const relations = []
  const transitive = []
  for (const rel of after2nf) {
    const { reduced, split } = toThirdNormalForm(rel, fds, nextName)
    relations.push(reduced)
    for (const s of split) {
      relations.push({ name: s.name, attrs: s.attrs, key: s.key })
      transitive.push({ ...s.from, inRelation: rel.name })
    }
  }

  return {
    name,
    attrs,
    key,
    fds,
    rows,
    partial,
    transitive,
    after2nf,
    relations,
  }
}

/** Rows of a relation, projected onto its attributes with duplicates removed. */
export function project(allAttrs, rows, want) {
  const idx = want.map((a) => allAttrs.indexOf(a))
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const r = idx.map((i) => row[i])
    const k = JSON.stringify(r)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

/**
 * Checks that would otherwise have to be done by eye:
 *   every attribute survives, every determinant survives ALONGSIDE what it
 *   determines, and no relation is left holding a dependency whose determinant
 *   is not a superkey of it (which is the definition of 3NF).
 */
export function check(spec) {
  const n = normalise(spec)

  const kept = new Set(n.relations.flatMap((r) => r.attrs))
  for (const a of spec.attrs) {
    if (!kept.has(a)) throw new Error(`${spec.name}: attribute ${a} was lost`)
  }

  // Every dependency must still be enforceable: some relation has to hold the
  // determinant and its right-hand side together, or the decomposition has
  // thrown the constraint away.
  for (const f of spec.fds) {
    const holds = n.relations.some(
      (r) => f.l.every((a) => r.attrs.includes(a)) && f.r.every((a) => r.attrs.includes(a))
    )
    if (!holds) {
      throw new Error(
        `${spec.name}: no relation can enforce ${f.l.join(',')} -> ${f.r.join(',')}; ` +
          `the decomposition is ${n.relations.map((r) => `${r.name}(${r.attrs.join(',')})`).join(' ')}`
      )
    }
  }

  for (const rel of n.relations) {
    for (const f of spec.fds) {
      if (!f.l.every((a) => rel.attrs.includes(a))) continue
      const rhs = f.r.filter((a) => rel.attrs.includes(a) && !f.l.includes(a))
      if (!rhs.length) continue
      const nonPrime = rhs.filter((a) => !rel.key.includes(a))
      if (!nonPrime.length) continue
      if (subset(rel.attrs, closure(f.l, spec.fds))) continue
      throw new Error(
        `${spec.name}: ${rel.name}(${rel.attrs.join(', ')}) is not in 3NF, ` +
          `${f.l.join(',')} -> ${nonPrime.join(',')} survives`
      )
    }
  }

  if (n.partial.length === 0 && n.transitive.length === 0) {
    throw new Error(`${spec.name}: nothing to normalise, the question teaches nothing`)
  }
  return n
}
