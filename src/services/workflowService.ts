import { supabase } from '@/lib/supabase/client'
import { Workflow } from '@/types'

export const workflowService = {
  async getWorkflows(organizationId: string) {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map((w: any) => ({
      id: w.id,
      organizationId: w.organization_id,
      name: w.name,
      triggerType: w.trigger_type,
      conditions: w.conditions,
      actions: w.actions,
      isActive: w.is_active,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    })) as Workflow[]
  },

  async createWorkflow(workflow: Partial<Workflow>) {
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        organization_id: workflow.organizationId,
        name: workflow.name,
        trigger_type: workflow.triggerType,
        conditions: workflow.conditions,
        actions: workflow.actions,
        is_active: workflow.isActive,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateWorkflow(id: string, updates: Partial<Workflow>) {
    const dbUpdates: any = { updated_at: new Date().toISOString() }
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.triggerType !== undefined) dbUpdates.trigger_type = updates.triggerType
    if (updates.conditions !== undefined) dbUpdates.conditions = updates.conditions
    if (updates.actions !== undefined) dbUpdates.actions = updates.actions
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive

    const { error } = await supabase
      .from('workflows')
      .update(dbUpdates)
      .eq('id', id)

    if (error) throw error
  },

  async deleteWorkflow(id: string) {
    const { error } = await supabase.from('workflows').delete().eq('id', id)
    if (error) throw error
  },

  async executeWorkflow(
    eventType: string,
    ticket: any,
    organizationId: string,
  ) {
    const { data, error } = await supabase.functions.invoke(
      'execute-workflow',
      {
        body: { eventType, ticket, organizationId },
      },
    )

    if (error) throw error
    return data
  },
}
