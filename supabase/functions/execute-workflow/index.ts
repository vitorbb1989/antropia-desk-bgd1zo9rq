import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCorsPreflightRequest, createCorsResponse } from '../_shared/cors.ts'
import { verifyUserAuth } from '../_shared/auth.ts'
import { isAllowedUrl } from '../_shared/ssrf-guard.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest()
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const { eventType, ticket, organizationId } = await req.json()

    // Auth: Verify caller JWT and org membership
    const authResult = await verifyUserAuth(req, organizationId)
    if (authResult instanceof Response) return authResult

    // 1. Fetch active workflows
    const { data: workflows } = await supabase
      .from('workflows')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('trigger_type', eventType)
      .eq('is_active', true)

    if (!workflows || workflows.length === 0) {
      return new Response(JSON.stringify({ message: 'No workflows found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = []

    for (const workflow of workflows) {
      // 2. Evaluate Conditions
      const conditions = workflow.conditions || []
      let conditionsMet = true

      for (const cond of conditions) {
        const ticketValue = ticket[cond.field]
        if (cond.operator === 'EQUALS') {
          if (String(ticketValue) !== String(cond.value)) {
            conditionsMet = false
            break
          }
        } else if (cond.operator === 'NOT_EQUALS') {
          if (String(ticketValue) === String(cond.value)) {
            conditionsMet = false
            break
          }
        }
      }

      if (!conditionsMet) {
        results.push({ workflow: workflow.name, status: 'skipped' })
        continue
      }

      // 3. Execute Actions
      const actions = workflow.actions || []
      for (const action of actions) {
        // ─── TRIGGER_INTEGRATION ──────────────────────────────
        if (action.type === 'TRIGGER_INTEGRATION') {
          const provider = action.config.provider
          const integration = await getEnabledIntegration(supabase, organizationId, provider)

          if (!integration) {
            results.push({
              workflow: workflow.name,
              action: `${provider}_INTEGRATION`,
              status: 'failed',
              error: `${provider} integration not enabled`,
            })
            continue
          }

          const actionConfig = action.config || {}

          // ── PLANKA: Create Card ─────────────────────────────
          if (provider === 'PLANKA') {
            await executePlanka(supabase, organizationId, integration, ticket, workflow, results, actionConfig)
          }

          // ── BOOKSTACK: Create Page ──────────────────────────
          else if (provider === 'BOOKSTACK') {
            await executeBookstack(supabase, organizationId, integration, ticket, workflow, results, actionConfig)
          }

          // ── KRAYIN: Create Lead ─────────────────────────────
          else if (provider === 'KRAYIN') {
            await executeKrayin(supabase, organizationId, integration, ticket, workflow, results)
          }

          // ── CHATWOOT: Create Conversation ───────────────────
          else if (provider === 'CHATWOOT') {
            await executeChatwoot(supabase, organizationId, integration, ticket, workflow, results, actionConfig)
          }

          // ── TYPEBOT: Start Bot ──────────────────────────────
          else if (provider === 'TYPEBOT') {
            await executeTypebot(supabase, organizationId, integration, ticket, workflow, results, actionConfig)
          }

          else {
            results.push({
              workflow: workflow.name,
              action: `${provider}_INTEGRATION`,
              status: 'failed',
              error: `Unknown integration provider: ${provider}`,
            })
          }
        }

        // ─── PLANKA_CREATE_SUBTASK ────────────────────────────
        else if (action.type === 'PLANKA_CREATE_SUBTASK') {
          await executePlankaSubtask(supabase, organizationId, action, ticket, workflow, results)
        }

        // ─── SEND_NOTIFICATION ────────────────────────────────
        else if (action.type === 'SEND_NOTIFICATION') {
          try {
            const templateId = action.config.template_id
            const recipientTarget = action.config.recipient || 'REQUESTER'
            const channel = action.config.channel || 'EMAIL'

            const recipientIds: string[] = []
            if ((recipientTarget === 'REQUESTER' || recipientTarget === 'BOTH') && ticket.requesterId) {
              recipientIds.push(ticket.requesterId)
            }
            if ((recipientTarget === 'ASSIGNEE' || recipientTarget === 'BOTH') && ticket.assigneeId) {
              recipientIds.push(ticket.assigneeId)
            }

            for (const recipientId of recipientIds) {
              await supabase.from('notifications').insert({
                organization_id: organizationId,
                ticket_id: ticket.id,
                recipient_id: recipientId,
                event_type: eventType,
                channel,
                subject: `Workflow: ${workflow.name}`,
                body: '',
                status: 'PENDING',
                template_data: templateId
                  ? { template_id: templateId, ticket, workflow: { id: workflow.id, name: workflow.name } }
                  : null,
                metadata: { workflow_id: workflow.id, workflow_name: workflow.name },
              })
            }

            results.push({
              workflow: workflow.name,
              action: 'SEND_NOTIFICATION',
              status: 'success',
              notified: recipientIds.length,
            })
          } catch (err: any) {
            results.push({
              workflow: workflow.name,
              action: 'SEND_NOTIFICATION',
              status: 'failed',
              error: err.message,
            })
          }
        }

        // ─── ADD_TAG ──────────────────────────────────────────
        else if (action.type === 'ADD_TAG') {
          const newTag = action.config.tag
          if (newTag) {
            const currentTags = ticket.tags || []
            if (!currentTags.includes(newTag)) {
              const updatedTags = [...currentTags, newTag]
              const { error } = await supabase
                .from('tickets')
                .update({ tags: updatedTags })
                .eq('id', ticket.id)
                .eq('organization_id', organizationId)

              if (error) {
                results.push({
                  workflow: workflow.name,
                  action: 'ADD_TAG',
                  status: 'failed',
                  error: error.message,
                })
              } else {
                results.push({
                  workflow: workflow.name,
                  action: 'ADD_TAG',
                  status: 'success',
                })
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Helpers ──────────────────────────────────────────────────

async function getEnabledIntegration(supabase: any, orgId: string, provider: string) {
  const { data } = await supabase
    .from('integrations_config')
    .select('*')
    .eq('organization_id', orgId)
    .eq('provider', provider)
    .eq('is_enabled', true)
    .single()
  return data
}

function sanitizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

async function logIntegration(
  supabase: any,
  orgId: string,
  type: string,
  status: string,
  reqData: any,
  resData: any,
  error: string | null = null,
  durationMs: number | null = null,
) {
  await supabase.from('integration_logs').insert({
    organization_id: orgId,
    integration_type: type,
    status,
    request_data: reqData,
    response_data: resData,
    error_message: error,
    duration_ms: durationMs,
  })
}

// ─── PLANKA: Create Card ──────────────────────────────────────

async function executePlanka(
  supabase: any, orgId: string, integration: any,
  ticket: any, workflow: any, results: any[],
  actionConfig: Record<string, any> = {},
) {
  const reqData = { action: 'create_card', ticketId: ticket.id }
  await logIntegration(supabase, orgId, 'PLANKA', 'PENDING', reqData, null)
  const startTime = Date.now()

  try {
    const { apiUrl, apiToken } = integration.settings
    const boardId = actionConfig.boardId || integration.settings.boardId
    const listId = actionConfig.listId || integration.settings.listId
    if (!isAllowedUrl(apiUrl)) throw new Error('Integration URL blocked: private/internal network')
    const baseUrl = sanitizeUrl(apiUrl)

    const res = await fetch(`${baseUrl}/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        boardId,
        listId,
        name: `[#${ticket.readableId || ticket.id.substring(0, 8)}] ${ticket.title}`,
        description: `${ticket.description || ''}\n\nLink: /tickets/${ticket.id}`,
      }),
    })

    const resData = await res.json()
    if (!res.ok) throw new Error(`Planka API Error: ${res.status} ${res.statusText}`)

    await logIntegration(supabase, orgId, 'PLANKA', 'SUCCESS', reqData, resData, null, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'PLANKA_CARD_CREATED', status: 'success' })
  } catch (err: any) {
    await logIntegration(supabase, orgId, 'PLANKA', 'FAILED', reqData, null, err.message, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'PLANKA_CARD_CREATED', status: 'failed', error: err.message })
  }
}

// ─── PLANKA: Create Subtask ───────────────────────────────────

async function executePlankaSubtask(
  supabase: any, orgId: string, action: any,
  ticket: any, workflow: any, results: any[],
) {
  const reqData = { action: 'create_subtask', ticketId: ticket.id }
  await logIntegration(supabase, orgId, 'PLANKA', 'PENDING', reqData, null)
  const startTime = Date.now()

  try {
    const integration = await getEnabledIntegration(supabase, orgId, 'PLANKA')
    if (!integration) throw new Error('Planka integration not enabled')

    const { apiUrl, apiToken, boardId, listId } = integration.settings
    if (!isAllowedUrl(apiUrl)) throw new Error('Integration URL blocked: private/internal network')
    const baseUrl = sanitizeUrl(apiUrl)

    const taskName = action.config.taskName || `Subtarefa: ${ticket.title}`

    // Create a card in Planka as the subtask
    const res = await fetch(`${baseUrl}/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        boardId,
        listId,
        name: `[Subtarefa] ${taskName}`,
        description: `Subtarefa do chamado #${ticket.readableId || ticket.id.substring(0, 8)}: ${ticket.title}\n\nLink: /tickets/${ticket.id}`,
      }),
    })

    const resData = await res.json()
    if (!res.ok) throw new Error(`Planka API Error: ${res.status} ${res.statusText}`)

    await logIntegration(supabase, orgId, 'PLANKA', 'SUCCESS', reqData, resData, null, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'PLANKA_SUBTASK_CREATED', status: 'success' })
  } catch (err: any) {
    await logIntegration(supabase, orgId, 'PLANKA', 'FAILED', reqData, null, err.message, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'PLANKA_SUBTASK_CREATED', status: 'failed', error: err.message })
  }
}

// ─── BOOKSTACK: Create Page ───────────────────────────────────

async function executeBookstack(
  supabase: any, orgId: string, integration: any,
  ticket: any, workflow: any, results: any[],
  actionConfig: Record<string, any> = {},
) {
  const reqData = { action: 'create_page', ticketId: ticket.id }
  await logIntegration(supabase, orgId, 'BOOKSTACK', 'PENDING', reqData, null)
  const startTime = Date.now()

  try {
    const { apiUrl, tokenId, tokenSecret } = integration.settings
    if (!isAllowedUrl(apiUrl)) throw new Error('Integration URL blocked: private/internal network')
    const baseUrl = sanitizeUrl(apiUrl)

    // Find or use default book - get the first book available
    let bookId = actionConfig.bookId || integration.settings.bookId
    if (!bookId) {
      const booksRes = await fetch(`${baseUrl}/api/books?count=1`, {
        headers: { Authorization: `Token ${tokenId}:${tokenSecret}` },
      })
      if (!booksRes.ok) throw new Error(`Bookstack API Error: ${booksRes.status} ${booksRes.statusText}`)
      const booksData = await booksRes.json()
      bookId = booksData.data?.[0]?.id
      if (!bookId) throw new Error('No books found in Bookstack. Create a book first.')
    }

    // Create a page in the book
    const ticketLabel = ticket.readableId || ticket.id.substring(0, 8)
    const res = await fetch(`${baseUrl}/api/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${tokenId}:${tokenSecret}`,
      },
      body: JSON.stringify({
        book_id: Number(bookId),
        name: `[#${ticketLabel}] ${ticket.title}`,
        html: `<h2>Chamado #${ticketLabel}</h2>
<p><strong>Tipo:</strong> ${ticket.type || '-'}</p>
<p><strong>Prioridade:</strong> ${ticket.priority || '-'}</p>
<p><strong>Status:</strong> ${ticket.status || '-'}</p>
<hr>
<p>${ticket.description || 'Sem descrição'}</p>
<p><a href="/tickets/${ticket.id}">Abrir no Antropia Desk</a></p>`,
      }),
    })

    const resData = await res.json()
    if (!res.ok) throw new Error(`Bookstack API Error: ${res.status} ${res.statusText}`)

    await logIntegration(supabase, orgId, 'BOOKSTACK', 'SUCCESS', reqData, resData, null, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'BOOKSTACK_PAGE_CREATED', status: 'success' })
  } catch (err: any) {
    await logIntegration(supabase, orgId, 'BOOKSTACK', 'FAILED', reqData, null, err.message, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'BOOKSTACK_PAGE_CREATED', status: 'failed', error: err.message })
  }
}

