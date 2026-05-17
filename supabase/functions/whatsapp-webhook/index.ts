import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { errorResponse } from '../_shared/errors.ts'

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // ── GET: Meta Verification Challenge ─────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expectedToken = Deno.env.get('WEBHOOK_VERIFY_TOKEN')

    if (mode === 'subscribe' && token && token === expectedToken) {
      console.log('[whatsapp-webhook] Verification challenge accepted')
      // Meta requires the raw challenge value as plain text — don't wrap.
      return new Response(challenge, { status: 200 })
    }
    return errorResponse(403, 'UNAUTHORIZED', 'Invalid verification token')
  }

  // ── POST: Status Update Callback ─────────────────────────
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )

      const entries = body.entry || []
      let processed = 0

      for (const entry of entries) {
        const changes = entry.changes || []
        for (const change of changes) {
          const statuses = change.value?.statuses || []
          for (const statusUpdate of statuses) {
            const externalId = statusUpdate.id
            const status = statusUpdate.status
            const timestamp = statusUpdate.timestamp

            if (externalId && status) {
              await updateNotificationStatus(supabase, externalId, status, timestamp)
              processed++
            }
          }
        }
      }

      console.log(`[whatsapp-webhook] Processed ${processed} status updates`)
      return new Response(JSON.stringify({ ok: true, processed }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err: any) {
      // Log structured but always return 200 to Meta to prevent retries.
      console.error(JSON.stringify({
        severity: 'ERROR',
        code: 'INTERNAL_ERROR',
        source: 'whatsapp-webhook',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      }))
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only GET (verify) and POST are allowed')
})

async function updateNotificationStatus(
  supabase: any,
  externalId: string,
  status: string,
  timestamp: string,
) {
  const now = new Date().toISOString()
  const tsISO = timestamp
    ? new Date(Number(timestamp) * 1000).toISOString()
    : now

  if (status === 'delivered') {
    // Only update if not already READ (prevent status regression)
    await supabase
      .from('notifications')
      .update({
        status: 'DELIVERED',
        delivered_at: tsISO,
        updated_at: now,
      })
      .eq('external_id', externalId)
      .in('status', ['SENT', 'PROCESSING'])
  } else if (status === 'read') {
    await supabase
      .from('notifications')
      .update({
        status: 'READ',
        read_at: tsISO,
        delivered_at: tsISO, // Ensure delivered_at is set if missed
        updated_at: now,
      })
      .eq('external_id', externalId)
      .in('status', ['SENT', 'DELIVERED', 'PROCESSING'])
  } else if (status === 'failed') {
    const errors = status === 'failed' ? 'Delivery failed (reported by WhatsApp)' : null
    await supabase
      .from('notifications')
      .update({
        status: 'FAILED',
        error_message: errors,
        failed_at: tsISO,
        updated_at: now,
      })
      .eq('external_id', externalId)
      .in('status', ['SENT', 'PROCESSING', 'PENDING'])
  }
}
