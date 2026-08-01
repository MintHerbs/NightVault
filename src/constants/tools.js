// src/constants/tools.js
//
// Single registry for the app's course-agnostic tools (T-077) — B+ Tree,
// ERD, Code Complexity, Recurrence Relation, Semantic Tableaux, Grade
// Toolkit. Previously
// duplicated between HomePage.jsx's inline TOOLS array and Sidebar/
// modules.js's MODULE_TOOLS, which had already drifted apart. Both now
// read from here; `field` is the ASCII-cover animation
// (src/lib/asciiArt/fields) each tool's card renders on the home page and
// on every course landing page.

import { graphPulse, codeRain, spiralZoom, barMeter, truthTree, latticeGrid, algebraCascade, stateOrbit, circuitPulse } from '../lib/asciiArt/fields'
import { BTREE_COVER } from './coverPresets'

/**
 * `courses: EVERY_COURSE` puts a tool on every course landing page. Only Grade
 * Toolkit qualifies — CPA arithmetic is the same whatever you're studying, which
 * is also why it gets its own standalone card on the home page. Everything else
 * here is a computer-science artefact, so advertising it under Mathematics would
 * promise things those courses don't cover.
 */
export const EVERY_COURSE = '*'

/**
 * Which course landing pages each tool appears on is declared ON the tool, not in
 * a separate id list further down. T-084 added Semantic Tableaux to this registry
 * while that second list still named the previous five ids, so the tool was
 * routable and on the home page but silently absent from
 * /courses/computer-science. A missing `courses` key is now a visible hole in the
 * entry rather than an omission in a list nobody remembers to edit.
 */
export const TOOLS = [
  {
    id: 'btree',
    title: 'B+ Tree Visualizer',
    description: 'Insert, delete, and search keys with every step animated.',
    field: BTREE_COVER,
    route: '/tree',
    courses: ['computer-science'],
  },
  {
    id: 'erd',
    title: 'ERD Visualizer',
    description: 'Turn a schema description into an entity relationship diagram.',
    field: graphPulse,
    route: '/erd',
    courses: ['computer-science'],
  },
  {
    id: 'complexity',
    title: 'Code Complexity',
    description: 'Paste code and get its Big-O complexity line by line.',
    field: codeRain,
    route: '/algo/code-complexity',
    courses: ['computer-science'],
  },
  {
    id: 'recurrence',
    title: 'Recurrence Relation',
    description: 'Solve recurrences and follow the substitution steps.',
    field: spiralZoom,
    route: '/algo/recurrence-relation',
    courses: ['computer-science'],
  },
  {
    id: 'semantic-tableaux',
    title: 'Semantic Tableaux',
    description: 'Break a formula into a truth tree and close the contradictory branches.',
    field: truthTree,
    route: '/logic/semantic-tableaux',
    courses: ['computer-science'],
  },
  // The Digital Logic Lab (T-089) used to be one "Digital Logic" tool with a
  // Mode dropdown inside it (algebra / K-map / sandbox / state machine). Each
  // mode is its own card now (owner decision) — DigitalLogicPage.jsx still
  // reads the same `?mode=` param, it just has no in-page switcher left to
  // set it, so these routes are the only way in.
  {
    id: 'boolean-algebra',
    title: 'Boolean Algebra',
    description: 'Simplify an expression step by step, with the law used at each stage.',
    field: algebraCascade,
    route: '/arch/digital-logic?mode=algebra',
    courses: ['computer-science'],
  },
  {
    id: 'truth-table-kmap',
    title: 'Truth Table & K-Map',
    description: 'Expression to truth table to K-map to circuit.',
    field: latticeGrid,
    route: '/arch/digital-logic?mode=kmap',
    courses: ['computer-science'],
  },
  {
    id: 'state-machine',
    title: 'State Machine',
    description: 'Describe a machine in English and get a synthesised sequential circuit.',
    field: stateOrbit,
    route: '/arch/digital-logic?mode=fsm',
    courses: ['computer-science'],
  },
  // Not on any course page (`courses: []`): the sandbox is a standalone
  // workbench, not a Computer Science artefact specifically, so it sits on
  // the home page instead (owner decision) — HomePage.jsx looks this entry up
  // by id directly, the same way it already does for Grade Toolkit.
  {
    id: 'circuit-sandbox',
    title: 'Circuit Sandbox',
    description: 'Build and run a circuit with gates, wires, and flip-flops.',
    field: circuitPulse,
    route: '/arch/digital-logic?mode=sandbox',
    courses: [],
  },
  {
    id: 'grades',
    title: 'Grade Toolkit',
    description: 'Work out your CPA and see what each module does to it.',
    field: barMeter,
    route: '/tools/grade-toolkit',
    courses: EVERY_COURSE,
  },
]

export const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]))

/**
 * The tool cards a course's landing page should show, in registry order.
 *
 * A course no tool has opted into gets only the EVERY_COURSE tools, which is the
 * conservative direction: a new course advertises what always applies rather than
 * inheriting the computer-science toolset by accident.
 */
export function toolsForCourse(courseId) {
  return TOOLS.filter(
    (tool) => tool.courses === EVERY_COURSE || tool.courses?.includes(courseId)
  )
}