// ─── KRAYIN CRM: Create Lead ──────────────────────────────────

async function executeKrayin(
  supabase: any, orgId: string, integration: any,
  ticket: any, workflow: any, results: any[],
) {
  const reqData = { action: 'create_lead', ticketId: ticket.id }
  await logIntegration(supabase, orgId, 'KRAYIN', 'PENDING', reqData, null)
  const startTime = Date.now()

  try {
    const { appUrl, apiKey } = integration.settings
    if (!isAllowedUrl(appUrl)) throw new Error('Integration URL blocked: private/internal network')
    const baseUrl = sanitizeUrl(appUrl)

    const ticketLabel = ticket.readableId || ticket.id.substring(0, 8)
    const res = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title: `[#${ticketLabel}] ${ticket.title}`,
        description: ticket.description || '',
        status: 1, // New lead
        lead_value: 0,
        source: { name: 'Antropia Desk' },
        tags: { name: `ticket-${ticketLabel}` },
      }),
    })

    const resData = await res.json()
    if (!res.ok) throw new Error(`Krayin API Error: ${res.status} ${res.statusText}`)

    await logIntegration(supabase, orgId, 'KRAYIN', 'SUCCESS', reqData, resData, null, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'KRAYIN_LEAD_CREATED', status: 'success' })
  } catch (err: any) {
    await logIntegration(supabase, orgId, 'KRAYIN', 'FAILED', reqData, null, err.message, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'KRAYIN_LEAD_CREATED', status: 'failed', error: err.message })
  }
}

