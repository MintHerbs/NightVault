#!/usr/bin/env node
// Builds the `::anim` figures for Semester 1 lecture 7, ER modelling.
//
//   node scripts/build-erd-animations.mjs

import { writeFile } from 'node:fs/promises'
import { C, W, text, rect, line, moduleSource, fitHeights, wrap } from './anim/draw.mjs'
import {
  entity, relationship, attribute, isa, connect, edgeEntityRel, attachedAttribute,
  ENTITY_W, ENTITY_H, REL_RY, ATTR_RY,
} from './anim/erdraw.mjs'

const entries = []
const E = (cx, cy) => ({ cx, cy, shape: 'rect' })
const R = (cx, cy) => ({ cx, cy, shape: 'diamond' })

// ───────────────────────────────────────────── 1. the notation reference
{
  const frames = []
  const head = (s, colour = C.text) => text(W / 2, 18, s, { size: 13, weight: 700, anchor: 'middle', fill: colour })

  // Three columns: group, meaning, symbol.
  const GX = 26
  const MX = 150
  const SX = 470
  const rowH = 46

  const shell = (rows, title, colour) => {
    const out = [head(title, colour)]
    const top = 40
    out.push(rect(GX - 8, top - 6, W - 2 * (GX - 8), rows.length * rowH + 12, { fill: 'none', stroke: C.line, rx: 6 }))
    rows.forEach((r, i) => {
      const y = top + i * rowH + rowH / 2
      if (i > 0) out.push(line(GX - 8, top + i * rowH - 6, W - GX + 8, top + i * rowH - 6, { stroke: C.line, sw: 0.5 }))
      if (r.group) out.push(text(GX, y + 4, r.group, { size: 11.5, weight: 700, fill: r.colour ?? C.muted }))
      out.push(text(MX, y - 2, r.name, { size: 11.5, weight: 600, fill: C.text }))
      if (r.note) out.push(text(MX, y + 13, r.note, { size: 10, fill: C.muted }))
      out.push(r.symbol(SX + 90, y))
    })
    return out.join('')
  }

  frames.push({
    caption: 'The two things every ER diagram is made of: the things you store, and what identifies them.',
    hold: 4000,
    svg: shell(
      [
        { group: 'Entity set', name: 'Strong entity set', note: 'exists on its own, has its own key', symbol: (x, y) => entity(x, y, 'Student') },
        { group: '', name: 'Weak entity set', note: 'identified only through an owner', symbol: (x, y) => entity(x, y, 'Dependent', { weak: true }) },
      ],
      'Entities',
      C.text
    ),
  })

  frames.push({
    caption: 'Attributes. The outline and the underline carry the meaning, so read the shape before you read the word.',
    hold: 5200,
    svg: shell(
      [
        { group: 'Attributes', name: 'Simple (atomic)', note: 'one indivisible value', symbol: (x, y) => attribute(x, y, 'gender') },
        { group: '', name: 'Key attribute', note: 'underlined, unique per entity', symbol: (x, y) => attribute(x, y, 'studentNo', { key: true, rx: 46 }) },
        { group: '', name: 'Multivalued', note: 'double outline, many values at once', symbol: (x, y) => attribute(x, y, 'phone', { multi: true }) },
        { group: '', name: 'Derived', note: 'dashed, computed from others', symbol: (x, y) => attribute(x, y, 'age', { derived: true }) },
        { group: '', name: 'Composite', note: 'made of smaller attributes', symbol: (x, y) => attribute(x, y - 10, 'address') + connect(x - 20, y - 10 + ATTR_RY - 4, x - 44, y + 16) + connect(x + 16, y - 10 + ATTR_RY - 4, x + 40, y + 16) + attribute(x - 60, y + 18, 'city', { rx: 24 }) + attribute(x + 56, y + 18, 'zip', { rx: 22 }) },
      ],
      'Attributes',
      C.link
    ),
  })

  frames.push({
    caption: 'Relationships, and the marks that say how many and whether it is optional.',
    hold: 5200,
    svg: shell(
      [
        { group: 'Relationship', name: 'Strong relationship', note: 'ordinary association', symbol: (x, y) => relationship(x, y, 'enrols') },
        { group: '', name: 'Weak (identifying)', note: 'double diamond, identifies a weak entity', symbol: (x, y) => relationship(x, y, 'has', { weak: true }) },
        { group: 'Constraints', name: 'Cardinality', note: '1:1, 1:M or M:N, written on the line', symbol: (x, y) => connect(x - 70, y, x + 70, y, { label: 'M' }) + text(x + 58, y - 8, 'N', { size: 10.5, weight: 700, fill: C.line, mono: true }) },
        { group: '', name: 'Total participation', note: 'double line, every entity must take part', symbol: (x, y) => connect(x - 70, y, x + 70, y, { total: true }) },
      ],
      'Relationships and constraints',
      C.focus
    ),
  })

  frames.push({
    caption: 'ISA. The triangle points at the superclass, and the subclasses inherit everything above it.',
    hold: 5600,
    svg: (() => {
      const out = [head('Specialisation and generalisation', C.alt)]
      const cx = W / 2
      out.push(entity(cx, 62, 'Employee'))
      out.push(connect(cx, 62 + ENTITY_H / 2, cx, 100))
      out.push(isa(cx, 113))
      out.push(connect(cx, 126, cx - 150, 150))
      out.push(connect(cx, 126, cx, 150))
      out.push(connect(cx, 126, cx + 150, 150))
      out.push(entity(cx - 150, 172, 'Officer'))
      out.push(entity(cx, 172, 'Teller'))
      out.push(entity(cx + 150, 172, 'Secretary'))
      out.push(text(cx + 34, 116, 'disjoint', { size: 10, fill: C.alt, weight: 700 }))
      out.push(
        text(W / 2, 216, 'Specialisation is top down: carve subgroups out of a set. Generalisation is bottom up:', {
          size: 11, anchor: 'middle', fill: C.muted,
        })
      )
      out.push(
        text(W / 2, 232, 'combine sets that share features. Both are drawn the same way.', {
          size: 11, anchor: 'middle', fill: C.muted,
        })
      )
      out.push(
        text(W / 2, 254, 'disjoint = an entity is in at most one subclass    overlapping = it may be in several', {
          size: 10.5, anchor: 'middle', fill: C.alt,
        })
      )
      return out.join('')
    })(),
  })

  entries.push({
    id: 'db-erd-components',
    label: 'ER diagram notation',
    alt: 'A reference table of every ER diagram symbol, including ISA',
    width: W,
    height: 300,
    mode: 'replace',
    frames,
  })
}

