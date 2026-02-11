import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Verify Evolution webhook secret
    const apiKey = req.headers.get('apikey')
    const expectedKey = Deno.env.get('EVOLUTION_WEBHOOK_SECRET')
    if (expectedKey && apiKey !== expectedKey) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const event = body.event
    let processed = 0

    // Evolution API sends status updates via "messages.update" or "message-status" events
    if (event === 'messages.update' || event === 'message-status') {
      const messageKey = body.data?.key?.id || body.data?.id
      const rawStatus = body.data?.status

      if (messageKey && rawStatus) {
        await updateEvolutionStatus(supabase, messageKey, rawStatus)
        processed++
      }
    }

    console.log(`[evolution-webhook] Event: ${event}, processed: ${processed}`)
    return new Response(JSON.stringify({ ok: true, processed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[evolution-webhook] Error:', err.message)
    // Always return 200 to prevent retries
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

async function updateEvolutionStatus(
  supabase: any,
  externalId: string,
  rawStatus: string | number,
) {
  const now = new Date().toISOString()

  // Evolution status codes:
  // DELIVERY_ACK or 3 = delivered
  // READ or PLAYED or 4 = read
  if (rawStatus === 'DELIVERY_ACK' || rawStatus === 3) {
    await supabase
      .from('notifications')
      .update({
        status: 'DELIVERED',
        delivered_at: now,
        updated_at: now,
      })
      .eq('external_id', externalId)
      .in('status', ['SENT', 'PROCESSING'])
  } else if (rawStatus === 'READ' || rawStatus === 'PLAYED' || rawStatus === 4) {
    await supabase
      .from('notifications')
      .update({
        status: 'READ',
        read_at: now,
        delivered_at: now,
        updated_at: now,
      })
      .eq('external_id', externalId)
      .in('status', ['SENT', 'DELIVERED', 'PROCESSING'])
  }
}
