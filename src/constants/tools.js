// src/constants/tools.js
//
// Single registry for the app's course-agnostic tools (T-077) — B+ Tree,
// ERD, Code Complexity, Recurrence Relation, Grade Toolkit. Previously
// duplicated between HomePage.jsx's inline TOOLS array and Sidebar/
// modules.js's MODULE_TOOLS, which had already drifted apart. Both now
// read from here; `field` is the ASCII-cover animation
// (src/lib/asciiArt/fields) each tool's card renders on the home page and
// on every course landing page.

import { graphPulse, codeRain, spiralZoom, barMeter } from '../lib/asciiArt/fields'
import { BTREE_COVER } from './coverPresets'

export const TOOLS = [
  {
    id: 'btree',
    title: 'B+ Tree Visualizer',
    description: 'Insert, delete, and search keys with every step animated.',
    field: BTREE_COVER,
    route: '/tree',
  },
  {
    id: 'erd',
    title: 'ERD Visualizer',
    description: 'Turn a schema description into an entity relationship diagram.',
    field: graphPulse,
    route: '/erd',
  },
  {
    id: 'complexity',
    title: 'Code Complexity',
    description: 'Paste code and get its Big-O complexity line by line.',
    field: codeRain,
    route: '/algo/code-complexity',
  },
  {
    id: 'recurrence',
    title: 'Recurrence Relation',
    description: 'Solve recurrences and follow the substitution steps.',
    field: spiralZoom,
    route: '/algo/recurrence-relation',
  },
  {
    id: 'grades',
    title: 'Grade Toolkit',
    description: 'Work out your CPA and see what each module does to it.',
    field: barMeter,
    route: '/tools/grade-toolkit',
  },
]

export const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]))

// Grade Toolkit is the only genuinely course-agnostic tool — CPA arithmetic is
// the same whatever you're studying, which is also why it gets its own
// standalone card on the home page. Every other tool here is a computer-science
// artefact (B+ trees, ER diagrams, Big-O, recurrence relations), so showing
// them under Mathematics with CS or Data Science advertised things those
// courses don't cover.
const DEFAULT_COURSE_TOOL_IDS = ['grades']

// Per-course tool sets, keyed by `courses.id`. A course not listed here gets
// DEFAULT_COURSE_TOOL_IDS — the conservative direction: a new course shows the
// one tool that's always applicable rather than inheriting the CS toolset by
// accident.
const COURSE_TOOL_IDS = {
  'computer-science': ['btree', 'erd', 'complexity', 'recurrence', 'grades'],
}

/**
 * The tool cards a course's landing page should show, in registry order.
 *
 * Unknown ids in the mapping are dropped rather than rendered as blanks, so a
 * typo here can't crash a course page — it just omits that card.
 */
export function toolsForCourse(courseId) {
  const ids = COURSE_TOOL_IDS[courseId] ?? DEFAULT_COURSE_TOOL_IDS
  return ids.map((id) => TOOL_BY_ID.get(id)).filter(Boolean)
}
