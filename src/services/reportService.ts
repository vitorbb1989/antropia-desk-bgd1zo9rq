import { supabase } from '@/lib/supabase/client'
import { ReportTemplate } from '@/types'

export const reportService = {
  async getTemplates(organizationId: string): Promise<ReportTemplate[]> {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map((t: any) => ({
      id: t.id,
      organizationId: t.organization_id,
      name: t.name,
      metrics: t.metrics,
      channels: t.channels,
      recipientEmails: t.recipient_emails,
      recipientPhones: t.recipient_phones,
      frequencyDays: t.frequency_days,
      lastSentAt: t.last_sent_at,
      isActive: t.is_active,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }))
  },

  async createTemplate(
    template: Omit<
      ReportTemplate,
      'id' | 'createdAt' | 'updatedAt' | 'lastSentAt'
    >,
  ): Promise<ReportTemplate> {
    const { data, error } = await supabase
      .from('report_templates')
      .insert({
        organization_id: template.organizationId,
        name: template.name,
        metrics: template.metrics,
        channels: template.channels,
        recipient_emails: template.recipientEmails,
        recipient_phones: template.recipientPhones,
        frequency_days: template.frequencyDays,
        is_active: template.isActive,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      metrics: data.metrics,
      channels: data.channels,
      recipientEmails: data.recipient_emails,
      recipientPhones: data.recipient_phones,
      frequencyDays: data.frequency_days,
      lastSentAt: data.last_sent_at,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  async updateTemplate(
    id: string,
    updates: Partial<ReportTemplate>,
  ): Promise<void> {
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    }
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.metrics !== undefined) dbUpdates.metrics = updates.metrics
    if (updates.channels !== undefined) dbUpdates.channels = updates.channels
    if (updates.recipientEmails !== undefined)
      dbUpdates.recipient_emails = updates.recipientEmails
    if (updates.recipientPhones !== undefined)
      dbUpdates.recipient_phones = updates.recipientPhones
    if (updates.frequencyDays !== undefined)
      dbUpdates.frequency_days = updates.frequencyDays
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive

    const { error } = await supabase
      .from('report_templates')
      .update(dbUpdates)
      .eq('id', id)

    if (error) throw error
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('report_templates')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async generateReport(templateId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('generate-reports', {
      body: { template_id: templateId },
    })

    if (error) throw error
  },
}
