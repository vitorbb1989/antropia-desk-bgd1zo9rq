import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCorsPreflightRequest, createCorsResponse } from '../_shared/cors.ts'
import { verifyCronSecret, verifyUserAuth } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest()
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if triggered manually with a template_id
    const { template_id } = await req.json().catch(() => ({}))

    // Auth: If manual trigger (has template_id), verify user JWT. Otherwise require CRON_SECRET.
    if (template_id) {
      const authResult = await verifyUserAuth(req)
      if (authResult instanceof Response) return authResult
    } else {
      const cronError = verifyCronSecret(req)
      if (cronError) return cronError
    }

    let query = supabase
      .from('report_templates')
      .select('*, organizations(name)')
      .eq('is_active', true)

    if (template_id) {
      query = supabase
        .from('report_templates')
        .select('*, organizations(name)')
        .eq('id', template_id) // Fetch even if inactive if manual
    }

    const { data: templates, error } = await query

    if (error) throw error
    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ message: 'No templates found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const now = new Date()
    const reportsToProcess = templates.filter((t) => {
      if (template_id) return true // Manual trigger
      if (!t.last_sent_at) return true // Never sent
      const nextRun = new Date(
        new Date(t.last_sent_at).getTime() +
          t.frequency_days * 24 * 60 * 60 * 1000,
      )
      return now >= nextRun
    })

    const results = []

    for (const template of reportsToProcess) {
      // Fetch Org Settings for Logo and Branding
      const { data: orgSettings } = await supabase
        .from('organization_notification_settings')
        .select('logo_url')
        .eq('organization_id', template.organization_id)
        .single()

      // 1. Calculate Metrics
      const stats = await calculateStats(supabase, template.organization_id)

      // 2. Generate Content
      const htmlBody = generateHtmlReport(
        template,
        stats,
        orgSettings?.logo_url,
      )
      const textBody = generateTextReport(template, stats)

      // 3. Create Notifications
      const recipients = [
        ...(template.recipient_emails || []).map((email: string) => ({
          type: 'EMAIL',
          value: email,
        })),
        ...(template.recipient_phones || []).map((phone: string) => ({
          type: 'WHATSAPP',
          value: phone,
        })),
      ]

      // Also fetch admin emails if needed, but for now we stick to template recipients

      for (const recipient of recipients) {
        let valid = false
        let channel = 'EMAIL'

        if (recipient.type === 'EMAIL' && template.channels.includes('EMAIL')) {
          valid = true
          channel = 'EMAIL'
        }
        if (
          recipient.type === 'WHATSAPP' &&
          (template.channels.includes('WHATSAPP_CLOUD') ||
            template.channels.includes('EVOLUTION'))
        ) {
          valid = true
          channel = 'WHATSAPP'
        }

        if (valid) {
          await supabase.from('notifications').insert({
            organization_id: template.organization_id,
            channel: channel,
            event_type: 'TEST', // Use generic event type for report delivery or create REPORT type
            subject: `Relatório: ${template.name}`,
            body: channel === 'EMAIL' ? htmlBody : textBody,
            recipient_email: channel === 'EMAIL' ? recipient.value : null,
            recipient_phone: channel === 'WHATSAPP' ? recipient.value : null,
            status: 'PENDING',
          })
        }
      }

      // 4. Update last_sent_at
      await supabase
        .from('report_templates')
        .update({ last_sent_at: now.toISOString() })
        .eq('id', template.id)
      results.push(template.name)
    }

    return new Response(JSON.stringify({ processed: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

async function calculateStats(supabase: any, orgId: string) {
  const { count: totalTickets } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
  const { count: closedTickets } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'CLOSED')

  // New Metrics Calculation
  // Cost
  const { data: costData } = await supabase
    .from('tickets')
    .select('estimated_cost')
    .eq('organization_id', orgId)
    .not('estimated_cost', 'is', null)
  const totalCost =
    costData?.reduce(
      (acc: number, curr: any) => acc + (curr.estimated_cost || 0),
      0,
    ) || 0
  const avgCost = totalTickets > 0 ? totalCost / totalTickets : 0

  // CSAT
  const { data: csatData } = await supabase
    .from('tickets')
    .select('satisfaction_score')
    .eq('organization_id', orgId)
    .not('satisfaction_score', 'is', null)
  const totalScore =
    csatData?.reduce(
      (acc: number, curr: any) => acc + (curr.satisfaction_score || 0),
      0,
    ) || 0
  const avgCsat = csatData?.length > 0 ? totalScore / csatData.length : 0

  // Resolution Time (Approximate - just using updated_at - created_at for closed tickets)
  // In production this would use ticket_timeline or a dedicated resolution_at column
  const { data: resolvedTickets } = await supabase
    .from('tickets')
    .select('created_at, updated_at')
    .eq('organization_id', orgId)
    .eq('status', 'CLOSED')
    .limit(100) // Limit for performance in edge function

  let totalResolutionHours = 0
  if (resolvedTickets && resolvedTickets.length > 0) {
    resolvedTickets.forEach((t: any) => {
      const start = new Date(t.created_at).getTime()
      const end = new Date(t.updated_at).getTime()
      totalResolutionHours += (end - start) / (1000 * 60 * 60)
    })
  }
  const avgResolutionTime =
    resolvedTickets?.length > 0
      ? totalResolutionHours / resolvedTickets.length
      : 0

  return {
    totalTickets: totalTickets || 0,
    closedTickets: closedTickets || 0,
    openTickets: (totalTickets || 0) - (closedTickets || 0),
    avgCost,
    avgCsat: avgCsat.toFixed(1),
    avgResolutionTime: avgResolutionTime.toFixed(1),
  }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function generateHtmlReport(template: any, stats: any, logoUrl?: string) {
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : ''
  const logoHtml = safeLogoUrl
    ? `<img src="${safeLogoUrl}" alt="Logo" style="max-height: 50px; margin-bottom: 20px;" />`
    : ''

  const safeName = escapeHtml(template.name || '')
  const safeOrgName = escapeHtml(template.organizations?.name || '')

  return `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
            ${logoHtml}
            <h1 style="color: #333;">${safeName}</h1>
            <p style="color: #666;"><strong>Organização:</strong> ${safeOrgName}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            
            <h3>Resumo Executivo</h3>
            <ul style="line-height: 1.6;">
                <li>Total de Chamados: <strong>${stats.totalTickets}</strong></li>
                <li>Chamados Abertos: <strong>${stats.openTickets}</strong></li>
                <li>Chamados Fechados: <strong>${stats.closedTickets}</strong></li>
            </ul>
            
            <h3>Métricas Avançadas</h3>
            <ul style="line-height: 1.6;">
                <li>Custo Médio por Chamado: <strong>R$ ${stats.avgCost.toFixed(2)}</strong></li>
                <li>Índice de Satisfação (CSAT): <strong>${stats.avgCsat} / 5.0</strong></li>
                <li>Tempo Médio de Resolução: <strong>${stats.avgResolutionTime} horas</strong></li>
            </ul>
            
            <p style="font-size: 12px; color: #999; margin-top: 40px; text-align: center;">
                Gerado automaticamente pelo Antropia Desk.
            </p>
        </div>
    `
}

function generateTextReport(template: any, stats: any) {
  return `*${template.name}*\n\n📊 *Resumo*\n- Total: ${stats.totalTickets}\n- Abertos: ${stats.openTickets}\n- Fechados: ${stats.closedTickets}\n\n💰 *Financeiro*\n- Custo Médio: R$ ${stats.avgCost.toFixed(2)}\n\n⭐ *Qualidade*\n- CSAT: ${stats.avgCsat}/5.0\n- Tempo Resol.: ${stats.avgResolutionTime}h\n\n_Gerado por Antropia Desk_`
}
