/**
 * Sidebar registry — CODE-DEFINED tool routes only. Subject STRUCTURE
 * (id/label/icon/order/hidden) moved to the Supabase `sidebar_modules` table
 * (2026-07-24) — a Subject is admin-managed content now, not a code change.
 * `useNotesRegistry`/`useAdminModulesRegistry` fetch Subjects from the DB,
 * resolve each `icon_name` to a live component via `getIconOptionByName`
 * (adminIconOptions.js), attach `tools` from MODULE_TOOLS below by id, then
 * merge in notes/folders exactly as before. This file must stay free of both
 * `notes[]` arrays AND a hardcoded Subject list.
 *
 * To add new items:
 *
 *   • Tool inside an existing module — append to that module's entry in
 *     MODULE_TOOLS below (built-in app features only; never admin-editable).
 *   • Note inside an existing module — create it in the admin editor; it is
 *     saved to the `notes` table (module_id + path) and appears here
 *     automatically. The URL is `/notes/<module-id>/<path>`.
 *   • Whole new Subject — create it in the admin panel (owner-only). It's a
 *     `sidebar_modules` row, not a code change; add a MODULE_TOOLS entry
 *     separately if it should carry a built-in tool.
 *   • Standalone tool (below the divider) — append to STANDALONE_TOOLS.
 *
 * Conventions:
 *   • `id`      kebab-case identifier — used in URLs and as React keys.
 *   • `route`   must exist in src/routes/index.jsx; clicking navigates here.
 *   • `label`   user-facing string. The ".js" suffix on tools matches the
 *               expanded sidebar's "file tree" visual metaphor.
 *
 * Routing: a module is "active" when the current pathname's first segment
 * matches any of its tools' first segments (e.g. `/algo/anything` activates
 * the module whose tool route starts with `/algo`). Notes addressed under
 * `/notes/<module-id>/...` also activate that module.
 */

import {
  Calculator,
  FileCode,
  FileJs,
} from '@phosphor-icons/react'

// ── Built-in tool routes, by Subject id ─────────────────────────────────────
// Only Subjects with an actual coded feature need an entry here — everything
// else renders as a greyed "coming soon" icon once merged with its DB row.

export const MODULE_TOOLS = {
  algorithms: [
    { id: 'complexity', label: 'Code Complexity.js',     route: '/algo/code-complexity' },
    { id: 'recurrence', label: 'Recurrence Relation.js', route: '/algo/recurrence-relation' },
  ],
  'artificial-intelligence': [
    { id: 'truth-tree',        label: 'Truth Tree.js',        route: '/logic/truth-tree' },
    { id: 'semantic-tableaux', label: 'Semantic Tableaux.js', route: '/logic/semantic-tableaux' },
  ],
  database: [
    { id: 'btree', label: 'B+ Tree.js',        route: '/tree' },
    { id: 'erd',   label: 'ERD Visualizer.js', route: '/erd' },
  ],
}

// ── Standalone tools (below the divider) ────────────────────────────────────

export const STANDALONE_TOOLS = [
  {id: 'Home', label: 'homePage.js', Icon: FileJs, route: '/home' },
  { id: 'grades', label: 'Grade Toolkit.js', Icon: Calculator, route: '/tools/grade-toolkit' },
]

// ── Easter-egg pinned at the divider ────────────────────────────────────────

export const PACKAGE_JSON = { id: 'package-json', label: 'package.json', Icon: FileCode }

// ── Breadcrumb abbreviations ────────────────────────────────────────────────

export const MODULE_ABBREV = {
  'home':                    'home',
  'computer-science':        'CS',        // root label
  'algorithms':              'Algo',
  'artificial-intelligence': 'AI',
  'database':                'DB',
  'math':                    'Math',
  'computer-architecture':   'CA',
  'computer-networking':     'CN',
  'computer-security':       'CompSec',
  'computer-vision':         'CV',
  'operating-systems':       'OS',
  'programming':             'Prog',
  'software-engineering':    'SEPM',
  'miscellaneous':           'Misc',
  'notes':                   'notes',
  'labs':                    'labs',
  'tools':                   'tools',
}

// ── Derived helpers — components consume these, not the raw arrays ──────────

/** First tool of a module, or null if it has none. */
export function primaryTool(module) {
  return module.tools?.[0] ?? null
}

/** Whether a module has at least one tool or note (i.e. is renderable in the expanded view). */
export function hasContent(module) {
  return (module.tools?.length ?? 0) + (module.notes?.length ?? 0) > 0
}

/** Build the URL for a note. Mirrors src/pages/notes/NotesPage.jsx routing. */
export function noteRoute(moduleId, filename) {
  return `/notes/${moduleId}/${filename}`
}

/** Find the module id that owns the given pathname, or null. Returns just
 * `{ id }` — callers only ever need the id (to match against the DB-fetched
 * module list), never label/Icon, so this stays code-only and doesn't need
 * the DB. A `/notes/<id>/...` pathname is trusted as-is (Subject ids are DB
 * rows now, not statically known here); a tool-route pathname is resolved
 * against MODULE_TOOLS. */
export function findActiveModule(pathname) {
  if (pathname.startsWith('/notes/')) {
    const id = pathname.split('/')[2]
    return id ? { id } : null
  }
  const seg = firstSegment(pathname)
  if (!seg) return null
  for (const [id, tools] of Object.entries(MODULE_TOOLS)) {
    if (tools.some((t) => firstSegment(t.route) === seg)) return { id }
  }
  return null
}

function firstSegment(pathname) {
  return pathname.split('/').filter(Boolean)[0] ?? null
}
