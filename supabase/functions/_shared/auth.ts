import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

/**
 * Verify that the request has a valid cron secret.
 * Used by scheduled/cron edge functions (check-sla, generate-reports).
 */
export function verifyCronSecret(req: Request): Response | null {
  const cronSecret = req.headers.get('x-cron-secret')
  const expectedSecret = Deno.env.get('CRON_SECRET')

  if (!expectedSecret) {
    console.error('CRON_SECRET env var not set')
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return null // Auth passed
}

/**
 * Verify that the request has a valid user JWT and optionally check org membership.
 * Used by user-facing edge functions (execute-workflow, test-integration).
 * Returns the authenticated user or an error Response.
 */
export async function verifyUserAuth(
  req: Request,
  organizationId?: string,
): Promise<{ user: any; membership?: any } | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.replace('Bearer ', '')

  // Verify the JWT using the service role client
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // If organizationId is provided, verify membership
  if (organizationId) {
    const { data: membership, error: memberError } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (memberError || !membership) {
      return new Response(JSON.stringify({ error: 'Forbidden: not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return { user, membership }
  }

  return { user }
}
