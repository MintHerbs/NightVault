// src/lib/analytics/adminApi.js
//
// Read side of T-086, for /admin/analytics only.
//
// The four tables from 0052 have no anon or authenticated grants, so there is no
// REST path to them: everything comes back from one analytics_dashboard() call,
// which aggregates server-side and is gated by analytics_can_view() on
// role in ('owner', 'admin'). One call rather than one per panel means every
// number on the page describes the same instant.

import { supabase } from '../supabaseClient'

/** Ranges the dashboard offers. 'days' is what the RPC takes. */
export const RANGES = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
]

export const DEFAULT_RANGE = '30d'

/** Shape returned when there is nothing yet, so panels can render empty
 *  rather than each guarding against undefined. */
export const EMPTY_DASHBOARD = {
  range: { days: 0, from: null, to: null },
  totals: {
    visitors: 0, new_visitors: 0, pageviews: 0,
    note_reads: 0, tool_uses: 0, tool_users: 0,
  },
  daily: [],
  top_pages: [],
  top_notes: [],
  tools: [],
  tool_breakdown: [],
  entry_points: [],
  flow: [],
  contributors: [],
  recent_notes: [],
}

/**
 * @param {number} days
 * @returns {Promise<typeof EMPTY_DASHBOARD>}
 */
export async function fetchDashboard(days) {
  const { data, error } = await supabase.rpc('analytics_dashboard', { p_days: days })
  if (error) throw new Error(error.message)
  // Merged into the empty shape rather than returned raw: a migration that adds
  // a panel to the function should not have to ship in lockstep with the UI,
  // and an older database simply renders that panel empty.
  return { ...EMPTY_DASHBOARD, ...(data ?? {}) }
}

/**
 * Sum of a tool's non-'open' events per engaged session — the depth figure. Kept
 * here rather than in SQL because it is a presentation choice: a tool with three
 * sessions doing fifty operations each is worth more attention than one with
 * thirty sessions doing one, and that only shows up as a ratio.
 */
export function usesPerUser(tool) {
  if (!tool || !tool.used) return 0
  return tool.uses / tool.used
}

/** Share of people who opened a tool and then actually drove it. */
export function activationRate(tool) {
  if (!tool || !tool.opened) return 0
  return tool.used / tool.opened
}
