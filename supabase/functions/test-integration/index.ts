import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, handleCorsPreflightRequest, createCorsResponse } from '../_shared/cors.ts'
import { verifyUserAuth } from '../_shared/auth.ts'
import { isAllowedUrl } from '../_shared/ssrf-guard.ts'

function sanitizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function validateUrl(url: string, label: string): void {
  if (!url) throw new Error(`Missing ${label}`)
  if (!isAllowedUrl(url)) {
    throw new Error(`Invalid or blocked ${label}. Only public HTTPS endpoints are allowed.`)
  }
}

function okResponse(data: any): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest()
  }

  try {
    const authResult = await verifyUserAuth(req)
    if (authResult instanceof Response) return authResult

    const { provider, config } = await req.json()

    // ─── PLANKA ─────────────────────────────────────────────
    if (provider === 'PLANKA') {
      const { apiUrl, apiToken, projectId } = config
      if (!apiUrl || !apiToken) throw new Error('Missing API URL or Token')
      validateUrl(apiUrl, 'API URL')

      const baseUrl = sanitizeUrl(apiUrl)
      const res = await fetch(`${baseUrl}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to connect to Planka: ${res.status} ${res.statusText}`)
      }

      return okResponse(await res.json())
    }

    // ─── BOOKSTACK ──────────────────────────────────────────
    if (provider === 'BOOKSTACK') {
      const { apiUrl, tokenId, tokenSecret } = config
      if (!apiUrl || !tokenId || !tokenSecret) {
        throw new Error('Missing API URL, Token ID or Token Secret')
      }
      validateUrl(apiUrl, 'API URL')

      const baseUrl = sanitizeUrl(apiUrl)
      const res = await fetch(`${baseUrl}/api/books?count=1`, {
        headers: {
          Authorization: `Token ${tokenId}:${tokenSecret}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to connect to Bookstack: ${res.status} ${res.statusText}`)
      }

      return okResponse(await res.json())
    }

    // ─── KRAYIN CRM ─────────────────────────────────────────
    if (provider === 'KRAYIN') {
      const { appUrl, apiKey } = config
      if (!appUrl || !apiKey) throw new Error('Missing App URL or API Key')
      validateUrl(appUrl, 'App URL')

      const baseUrl = sanitizeUrl(appUrl)
      const res = await fetch(`${baseUrl}/api/v1/contacts?limit=1`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to connect to Krayin CRM: ${res.status} ${res.statusText}`)
      }

      return okResponse(await res.json())
    }

    // ─── CHATWOOT ───────────────────────────────────────────
    if (provider === 'CHATWOOT') {
      const { baseUrl: chatUrl, apiAccessToken, accountId } = config
      if (!chatUrl || !apiAccessToken || !accountId) {
        throw new Error('Missing Base URL, Access Token or Account ID')
      }
      validateUrl(chatUrl, 'Base URL')

      const baseUrl = sanitizeUrl(chatUrl)
      const res = await fetch(`${baseUrl}/api/v1/profile`, {
        headers: {
          api_access_token: apiAccessToken,
          Accept: 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to connect to Chatwoot: ${res.status} ${res.statusText}`)
      }

      return okResponse(await res.json())
    }

    // ─── TYPEBOT ────────────────────────────────────────────
    if (provider === 'TYPEBOT') {
      const { apiToken, workspaceId } = config
      if (!apiToken || !workspaceId) {
        throw new Error('Missing API Token or Workspace ID')
      }

      // Typebot Cloud API or self-hosted
      const typebotUrl = config.apiUrl || 'https://app.typebot.io'
      validateUrl(typebotUrl, 'Typebot URL')

      const baseUrl = sanitizeUrl(typebotUrl)
      const res = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/typebots?limit=1`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to connect to Typebot: ${res.status} ${res.statusText}`)
      }

      return okResponse(await res.json())
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown provider: ${provider}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
