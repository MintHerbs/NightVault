// Vercel serverless function: the only writer for the T-086 analytics tables.
//
// The tables created in 0052 have RLS on and no anon grants, so the browser
// cannot reach them at all. That is deliberate: they accept caller-named text
// keys, and api_calls (0003) already demonstrated where open insert RLS on a
// counter table leads — it had to be closed in 0048.
//
// This endpoint's whole job is to be the allowlist boundary. Every key is
// checked against src/lib/analytics/eventSchema.js (the same module the browser
// imports, so the two cannot drift) and anything unrecognised is dropped rather
// than stored. Invalid entries do not fail the batch: one bad key in a queued
// beacon must not discard the visitor's whole session.

import {
  ENTRY_ROUTE,
  isPageRoute,
  isRecordableRoute,
  isToolEvent,
} from '../src/lib/analytics/eventSchema.js'
import { analyticsClient, recordBatch, withinRateLimit } from './_lib/analyticsStore.js'

/** Per-bucket entry cap. A well-behaved client sends far fewer; this bounds a
 *  buggy or hostile one without needing to reject it outright. */
const MAX_ENTRIES = 200

const SESSION_RE = /^[A-Za-z0-9-]{8,64}$/
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const isSession = (value) => typeof value === 'string' && SESSION_RE.test(value)

/** Clamp a count into 1..1000, matching the clamp analytics_record() applies. */
function amount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(Math.max(Math.trunc(n), 1), 1000)
}

function asArray(value) {
  return Array.isArray(value) ? value.slice(0, MAX_ENTRIES) : []
}

/**
 * Keep only entries whose keys are on the allowlist.
 *
 * Exported for src/test/analytics/test-analytics-handler.mjs: this is the actual
 * trust boundary, so it is worth testing directly rather than only through a
 * mocked Supabase client.
 *
 * @returns {{ batch: object, accepted: number, dropped: number }}
 */
export function sanitise(body) {
  let accepted = 0
  let dropped = 0

  const keep = (list, validate, build) => {
    const out = []
    for (const entry of asArray(list)) {
      if (entry && typeof entry === 'object' && validate(entry)) {
        out.push(build(entry))
        accepted += 1
      } else {
        dropped += 1
      }
    }
    return out
  }

  const pages = keep(
    body?.pages,
    (e) => isRecordableRoute(e.route_key) && isSession(e.session_id),
    (e) => ({ route_key: e.route_key, session_id: e.session_id, hits: amount(e.hits) }),
  )

  const notes = keep(
    body?.notes,
    (e) => typeof e.note_id === 'string' && UUID_RE.test(e.note_id) && isSession(e.session_id),
    (e) => ({ note_id: e.note_id, session_id: e.session_id, hits: amount(e.hits) }),
  )

  // Stricter than isRecordableRoute on purpose: an alias is a redirect source,
  // never somewhere a visitor navigated from or to, so letting one into an edge
  // would insert a hop that never happened. The tracker does not send them; this
  // is the check that makes that a guarantee rather than a convention.
  const transitions = keep(
    body?.transitions,
    (e) => (e.from_route === ENTRY_ROUTE || isPageRoute(e.from_route)) && isPageRoute(e.to_route),
    (e) => ({ from_route: e.from_route, to_route: e.to_route, count: amount(e.count) }),
  )

  const tools = keep(
    body?.tools,
    (e) => isToolEvent(e.tool_key, e.event_key) && isSession(e.session_id),
    (e) => ({
      tool_key: e.tool_key,
      event_key: e.event_key,
      session_id: e.session_id,
      count: amount(e.count),
    }),
  )

  return { batch: { pages, notes, transitions, tools }, accepted, dropped }
}

/** sendBeacon posts a Blob, which Vercel does not always pre-parse into an
 *  object the way it does a JSON fetch. Handle both shapes. */
function readBody(req) {
  const raw = req.body
  if (!raw) return null
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw
  try {
    return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw))
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Unconfigured is a no-op, not an error: the site must work identically
  // whether or not analytics is switched on, and the client ignores the response
  // either way.
  if (!analyticsClient()) return res.status(204).end()

  const body = readBody(req)
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Expected a JSON batch' })
  }

  const { batch, accepted, dropped } = sanitise(body)
  if (!accepted) {
    // Nothing survived validation. 202 rather than 400: the caller cannot act
    // on this, and a client bug should not read as a server error.
    return res.status(202).json({ accepted: 0, dropped })
  }

  // Fails open when the limiter itself is unavailable (see analyticsStore.js):
  // refusing an analytics write protects nothing and loses data, so a blind
  // counter is the lesser harm.
  if (!await withinRateLimit(req)) {
    return res.status(429).json({ error: 'Too many analytics flushes' })
  }

  const failure = await recordBatch(batch)
  if (failure) {
    console.error(`[analytics] record failed: ${failure}`)
    return res.status(502).json({ error: 'Could not record analytics' })
  }

  return res.status(202).json({ accepted, dropped })
}
