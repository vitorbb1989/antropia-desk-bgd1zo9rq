import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCorsPreflightRequest, createCorsResponse } from '../_shared/cors.ts'
import { verifyCronSecret } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest()
  }

  // Auth: This is a cron/scheduled function - require CRON_SECRET
  const authError = verifyCronSecret(req)
  if (authError) return authError

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date()
    const nowISO = now.toISOString()

    // 1. Fetch active tickets with due dates
    // We fetch assignee_id to notify the agent responsible
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*, organizations(name)')
      .neq('status', 'CLOSED')
      .not('due_date', 'is', null)

    if (error) throw error

    const updates = []
    const notifications = []

    for (const ticket of tickets) {
      const dueDate = new Date(ticket.due_date)
      const timeDiff = dueDate.getTime() - now.getTime()
      const hoursDiff = timeDiff / (1000 * 60 * 60)

      // Check SLA WARNING (approx 2 hours remaining)
      // Condition: 0 < hoursDiff <= 2 AND not sent yet
      if (hoursDiff > 0 && hoursDiff <= 2 && !ticket.sla_warning_sent_at) {
        console.log(`Sending SLA Warning for ticket ${ticket.id}`)

        updates.push({
          id: ticket.id,
          sla_warning_sent_at: nowISO,
        })

        // Notify Assignee or Admins
        if (ticket.assignee_id) {
          notifications.push(
            createNotification(
              ticket,
              'SLA_WARNING',
              ticket.assignee_id,
              nowISO,
            ),
          )
        } else {
          // If no assignee, we might want to notify admins, but for now we skip or log
          console.log(
            `No assignee for ticket ${ticket.id}, skipping warning notification`,
          )
        }
      }

      // Check SLA BREACH (Overdue)
      // Condition: hoursDiff < 0 AND not sent yet
      if (hoursDiff < 0 && !ticket.sla_breach_sent_at) {
        console.log(`Sending SLA Breach for ticket ${ticket.id}`)

        updates.push({
          id: ticket.id,
          sla_breach_sent_at: nowISO,
        })

        // Notify Assignee
        if (ticket.assignee_id) {
          notifications.push(
            createNotification(
              ticket,
              'SLA_BREACH',
              ticket.assignee_id,
              nowISO,
            ),
          )
        }
      }
    }

    // Batch Insert Notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (notifError)
        console.error('Error inserting notifications:', notifError)
    }

    // Batch Update Tickets
    for (const update of updates) {
      await supabase.from('tickets').update(update).eq('id', update.id)
    }

    return new Response(
      JSON.stringify({
        message: 'SLA check complete',
        processed: tickets.length,
        triggered: notifications.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

function createNotification(
  ticket: any,
  eventType: string,
  recipientId: string,
  nowISO: string,
) {
  const isWarning = eventType === 'SLA_WARNING'
  const subject = isWarning
    ? `⚠️ Atenção: Ticket #${ticket.id.substring(0, 8)} vence em breve`
    : `🚨 SLA Vencido: Ticket #${ticket.id.substring(0, 8)} está atrasado`

  const body = isWarning
    ? `O ticket "${ticket.title}" vencerá em menos de 2 horas. Por favor, verifique.`
    : `O prazo para o ticket "${ticket.title}" expirou. Ação imediata necessária.`

  return {
    organization_id: ticket.organization_id,
    ticket_id: ticket.id,
    recipient_id: recipientId,
    event_type: eventType,
    channel: 'EMAIL', // Default to EMAIL for system alerts for now, user prefs would override in a fuller implementation
    subject: subject,
    body: body,
    status: 'PENDING',
    created_at: nowISO,
    updated_at: nowISO,
    metadata: {
      ticket_id: ticket.id,
      public_id: ticket.id.substring(0, 8),
      priority: ticket.priority,
      due_date: ticket.due_date,
    },
  }
}
