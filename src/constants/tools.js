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
