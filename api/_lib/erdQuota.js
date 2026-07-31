// Rate limiting and response caching for the ERD generator.
//
// Lives under api/_lib/ rather than api/ so Vercel does not expose it as a route.
//
// Degradation is deliberate and asymmetric:
//   - Supabase not configured -> skip both. The tool still works, protected only
//     by the input gate. Better than being permanently unusable because an env
//     var was never set.
//   - Supabase configured but erroring -> fail CLOSED on the limiter. Refusing
//     is safe here because the client falls back to the manual copy/paste flow,
//     so the student is never stuck, and the quota cannot leak while the counter
//     is blind.
//   - Cache errors are always non-fatal; the worst case is spending a call we
//     could have avoided.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { scenarioCacheKey } from '../../src/lib/erdScenarioGuard.js'

// Generous by default: campus networks put a whole cohort behind one NAT address,
// so this bounds abuse without punishing a lab full of students.
export const HOURLY_LIMIT = Number(process.env.ERD_HOURLY_LIMIT ?? 15)
export const WINDOW = process.env.ERD_RATE_WINDOW ?? '1 hour'

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY

// Salt keeps the stored hash from being reversible via a rainbow table of the
// IPv4 space, which is small enough to enumerate outright.
const SALT = process.env.ERD_HASH_SALT ?? SECRET ?? ''

let client = null
export function quotaClient() {
  if (!URL || !SECRET) return null
  if (!client) client = createClient(URL, SECRET, { auth: { persistSession: false } })
  return client
}

export const quotaConfigured = () => Boolean(URL && SECRET)

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

/**
 * Stable per-caller key. Vercel puts the real client address first in
 * x-forwarded-for; everything after it is proxy chain and is attacker-controlled,
 * so only the first entry is trusted.
 */
export function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded ?? '').split(',')[0]
  const ip = (first || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').trim()
  return sha256(`${SALT}:${ip}`)
}

export const cacheKeyFor = (question) => sha256(scenarioCacheKey(question))

/**
 * @returns {Promise<{ allowed: boolean, remaining: number|null, resetsAt: string|null, skipped?: boolean }>}
 */
export async function checkRateLimit(req) {
  const db = quotaClient()
  if (!db) return { allowed: true, remaining: null, resetsAt: null, skipped: true }

  const { data, error } = await db.rpc('erd_check_and_increment', {
    p_client_key: clientKey(req),
    p_limit: HOURLY_LIMIT,
    p_window: WINDOW,
  })

  if (error) {
    console.error(`[gemini] rate limit check failed, refusing: ${error.message}`)
    return { allowed: false, remaining: 0, resetsAt: null, errored: true }
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean(row?.allowed),
    remaining: row?.remaining ?? null,
    resetsAt: row?.resets_at ?? null,
  }
}

export async function readCache(question) {
  const db = quotaClient()
  if (!db) return null

  const { data, error } = await db
    .from('erd_cache')
    .select('response_text, model, hit_count')
    .eq('cache_key', cacheKeyFor(question))
    .maybeSingle()

  if (error || !data) return null

  // Fire and forget: a failed hit-count bump must not cost the user their answer
  db.from('erd_cache')
    .update({ hit_count: (data.hit_count ?? 0) + 1 })
    .eq('cache_key', cacheKeyFor(question))
    .then(undefined, () => {})

  return { text: data.response_text, model: data.model }
}

export async function writeCache(question, text, model) {
  const db = quotaClient()
  if (!db) return
  const { error } = await db
    .from('erd_cache')
    .upsert({ cache_key: cacheKeyFor(question), response_text: text, model }, { onConflict: 'cache_key' })
  if (error) console.error(`[gemini] cache write failed (non-fatal): ${error.message}`)
}
