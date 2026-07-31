// Cheap quality gate for ERD scenario text.
//
// Shared deliberately: the client runs it for instant feedback, the server runs
// it again as the authority. A client-only check is bypassable by posting
// straight to /api/gemini, which is the lesson T-078 already paid for.
//
// This does not try to detect "is this a real ER scenario" — that needs the
// model. It only rejects input that obviously cannot be one, so keyboard mash
// never reaches a metered API call. Rate limiting is the actual defence; this
// just makes the cheap attacks free to reject.
//
// Thresholds are deliberately loose. "Students enrol in courses." is a real
// four-word scenario, so anything stricter refuses legitimate work to catch
// spam that the rate limiter already bounds. False rejections cost a student
// their diagram; a false accept costs one call out of an hourly allowance.

export const MIN_CHARS = 15
export const MAX_CHARS = 4000
export const MIN_WORDS = 4
export const MIN_UNIQUE_WORDS = 3
export const MIN_UNIQUE_RATIO = 0.4

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu

export function scenarioWords(text) {
  return String(text ?? '').toLowerCase().match(WORD) ?? []
}

/**
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function validateScenario(raw) {
  const text = String(raw ?? '').trim()

  if (!text) {
    return { ok: false, code: 'bad_request', error: 'Describe your scenario first.' }
  }
  if (text.length > MAX_CHARS) {
    return { ok: false, code: 'too_long', error: `Keep the scenario under ${MAX_CHARS} characters.` }
  }
  if (text.length < MIN_CHARS) {
    return { ok: false, code: 'too_short', error: 'That is too short to build a diagram from. Describe the entities and how they relate, in a sentence or two.' }
  }

  const words = scenarioWords(text)
  if (words.length < MIN_WORDS) {
    return { ok: false, code: 'too_few_words', error: `Use at least ${MIN_WORDS} words so there is something to model.` }
  }

  // Word count alone is trivially passed by repeating one word, so the real
  // test is how much distinct vocabulary is present.
  const unique = new Set(words)
  if (unique.size < MIN_UNIQUE_WORDS || unique.size / words.length < MIN_UNIQUE_RATIO) {
    return { ok: false, code: 'low_variety', error: 'That looks like repeated or random text. Describe your scenario in plain English.' }
  }

  // Real prose carries several multi-letter words; "a a b c d e" and "aaaa bbbb"
  // both clear the checks above.
  const substantial = [...unique].filter(w => w.length >= 3 && /\p{L}/u.test(w))
  if (substantial.length < 3) {
    return { ok: false, code: 'low_variety', error: 'That looks like repeated or random text. Describe your scenario in plain English.' }
  }

  // A long run of one character ("aaaaaaaaaa...") survives tokenising as a
  // single word but is never a scenario.
  if (/(.)\1{9,}/u.test(text)) {
    return { ok: false, code: 'low_variety', error: 'That looks like repeated or random text. Describe your scenario in plain English.' }
  }

  return { ok: true }
}

/**
 * Normalised form used as the cache key, so trivial edits (case, spacing,
 * trailing punctuation) reuse a previous answer instead of spending a call.
 */
export function scenarioCacheKey(raw) {
  return scenarioWords(raw).join(' ')
}