// ─── CHATWOOT: Create Conversation ────────────────────────────

async function executeChatwoot(
  supabase: any, orgId: string, integration: any,
  ticket: any, workflow: any, results: any[],
  actionConfig: Record<string, any> = {},
) {
  const reqData = { action: 'create_conversation', ticketId: ticket.id }
  await logIntegration(supabase, orgId, 'CHATWOOT', 'PENDING', reqData, null)
  const startTime = Date.now()

  try {
    const { baseUrl: chatUrl, apiAccessToken, accountId } = integration.settings
    if (!isAllowedUrl(chatUrl)) throw new Error('Integration URL blocked: private/internal network')
    const baseUrl = sanitizeUrl(chatUrl)

    // First, find or create a contact for this ticket
    const ticketLabel = ticket.readableId || ticket.id.substring(0, 8)

    // Search for existing contact or create one
    const searchRes = await fetch(
      `${baseUrl}/api/v1/accounts/${accountId}/search?q=${encodeURIComponent(ticketLabel)}&include_contacts=true`,
      {
        headers: {
          api_access_token: apiAccessToken,
          Accept: 'application/json',
        },
      },
    )

    let contactId: number | null = null
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      contactId = searchData.payload?.contacts?.[0]?.id || null
    }

    // If no contact found, create one
    if (!contactId) {
      const contactRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          api_access_token: apiAccessToken,
        },
        body: JSON.stringify({
          name: `Ticket #${ticketLabel}`,
          identifier: `antropia-ticket-${ticket.id}`,
        }),
      })
      if (contactRes.ok) {
        const contactData = await contactRes.json()
        contactId = contactData.payload?.contact?.id || contactData.id
      }
    }

    if (!contactId) throw new Error('Could not find or create contact in Chatwoot')

    // Create a conversation
    const inboxId = actionConfig.inboxId || integration.settings.inboxId
    const convPayload: any = {
      contact_id: contactId,
      status: 'open',
      additional_attributes: {
        antropia_ticket_id: ticket.id,
        antropia_ticket_label: ticketLabel,
      },
    }
    if (inboxId) convPayload.inbox_id = Number(inboxId)

    const convRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_access_token: apiAccessToken,
      },
      body: JSON.stringify(convPayload),
    })

    const convData = await convRes.json()
    if (!convRes.ok) throw new Error(`Chatwoot API Error: ${convRes.status} ${convRes.statusText}`)

    const conversationId = convData.id || convData.payload?.id

    // Send initial message with ticket details
    if (conversationId) {
      await fetch(`${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          api_access_token: apiAccessToken,
        },
        body: JSON.stringify({
          content: `**Chamado #${ticketLabel}: ${ticket.title}**\nPrioridade: ${ticket.priority || '-'}\nStatus: ${ticket.status || '-'}\n\n${ticket.description || ''}`,
          message_type: 'outgoing',
          content_type: 'text',
        }),
      })
    }

    await logIntegration(supabase, orgId, 'CHATWOOT', 'SUCCESS', reqData, convData, null, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'CHATWOOT_CONVERSATION_CREATED', status: 'success' })
  } catch (err: any) {
    await logIntegration(supabase, orgId, 'CHATWOOT', 'FAILED', reqData, null, err.message, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'CHATWOOT_CONVERSATION_CREATED', status: 'failed', error: err.message })
  }
}