// ──────────────────────────────── 2. a complex question, sentence by sentence
{
  const SENTENCES = [
    'A university is divided into departments. Each department has a unique code, a name, and any number of contact phone numbers.',
    'Every department is headed by exactly one lecturer, and a lecturer heads at most one department.',
    'Each lecturer has a staff number, a name, and a date of birth, from which their age is worked out.',
    'A lecturer teaches many modules, and every module is taught by exactly one lecturer.',
    'Students enrol on many modules, and every module is taken by many students. The date a student enrolled on a module must be recorded.',
    'Every student is either an undergraduate or a postgraduate, and never both.',
  ]

  // Fixed positions, chosen once so the diagram never reflows as it grows: a
  // student watching a shape jump between frames loses track of what is new.
  const DEPT = E(136, 250)
  const HEADS = R(136, 160)
  const LECT = E(136, 74)
  const TEACHES = R(268, 74)
  const MODULE = E(430, 74)
  const ENROLS = R(430, 176)
  const STUDENT = E(430, 268)
  const ISA_Y = 330

  const layers = []

  layers.push(
    entity(DEPT.cx, DEPT.cy, 'Department') +
      attachedAttribute(DEPT, DEPT.cx - 4, DEPT.cy + 62, 'deptCode', { key: true, rx: 38 }) +
      attachedAttribute(DEPT, DEPT.cx + 116, DEPT.cy + 46, 'dName', { rx: 30 }) +
      attachedAttribute(DEPT, DEPT.cx + 132, DEPT.cy - 8, 'phone', { multi: true, rx: 30 })
  )

  layers.push(
    relationship(HEADS.cx, HEADS.cy, 'heads') +
      edgeEntityRel(DEPT, HEADS, { label: '1', labelAt: 0.55, total: true }) +
      edgeEntityRel(LECT, HEADS, { label: '1', labelAt: 0.55 })
  )

  layers.push(
    entity(LECT.cx, LECT.cy, 'Lecturer') +
      attachedAttribute(LECT, LECT.cx - 6, LECT.cy - 56, 'staffNo', { key: true, rx: 34 }) +
      attachedAttribute(LECT, LECT.cx + 106, LECT.cy - 40, 'lName', { rx: 28 }) +
      // Clear of the vertical Lecturer-to-heads edge, which runs down x = LECT.cx.
      attachedAttribute(LECT, LECT.cx - 82, LECT.cy + 42, 'age', { derived: true, rx: 24 })
  )

  layers.push(
    relationship(TEACHES.cx, TEACHES.cy, 'teaches') +
      edgeEntityRel(LECT, TEACHES, { label: '1', labelAt: 0.6 }) +
      edgeEntityRel(MODULE, TEACHES, { label: 'M', labelAt: 0.6, total: true }) +
      entity(MODULE.cx, MODULE.cy, 'Module') +
      attachedAttribute(MODULE, MODULE.cx + 8, MODULE.cy - 56, 'modCode', { key: true, rx: 36 }) +
      attachedAttribute(MODULE, MODULE.cx + 128, MODULE.cy + 6, 'title', { rx: 26 })
  )

  layers.push(
    relationship(ENROLS.cx, ENROLS.cy, 'enrols') +
      edgeEntityRel(MODULE, ENROLS, { label: 'M', labelAt: 0.6 }) +
      edgeEntityRel(STUDENT, ENROLS, { label: 'N', labelAt: 0.6 }) +
      entity(STUDENT.cx, STUDENT.cy, 'Student') +
      attachedAttribute(STUDENT, STUDENT.cx + 130, STUDENT.cy + 4, 'sNo', { key: true, rx: 24 }) +
      connect(ENROLS.cx + 46, ENROLS.cy - 12, ENROLS.cx + 104, ENROLS.cy - 30) +
      attribute(ENROLS.cx + 136, ENROLS.cy - 38, 'enrolDate', { rx: 40 })
  )

  layers.push(
    connect(STUDENT.cx, STUDENT.cy + ENTITY_H / 2, STUDENT.cx, ISA_Y - 13) +
      isa(STUDENT.cx, ISA_Y) +
      text(STUDENT.cx + 32, ISA_Y + 3, 'disjoint', { size: 9.5, fill: C.alt, weight: 700 }) +
      connect(STUDENT.cx, ISA_Y + 13, STUDENT.cx - 120, ISA_Y + 40) +
      connect(STUDENT.cx, ISA_Y + 13, STUDENT.cx + 120, ISA_Y + 40) +
      entity(STUDENT.cx - 120, ISA_Y + 60, 'Undergrad') +
      entity(STUDENT.cx + 120, ISA_Y + 60, 'Postgrad')
  )

  const NOTES = [
    'One entity, and the shapes of its attributes: underlined for the key, double for the many phone numbers.',
    'One head each way, so 1:1. Department sits on a double line because every department must have a head.',
    'age is dashed. It is not stored, it is worked out from the date of birth.',
    'Many modules to one lecturer, so 1:M. Every module must have a teacher, so that side is total.',
    'Many to many, so the date cannot live on either entity. It belongs to the relationship itself.',
    'Either one or the other and never both: an ISA triangle marked disjoint.',
  ]

  const frames = []
  const TEXT_TOP = 16
  const LINE_H = 14
  const GAP = 5

  // The whole question is on screen in every frame, with only the sentence
  // being worked on lit up. Revealing it a sentence at a time would grow the
  // text block and push the diagram down as it went, so shapes already drawn
  // would drift between frames and the reader would lose track of what had
  // actually changed. Laying it out once fixes the diagram in place.
  const WRAPPED = SENTENCES.map((s) => wrap(s, 108))
  const TEXT_H = WRAPPED.reduce((a, ls) => a + ls.length * LINE_H + GAP, 0)
  const DIAGRAM_TOP = TEXT_TOP + TEXT_H + 18

  for (let i = 0; i < SENTENCES.length; i += 1) {
    const out = []

    let y = TEXT_TOP
    WRAPPED.forEach((lines, s) => {
      const active = s === i
      const done = s < i
      for (const l of lines) {
        out.push(
          text(20, y, l, {
            size: 10.8,
            fill: active ? C.focus : done ? C.muted : C.muted,
            weight: active ? 700 : 400,
            opacity: active ? 1 : done ? 0.5 : 0.28,
          })
        )
        y += LINE_H
      }
      y += GAP
    })

    out.push(line(20, DIAGRAM_TOP - 12, W - 20, DIAGRAM_TOP - 12, { stroke: C.line, sw: 0.6, dash: '3 3' }))

    // Everything built so far, shifted below the text.
    const built = layers.slice(0, i + 1).join('')
    out.push(`<g transform="translate(0, ${DIAGRAM_TOP - 20})">${built}</g>`)

    frames.push({
      caption: NOTES[i],
      hold: 6000,
      svg: out.join(''),
    })
  }

  entries.push({
    id: 'db-erd-stepwise',
    label: 'Building an ER diagram sentence by sentence',
    alt: 'A university ER diagram built one sentence of the question at a time',
    width: W,
    height: 520,
    mode: 'replace',
    frames,
  })
}

