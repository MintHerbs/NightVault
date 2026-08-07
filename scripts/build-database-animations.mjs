#!/usr/bin/env node
// Builds the `::anim` figures for the Database Systems notes.
//
//   node scripts/build-database-animations.mjs
//
// Writes src/content/animations/database.js. Nothing here ships to the browser
// except the emitted frame data.

import { writeFile } from 'node:fs/promises'
import { C, W, text, rect, line, table, markerDef, moduleSource, fitHeights } from './anim/draw.mjs'

const entries = []

// ─────────────────────────────────────────────── the DreamHome schema figure
// Shown at the top of the DDL lecture: here are the tables, this is what we are
// about to build, and this is how they hold on to each other.
{
  const H = 300
  const frames = []
  const defs = markerDef('fk', C.link) + markerDef('fkFocus', C.focus)

  const branchCols = [
    { label: 'column', w: 96 },
    { label: 'type', w: 104 },
    { label: 'key', w: 52, align: 'middle' },
  ]
  const branchRows = [
    [{ v: 'branchNo', colour: C.focus, weight: 700 }, 'CHAR(4)', { v: 'PK', colour: C.focus, weight: 700 }],
    ['street', 'VARCHAR(25)', ''],
    ['city', 'VARCHAR(15)', ''],
    ['postcode', 'VARCHAR(8)', ''],
  ]
  const staffRows = [
    [{ v: 'staffNo', colour: C.focus, weight: 700 }, 'CHAR(5)', { v: 'PK', colour: C.focus, weight: 700 }],
    ['fName', 'VARCHAR(15)', ''],
    ['lName', 'VARCHAR(15)', ''],
    ['position', 'VARCHAR(10)', ''],
    ['salary', 'DECIMAL(7,2)', ''],
    [{ v: 'branchNo', colour: C.link, weight: 700 }, 'CHAR(4)', { v: 'FK', colour: C.link, weight: 700 }],
  ]

  const bx = 24
  const by = 58
  const branch = table(bx, by, branchCols, branchRows, { title: 'Branch', titleColour: C.text })

  const sx = 420
  const sy = 58
  const staff = table(sx, sy, branchCols, staffRows, { title: 'Staff', titleColour: C.text })

  const heading = (s) => text(W / 2, 28, s, { size: 14, weight: 700, anchor: 'middle' })

  frames.push({
    caption: 'Branch is the parent. Every branch of the estate agency is one row, identified by branchNo.',
    hold: 2800,
    svg: heading('The two tables we are about to create') + branch.svg,
  })

  frames.push({
    caption: 'Staff is the child. Each member of staff has their own key, staffNo.',
    hold: 2600,
    svg: staff.svg,
  })

  // the FK link, drawn from Staff.branchNo back to Branch.branchNo
  const fkFromY = sy + 26 + 5.5 * 24 + 12
  const fkToY = by + 26 + 0.5 * 24 + 12
  const midX = (bx + branch.width + sx) / 2
  frames.push({
    caption: 'branchNo appears in both. In Staff it is a foreign key, and it can only ever hold a branchNo that really exists in Branch.',
    hold: 3600,
    svg:
      line(sx - 4, fkFromY, midX, fkFromY, { stroke: C.link, sw: 1.6 }) +
      line(midX, fkFromY, midX, fkToY, { stroke: C.link, sw: 1.6 }) +
      line(midX, fkToY, bx + branch.width + 4, fkToY, { stroke: C.link, sw: 1.6, marker: 'fk' }) +
      text(midX, fkFromY + 16, 'references', { size: 10.5, fill: C.link, anchor: 'middle', weight: 700 }),
  })

  frames.push({
    caption: 'Which is why Branch has to be created first. A foreign key cannot point at a table that does not exist yet.',
    hold: 3600,
    svg:
      rect(bx - 8, by - 20, branch.width + 16, branch.height + 28, {
        fill: 'none',
        stroke: C.ok,
        sw: 1.6,
        dash: '5 4',
        rx: 8,
      }) + text(bx + branch.width / 2, by + branch.height + 24, 'create this one first', {
        size: 11,
        fill: C.ok,
        anchor: 'middle',
        weight: 700,
      }),
  })

  entries.push({
    id: 'db-dreamhome-schema',
    label: 'The Branch and Staff tables',
    alt: 'The Branch and Staff table structures, and the foreign key joining them',
    width: W,
    height: H,
    mode: 'build',
    defs,
    frames,
  })
}