// ─── TYPEBOT: Start Bot Session ───────────────────────────────

async function executeTypebot(
  supabase: any, orgId: string, integration: any,
  ticket: any, workflow: any, results: any[],
  actionConfig: Record<string, any> = {},
) {
  const reqData = { action: 'start_bot', ticketId: ticket.id }
  await logIntegration(supabase, orgId, 'TYPEBOT', 'PENDING', reqData, null)
  const startTime = Date.now()

  try {
    const { apiToken, workspaceId, defaultBotId } = integration.settings
    const typebotUrl = integration.settings.apiUrl || 'https://app.typebot.io'
    if (!isAllowedUrl(typebotUrl)) throw new Error('Integration URL blocked: private/internal network')
    const baseUrl = sanitizeUrl(typebotUrl)

    const botId = actionConfig.botId || defaultBotId
    if (!botId) throw new Error('No default bot ID configured')

    const ticketLabel = ticket.readableId || ticket.id.substring(0, 8)

    // Start a new chat session with the bot, passing ticket data as pre-filled variables
    const res = await fetch(`${baseUrl}/api/v1/typebots/${botId}/startChat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        prefilledVariables: {
          ticket_id: ticket.id,
          ticket_label: ticketLabel,
          ticket_title: ticket.title,
          ticket_priority: ticket.priority || '',
          ticket_status: ticket.status || '',
          ticket_description: ticket.description || '',
          ticket_type: ticket.type || '',
        },
      }),
    })

    const resData = await res.json()
    if (!res.ok) throw new Error(`Typebot API Error: ${res.status} ${res.statusText}`)

    await logIntegration(supabase, orgId, 'TYPEBOT', 'SUCCESS', reqData, resData, null, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'TYPEBOT_SESSION_STARTED', status: 'success' })
  } catch (err: any) {
    await logIntegration(supabase, orgId, 'TYPEBOT', 'FAILED', reqData, null, err.message, Date.now() - startTime)
    results.push({ workflow: workflow.name, action: 'TYPEBOT_SESSION_STARTED', status: 'failed', error: err.message })
  }
}
