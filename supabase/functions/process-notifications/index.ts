import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { verifyCronSecret } from '../_shared/auth.ts'
import {
  dispatchNotification,
  resolveTemplateContent,
  type OrgNotificationSettings,
} from '../_shared/notification-sender.ts'

const BATCH_SIZE = 50

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest()
  }

  // Auth: Require CRON_SECRET (scheduled function)
  const authError = verifyCronSecret(req)
  if (authError) return authError

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch PENDING notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('status', 'PENDING')
      .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) throw fetchError

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending notifications', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Cache org settings to avoid repeated queries
    const settingsCache: Record<string, OrgNotificationSettings> = {}
    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

    for (const notif of notifications) {
      try {
        // 2. Atomically claim notification (optimistic lock)
        const { data: claimed } = await supabase
          .from('notifications')
          .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
          .eq('id', notif.id)
          .eq('status', 'PENDING') // Only claim if still PENDING (prevents double-processing)
          .select('id')

        if (!claimed || claimed.length === 0) {
          results.skipped++
          continue // Another worker already claimed this notification
        }

        // 3. Load org settings (cached)
        if (!settingsCache[notif.organization_id]) {
          const { data: settings } = await supabase
            .from('organization_notification_settings')
            .select('*')
            .eq('organization_id', notif.organization_id)
            .single()

          if (!settings) {
            throw new Error(`No notification settings for org ${notif.organization_id}`)
          }
          settingsCache[notif.organization_id] = settings as OrgNotificationSettings
        }
        const settings = settingsCache[notif.organization_id]

        // 4. Resolve template content (if template_data.template_id exists)
        const { subject, body } = await resolveTemplateContent(supabase, notif)

        // 5. Determine recipient address
        let recipientAddress = ''
        if (notif.channel === 'EMAIL') {
          recipientAddress = notif.recipient_email || ''
          // If no direct email, try to resolve from recipient_id
          if (!recipientAddress && notif.recipient_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', notif.recipient_id)
              .single()
            recipientAddress = profile?.email || ''
          }
        } else if (notif.channel === 'WHATSAPP' || notif.channel === 'SMS') {
          recipientAddress = notif.recipient_phone || ''
          // If no direct phone, try to resolve from recipient_id
          if (!recipientAddress && notif.recipient_id) {
            const { data: prefs } = await supabase
              .from('user_notification_preferences')
              .select('phone_number')
              .eq('user_id', notif.recipient_id)
              .single()
            recipientAddress = prefs?.phone_number || ''
          }
        }

        if (!recipientAddress) {
          throw new Error(`No recipient address for ${notif.channel} notification`)
        }

        // 6. Dispatch
        const sendResult = await dispatchNotification(
          settings,
          notif.channel,
          recipientAddress,
          subject,
          body,
        )

        // 7. Update status
        if (sendResult.success) {
          await supabase
            .from('notifications')
            .update({
              status: 'SENT',
              sent_at: new Date().toISOString(),
              external_id: sendResult.externalId || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', notif.id)
          results.sent++
        } else {
          throw new Error(sendResult.error || 'Send failed')
        }
      } catch (err: any) {
        const newRetryCount = (notif.retry_count || 0) + 1
        const maxRetries = notif.max_retries || 3
        const isFinal = newRetryCount >= maxRetries

        // Exponential backoff: min(30s * 2^retryCount, 600s) + jitter
        let nextRetryAt: string | null = null
        if (!isFinal) {
          const baseDelayMs = 30_000
          const delayMs = Math.min(baseDelayMs * Math.pow(2, newRetryCount), 600_000)
          const jitterMs = Math.random() * delayMs * 0.2
          nextRetryAt = new Date(Date.now() + delayMs + jitterMs).toISOString()
        }

        await supabase
          .from('notifications')
          .update({
            status: isFinal ? 'FAILED' : 'PENDING',
            retry_count: newRetryCount,
            error_message: err.message,
            failed_at: isFinal ? new Date().toISOString() : null,
            next_retry_at: nextRetryAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notif.id)

        if (isFinal) {
          results.failed++
        } else {
          results.skipped++
        }
        results.errors.push(`${notif.id}: ${err.message}`)
        console.error(`[process-notifications] Error processing ${notif.id}:`, err.message)
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Notification processing complete',
        processed: notifications.length,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (err: any) {
    console.error('[process-notifications] Fatal error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
