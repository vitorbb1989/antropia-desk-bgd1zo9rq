// Shared CORS configuration for Supabase Edge Functions

// Determine allowed origin based on environment (Deno runtime)
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || (
  Deno.env.get('ENVIRONMENT') === 'production'
    ? 'https://desk.antrop-ia.com'
    : '*'
)

// Production-safe CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400', // 24 hours
}

// Helper function to handle OPTIONS preflight requests
export function handleCorsPreflightRequest(): Response {
  return new Response('ok', {
    headers: corsHeaders,
    status: 200
  })
}

// Helper function to create a response with CORS headers
export function createCorsResponse(
  body: any,
  init: ResponseInit = {}
): Response {
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      ...init,
      headers: {
        ...corsHeaders,
        ...init.headers,
        'Content-Type': 'application/json',
      },
    }
  )
}