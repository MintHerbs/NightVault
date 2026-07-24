import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Everything admin-managed writes to Supabase now: note content (`notes`),
// folders (`note_folders`), Subjects (`sidebar_modules`), and images (the
// `note-images` Storage bucket) — see db/sql/0020_init_notes.sql and
// db/sql/0023_sidebar_modules_and_images.sql. GitHub is reduced to a single
// optional, owner-or-contributor-triggered backup path: committing a note's
// current .md text (handleBackupToGithub in useEditorSave.js). Every other op
// this function used to expose (uploadImage, listDirectory, deleteFile,
// deleteModule, cleanupFile, getFileContent, getFileSha) is gone along with
// the client code that called them.
function isPathAllowed(path: string, role: string, allowedDirectories: string[]): boolean {
  if (role === 'owner') return true
  return allowedDirectories.some(dir => path.startsWith(`src/content/notes/${dir}/`))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    const githubOwner = Deno.env.get('GITHUB_OWNER')
    const githubRepo = Deno.env.get('GITHUB_REPO')
    const githubBranch = Deno.env.get('GITHUB_BRANCH')

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !githubToken || !githubOwner || !githubRepo || !githubBranch) {
      throw new Error('Function environment is not configured')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerData, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerData.user) {
      return json({ error: 'Not authenticated' }, 401)
    }

    const { data: profile, error: profileError } = await adminClient
      .from('admin_users')
      .select('role, allowed_directories')
      .eq('id', callerData.user.id)
      .single()

    if (profileError || !profile) {
      return json({ error: 'Not an admin user' }, 403)
    }

    const { op, path, content, message } = await req.json()

    if (!op) {
      return json({ error: 'Missing op' }, 400)
    }
    if (!path) {
      return json({ error: 'Missing path' }, 400)
    }
    if (!isPathAllowed(path, profile.role, profile.allowed_directories ?? [])) {
      return json({ error: 'Path is outside your allowed directories' }, 403)
    }

    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    }
    const contentsUrl = (p: string) =>
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${p}`

    async function fetchSha(p: string): Promise<string | null> {
      const res = await fetch(`${contentsUrl(p)}?ref=${githubBranch}`, { headers: ghHeaders })
      if (res.status === 404) return null
      const data = await res.json()
      return data.sha ?? null
    }

    switch (op) {
      case 'commitFile': {
        if (typeof content !== 'string' || !message) {
          return json({ error: 'Missing content or message' }, 400)
        }
        const sha: string | null = await fetchSha(path)
        const body = {
          message,
          content: btoa(unescape(encodeURIComponent(content))),
          branch: githubBranch,
          ...(sha ? { sha } : {}),
        }
        const res = await fetch(contentsUrl(path), { method: 'PUT', headers: ghHeaders, body: JSON.stringify(body) })
        if (!res.ok) return json({ error: `GitHub commit failed: ${res.status}` }, res.status)
        return json(await res.json())
      }

      default:
        return json({ error: `Unknown op: ${op}` }, 400)
    }
  } catch (error) {
    return json({ error: error.message || 'Unexpected error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
