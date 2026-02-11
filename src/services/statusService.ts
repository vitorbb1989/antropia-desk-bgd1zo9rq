import { supabase } from '@/lib/supabase/client'
import { Ticket } from '@/types'
import { subDays } from 'date-fns'

export const statusService = {
  async getMonitoringTickets(organizationId: string, daysAgo: number = 30) {
    if (!organizationId || organizationId === 'ALL') {
      throw new Error('A valid organizationId is required')
    }

    const startDate = subDays(new Date(), daysAgo).toISOString()

    const { data, error } = await supabase
      .from('tickets')
      .select('*, organizations(name)')
      .eq('organization_id', organizationId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map((t: any) => ({
      id: t.id,
      readableId: t.id.split('-')[0], // Simulation
      title: t.title,
      description: '',
      type: 'REQUEST',
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
      organizationName: t.organizations?.name || 'Desconhecida',
    }))
  },
}
