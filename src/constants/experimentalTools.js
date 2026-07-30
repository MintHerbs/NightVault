// src/constants/experimentalTools.js
//
// Registry for /experimental: tools that are built and routed, but kept off
// every public surface.
//
// Three separate things decide whether a tool is publicly visible, and a tool
// counts as experimental when it fails any of them:
//
//   1. TOOLS in src/constants/tools.js, the ASCII cards on the home page and
//      on course landing pages. Nothing below appears there.
//   2. MODULE_TOOLS in Sidebar/modules.js, the sidebar file tree grouped by
//      Subject. Hiding a Subject (the admin panel's toggle, stored as
//      `sidebar_modules.hidden` and filtered in useNotesRegistry) removes all
//      of its tools from the sidebar at once, because that flag is per
//      Subject and not per tool.
//   3. Nothing whatsoever: /logic/proof has a route and no registry entry
//      anywhere, so typing the URL has always been the only way to reach it.
//
// None of that gates the route. Every path below renders for anyone who knows
// it, since routeComponents in src/routes/academiaRoutes.jsx carries no auth
// or visibility check. This page collects those URLs in one place; it does not
// open a door that was previously shut.
//
// Deliberately not imported by tools.js, modules.js, HomePage or
// CourseLandingPage. Importing it into any of them would publish these tools.

import { latticeGrid, dataScatter, globePulse } from '../lib/asciiArt/fields'

export const EXPERIMENTAL_TOOLS = [
  {
    id: 'semantic-tableaux',
    title: 'Semantic Tableaux',
    description:
      'Break a propositional formula into a branching tree and close the contradictory branches.',
    field: latticeGrid,
    route: '/logic/semantic-tableaux',
    why: 'Hidden along with the whole Artificial Intelligence Subject. The admin hide toggle works per Subject, so this cannot be published without publishing Truth Tree too.',
  },
  {
    id: 'truth-tree',
    title: 'Truth Tree',
    description: 'The same tableau solver, reached under its truth-tree name.',
    field: dataScatter,
    route: '/logic/truth-tree',
    why: 'A second route onto the Semantic Tableaux page, hidden with the same Subject. /logic/tableaux is a third alias for it.',
  },
  {
    id: 'logic-proof',
    title: 'Logical Equivalence',
    description:
      'Run premises and a conclusion through natural deduction and read back the proof tree.',
    field: globePulse,
    route: '/logic/proof',
    why: 'In no registry at all. It has never appeared in the sidebar or on a course page, so the URL is the only way in.',
  },
]
