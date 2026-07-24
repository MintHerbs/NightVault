import { supabase } from './supabaseClient'

// GitHub is now just the optional, one-file-at-a-time backup path for note
// text (handleBackupToGithub in useEditorSave.js) — note content, folders,
// Subjects, and images are all Supabase-backed (see notesApi.js,
// modulesApi.js, and the note-images Storage bucket). Proxied through the
// admin-github-write Edge Function, which verifies the caller's Supabase
// session and allowed_directories server-side before touching GitHub. No
// GitHub token or write access exists in the browser.
async function invokeGithub(payload) {
  const { data, error } = await supabase.functions.invoke('admin-github-write', { body: payload })
  if (error) {
    // FunctionsHttpError carries the original Response on `context` — read it
    // so error messages like "GitHub commit failed: 409" survive the relay
    // (commitFileWithRetry matches on the "409" substring).
    const body = error.context?.json ? await error.context.json().catch(() => null) : null
    throw new Error(body?.error || error.message || 'GitHub proxy call failed')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// ─── COMMIT TEXT FILE ───────────────────────────────────────────────────────
// Creates or updates a text file on the branch.
export async function commitFile(path, content, message) {
  return invokeGithub({ op: 'commitFile', path, content, message })
}

// ─── COMMIT WITH RETRY ──────────────────────────────────────────────────────
// Wraps commitFile with automatic retry for 409 SHA conflicts.
// A 409 means another user committed to the same file between our SHA fetch
// and our write. We retry up to 3 times with exponential backoff (500ms,
// 1000ms, 1500ms). Each retry calls commitFile fresh which re-fetches the
// latest SHA internally — no manual SHA management needed here.
// All non-409 errors are rethrown immediately without retrying.
export async function commitFileWithRetry(path, content, message) {
  let lastError
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await commitFile(path, content, message)
    } catch (err) {
      if (!err.message?.includes('409')) throw err
      lastError = err
      if (attempt === 4) break
      // Wait before retrying — gives the conflicting commit time to settle
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
  }
  throw lastError
}
