#!/usr/bin/env node
// Ten exam-style normalisation questions for Semester 1 lecture 10.
//
//   node scripts/build-normalisation-questions.mjs
//
// Each question hands the student an unnormalised table and asks for 3NF. The
// answer frames are produced by scripts/anim/normalise.mjs, so the tables, the
// dependencies and the decomposition cannot disagree with each other.

import { writeFile } from 'node:fs/promises'
import { C, W, text, rect, table, moduleSource, fitHeights } from './anim/draw.mjs'
import { check, project } from './anim/normalise.mjs'

const KEYC = C.focus
const PARTIAL = C.mark
const TRANS = C.alt
const tint = (hex) => `color-mix(in srgb, ${hex} 22%, transparent)`

/** Width a column needs: the widest of its header and its values, in the mono
 *  face at 11.5px, where a character measures about 6.9px. */
const colWidth = (label, values) => {
  const longest = Math.max(String(label).length, ...values.map((v) => String(v ?? 'NULL').length))
  return Math.ceil(longest * 6.9) + 18
}

const QUESTIONS = [
  {
    name: 'ORDER',
    prompt: 'A shop records each line of each order in one table. Normalise it to 3NF.',
    attrs: ['orderNo', 'itemNo', 'qty', 'custName', 'itemName'],
    key: ['orderNo', 'itemNo'],
    fds: [
      { l: ['orderNo', 'itemNo'], r: ['qty'] },
      { l: ['orderNo'], r: ['custName'] },
      { l: ['itemNo'], r: ['itemName'] },
    ],
    rows: [
      ['O1', 'I1', 2, 'Adeyemi', 'Kettle'],
      ['O1', 'I2', 1, 'Adeyemi', 'Toaster'],
      ['O2', 'I1', 5, 'Blake', 'Kettle'],
      ['O3', 'I3', 1, 'Chen', 'Lamp'],
    ],
  },
  {
    name: 'ENROL',
    prompt: 'A college records enrolments like this. Normalise it to 3NF.',
    attrs: ['studentNo', 'courseNo', 'grade', 'sName', 'courseName', 'dept'],
    key: ['studentNo', 'courseNo'],
    fds: [
      { l: ['studentNo', 'courseNo'], r: ['grade'] },
      { l: ['studentNo'], r: ['sName'] },
      { l: ['courseNo'], r: ['courseName'] },
      { l: ['courseName'], r: ['dept'] },
    ],
    rows: [
      ['S1', 'C1', 'A', 'Osei', 'Databases', 'CS'],
      ['S1', 'C2', 'B', 'Osei', 'Calculus', 'Maths'],
      ['S2', 'C1', 'A', 'Rahman', 'Databases', 'CS'],
      ['S3', 'C3', 'C', 'Silva', 'Optics', 'Physics'],
    ],
  },
  {
    name: 'SALE',
    prompt: 'Every sale line of a supermarket is kept in one relation. Normalise it to 3NF.',
    attrs: ['receiptNo', 'productNo', 'qty', 'tillNo', 'productName', 'price'],
    key: ['receiptNo', 'productNo'],
    fds: [
      { l: ['receiptNo', 'productNo'], r: ['qty'] },
      { l: ['receiptNo'], r: ['tillNo'] },
      { l: ['productNo'], r: ['productName', 'price'] },
    ],
    rows: [
      ['R1', 'P1', 3, 'T2', 'Bread', 1.2],
      ['R1', 'P2', 1, 'T2', 'Milk', 0.95],
      ['R2', 'P1', 2, 'T5', 'Bread', 1.2],
      ['R3', 'P3', 4, 'T1', 'Eggs', 2.4],
    ],
  },
  {
    name: 'FLIGHT',
    prompt: 'A booking system stores one row per passenger per flight. Normalise it to 3NF.',
    attrs: ['flightNo', 'passNo', 'seat', 'aircraft', 'capacity'],
    key: ['flightNo', 'passNo'],
    fds: [
      { l: ['flightNo', 'passNo'], r: ['seat'] },
      { l: ['flightNo'], r: ['aircraft'] },
      { l: ['aircraft'], r: ['capacity'] },
    ],
    rows: [
      ['BA1', 'P1', '12A', 'A320', 180],
      ['BA1', 'P2', '12B', 'A320', 180],
      ['BA2', 'P1', '03C', 'B777', 396],
      ['BA3', 'P4', '21F', 'A320', 180],
    ],
  },
  {
    name: 'REPAIR',
    prompt: 'A garage logs every repair job like this. Normalise it to 3NF.',
    attrs: ['jobNo', 'partNo', 'qty', 'regNo', 'partName', 'supplier'],
    key: ['jobNo', 'partNo'],
    fds: [
      { l: ['jobNo', 'partNo'], r: ['qty'] },
      { l: ['jobNo'], r: ['regNo'] },
      { l: ['partNo'], r: ['partName'] },
      { l: ['partName'], r: ['supplier'] },
    ],
    rows: [
      ['J1', 'X1', 4, 'AB12CDE', 'Brake pad', 'Delphi'],
      ['J1', 'X2', 1, 'AB12CDE', 'Oil filter', 'Bosch'],
      ['J2', 'X1', 2, 'FG34HIJ', 'Brake pad', 'Delphi'],
      ['J3', 'X3', 6, 'KL56MNO', 'Spark plug', 'NGK'],
    ],
  },
  {
    name: 'LOAN',
    prompt: 'A library keeps one row per loan. Normalise it to 3NF.',
    attrs: ['memberNo', 'bookNo', 'dueDate', 'memberName', 'title', 'author'],
    key: ['memberNo', 'bookNo'],
    fds: [
      { l: ['memberNo', 'bookNo'], r: ['dueDate'] },
      { l: ['memberNo'], r: ['memberName'] },
      { l: ['bookNo'], r: ['title'] },
      { l: ['title'], r: ['author'] },
    ],
    rows: [
      ['M1', 'B1', '10 Mar', 'Iqbal', 'Dune', 'Herbert'],
      ['M1', 'B2', '11 Mar', 'Iqbal', 'Emma', 'Austen'],
      ['M2', 'B1', '18 Mar', 'Jonsson', 'Dune', 'Herbert'],
      ['M3', 'B3', '02 Apr', 'Kaur', 'Ulysses', 'Joyce'],
    ],
  },
  {
    name: 'SHIFT',
    prompt: 'A hospital rota is kept in one table. Normalise it to 3NF.',
    attrs: ['staffNo', 'shiftDate', 'hours', 'staffName', 'wardNo', 'wardName'],
    key: ['staffNo', 'shiftDate'],
    fds: [
      { l: ['staffNo', 'shiftDate'], r: ['hours'] },
      { l: ['staffNo'], r: ['staffName', 'wardNo'] },
      { l: ['wardNo'], r: ['wardName'] },
    ],
    rows: [
      ['N1', '01 Jun', 8, 'Abebe', 'W3', 'Cardiac'],
      ['N1', '02 Jun', 12, 'Abebe', 'W3', 'Cardiac'],
      ['N2', '01 Jun', 8, 'Bianchi', 'W1', 'Renal'],
      ['N3', '03 Jun', 6, 'Costa', 'W3', 'Cardiac'],
    ],
  },
  {
    name: 'MATCH',
    prompt: 'A league records one row per player per match. Normalise it to 3NF.',
    attrs: ['matchNo', 'playerNo', 'goals', 'venue', 'playerName', 'club'],
    key: ['matchNo', 'playerNo'],
    fds: [
      { l: ['matchNo', 'playerNo'], r: ['goals'] },
      { l: ['matchNo'], r: ['venue'] },
      { l: ['playerNo'], r: ['playerName', 'club'] },
    ],
    rows: [
      ['M1', 'P1', 2, 'Anfield', 'Traore', 'Reds'],
      ['M1', 'P2', 0, 'Anfield', 'Novak', 'Blues'],
      ['M2', 'P1', 1, 'Emirates', 'Traore', 'Reds'],
      ['M3', 'P3', 3, 'Etihad', 'Ozturk', 'Whites'],
    ],
  },
  {
    name: 'STOCK',
    prompt: 'A warehouse records stock levels per depot. Normalise it to 3NF.',
    attrs: ['depotNo', 'itemNo', 'level', 'depotCity', 'manager'],
    key: ['depotNo', 'itemNo'],
    fds: [
      { l: ['depotNo', 'itemNo'], r: ['level'] },
      { l: ['depotNo'], r: ['depotCity'] },
      { l: ['depotCity'], r: ['manager'] },
    ],
    rows: [
      ['D1', 'I1', 40, 'Leeds', 'Ahmed'],
      ['D1', 'I2', 12, 'Leeds', 'Ahmed'],
      ['D2', 'I1', 90, 'Cardiff', 'Bryn'],
      ['D3', 'I5', 7, 'Leeds', 'Ahmed'],
    ],
  },
  {
    name: 'BOOKING',
    prompt: 'A hotel keeps one row per guest per night. Normalise it to 3NF.',
    attrs: ['guestNo', 'roomNo', 'nights', 'guestName', 'roomType', 'rate'],
    key: ['guestNo', 'roomNo'],
    fds: [
      { l: ['guestNo', 'roomNo'], r: ['nights'] },
      { l: ['guestNo'], r: ['guestName'] },
      { l: ['roomNo'], r: ['roomType'] },
      { l: ['roomType'], r: ['rate'] },
    ],
    rows: [
      ['G1', 'R1', 2, 'Dlamini', 'Double', 90],
      ['G1', 'R2', 1, 'Dlamini', 'Single', 60],
      ['G2', 'R1', 3, 'Eriksen', 'Double', 90],
      ['G3', 'R4', 1, 'Farah', 'Suite', 150],
    ],
  },
]

