import { supabase } from '@/lib/supabase/client'
import { TicketCategory } from '@/types'
import { isValidUUID } from '@/lib/utils'

export const categoryService = {
  async getCategories(organizationId: string): Promise<TicketCategory[]> {
    if (!isValidUUID(organizationId)) {
      console.warn(
        'Invalid Organization UUID provided to categoryService',
        organizationId,
      )
      return []
    }

    const { data, error } = await supabase
      .from('ticket_categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name')

    if (error) throw error

    // Map snake_case to camelCase
    return data.map((item: any) => ({
      id: item.id,
      organizationId: item.organization_id,
      name: item.name,
      description: item.description,
      slaHours: item.sla_hours,
      color: item.color,
      slug: item.slug,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))
  },

  async createCategory(
    category: Omit<TicketCategory, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TicketCategory> {
    if (!isValidUUID(category.organizationId)) {
      throw new Error('Invalid Organization UUID')
    }

    const { data, error } = await supabase
      .from('ticket_categories')
      .insert({
        organization_id: category.organizationId,
        name: category.name,
        description: category.description,
        sla_hours: category.slaHours,
        color: category.color,
        slug: category.slug,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      description: data.description,
      slaHours: data.sla_hours,
      color: data.color,
      slug: data.slug,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  async updateCategory(
    id: string,
    updates: Partial<
      Omit<TicketCategory, 'id' | 'organizationId' | 'createdAt'>
    >,
  ): Promise<TicketCategory> {
    const dbUpdates: any = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.slaHours !== undefined) dbUpdates.sla_hours = updates.slaHours
    if (updates.color !== undefined) dbUpdates.color = updates.color
    if (updates.slug !== undefined) dbUpdates.slug = updates.slug
    dbUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('ticket_categories')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      description: data.description,
      slaHours: data.sla_hours,
      color: data.color,
      slug: data.slug,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('ticket_categories')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
