// Client for the server-side ERD generation endpoint.
//
// The API key is held by /api/gemini and never reaches the browser (issue #12).
// This module only ever sends the user's scenario text.

import { parseERD } from './erdParser.js'

const ENDPOINT = '/api/gemini'

// Errors where retrying the same request would fail the same way, so the UI
// should offer the manual copy/paste flow instead of a retry button.
const TERMINAL_CODES = new Set(['no_key', 'quota', 'forbidden'])

/**
 * Generates an ERD from a scenario description.
 * @param {string} question - The user's description of their ER scenario
 * @returns {Promise<{success: true, data: Object} | {success: false, error: string, code: string, terminal: boolean}>}
 */
export async function generateERD(question) {
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    })
  } catch {
    // Offline, blocked, or the endpoint does not exist — the case in `vite dev`,
    // where serverless functions are not served. Manual flow is the way through.
    return {
      success: false,
      error: 'Could not reach the generator',
      code: 'network',
      terminal: true,
    }
  }

  // A 404 here means the function is not deployed; treat it like any other
  // unavailability rather than surfacing an HTML error page to the user.
  if (response.status === 404) {
    return {
      success: false,
      error: 'Automatic generation is unavailable',
      code: 'not_deployed',
      terminal: true,
    }
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    return {
      success: false,
      error: 'The generator returned an unreadable response',
      code: 'bad_response',
      terminal: true,
    }
  }

  if (!response.ok) {
    const code = payload.code ?? 'upstream'
    return {
      success: false,
      error: payload.error ?? 'Generation failed',
      code,
      terminal: TERMINAL_CODES.has(code),
    }
  }

  // Strip markdown fences. responseMimeType should prevent these, but models
  // still emit them often enough that dropping them is cheaper than a retry.
  const text = String(payload.text ?? '')
    .replace(/^```json\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .replace(/```/g, '')
    .trim()

  const parsed = parseERD(text)
  if (!parsed.valid) {
    // The model answered but broke the schema. Worth one retry, so not terminal.
    return {
      success: false,
      error: `The generated diagram was malformed: ${parsed.error}`,
      code: 'invalid_schema',
      terminal: false,
    }
  }

  return { success: true, data: parsed.data }
}