const entries = []
const heading = (s, colour = C.text) =>
  text(W / 2, 22, s, { size: 13, weight: 700, anchor: 'middle', fill: colour })
const sub = (s, y = 40) => text(W / 2, y, s, { size: 11, anchor: 'middle', fill: C.muted })

/** Draws one relation as a table, tinting whichever attributes are called out. */
function relationTable(x, y, attrs, rows, { title, titleColour, tintMap = {}, keyAttrs = [] } = {}) {
  const cols = attrs.map((a, i) => ({
    label: a,
    w: colWidth(a, rows.map((r) => r[i])),
    colour: tintMap[a] ?? (keyAttrs.includes(a) ? KEYC : C.muted),
  }))
  const body = rows.map((r) =>
    r.map((v, i) => {
      const a = attrs[i]
      const hue = tintMap[a] ?? (keyAttrs.includes(a) ? KEYC : null)
      return hue ? { v, fill: tint(hue), colour: hue, weight: 700 } : v
    })
  )
  return table(x, y, cols, body, { title, titleColour })
}

const totalWidth = (attrs, rows) =>
  attrs.reduce((a, at, i) => a + colWidth(at, rows.map((r) => r[i])), 0)

for (const q of QUESTIONS) {
  const n = check(q)
  const frames = []

  const fullW = totalWidth(q.attrs, q.rows)
  const x0 = Math.max(16, (W - fullW) / 2)

  // 1. the table as given, with the key marked
  frames.push({
    caption: `The key is ${q.key.join(' + ')}. Neither part identifies a row on its own, which is what makes a partial dependency possible.`,
    hold: 4600,
    svg:
      heading('Step 1: find the key', KEYC) +
      sub('everything else must depend on the whole of it') +
      relationTable(x0, 66, q.attrs, q.rows, { title: `${q.name} in 1NF`, keyAttrs: q.key }).svg,
  })

  // 2. partial dependencies
  const partialMap = {}
  for (const f of n.partial) {
    for (const a of f.l) partialMap[a] = KEYC
    for (const a of f.r) partialMap[a] = PARTIAL
  }
  if (n.partial.length) {
    const t = relationTable(x0, 78, q.attrs, q.rows, { keyAttrs: q.key, tintMap: partialMap })
    frames.push({
      caption: `${n.partial.map((f) => `${f.l.join(', ')} → ${f.r.join(', ')}`).join('   and   ')}. Each of these depends on part of the key only.`,
      hold: 5200,
      svg:
        heading('Step 2: partial dependencies', PARTIAL) +
        sub('determined by part of the key, not all of it') +
        t.svg +
        n.partial
          .map((f, i) =>
            text(x0, 78 + t.height + 22 + i * 17, `${f.l.join(', ')} → ${f.r.join(', ')}`, {
              size: 11.5, mono: true, fill: PARTIAL, weight: 700,
            })
          )
          .join(''),
    })
  }

  // 3. after 2NF
  {
    let x = 16
    const parts = n.after2nf.map((rel) => {
      const rows = project(q.attrs, q.rows, rel.attrs)
      const t = relationTable(x, 78, rel.attrs, rows, {
        title: rel.name,
        titleColour: C.ok,
        keyAttrs: rel.key,
      })
      x += t.width + 24
      return t
    })
    frames.push({
      caption: `2NF. ${n.partial.length === 1 ? 'The partial dependency has' : 'The partial dependencies have'} been peeled off with ${n.partial.length === 1 ? 'its determinant' : 'their determinants'}, each into its own relation.`,
      hold: 5200,
      svg: heading('Step 3: second normal form', C.ok) + sub('every non-key attribute now needs the whole key') + parts.map((p) => p.svg).join(''),
    })
  }

  // 4. transitive dependencies
  if (n.transitive.length) {
    // A transitive dependency usually turns up inside one of the relations 2NF
    // split off rather than in what is left of the original, so draw the one
    // that actually holds it rather than assuming it is the first.
    const hostNames = [...new Set(n.transitive.map((f) => f.inRelation))]
    let x = 16
    const tables = []
    const arrows = []
    for (const hostName of hostNames) {
      const rel = n.after2nf.find((r) => r.name === hostName)
      const here = n.transitive.filter((f) => f.inRelation === hostName)
      const transMap = {}
      for (const f of here) {
        for (const a of f.l) transMap[a] = TRANS
        for (const a of f.r) transMap[a] = TRANS
      }
      const rows = project(q.attrs, q.rows, rel.attrs)
      const t = relationTable(x, 78, rel.attrs, rows, {
        title: rel.name,
        keyAttrs: rel.key,
        tintMap: transMap,
      })
      tables.push(t)
      for (const f of here) {
        arrows.push({ text: `${rel.key.join(' + ')} → ${f.l.join(', ')} → ${f.r.join(', ')}`, x })
      }
      x += t.width + 26
    }
    const bottom = 78 + Math.max(...tables.map((t) => t.height))
    frames.push({
      caption: `${n.transitive.map((f) => `${f.l.join(', ')} → ${f.r.join(', ')}`).join('   and   ')}. A non-key attribute determined by another non-key attribute, not by the key.`,
      hold: 5200,
      svg:
        heading('Step 4: transitive dependencies', TRANS) +
        sub('the key determines one, and that one determines the next') +
        tables.map((t) => t.svg).join('') +
        arrows
          .map((a, i) =>
            text(16, bottom + 24 + i * 17, a.text, { size: 11.5, mono: true, fill: TRANS, weight: 700 })
          )
          .join(''),
    })
  }

  // 5. final 3NF
  {
    let x = 16
    let y = 78
    let rowMax = 0
    const parts = []
    for (const rel of n.relations) {
      const rows = project(q.attrs, q.rows, rel.attrs)
      const t = relationTable(x, y, rel.attrs, rows, {
        title: rel.name,
        titleColour: C.ok,
        keyAttrs: rel.key,
      })
      // Wrap to a second band rather than running off the right-hand edge.
      if (x + t.width > W - 16 && x > 16) {
        x = 16
        y += rowMax + 46
        rowMax = 0
        const again = relationTable(x, y, rel.attrs, rows, {
          title: rel.name,
          titleColour: C.ok,
          keyAttrs: rel.key,
        })
        parts.push(again)
        x += again.width + 24
        rowMax = Math.max(rowMax, again.height)
        continue
      }
      parts.push(t)
      x += t.width + 24
      rowMax = Math.max(rowMax, t.height)
    }
    frames.push({
      caption: `3NF: ${n.relations.map((r) => `${r.name}(${r.attrs.join(', ')})`).join('   ')}`,
      hold: 6500,
      svg: heading('Step 5: third normal form', C.ok) + sub('no partial and no transitive dependencies left') + parts.map((p) => p.svg).join(''),
    })
  }

  entries.push({
    id: `db-norm-q${QUESTIONS.indexOf(q) + 1}`,
    label: `Normalisation question ${QUESTIONS.indexOf(q) + 1}`,
    alt: `The ${q.name} relation taken from 1NF to 3NF`,
    width: W,
    height: 300,
    mode: 'replace',
    frames,
  })
}

