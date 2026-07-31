// Vercel serverless function: generates ERD JSON from a scenario description.
//
// The Gemini key lives here and never reaches the browser (issue #12). The
// endpoint deliberately accepts a *scenario*, not a prompt: building the prompt
// server-side keeps this from being usable as a general-purpose LLM proxy on
// the project's quota.

import { buildERDPrompt } from '../src/lib/erdPromptBuilder.js'
import { ERD_RESPONSE_SCHEMA } from '../src/lib/erdResponseSchema.js'
import { validateScenario } from '../src/lib/erdScenarioGuard.js'
import { parseERD } from '../src/lib/erdParser.js'
import { checkRateLimit, readCache, writeCache } from './_lib/erdQuota.js'

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'

// Pinned rather than an alias like gemini-flash-lite-latest: aliases float to new
// versions without warning, which would silently change behaviour under a prompt
// that has been tuned against this one.
const MODEL = 'gemini-3.5-flash-lite'

const TIMEOUT_MS = 25000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    // 503 rather than 500: the client treats this as "use the manual flow"
    return res.status(503).json({ error: 'Generation is not configured', code: 'no_key' })
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''

  // Authoritative copy of the check the client also runs. Keyboard mash and
  // repeated-word padding are rejected before they cost a metered call.
  const gate = validateScenario(question)
  if (!gate.ok) {
    return res.status(400).json({ error: gate.error, code: gate.code })
  }

  // Cache before quota: serving a stored answer spends nothing, so it should not
  // consume the caller's allowance either.
  const cached = await readCache(question)
  if (cached) {
    return res.status(200).json({ text: cached.text, model: cached.model, cached: true })
  }

  const quota = await checkRateLimit(req)
  if (!quota.allowed) {
    res.setHeader('Retry-After', '3600')
    return res.status(429).json({
      error: quota.errored
        ? 'Generation is temporarily unavailable'
        : 'You have made too many diagrams in a row. Try again later, or use your own LLM below.',
      code: quota.errored ? 'upstream' : 'rate_limited',
      resetsAt: quota.resetsAt ?? undefined,
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // Structured output constrains the enums at decode time, so "multi_valued" or a
  // cardinality of "many" cannot come back at all. Sent as a separate first
  // attempt rather than unconditionally: a responseSchema the API dislikes fails
  // the whole call with a 400, and that would take ERD generation down for a
  // field we could not verify against the live API when it was written. On a 400
  // we retry once without it, which is exactly the behaviour we had before.
  const call = (useSchema) => fetch(`${API_ROOT}/models/${MODEL}:generateContent`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'x-goog-api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildERDPrompt(question) }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        ...(useSchema ? { responseSchema: ERD_RESPONSE_SCHEMA } : {}),
      },
    }),
  })

  try {
    let upstream = await call(true)
    let body = await upstream.json().catch(() => ({}))

    if (upstream.status === 400) {
      console.error(`[gemini] responseSchema rejected: ${body?.error?.message ?? 'no message'}; retrying without it`)
      upstream = await call(false)
      body = await upstream.json().catch(() => ({}))
    }

    if (!upstream.ok) {
      // Google echoes the API key back inside some error messages, so never
      // forward the upstream text to the client verbatim.
      const status = upstream.status
      const code = status === 429 ? 'quota' : status === 403 ? 'forbidden' : 'upstream'
      console.error(`[gemini] upstream ${status}: ${body?.error?.message ?? 'no message'}`)
      return res.status(status === 429 ? 429 : 502).json({
        error: status === 429
          ? 'The daily free generation limit has been reached'
          : 'The generation service is unavailable',
        code,
      })
    }

    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .map(p => p.text)
      .filter(Boolean)
      .join('')
      .trim()

    if (!text) {
      const reason = body.candidates?.[0]?.finishReason ?? 'unknown'
      console.error(`[gemini] empty response, finishReason=${reason}`)
      return res.status(502).json({ error: 'The model returned an empty response', code: 'empty' })
    }

    // Only cache what actually parses. Storing an unvalidated response would
    // turn one bad generation into a permanent failure for that scenario, since
    // every later request would be served the same broken JSON. The client is
    // still free to retry an unparseable answer — it just never becomes sticky.
    if (parseERD(text).valid) {
      await writeCache(question, text, MODEL)
    } else {
      console.error('[gemini] response did not parse; not caching')
    }

    return res.status(200).json({ text, model: MODEL })
  } catch (err) {
    const aborted = err.name === 'AbortError'
    console.error(`[gemini] ${aborted ? 'timeout' : 'error'}: ${err.message}`)
    return res.status(aborted ? 504 : 502).json({
      error: aborted ? 'Generation timed out' : 'The generation service is unavailable',
      code: aborted ? 'timeout' : 'network',
    })
  } finally {
    clearTimeout(timeout)
  }
}
