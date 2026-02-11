import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

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
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
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
      console.error('[whatsapp-webhook] Error:', err.message)
      // Always return 200 to Meta to prevent retries
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method not allowed', { status: 405 })
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
