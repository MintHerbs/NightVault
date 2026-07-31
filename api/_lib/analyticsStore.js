// Service-role access for the analytics endpoint (T-086).
//
// Lives under api/_lib/ rather than api/ so Vercel does not expose it as a route.
//
// Deliberately self-contained rather than reusing erdQuota.js's client and IP
// hashing. Sharing them would have saved ~25 lines and coupled analytics to the
// ERD feature's module and to 0051's erd_rate_limits table — so ERD's quota
// schema would have to be applied before analytics could rate limit, and a
// change to either feature's limiter would move the other. The duplication is
// the cheaper of the two.
//
// Degradation is uniform and deliberate: every failure here is non-fatal.
// Analytics that refuses to record protects nothing, unlike the ERD limiter
// which fails closed to protect a metered third-party quota.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

// Generous: a session flushes a handful of times, and campus networks put a
// whole cohort behind one NAT address, so this bounds a runaway client without
// punishing a lab full of students.
export const HOURLY_LIMIT = Number(process.env.ANALYTICS_HOURLY_LIMIT ?? 240)
export const WINDOW = process.env.ANALYTICS_RATE_WINDOW ?? '1 hour'

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY

// Without a salt the stored hash is reversible by enumerating the IPv4 space,
// which is small enough to walk outright.
const SALT = process.env.ANALYTICS_HASH_SALT ?? SECRET ?? ''

let client = null

/** Service-role client, or null when analytics is not configured. */
export function analyticsClient() {
  if (!URL || !SECRET) return null
  if (!client) client = createClient(URL, SECRET, { auth: { persistSession: false } })
  return client
}

export const analyticsConfigured = () => Boolean(URL && SECRET)

/**
 * Stable per-caller key. Vercel puts the real client address first in
 * x-forwarded-for; everything after it is proxy chain and is attacker-controlled,
 * so only the first entry is trusted. Only the hash is ever stored.
 */
export function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded ?? '').split(',')[0]
  const ip = (first || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').trim()
  return createHash('sha256').update(`${SALT}:${ip}`).digest('hex')
}

/**
 * @returns {Promise<boolean>} false only when the caller is definitively over
 *   the limit. An unavailable limiter returns true — see the header.
 */
export async function withinRateLimit(req) {
  const db = analyticsClient()
  if (!db) return true
  try {
    const { data, error } = await db.rpc('analytics_check_and_increment', {
      p_client_key: clientKey(req),
      p_limit: HOURLY_LIMIT,
      p_window: WINDOW,
    })
    if (error) return true
    const row = Array.isArray(data) ? data[0] : data
    return row?.allowed !== false
  } catch {
    return true
  }
}

/**
 * @returns {Promise<string|null>} an error message, or null on success.
 */
export async function recordBatch(batch) {
  const db = analyticsClient()
  if (!db) return null
  const { error } = await db.rpc('analytics_record', { p_batch: batch })
  return error ? error.message : null
}
