import { supabase } from '@/lib/supabase/client'
import {
  NotificationTemplate,
  NotificationEventType,
  NotificationChannelType,
} from '@/types'

export const templateService = {
  async getTemplates(organizationId: string): Promise<NotificationTemplate[]> {
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name')

    if (error) throw error

    return data.map((t: any) => ({
      id: t.id,
      organizationId: t.organization_id,
      name: t.name,
      eventType: t.event_type as NotificationEventType,
      channel: t.channel as NotificationChannelType | 'DEFAULT',
      subjectTemplate: t.subject_template,
      bodyTemplate: t.body_template,
      header: t.header,
      footer: t.footer,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      enabled: true,
    }))
  },

  async createTemplate(
    template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<NotificationTemplate> {
    const { data, error } = await supabase
      .from('notification_templates')
      .insert({
        organization_id: template.organizationId,
        name: template.name,
        event_type: template.eventType,
        channel: template.channel,
        subject_template: template.subjectTemplate,
        body_template: template.bodyTemplate,
        header: template.header,
        footer: template.footer,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      eventType: data.event_type,
      channel: data.channel,
      subjectTemplate: data.subject_template,
      bodyTemplate: data.body_template,
      header: data.header,
      footer: data.footer,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      enabled: true,
    }
  },

  async updateTemplate(
    id: string,
    updates: Partial<NotificationTemplate>,
  ): Promise<void> {
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    }
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.eventType !== undefined) dbUpdates.event_type = updates.eventType
    if (updates.channel !== undefined) dbUpdates.channel = updates.channel
    if (updates.subjectTemplate !== undefined)
      dbUpdates.subject_template = updates.subjectTemplate
    if (updates.bodyTemplate !== undefined) dbUpdates.body_template = updates.bodyTemplate
    if (updates.header !== undefined) dbUpdates.header = updates.header
    if (updates.footer !== undefined) dbUpdates.footer = updates.footer

    const { error } = await supabase
      .from('notification_templates')
      .update(dbUpdates)
      .eq('id', id)

    if (error) throw error
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