// ─────────────────────────────────────────────── 3. the ten exam questions
export const ERD_QUESTIONS = [
  {
    id: 1,
    text: 'A hospital has many wards. Each ward has a unique ward number and a name. Every ward is staffed by many nurses, and each nurse works on exactly one ward. A nurse has a staff number and a name.',
    answer: 'Ward 1:M Nurse. Nurse is total: every nurse must be on a ward.',
    draw: () => {
      const A = E(140, 70), Rl = R(345, 70), B = E(550, 70)
      return entity(A.cx, A.cy, 'Ward') + relationship(Rl.cx, Rl.cy, 'staffed by') + entity(B.cx, B.cy, 'Nurse') +
        edgeEntityRel(A, Rl, { label: '1' }) + edgeEntityRel(B, Rl, { label: 'M', total: true }) +
        attachedAttribute(A, A.cx - 66, A.cy + 62, 'wardNo', { key: true, rx: 34 }) +
        attachedAttribute(A, A.cx + 60, A.cy + 62, 'wName', { rx: 30 }) +
        attachedAttribute(B, B.cx - 56, B.cy + 62, 'staffNo', { key: true, rx: 34 }) +
        attachedAttribute(B, B.cx + 62, B.cy + 62, 'nName', { rx: 30 })
    },
  },
  {
    id: 2,
    text: 'A library holds many books. A member may borrow many books and a book may be borrowed by many members over time. The date of each loan must be recorded.',
    answer: 'Member M:N Book, with loanDate on the relationship because it belongs to neither entity alone.',
    draw: () => {
      const A = E(140, 70), Rl = R(345, 70), B = E(550, 70)
      return entity(A.cx, A.cy, 'Member') + relationship(Rl.cx, Rl.cy, 'borrows') + entity(B.cx, B.cy, 'Book') +
        edgeEntityRel(A, Rl, { label: 'M' }) + edgeEntityRel(B, Rl, { label: 'N' }) +
        connect(Rl.cx, Rl.cy - REL_RY, Rl.cx, 26 + ATTR_RY) + attribute(Rl.cx, 26, 'loanDate', { rx: 40 }) +
        attachedAttribute(A, A.cx - 40, A.cy + 66, 'memberNo', { key: true, rx: 40 }) +
        attachedAttribute(B, B.cx + 40, B.cy + 66, 'ISBN', { key: true, rx: 28 })
    },
  },
  {
    id: 3,
    text: 'An employee may manage many other employees, and every employee is managed by at most one manager, who is also an employee.',
    answer: 'A unary (recursive) 1:M relationship on Employee, with role names on each line.',
    draw: () => {
      const A = E(345, 130), Rl = R(345, 46)
      return entity(A.cx, A.cy, 'Employee') + relationship(Rl.cx, Rl.cy, 'manages') +
        connect(A.cx - 40, A.cy - ENTITY_H / 2, A.cx - 40, Rl.cy) + connect(A.cx - 40, Rl.cy, Rl.cx - 46, Rl.cy, { label: '1', labelAt: 0.4 }) +
        connect(A.cx + 40, A.cy - ENTITY_H / 2, A.cx + 40, Rl.cy) + connect(A.cx + 40, Rl.cy, Rl.cx + 46, Rl.cy, { label: 'M', labelAt: 0.4 }) +
        text(A.cx - 96, A.cy - 26, 'manager', { size: 10, fill: C.link, weight: 700 }) +
        text(A.cx + 60, A.cy - 26, 'worker', { size: 10, fill: C.link, weight: 700 }) +
        attachedAttribute(A, A.cx, A.cy + 62, 'empNo', { key: true, rx: 32 })
    },
  },
  {
    id: 4,
    text: 'A company has several projects. Each project is identified by a project number and has a budget. An employee may work on many projects and a project has many employees. The number of hours each employee spends on each project is recorded.',
    answer: 'Employee M:N Project with hours on the relationship.',
    draw: () => {
      const A = E(140, 80), Rl = R(345, 80), B = E(550, 80)
      return entity(A.cx, A.cy, 'Employee') + relationship(Rl.cx, Rl.cy, 'works on') + entity(B.cx, B.cy, 'Project') +
        edgeEntityRel(A, Rl, { label: 'M' }) + edgeEntityRel(B, Rl, { label: 'N' }) +
        connect(Rl.cx, Rl.cy - REL_RY, Rl.cx, 30 + ATTR_RY) + attribute(Rl.cx, 30, 'hours', { rx: 30 }) +
        attachedAttribute(A, A.cx - 44, A.cy + 66, 'empNo', { key: true, rx: 32 }) +
        attachedAttribute(B, B.cx - 20, B.cy + 66, 'projNo', { key: true, rx: 32 }) +
        attachedAttribute(B, B.cx + 96, B.cy + 52, 'budget', { rx: 32 })
    },
  },
  {
    id: 5,
    text: 'A bank has many branches. A customer may hold many accounts and an account may be held jointly by many customers. Every account belongs to exactly one branch.',
    answer: 'Customer M:N Account, and Account M:1 Branch. Account is total on the branch side.',
    draw: () => {
      const A = E(110, 70), R1 = R(300, 70), B = E(490, 70), R2 = R(490, 170), Cc = E(490, 254)
      return entity(A.cx, A.cy, 'Customer') + relationship(R1.cx, R1.cy, 'holds') + entity(B.cx, B.cy, 'Account') +
        relationship(R2.cx, R2.cy, 'belongs to') + entity(Cc.cx, Cc.cy, 'Branch') +
        edgeEntityRel(A, R1, { label: 'M' }) + edgeEntityRel(B, R1, { label: 'N' }) +
        edgeEntityRel(B, R2, { label: 'M', total: true }) + edgeEntityRel(Cc, R2, { label: '1' }) +
        attachedAttribute(A, A.cx - 20, A.cy + 66, 'custNo', { key: true, rx: 32 }) +
        attachedAttribute(B, B.cx + 130, B.cy - 4, 'accNo', { key: true, rx: 30 }) +
        attachedAttribute(Cc, Cc.cx + 130, Cc.cy, 'sortCode', { key: true, rx: 38 })
    },
  },
  {
    id: 6,
    text: 'A building contains many rooms. A room is numbered only within its building, so room 101 may exist in several buildings. If a building is demolished its rooms cease to exist.',
    answer: 'Room is a weak entity: double rectangle, identifying relationship in a double diamond, and roomNo is a partial key with a dashed underline.',
    draw: () => {
      const A = E(150, 80), Rl = R(345, 80), B = E(545, 80)
      return entity(A.cx, A.cy, 'Building') + relationship(Rl.cx, Rl.cy, 'contains', { weak: true }) +
        entity(B.cx, B.cy, 'Room', { weak: true }) +
        edgeEntityRel(A, Rl, { label: '1' }) + edgeEntityRel(B, Rl, { label: 'M', total: true }) +
        attachedAttribute(A, A.cx - 40, A.cy + 66, 'bldgNo', { key: true, rx: 34 }) +
        attachedAttribute(B, B.cx + 40, B.cy + 66, 'roomNo', { partialKey: true, rx: 34 })
    },
  },
  {
    id: 7,
    text: 'A vehicle is either a car or a lorry. Every vehicle has a registration and a make. A car additionally has a number of seats; a lorry has a maximum load. A vehicle cannot be both.',
    answer: 'An ISA triangle marked disjoint, with the shared attributes on the superclass and the specific ones on each subclass.',
    draw: () => {
      const A = E(345, 54)
      return entity(A.cx, A.cy, 'Vehicle') +
        attachedAttribute(A, A.cx - 150, A.cy, 'regNo', { key: true, rx: 30 }) +
        attachedAttribute(A, A.cx + 146, A.cy, 'make', { rx: 28 }) +
        connect(A.cx, A.cy + ENTITY_H / 2, A.cx, 108) + isa(A.cx, 121) +
        text(A.cx + 32, 124, 'disjoint', { size: 9.5, fill: C.alt, weight: 700 }) +
        connect(A.cx, 134, A.cx - 130, 158) + connect(A.cx, 134, A.cx + 130, 158) +
        entity(A.cx - 130, 180, 'Car') + entity(A.cx + 130, 180, 'Lorry') +
        attachedAttribute(E(A.cx - 130, 180), A.cx - 130, 242, 'seats', { rx: 28 }) +
        attachedAttribute(E(A.cx + 130, 180), A.cx + 130, 242, 'maxLoad', { rx: 36 })
    },
  },
  {
    id: 8,
    text: 'A supplier supplies many parts to many projects. A given part may come from several suppliers and go to several projects. The quantity supplied must be recorded for each combination.',
    answer: 'A ternary relationship joining all three entity sets. It cannot be split into three binary relationships without losing which supplier sent which part to which project.',
    draw: () => {
      const A = E(110, 60), B = E(580, 60), Cc = E(345, 250), Rl = R(345, 130)
      return entity(A.cx, A.cy, 'Supplier') + entity(B.cx, B.cy, 'Project') + entity(Cc.cx, Cc.cy, 'Part') +
        relationship(Rl.cx, Rl.cy, 'supplies') +
        edgeEntityRel(A, Rl, { label: 'M', labelAt: 0.6 }) +
        edgeEntityRel(B, Rl, { label: 'N', labelAt: 0.6 }) +
        edgeEntityRel(Cc, Rl, { label: 'P', labelAt: 0.55 }) +
        connect(Rl.cx + 46, Rl.cy, Rl.cx + 108, Rl.cy) + attribute(Rl.cx + 140, Rl.cy, 'qty', { rx: 26 })
    },
  },
  {
    id: 9,
    text: 'A patient is registered with exactly one doctor, and a doctor has many patients. Every patient must be registered. A patient may have many appointments, each on a date and at a time, and an appointment belongs to exactly one patient.',
    answer: 'Doctor 1:M Patient with Patient total, and Patient 1:M Appointment. Appointment is weak if it is identified only by its patient plus date and time.',
    draw: () => {
      const A = E(110, 70), R1 = R(300, 70), B = E(490, 70), R2 = R(490, 168), Cc = E(490, 250)
      return entity(A.cx, A.cy, 'Doctor') + relationship(R1.cx, R1.cy, 'registered') + entity(B.cx, B.cy, 'Patient') +
        relationship(R2.cx, R2.cy, 'books', { weak: true }) + entity(Cc.cx, Cc.cy, 'Appointment', { weak: true }) +
        edgeEntityRel(A, R1, { label: '1' }) + edgeEntityRel(B, R1, { label: 'M', total: true }) +
        edgeEntityRel(B, R2, { label: '1' }) + edgeEntityRel(Cc, R2, { label: 'M', total: true }) +
        attachedAttribute(A, A.cx - 20, A.cy + 66, 'docNo', { key: true, rx: 30 }) +
        attachedAttribute(B, B.cx + 130, B.cy - 6, 'nhsNo', { key: true, rx: 30 }) +
        attachedAttribute(Cc, Cc.cx + 136, Cc.cy, 'apptTime', { partialKey: true, rx: 38 })
    },
  },
  {
    id: 10,
    text: 'An airline operates many flights. Each flight has a flight number, and runs on many days of the week. A passenger may book many flights and a flight carries many passengers. Each booking has a seat number. Every flight is operated by exactly one aircraft, and an aircraft may operate many flights.',
    answer: 'Aircraft 1:M Flight, Passenger M:N Flight with seatNo on the relationship, and days is multivalued on Flight.',
    draw: () => {
      const A = E(110, 70), R1 = R(300, 70), B = E(490, 70), R2 = R(490, 176), Cc = E(490, 258)
      return entity(A.cx, A.cy, 'Passenger') + relationship(R1.cx, R1.cy, 'books') + entity(B.cx, B.cy, 'Flight') +
        relationship(R2.cx, R2.cy, 'operated by') + entity(Cc.cx, Cc.cy, 'Aircraft') +
        edgeEntityRel(A, R1, { label: 'M' }) + edgeEntityRel(B, R1, { label: 'N' }) +
        edgeEntityRel(B, R2, { label: 'M', total: true }) + edgeEntityRel(Cc, R2, { label: '1' }) +
        connect(R1.cx, R1.cy - REL_RY, R1.cx, 26 + ATTR_RY) + attribute(R1.cx, 26, 'seatNo', { rx: 32 }) +
        attachedAttribute(B, B.cx + 132, B.cy - 8, 'flightNo', { key: true, rx: 38 }) +
        attachedAttribute(B, B.cx + 120, B.cy + 44, 'days', { multi: true, rx: 28 }) +
        attachedAttribute(A, A.cx - 20, A.cy + 66, 'passNo', { key: true, rx: 32 })
    },
  },
]

