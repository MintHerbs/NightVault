/**
 * Client for the server-side FSM generation endpoint (T-089 phase 3).
 *
 * Mirrors geminiService.js: the API key is held by /api/fsm and never reaches
 * the browser, this module only ever sends the student's question, and the same
 * terminal/input error split decides whether the UI offers a retry or drops to
 * the manual copy-the-prompt flow.
 *
 * That manual flow matters more here than it looks: students revise on trains
 * and in labs with the network locked down, and `vite dev` does not serve
 * serverless functions at all. The tool must not hard-fail when /api is
 * unreachable.
 */

import { parseFSM } from './fsmParser.js'
import { validateScenario } from '../erdScenarioGuard.js'

const ENDPOINT = '/api/fsm'

// Errors where retrying the same request would fail the same way, so the UI
// should offer the manual copy/paste flow instead of a retry button.
const TERMINAL_CODES = new Set(['no_key', 'quota', 'forbidden', 'rate_limited'])

// The question itself is the problem. These must NOT drop the student into the
// manual flow; they need to stay put and edit what they typed.
const INPUT_CODES = new Set(['bad_request', 'too_long', 'too_short', 'too_few_words', 'low_variety'])

/**
 * @param {string} question
 * @returns {Promise<{success: true, fsm: Object, warnings: string[]}
 *   | {success: false, error: string, code: string, terminal: boolean, inputError?: boolean}>}
 */
export async function generateFSM(question) {
  // The same gate the server enforces, run first so obviously unusable input
  // costs no round trip. The server remains the authority.
  const gate = validateScenario(question)
  if (!gate.ok) {
    return { success: false, error: gate.error, code: gate.code, terminal: false, inputError: true }
  }

  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    })
  } catch {
    // Offline, blocked, or the endpoint does not exist, which is the case in
    // `vite dev`. The manual flow is the way through.
    return { success: false, error: 'Could not reach the generator', code: 'network', terminal: true }
  }

  // A 404 means the function is not deployed; treat it like any other
  // unavailability rather than surfacing an HTML error page.
  if (response.status === 404) {
    return { success: false, error: 'Automatic generation is unavailable', code: 'not_deployed', terminal: true }
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    return { success: false, error: 'The generator returned an unreadable response', code: 'bad_response', terminal: true }
  }

  if (!response.ok) {
    const code = payload.code ?? 'upstream'
    return {
      success: false,
      error: payload.error ?? 'Generation failed',
      code,
      terminal: TERMINAL_CODES.has(code),
      inputError: INPUT_CODES.has(code),
    }
  }

  const parsed = parseFSM(stripFences(payload.text))
  if (!parsed.valid) {
    // The model answered but broke the shape. Worth one retry, so not terminal.
    return {
      success: false,
      error: `The generated state machine was unusable: ${parsed.error}`,
      code: 'invalid_schema',
      terminal: false,
      detail: parsed.detail,
    }
  }

  return { success: true, fsm: parsed.fsm, warnings: parsed.warnings }
}

/**
 * Strips markdown fences. responseMimeType should prevent these, but models
 * still emit them often enough that dropping them is cheaper than a retry.
 */
export function stripFences(text) {
  return String(text ?? '')
    .replace(/^```json\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .replace(/```/g, '')
    .trim()
}
