// ERD's view of the shared generation quota.
//
// The implementation moved to generationQuota.js when a second generating tool
// arrived (T-089). This file stays as ERD's binding of it so api/gemini.js and
// its tests keep the exact call signatures they had, and so the `tool` argument
// cannot be forgotten at a call site and silently share FSM's allowance.
//
// ERD's hash inputs are unchanged, so its cache entries and rate windows
// survived the move.

import {
  checkRateLimit as check,
  readCache as read,
  writeCache as write,
  cacheKeyFor as keyFor,
  clientKey as callerKey,
} from './generationQuota.js'

export { HOURLY_LIMIT, WINDOW, quotaClient, quotaConfigured } from './generationQuota.js'

const TOOL = 'erd'

export const clientKey = (req) => callerKey(req, TOOL)
export const cacheKeyFor = (question) => keyFor(question, TOOL)
export const checkRateLimit = (req) => check(req, TOOL)
export const readCache = (question) => read(question, TOOL)
export const writeCache = (question, text, model) => write(question, text, model, TOOL)
