import { supabase } from '@/lib/supabase/client'
import type { ServicePlan, UserServiceCategory } from '@/types'

export const servicePlanService = {
  /** Get all service plans for an organization */
  async getServicePlans(organizationId: string): Promise<ServicePlan[]> {
    const { data, error } = await supabase
      .from('service_plans')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('display_order')

    if (error) throw error

    return (data || []).map((item: any) => ({
      id: item.id,
      organizationId: item.organization_id,
      name: item.name,
      description: item.description,
      color: item.color,
      icon: item.icon,
      isActive: item.is_active,
      displayOrder: item.display_order,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))
  },

  /** Get service plan IDs assigned to a specific user */
  async getUserServicePlanIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_service_plans')
      .select('service_plan_id')
      .eq('user_id', userId)

    if (error) throw error
    return (data || []).map((d: any) => d.service_plan_id)
  },

  /** Get categories for a user grouped by service plan (via RPC) */
  async getUserCategories(userId: string): Promise<UserServiceCategory[]> {
    const { data, error } = await supabase.rpc('get_user_categories', {
      p_user_id: userId,
    })

    if (error) throw error

    return (data || []).map((item: any) => ({
      categoryId: item.category_id,
      categoryName: item.category_name,
      categoryDescription: item.category_description,
      categorySlaHours: item.category_sla_hours,
      categoryColor: item.category_color,
      categorySlug: item.category_slug,
      servicePlanId: item.service_plan_id,
      servicePlanName: item.service_plan_name,
      servicePlanColor: item.service_plan_color,
      servicePlanIcon: item.service_plan_icon,
    }))
  },

  /** Assign service plans to a user (atomic replace via RPC) */
  async assignServicePlans(userId: string, planIds: string[]): Promise<void> {
    const { error } = await supabase.rpc('assign_user_service_plans', {
      p_user_id: userId,
      p_plan_ids: planIds,
    })

    if (error) throw error
  },
}
