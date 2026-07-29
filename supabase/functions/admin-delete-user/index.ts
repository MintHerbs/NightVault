import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// See admin-github-write/index.ts for why this reads ALLOWED_ORIGIN instead
// of hardcoding '*' — same privileged-write-behind-a-Bearer-token shape.
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Supabase function environment is not configured')
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
      .select('role, course_id')
      .eq('id', callerData.user.id)
      .single()

    if (profileError || !profile) {
      return json({ error: 'Not an admin account' }, 403)
    }

    const { userId } = await req.json()
    if (!userId) {
      return json({ error: 'Missing user id' }, 400)
    }

    if (userId === callerData.user.id) {
      return json({ error: 'You cannot delete yourself' }, 400)
    }

    const isPrimaryOwner = callerData.user.email === 'moon@mooner.dev'

    const { data: target, error: targetError } = await adminClient
      .from('admin_users')
      .select('role, course_id')
      .eq('id', userId)
      .single()

    if (targetError || !target) {
      return json({ error: 'User not found' }, 404)
    }

    // T-051 role matrix: the primary owner can remove anyone; a course owner
    // can remove an admin/contributor in their own course (never another
    // owner); an admin can remove a contributor in their own course only; a
    // contributor can't remove anyone.
    const sameCourse = target.course_id === profile.course_id
    const authorized = isPrimaryOwner
      || (profile.role === 'owner' && sameCourse && target.role !== 'owner')
      || (profile.role === 'admin' && sameCourse && target.role === 'contributor')

    if (!authorized) {
      return json({ error: 'You are not authorized to delete this user' }, 403)
    }

    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) {
      return json({ error: authError.message }, 400)
    }

    const { error: deleteError } = await adminClient
      .from('admin_users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      return json({ error: deleteError.message }, 400)
    }

    return json({ ok: true })
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
