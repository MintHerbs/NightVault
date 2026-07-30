#!/usr/bin/env node
// Smoke test for the Gemini API key.
//
// Checks, in order:
//   1. a key is present in the environment
//   2. the key is accepted by ListModels
//   3. a real generateContent call returns text (and how many tokens it cost)
//
// Usage:
//   npm run test:gemini
//   npm run test:gemini -- --model gemini-2.5-flash
//   npm run test:gemini -- --all      # one call per free-tier flash model
//
// Requires Node 20+ for --env-file-if-exists (nvm use 22).

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

// Model the app actually ships with, see src/lib/geminiService.js
const DEFAULT_MODEL = 'gemini-2.0-flash-lite';

const args = process.argv.slice(2);
const wantAll = args.includes('--all');
const modelArg = args[args.indexOf('--model') + 1];
const model = args.includes('--model') && modelArg ? modelArg : DEFAULT_MODEL;

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

function ok(msg) { console.log(`\x1b[32m✓\x1b[0m ${msg}`); }
function bad(msg) { console.log(`\x1b[31m✗\x1b[0m ${msg}`); }
function info(msg) { console.log(`  ${msg}`); }

if (!apiKey) {
  bad('No API key found. Set GEMINI_API_KEY in .env or .env.local.');
  process.exit(1);
}
ok(`Key found (${apiKey.length} chars, ends "…${apiKey.slice(-4)}")`);

// Key travels in a header rather than the query string so it stays out of
// URLs, proxy logs and shell history.
async function call(path, init = {}) {
  const started = Date.now();
  const res = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      'x-goog-api-key': apiKey,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const ms = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  return { res, body, ms };
}

// Google echoes the raw key back inside some error messages ("Consumer
// 'api_key:AQ.…' has been suspended"), so scrub it before anything is printed.
function redact(text) {
  return text.split(apiKey).join(`…${apiKey.slice(-4)}`);
}

function explain(status, body) {
  const message = redact(body?.error?.message || `HTTP ${status}`);
  if (status === 400) return `${message} (malformed key or request)`;
  if (status === 403) return `${message} (key rejected, or Generative Language API not enabled on the project)`;
  if (status === 404) return `${message} (model name not available to this key)`;
  if (status === 429) return `${message} (quota exhausted, this is the daily/minute free-tier limit)`;
  return message;
}

// ---------------------------------------------------------------- list models

const list = await call('/models?pageSize=200');
let flash = [];

if (list.res.ok) {
  const usable = (list.body.models || []).filter((m) =>
    (m.supportedGenerationMethods || []).includes('generateContent'),
  );
  ok(`Key is valid. ${usable.length} models support generateContent (${list.ms}ms)`);

  flash = usable
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => n.includes('flash') && !n.includes('exp') && !n.includes('preview'))
    .sort();
  info(`flash models: ${flash.join(', ') || '(none)'}`);
} else {
  // Not fatal on its own: listing and generation are separate permissions, so
  // still try a real call before declaring the key dead.
  bad(`ListModels failed: ${explain(list.res.status, list.body)}`);
}

// ------------------------------------------------------------- generate calls

const targets = wantAll && flash.length > 0 ? flash : [model];
let failures = 0;

for (const name of targets) {
  const { res, body, ms } = await call(`/models/${name}:generateContent`, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with exactly: pong' }] }],
      // Budget has to clear the reasoning tokens too: on thinking models the
      // thoughts are billed against maxOutputTokens, so a tight cap returns
      // MAX_TOKENS with no text and looks like a failure that isn't one.
      generationConfig: { maxOutputTokens: 2048, temperature: 0 },
    }),
  });

  if (!res.ok) {
    failures += 1;
    bad(`${name}: ${explain(res.status, body)}`);
    continue;
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  const finish = body.candidates?.[0]?.finishReason;
  const u = body.usageMetadata || {};

  if (!text) {
    failures += 1;
    bad(`${name}: empty response (finishReason: ${finish || 'unknown'})`);
    continue;
  }

  const thoughts = u.thoughtsTokenCount ? `, ${u.thoughtsTokenCount} thinking` : '';
  ok(`${name}: "${text}" — ${ms}ms, ${u.promptTokenCount ?? '?'} in / ${u.candidatesTokenCount ?? '?'} out${thoughts} tokens`);
}

console.log('');
if (failures > 0) {
  bad(`${failures} of ${targets.length} model call(s) failed`);
  process.exit(1);
}
ok(`All ${targets.length} model call(s) succeeded. Key works.`);
info('Free-tier limits are per-model and per-minute as well as per-day; a 429 here');
info('means the quota is spent, not that the key is broken.');
