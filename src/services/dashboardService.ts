import { supabase } from '@/lib/supabase/client'
import { DashboardPreferences } from '@/types'
import { isValidUUID } from '@/lib/utils'

export const dashboardService = {
  async getPreferences(userId: string): Promise<DashboardPreferences | null> {
    if (!isValidUUID(userId)) return null

    const { data, error } = await supabase
      .from('user_dashboard_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) return null

    return {
      userId: data.user_id,
      visibleWidgets: data.visible_widgets || [],
      updatedAt: data.updated_at,
    }
  },

  async savePreferences(preferences: DashboardPreferences): Promise<void> {
    const { error } = await supabase.from('user_dashboard_preferences').upsert(
      {
        user_id: preferences.userId,
        visible_widgets: preferences.visibleWidgets,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) throw error
  },
}
