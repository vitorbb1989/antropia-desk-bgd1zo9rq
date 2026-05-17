// Shared error response helpers for Supabase Edge Functions.
// Goals:
//   - Consistent JSON shape: { error: { code, message, request_id } }
//   - Never leak err.message / stack / SQL in 500 responses
//   - Always log structured (JSON) for Cloud Logging / Supabase log drain
//   - Propagate request_id via x-request-id response header

import { corsHeaders } from './cors.ts'

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_PAYLOAD'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'WORKFLOW_EXECUTION_FAILED'
  | 'SMTP_DELIVERY_FAILED'
  | 'SERVER_MISCONFIGURED'

interface ErrorBody {
  error: {
    code: ErrorCode
    message: string
    request_id: string
  }
}

function newRequestId(): string {
  return crypto.randomUUID()
}

function logStructured(severity: 'ERROR' | 'WARNING', payload: Record<string, unknown>) {
  // Cloud Logging picks up JSON on stdout/stderr and treats `severity` natively.
  console.error(JSON.stringify({ severity, ...payload }))
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  requestId?: string,
): Response {
  const rid = requestId ?? newRequestId()
  const body: ErrorBody = {
    error: { code, message, request_id: rid },
  }
  logStructured('ERROR', { code, message, request_id: rid, status })
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'x-request-id': rid,
    },
  })
}

// Use for 500s caused by unexpected exceptions.
// The original message/stack go ONLY to logs, never to the response.
export function internalError(err: unknown, requestId?: string): Response {
  const rid = requestId ?? newRequestId()
  logStructured('ERROR', {
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    request_id: rid,
  })
  const body: ErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      request_id: rid,
    },
  }
  return new Response(JSON.stringify(body), {
    status: 500,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'x-request-id': rid,
    },
  })
}