const problems = fitHeights(entries)
if (problems.length) {
  for (const p of problems) console.error(`  OVERFLOW  ${p}`)
  process.exitCode = 1
}

const header = `// GENERATED by scripts/build-normalisation-questions.mjs — do not edit by hand.
//
// Ten exam-style normalisation questions. Each decomposition is computed by
// scripts/anim/normalise.mjs, not written by hand.
`

await writeFile(
  new URL('../src/content/animations/normalisation.js', import.meta.url),
  moduleSource('normalisationAnimations', entries, header),
  'utf8'
)

// Question prose, emitted from the same array the figures come from.
const md =
  `## Ten more to work through\n\n` +
  `Each one hands you a table and its dependencies. Write out 1NF, 2NF and 3NF\n` +
  `before you press play; the frames take you through the same four steps every\n` +
  `time, so the method matters more than the answer.\n\n` +
  QUESTIONS.map((q, i) => {
    const n = check(q)
    const fdList = q.fds.map((f) => `\`${f.l.join(', ')} → ${f.r.join(', ')}\``).join(', ')
    const rowsMd =
      `| ${q.attrs.join(' | ')} |\n| ${q.attrs.map(() => ':---').join(' | ')} |\n` +
      q.rows.map((r) => `| ${r.join(' | ')} |`).join('\n')
    return (
      `### Question ${i + 1}\n\n${q.prompt}\n\n**${q.name}**\n\n${rowsMd}\n\n` +
      `Primary key: \`${q.key.join(' + ')}\`. Dependencies: ${fdList}\n\n` +
      `::anim{id="db-norm-q${i + 1}"}\n\n` +
      `:color[**3NF.**]{hex="#22c55e"} ${n.relations.map((r) => `\`${r.name}(${r.attrs.join(', ')})\``).join(', ')}\n`
    )
  }).join('\n')

await writeFile(new URL('../generated/normalisation-questions.md', import.meta.url), md, 'utf8')

for (const e of entries) {
  console.log(`${e.id.padEnd(16)} ${String(e.frames.length).padStart(2)} frames  ${e.width}x${e.height}`)
}
console.log(`\n${entries.length} figure(s) written to src/content/animations/normalisation.js`)