for (const q of ERD_QUESTIONS) {
  const body = q.draw()
  const frames = [
    {
      caption: q.answer,
      hold: 6000,
      svg: text(20, 18, `Question ${q.id}`, { size: 12, weight: 700, fill: C.muted }) + `<g transform="translate(0, 22)">${body}</g>`,
    },
  ]
  entries.push({
    id: `db-erd-q${q.id}`,
    label: `ERD question ${q.id}`,
    alt: `The ER diagram answering question ${q.id}`,
    width: W,
    height: 340,
    mode: 'replace',
    frames,
  })
}

// ─────────────────────────────────────────────────────────────── emit
const problems = fitHeights(entries)
if (problems.length) {
  for (const p of problems) console.error(`  OVERFLOW  ${p}`)
  process.exitCode = 1
}

const header = `// GENERATED by scripts/build-erd-animations.mjs — do not edit by hand.
//
// Frames for the ER modelling figures in Semester 1 lecture 7: the notation
// reference, the sentence-by-sentence walkthrough, and ten exam questions.
`

await writeFile(
  new URL('../src/content/animations/erd.js', import.meta.url),
  moduleSource('erdAnimations', entries, header),
  'utf8'
)

// The question prose is emitted from the same array the figures are built from,
// so a question and its answer diagram cannot drift apart.
const questionsMd =
  `## Ten questions to practise on\n\n` +
  `Work each one out on paper first. The diagram under each question is the\n` +
  `answer, and it starts paused, so nothing is given away until you press play.\n\n` +
  ERD_QUESTIONS.map(
    (q) =>
      `### Question ${q.id}\n\n${q.text}\n\n::anim{id="db-erd-q${q.id}"}\n\n` +
      `:color[**Answer.**]{hex="#22c55e"} ${q.answer}\n`
  ).join('\n')

await writeFile(new URL('../generated/erd-questions.md', import.meta.url), questionsMd, 'utf8')

for (const e of entries) {
  console.log(`${e.id.padEnd(24)} ${String(e.frames.length).padStart(2)} frames  ${e.width}x${e.height}`)
}
console.log(`\n${entries.length} figure(s) written to src/content/animations/erd.js`)
console.log(`${ERD_QUESTIONS.length} question(s) written to generated/erd-questions.md`)
