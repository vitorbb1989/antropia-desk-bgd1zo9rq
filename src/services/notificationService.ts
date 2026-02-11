import { supabase } from '@/lib/supabase/client'
import { isValidUUID } from '@/lib/utils'

export const notificationService = {
  async getNotifications(
    organizationId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    if (!isValidUUID(organizationId)) {
      return { data: [], total: 0 }
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('notifications')
      .select(
        'id, channel, event_type, subject, body, status, sent_at, created_at, metadata, recipient_id',
        { count: 'exact' },
      )
      .eq('organization_id', organizationId)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    return { data, total: count || 0 }
  },
}