// ──────────────────────────────────────────────── normalisation, 0NF to 3NF
// Noorie's CARE example, kept exactly as she set it up, worked through as a
// figure rather than as three code blocks the reader has to diff by eye.
{
  const H = 340
  const frames = []
  const KEYC = C.focus
  const PARTIAL = C.mark
  const TRANS = C.alt

  const tint = (hex) => `color-mix(in srgb, ${hex} 22%, transparent)`

  const heading = (s, colour = C.text) =>
    text(W / 2, 26, s, { size: 14, weight: 700, anchor: 'middle', fill: colour })

  const sub = (s, y = 44) => text(W / 2, y, s, { size: 11.5, anchor: 'middle', fill: C.muted })

  // 0NF: one patient row with a repeating group crammed inside it
  {
    // Column widths are sized to the widest cell each one has to hold: at
    // 11.5px in the mono face a character is about 6.9px, and
    // "admission, x-ray, discharge" is 27 of them.
    const cols = [
      { label: 'PatientName', w: 96 },
      { label: 'Age', w: 42, align: 'middle' },
      { label: 'Event', w: 236 },
      { label: 'Caregiver', w: 84 },
      { label: 'CGName', w: 152 },
    ]
    const rows = [
      ['Aisha', '34', 'admission, x-ray, discharge', 'C1, C2, C1', 'Patel, Okoro, Patel'],
      ['Bilal', '61', 'admission, physio', 'C3, C2', 'Nwosu, Okoro'],
    ]
    const x0 = 40
    const t = table(x0, 104, cols, rows, { title: 'CARE, as collected', rowH: 28 })
    const groupX = x0 + 96 + 42
    const groupW = 236 + 84 + 152
    frames.push({
      caption: 'Unnormalised. One row per patient, with several events crushed into a single cell. Nothing here is atomic.',
      hold: 3800,
      svg:
        heading('0NF: the repeating group') +
        sub('the three boxed columns repeat together inside one row') +
        t.svg +
        rect(groupX, 104, groupW, t.height, { fill: tint(C.bad), stroke: C.bad, sw: 1.4, rx: 4, annot: true }) +
        text(groupX + groupW / 2, 104 + t.height + 20, 'repeating group', {
          size: 11,
          fill: C.bad,
          anchor: 'middle',
          weight: 700,
        }) +
        text(W / 2, 104 + t.height + 46, 'Aisha has had three events. There is no way to ask "which patients had an x-ray?"', {
          size: 11.5,
          fill: C.muted,
          anchor: 'middle',
        }) +
        text(W / 2, 104 + t.height + 64, 'without picking apart the inside of a cell, and no way to add a fourth event without rewriting the row.', {
          size: 11.5,
          fill: C.muted,
          anchor: 'middle',
        }),
    })
  }

  // 1NF: flattened
  const oneNfCols = [
    { label: 'PatientName', w: 104 },
    { label: 'Age', w: 46, align: 'middle' },
    { label: 'Event', w: 96 },
    { label: 'Caregiver', w: 82, align: 'middle' },
    { label: 'CGName', w: 82 },
  ]
  const oneNfRows = [
    ['Aisha', '34', 'admission', 'C1', 'Patel'],
    ['Aisha', '34', 'x-ray', 'C2', 'Okoro'],
    ['Aisha', '34', 'discharge', 'C1', 'Patel'],
    ['Bilal', '61', 'admission', 'C3', 'Nwosu'],
    ['Bilal', '61', 'physio', 'C2', 'Okoro'],
  ]
  {
    const t = table(130, 96, oneNfCols, oneNfRows, { title: 'CARE in 1NF' })
    frames.push({
      caption: 'First normal form. Flatten the group: one row per event, copying the patient down beside each one. More rows, more repetition, but every cell now holds exactly one value.',
      hold: 4200,
      svg: heading('1NF: flatten it') + sub('every cell atomic, and a key that identifies a row') + t.svg,
    })
  }

  // 1NF with the composite key marked
  {
    const cols = oneNfCols.map((c, i) =>
      i === 0 || i === 2 ? { ...c, colour: KEYC } : c
    )
    const rows = oneNfRows.map((r) =>
      r.map((v, i) => (i === 0 || i === 2 ? { v, fill: tint(KEYC), colour: KEYC, weight: 700 } : v))
    )
    const t = table(130, 96, cols, rows)
    frames.push({
      caption: 'The key is PatientName plus Event together. Neither alone is enough: Aisha appears three times, and admission appears twice.',
      hold: 4200,
      svg:
        heading('The primary key is composite', KEYC) +
        sub('{PatientName, Event} identifies exactly one row') +
        t.svg,
    })
  }

  // the partial dependency
  {
    const cols = oneNfCols.map((c, i) =>
      i === 0 ? { ...c, colour: KEYC } : i === 1 ? { ...c, colour: PARTIAL } : c
    )
    const rows = oneNfRows.map((r) =>
      r.map((v, i) =>
        i === 0
          ? { v, fill: tint(KEYC), colour: KEYC, weight: 700 }
          : i === 1
            ? { v, fill: tint(PARTIAL), colour: PARTIAL, weight: 700 }
            : v
      )
    )
    const t = table(130, 110, cols, rows)
    frames.push({
      caption: 'Age depends on PatientName alone, not on the whole key. That is a partial dependency, and it is what 2NF exists to remove.',
      hold: 4400,
      svg:
        heading('The problem: a partial dependency', PARTIAL) +
        sub('PatientName → Age, and Event has nothing to do with it') +
        t.svg +
        text(130, 110 + t.height + 22, 'PatientName → Age', {
          size: 12,
          fill: PARTIAL,
          weight: 700,
          mono: true,
        }) +
        text(130, 110 + t.height + 40, 'Aisha is 34 on three separate rows. Change her age and you must change all three.', {
          size: 11,
          fill: C.muted,
        }),
    })
  }

  // 2NF: split
  {
    const c1Cols = [
      { label: 'PatientName', w: 104 },
      { label: 'Event', w: 92 },
      { label: 'Caregiver', w: 80, align: 'middle' },
      { label: 'CGName', w: 80 },
    ]
    const c1Rows = oneNfRows.map((r) => [
      { v: r[0], fill: tint(KEYC), colour: KEYC, weight: 700 },
      { v: r[2], fill: tint(KEYC), colour: KEYC, weight: 700 },
      r[3],
      r[4],
    ])
    const c2Cols = [
      { label: 'PatientName', w: 104 },
      { label: 'Age', w: 46, align: 'middle' },
    ]
    const c2Rows = [
      [{ v: 'Aisha', fill: tint(KEYC), colour: KEYC, weight: 700 }, '34'],
      [{ v: 'Bilal', fill: tint(KEYC), colour: KEYC, weight: 700 }, '61'],
    ]
    const t1 = table(28, 106, c1Cols, c1Rows, { title: 'C1', titleColour: C.ok })
    const t2 = table(430, 106, c2Cols, c2Rows, { title: 'C2', titleColour: C.ok })
    frames.push({
      caption: 'Second normal form. Age and its determinant move to a table of their own. Aisha is now 34 in exactly one place.',
      hold: 4400,
      svg:
        heading('2NF: peel off the partial dependency', C.ok) +
        sub('the shared PatientName is what links the two back together') +
        t1.svg +
        t2.svg +
        text(28, 106 + t1.height + 22, 'C1(PatientName, Event, Caregiver, CGName)', { size: 11.5, mono: true, fill: C.ok }) +
        text(430, 106 + t2.height + 22, 'C2(PatientName, Age)', { size: 11.5, mono: true, fill: C.ok }),
    })
  }

  // the transitive dependency
  {
    const cols = [
      { label: 'PatientName', w: 104, colour: KEYC },
      { label: 'Event', w: 92, colour: KEYC },
      { label: 'Caregiver', w: 80, align: 'middle', colour: TRANS },
      { label: 'CGName', w: 80, colour: TRANS },
    ]
    const rows = oneNfRows.map((r) => [
      { v: r[0], fill: tint(KEYC), colour: KEYC, weight: 700 },
      { v: r[2], fill: tint(KEYC), colour: KEYC, weight: 700 },
      { v: r[3], fill: tint(TRANS), colour: TRANS, weight: 700 },
      { v: r[4], fill: tint(TRANS), colour: TRANS, weight: 700 },
    ])
    const t = table(28, 110, cols, rows, { title: 'C1' })
    frames.push({
      caption: 'CGName does not depend on the key. It depends on Caregiver, which depends on the key. A chain like that is a transitive dependency.',
      hold: 4400,
      svg:
        heading('The next problem: a transitive dependency', TRANS) +
        sub('the key determines Caregiver, and Caregiver determines the name') +
        t.svg +
        text(28, 110 + t.height + 24, '{PatientName, Event} → Caregiver → CGName', {
          size: 12,
          fill: TRANS,
          weight: 700,
          mono: true,
        }) +
        text(28, 110 + t.height + 42, 'C2 is Okoro on two rows. Correct one spelling and you have to find every other copy.', {
          size: 11,
          fill: C.muted,
        }),
    })
  }

  // 3NF
  {
    const c1Cols = [
      { label: 'PatientName', w: 104 },
      { label: 'Event', w: 92 },
      { label: 'Caregiver', w: 80, align: 'middle' },
    ]
    const c1Rows = oneNfRows.map((r) => [r[0], r[2], { v: r[3], colour: TRANS, weight: 700 }])
    const c3Cols = [
      { label: 'Caregiver', w: 82, align: 'middle' },
      { label: 'CGName', w: 82 },
    ]
    const c3Rows = [
      [{ v: 'C1', colour: TRANS, weight: 700 }, 'Patel'],
      [{ v: 'C2', colour: TRANS, weight: 700 }, 'Okoro'],
      [{ v: 'C3', colour: TRANS, weight: 700 }, 'Nwosu'],
    ]
    const t1 = table(28, 106, c1Cols, c1Rows, { title: 'C1', titleColour: C.ok })
    const t3 = table(410, 106, c3Cols, c3Rows, { title: 'C3', titleColour: C.ok })
    frames.push({
      caption: 'Third normal form. Each caregiver name is stored once, and Caregiver is the trail back. Three small relations instead of one wide redundant one.',
      hold: 5000,
      svg:
        heading('3NF: peel off the transitive dependency', C.ok) +
        sub('every non-key attribute now depends on the key, the whole key, and nothing but the key') +
        t1.svg +
        t3.svg +
        text(28, 106 + t1.height + 26, 'C1(PatientName, Event, Caregiver)', { size: 11.5, mono: true, fill: C.ok }) +
        text(28, 106 + t1.height + 44, 'C2(PatientName, Age)', { size: 11.5, mono: true, fill: C.ok }) +
        text(28, 106 + t1.height + 62, 'C3(Caregiver, CGName)', { size: 11.5, mono: true, fill: C.ok }),
    })
  }

  entries.push({
    id: 'db-normalisation-care',
    label: 'Normalising the CARE table',
    alt: 'The CARE table taken from unnormalised through first, second and third normal form',
    width: W,
    height: H,
    mode: 'replace',
    frames,
  })
}

// Heights are measured from what the frames actually paint rather than guessed,
// so no figure ships with dead space under it or with its last row clipped.
const problems = fitHeights(entries)
if (problems.length) {
  for (const p of problems) console.error(`  OVERFLOW  ${p}`)
  process.exitCode = 1
}

const header = `// GENERATED by scripts/build-database-animations.mjs — do not edit by hand.
//
// Frames for the \`::anim\` figures in the Database Systems notes. Colours are
// CSS custom properties defined in NoteAnimation.module.css, so one figure
// serves both the light and the dark themes.
`

await writeFile(
  new URL('../src/content/animations/database.js', import.meta.url),
  moduleSource('databaseAnimations', entries, header),
  'utf8'
)

for (const e of entries) {
  console.log(`${e.id.padEnd(28)} ${String(e.frames.length).padStart(2)} frames  ${e.width}x${e.height}`)
}
console.log(`\n${entries.length} figure(s) written to src/content/animations/database.js`)
