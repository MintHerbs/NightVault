/**
 * Which quip a route arrival deserves, if any.
 *
 * Route-driven rather than wired into each tool page: ten tools would mean ten
 * near-identical edits, and an eleventh tool would silently get no reaction
 * until someone remembered. App.jsx watches location and asks here.
 *
 * The tool half of the table is built from the TOOLS registry itself, so a
 * route renamed in src/constants/tools.js cannot leave a stale copy behind
 * here. The matching itself lives in routeMatch.js, which has no imports and
 * is therefore testable without a bundler.
 */
import { TOOLS } from '../../constants/tools'
import { buildToolRouteIndex, matchRouteQuip } from './routeMatch'

const TOOL_ROUTES = buildToolRouteIndex(TOOLS)

/**
 * @param {string} pathname
 * @param {string} [search] - location.search, including the leading '?'
 * @returns {{ kind: string, id: string } | null}
 */
export function routeQuipContext(pathname, search) {
  return matchRouteQuip(TOOL_ROUTES, pathname, search)
}
