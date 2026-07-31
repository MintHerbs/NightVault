// Exercises api/gemini.js against a mocked fetch.
//
// The endpoint sends a responseSchema, which could not be verified against the
// live API when it was written (the key's service account was disabled), so the
// wiring and its 400 fallback are pinned here instead. Run via npm run test:erd.
import handler from '../../../api/gemini.js'

process.env.GEMINI_API_KEY = 'test-key'
let fail = 0
const check = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fail++ }

function mockRes() {
  const r = { statusCode: null, payload: null, headers: {} }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.payload = b; return r }
  r.setHeader = (k, v) => { r.headers[k] = v }
  return r
}
const okBody = { candidates: [{ content: { parts: [{ text: '{"entities":[]}' }] } }] }
const req = { method: 'POST', body: { question: 'A club has members.' } }

// 1. Happy path: schema is sent on the first call.
{
  const calls = []
  global.fetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body))
    return { ok: true, status: 200, json: async () => okBody }
  }
  const res = mockRes()
  await handler(req, { ...res, status: res.status, json: res.json, setHeader: res.setHeader })
  console.log('Case 1: normal generation')
  check(calls.length === 1, 'exactly one upstream call')
  check(!!calls[0]?.generationConfig?.responseSchema, 'responseSchema present on the first call')
  check(calls[0]?.generationConfig?.responseMimeType === 'application/json', 'responseMimeType still set')
  const schema = calls[0].generationConfig.responseSchema
  check(schema.properties?.relationships?.items?.properties?.participants?.items?.properties?.cardinality?.enum?.includes('P'),
    'cardinality enum reaches the wire with P')
  check(res.statusCode === 200 && res.payload?.text === '{"entities":[]}', 'returns 200 with the model text')
}

// 2. A 400 on the schema must fall back to a schema-less retry.
{
  const calls = []
  global.fetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body))
    if (calls.length === 1) {
      return { ok: false, status: 400, json: async () => ({ error: { message: 'Invalid JSON payload: responseSchema' } }) }
    }
    return { ok: true, status: 200, json: async () => okBody }
  }
  const res = mockRes()
  await handler(req, res)
  console.log('Case 2: responseSchema rejected with 400')
  check(calls.length === 2, 'retried once')
  check(!!calls[0]?.generationConfig?.responseSchema, 'first attempt carried the schema')
  check(!calls[1]?.generationConfig?.responseSchema, 'retry dropped the schema')
  check(res.statusCode === 200 && res.payload?.text === '{"entities":[]}', 'still returns 200 to the client')
}

// 3. Other upstream failures must NOT trigger a retry.
{
  const calls = []
  global.fetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body))
    return { ok: false, status: 429, json: async () => ({ error: { message: 'quota' } }) }
  }
  const res = mockRes()
  await handler(req, res)
  console.log('Case 3: quota error')
  check(calls.length === 1, 'no retry on 429')
  check(res.statusCode === 429 && res.payload?.code === 'quota', 'surfaces the quota code')
}

// 4. A 401 (the current real-world state) is reported, not retried.
{
  const calls = []
  global.fetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body))
    return { ok: false, status: 401, json: async () => ({ error: { message: 'service account disabled' } }) }
  }
  const res = mockRes()
  await handler(req, res)
  console.log('Case 4: disabled key (401)')
  check(calls.length === 1, 'no retry on 401')
  check(res.statusCode === 502 && res.payload?.code === 'upstream', 'mapped to a generic upstream failure')
  check(!JSON.stringify(res.payload).includes('service account'), 'upstream message not forwarded to the client')
}

console.log(fail ? `\n${fail} failure(s)` : '\nHandler behaves correctly under all four cases.')
process.exitCode = fail ? 1 : 0
