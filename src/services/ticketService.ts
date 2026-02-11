import { supabase } from '@/lib/supabase/client'
import {
  Ticket,
  Message,
  TicketStatus,
  TicketType,
  Attachment,
  UserRole,
} from '@/types'
import { isValidUUID } from '@/lib/utils'
import { workflowService } from './workflowService'
import { toast } from 'sonner'

export const ticketService = {
  async getTickets(
    companyId: string,
    role: UserRole,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    if (!isValidUUID(companyId)) {
      return { data: [], total: 0 }
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('tickets')
      .select('*', { count: 'exact' })
      .eq('organization_id', companyId)
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (role === 'USER') {
      query = query.eq('requester_id', userId)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      data: data.map((t: any) => ({
        id: t.id,
        readableId: t.id.split('-')[0], // Simple readable ID simulation
        title: t.title,
        description: '', // Don't fetch description for list to save bandwidth if not needed
        type: 'REQUEST' as TicketType, // Map or default
        status: t.status,
        priority: t.priority,
        requesterId: t.requester_id,
        assigneeId: t.assignee_id,
        companyId: t.organization_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        categoryId: t.category_id,
        tags: t.tags || [],
        estimatedCost: t.estimated_cost,
        satisfactionScore: t.satisfaction_score,
        satisfactionComment: t.satisfaction_comment,
        dueDate: t.due_date,
      })),
      total: count || 0,
    }
  },

  async createTicket(ticket: Partial<Ticket>) {
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        organization_id: ticket.companyId,
        requester_id: ticket.requesterId,
        category_id: ticket.categoryId,
        due_date: ticket.dueDate,
        tags: ticket.tags,
      })
      .select()
      .single()

    if (error) throw error

    const createdTicket = {
      ...ticket,
      id: data.id,
      readableId: data.id.split('-')[0],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      description: ticket.description, // Pass description for workflow context
    } as Ticket

    // Trigger Workflow Asynchronously
    if (ticket.companyId) {
      workflowService
        .executeWorkflow('TICKET_CREATED', createdTicket, ticket.companyId)
        .catch((err) => { console.error('Workflow trigger failed', err); toast.error('Falha ao executar automacao de criacao') })
    }

    return createdTicket
  },

  async updateTicket(id: string, updates: Partial<Ticket>) {
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority
    if (updates.assigneeId !== undefined)
      dbUpdates.assignee_id = updates.assigneeId
    if (updates.estimatedCost !== undefined)
      dbUpdates.estimated_cost = updates.estimatedCost
    if (updates.satisfactionScore !== undefined)
      dbUpdates.satisfaction_score = updates.satisfactionScore
    if (updates.satisfactionComment !== undefined)
      dbUpdates.satisfaction_comment = updates.satisfactionComment
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags

    const { error, data } = await supabase
      .from('tickets')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Trigger Workflows
    if (data) {
      if (updates.status) {
        workflowService
          .executeWorkflow('STATUS_CHANGED', data, data.organization_id)
          .catch((err) => { console.error('Workflow STATUS_CHANGED failed', err); toast.error('Falha ao executar automacao de status') })
      }
      if (updates.priority) {
        workflowService
          .executeWorkflow('PRIORITY_UPDATED', data, data.organization_id)
          .catch((err) => { console.error('Workflow PRIORITY_UPDATED failed', err); toast.error('Falha ao executar automacao de prioridade') })
      }
    }
  },

  async getMessages(ticketId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('ticket_timeline')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return data.map((m: any) => ({
      id: m.id,
      ticketId: m.ticket_id,
      senderId: m.sender_id || 'system',
      content: m.content,
      isInternal: m.is_internal,
      createdAt: m.created_at,
      type: m.entry_type,
      metadata: m.metadata,
    }))
  },

  async addMessage(
    message: Partial<Message>,
    organizationId: string,
  ): Promise<Message> {
    const { data, error } = await supabase
      .from('ticket_timeline')
      .insert({
        ticket_id: message.ticketId,
        organization_id: organizationId,
        sender_id: message.senderId === 'system' ? null : message.senderId,
        content: message.content,
        is_internal: message.isInternal,
        entry_type: message.type || 'MESSAGE',
        metadata: message.metadata,
      })
      .select()
      .single()

    if (error) throw error

    // Check for Customer Reply Trigger
    if (!message.isInternal && message.type === 'MESSAGE' && message.senderId) {
      // Fetch ticket to check if sender is requester
      const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', message.ticketId)
        .single()

      if (ticket && ticket.requester_id === message.senderId) {
        workflowService
          .executeWorkflow('TICKET_CUSTOMER_REPLY', ticket, organizationId)
          .catch((err) => { console.error('Workflow TICKET_CUSTOMER_REPLY failed', err); toast.error('Falha ao executar automacao de resposta') })
      }
    }

    return {
      id: data.id,
      ticketId: data.ticket_id,
      senderId: data.sender_id || 'system',
      content: data.content,
      isInternal: data.is_internal,
      createdAt: data.created_at,
      type: data.entry_type,
      metadata: data.metadata,
    }
  },

  async getAdvancedStats(organizationId: string) {
    if (!isValidUUID(organizationId)) return null

    // Parallel fetching for performance (bounded queries)
    const [ticketsRes, closedRes, costRes, csatRes] = await Promise.all([
      supabase
        .from('tickets')
        .select('status, priority, category_id, assignee_id, created_at')
        .eq('organization_id', organizationId)
        .limit(5000),
      supabase
        .from('tickets')
        .select('created_at, updated_at')
        .eq('organization_id', organizationId)
        .eq('status', 'CLOSED')
        .limit(500),
      supabase
        .from('tickets')
        .select('estimated_cost')
        .eq('organization_id', organizationId)
        .not('estimated_cost', 'is', null),
      supabase
        .from('tickets')
        .select('satisfaction_score')
        .eq('organization_id', organizationId)
        .not('satisfaction_score', 'is', null),
    ])

    const tickets = ticketsRes.data || []
    const closed = closedRes.data || []
    const costs = costRes.data || []
    const csats = csatRes.data || []

    // Aggregations
    const byStatus = tickets.reduce((acc: any, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    }, {})

    const byPriority = tickets.reduce((acc: any, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1
      return acc
    }, {})

    // Cost
    const totalCost = costs.reduce(
      (acc, curr) => acc + (curr.estimated_cost || 0),
      0,
    )
    const avgCost = tickets.length > 0 ? totalCost / tickets.length : 0

    // CSAT
    const totalCsat = csats.reduce(
      (acc, curr) => acc + (curr.satisfaction_score || 0),
      0,
    )
    const avgCsat = csats.length > 0 ? totalCsat / csats.length : 0

    // Resolution Time (Hours)
    let totalResTime = 0
    closed.forEach((t) => {
      const start = new Date(t.created_at).getTime()
      const end = new Date(t.updated_at).getTime()
      totalResTime += (end - start) / (1000 * 60 * 60)
    })
    const avgResolutionTime =
      closed.length > 0 ? totalResTime / closed.length : 0

    // Trends (Last 30 days)
    const trends = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayStr = d.toISOString().split('T')[0]

      const createdCount = tickets.filter((t: any) =>
        t.created_at.startsWith(dayStr),
      ).length
      // Ideally we check a 'resolved_at' date, using updated_at for closed tickets as proxy
      const resolvedCount = closed.filter((t: any) =>
        t.updated_at.startsWith(dayStr),
      ).length

      trends.push({
        date: dayStr,
        created: createdCount,
        resolved: resolvedCount,
      })
    }

    // Agent Performance (Simple count)
    const agentStats = tickets.reduce((acc: any, t) => {
      if (t.assignee_id) {
        if (!acc[t.assignee_id])
          acc[t.assignee_id] = {
            assigned: 0,
            closed: 0,
            agentName: 'Agente ' + t.assignee_id.substring(0, 4),
          }
        acc[t.assignee_id].assigned++
        if (t.status === 'CLOSED') acc[t.assignee_id].closed++
      }
      return acc
    }, {})

    return {
      totalOpen: tickets.filter((t: any) => t.status !== 'CLOSED').length,
      byStatus,
      byPriority,
      slaBreached: 0, // Placeholder as we'd need to calculate vs due_date
      trends,
      agentPerformance: Object.values(agentStats),
      avgCost,
      avgCsat,
      avgResolutionTime,
    }
  },
}
