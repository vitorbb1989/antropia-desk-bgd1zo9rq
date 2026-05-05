import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

// Reads a required env var without ever logging its value. Returns null if missing.
// Callers must handle null by returning a generic 500 — never leak which var is missing.
function readSecret(name: string): string | null {
  const v = Deno.env.get(name)
  return v && v.length > 0 ? v : null
}

function serverMisconfigured(): Response {
  // Generic message — never name the missing secret in the response.
  return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Verify that the request has a valid cron secret.
 * Used by scheduled/cron edge functions (check-sla, generate-reports).
 */
export function verifyCronSecret(req: Request): Response | null {
  const expectedSecret = readSecret('CRON_SECRET')
  if (!expectedSecret) return serverMisconfigured()

  const cronSecret = req.headers.get('x-cron-secret')
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
  const supabaseUrl = readSecret('SUPABASE_URL')
  const supabaseServiceKey = readSecret('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) return serverMisconfigured()

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.replace('Bearer ', '')

  // Verify the JWT using the service role client.
  // Wrap in try/catch to ensure no Supabase error message ever bubbles out
  // verbatim — defense in depth against accidental secret echoing in errors.
  let supabase
  let user
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    user = data.user
  } catch {
    // Do NOT log the caught error: it could include connection strings/headers.
    return serverMisconfigured()
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
