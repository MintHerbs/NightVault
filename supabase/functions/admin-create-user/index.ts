import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

    // Only an 'owner' can create accounts (matches T-051's role matrix — an
    // 'admin' can remove a contributor but never create anyone). Whether
    // that owner is course-locked or the primary owner is resolved below via
    // the verified JWT email, not this role check alone.
    if (profileError || profile?.role !== 'owner') {
      return json({ error: 'Only owners can create users' }, 403)
    }

    // Verified identity claim, not the editable admin_users.email column —
    // same distinction 0022/0024 draw for the delete lockdown.
    const isPrimaryOwner = callerData.user.email === 'moon@mooner.dev'

    const { email, password, username, role, allowedDirectories, courseId } = await req.json()

    if (!email || !password || !username || !role) {
      return json({ error: 'Missing required fields' }, 400)
    }

    if (!['owner', 'admin', 'contributor'].includes(role)) {
      return json({ error: 'Invalid role' }, 400)
    }

    // Only the primary owner creates an 'owner' (T-051 spec §5) — a
    // course-locked owner creates admins/contributors for their own course
    // only.
    if (role === 'owner' && !isPrimaryOwner) {
      return json({ error: 'Only the primary owner can create an owner' }, 403)
    }

    // The primary owner may target any course (e.g. a brand-new course's
    // first owner); every other caller is forced onto their own course_id
    // regardless of what the request body claims, so an owner can never
    // plant an account in a course they don't own.
    const targetCourseId = isPrimaryOwner && courseId ? courseId : profile.course_id

    if (role === 'contributor' && (!Array.isArray(allowedDirectories) || allowedDirectories.length === 0)) {
      return json({ error: 'Contributors must have at least one allowed directory' }, 400)
    }

    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return json({ error: createError.message }, 400)
    }

    const { error: insertError } = await adminClient
      .from('admin_users')
      .insert({
        id: authData.user.id,
        username,
        role,
        course_id: targetCourseId,
        allowed_directories: role === 'contributor' ? allowedDirectories : [],
      })

    if (insertError) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return json({ error: insertError.message }, 400)
    }

    return json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username,
        role,
        course_id: targetCourseId,
        allowed_directories: role === 'contributor' ? allowedDirectories : [],
      },
    })
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
