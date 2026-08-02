/**
 * Route-to-quip matching, with no imports of its own.
 *
 * Split from routeQuips.js so the logic stays reachable from the node test
 * runner: routeQuips.js pulls in the TOOLS registry, whose own import chain
 * uses extensionless and directory specifiers that only a bundler resolves.
 * The test feeds these functions the registry parsed from source instead, so a
 * renamed route is still caught without a build step.
 */

/**
 * Reduce registry routes to the shape a live location can be compared against:
 * pathname, plus the one query param that tells the four Digital Logic tools
 * apart from each other.
 *
 * @param {Array<{ id: string, route: string }>} tools
 * @returns {Map<string, string>} route key to tool id
 */
export function buildToolRouteIndex(tools) {
  const index = new Map()
  for (const tool of tools ?? []) {
    if (!tool?.id || typeof tool.route !== 'string') continue
    const [path, query] = tool.route.split('?')
    const mode = query ? new URLSearchParams(query).get('mode') : null
    index.set(mode ? `${path}?mode=${mode}` : path, tool.id)
  }
  return index
}

/**
 * @param {Map<string, string>} toolIndex
 * @param {string} pathname
 * @param {string} [search] - location.search, including the leading '?'
 * @returns {{ kind: string, id: string } | null}
 */
export function matchRouteQuip(toolIndex, pathname, search) {
  if (typeof pathname !== 'string' || !pathname) return null

  const mode = new URLSearchParams(search || '').get('mode')
  const toolId = toolIndex.get(mode ? `${pathname}?mode=${mode}` : pathname)
  if (toolId) return { kind: 'tool', id: toolId }

  // Settings before the generic admin door: the more specific arrival is the
  // more interesting one to remark on.
  if (pathname === '/admin/settings') return { kind: 'chrome', id: 'settings' }
  if (pathname.startsWith('/admin')) return { kind: 'chrome', id: 'admin' }
  if (pathname === '/social/feed') return { kind: 'chrome', id: 'feed' }

  // Chat is deliberately absent. It opens as a panel from several places as
  // well as from its own route, so App.jsx fires it off the open flag instead
  // and catches every way in.
  return null
}
