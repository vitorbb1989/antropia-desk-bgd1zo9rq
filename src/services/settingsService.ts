import { supabase } from '@/lib/supabase/client'
import {
  UserPreference,
  SystemSettings,
  NotificationChannelConfig,
  BrandingSettings,
} from '@/types'

export const settingsService = {
  async getOrgSettings(organizationId: string) {
    const { data, error } = await supabase
      .from('organization_notification_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) return null

    // Map DB columns to SystemSettings structure
    const channels: NotificationChannelConfig[] = [
      {
        type: 'WHATSAPP_CLOUD',
        enabled: data.whatsapp_cloud_enabled,
        config: {
          wabaId: data.whatsapp_cloud_waba_id || '',
          phoneNumberId: data.whatsapp_cloud_phone_number_id || '',
          apiKey: data.whatsapp_cloud_access_token || '',
        },
      },
      {
        type: 'EVOLUTION',
        enabled: data.evolution_enabled,
        config: {
          serverUrl: data.evolution_api_url || '',
          instanceName: data.evolution_instance_name || '',
          apiKey: data.evolution_api_key || '',
        },
      },
      {
        type: 'EMAIL',
        enabled: data.smtp_enabled,
        config: {
          smtpHost: data.smtp_host || '',
          smtpPort: data.smtp_port?.toString() || '587',
          smtpUser: data.smtp_user || '',
          senderEmail: data.smtp_from_email || '',
        },
      },
    ]

    const branding: Partial<BrandingSettings> = {
      logoUrl: data.logo_url || '',
    }

    return {
      notificationChannels: channels,
      branding,
    }
  },

  async updateOrgSettings(
    organizationId: string,
    channels: NotificationChannelConfig[],
    branding?: Partial<BrandingSettings>,
  ) {
    // Flatten settings for DB
    const updateData: any = {
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    }

    if (branding?.logoUrl !== undefined) {
      updateData.logo_url = branding.logoUrl
    }

    channels.forEach((ch) => {
      if (ch.type === 'WHATSAPP_CLOUD') {
        updateData.whatsapp_cloud_enabled = ch.enabled
        updateData.whatsapp_cloud_waba_id = ch.config.wabaId
        updateData.whatsapp_cloud_phone_number_id = ch.config.phoneNumberId
        if (ch.config.apiKey && !ch.config.apiKey.includes('****')) {
          updateData.whatsapp_cloud_access_token = ch.config.apiKey
        }
      } else if (ch.type === 'EVOLUTION') {
        updateData.evolution_enabled = ch.enabled
        updateData.evolution_api_url = ch.config.serverUrl
        updateData.evolution_instance_name = ch.config.instanceName
        if (ch.config.apiKey && !ch.config.apiKey.includes('****')) {
          updateData.evolution_api_key = ch.config.apiKey
        }
      } else if (ch.type === 'EMAIL') {
        updateData.smtp_enabled = ch.enabled
        updateData.smtp_host = ch.config.smtpHost
        const port = parseInt(ch.config.smtpPort || '587', 10)
        updateData.smtp_port = (Number.isFinite(port) && port > 0 && port <= 65535) ? port : 587
        updateData.smtp_user = ch.config.smtpUser
        updateData.smtp_from_email = ch.config.senderEmail
      }
    })

    const { error } = await supabase
      .from('organization_notification_settings')
      .upsert(updateData, { onConflict: 'organization_id' })

    if (error) throw error
  },

  async getUserPreferences(userId: string): Promise<UserPreference | null> {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) return null

    return {
      userId: data.user_id,
      channels: {
        email: data.email_enabled,
        whatsapp: data.whatsapp_enabled,
        sms: data.sms_enabled,
      },
      contactInfo: {
        email: data.email_address || undefined,
        phoneNumber: data.phone_number || undefined,
      },
      events: {
        ticketCreated: data.notify_on_ticket_created,
        ticketAssigned: data.notify_on_ticket_assigned,
        newMessage: data.notify_on_new_message,
        ticketClosed: data.notify_on_ticket_closed,
        mention: data.notify_on_mention,
        newAttachment: data.notify_on_new_attachment,
        statusUpdated: data.notify_on_ticket_updated,
      },
      quietHours: {
        enabled: data.quiet_hours_enabled,
        start: data.quiet_hours_start || '22:00',
        end: data.quiet_hours_end || '08:00',
      },
      summaryMode: data.digest_mode ? 'DAILY' : 'IMMEDIATE',
    }
  },

  async saveUserPreferences(prefs: UserPreference, organizationId: string) {
    if (!organizationId) {
      throw new Error('organizationId is required to save user preferences')
    }

    const dbData = {
      user_id: prefs.userId,
      organization_id: organizationId,
      email_enabled: prefs.channels.email,
      whatsapp_enabled: prefs.channels.whatsapp,
      sms_enabled: prefs.channels.sms,
      email_address: prefs.contactInfo.email,
      phone_number: prefs.contactInfo.phoneNumber,
      notify_on_ticket_created: prefs.events.ticketCreated,
      notify_on_ticket_assigned: prefs.events.ticketAssigned,
      notify_on_new_message: prefs.events.newMessage,
      notify_on_ticket_closed: prefs.events.ticketClosed,
      notify_on_mention: prefs.events.mention,
      notify_on_new_attachment: prefs.events.newAttachment,
      notify_on_ticket_updated: prefs.events.statusUpdated,
      quiet_hours_enabled: prefs.quietHours.enabled,
      quiet_hours_start: prefs.quietHours.start,
      quiet_hours_end: prefs.quietHours.end,
      digest_mode: prefs.summaryMode !== 'IMMEDIATE',
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert(dbData, { onConflict: 'user_id' })

    if (error) throw error
  },

  async testNotification(
    channel: string,
    recipient: string,
    organizationId: string,
  ) {
    const { data, error } = await supabase.rpc('test_notification_settings', {
      p_channel: channel,
      p_test_recipient: recipient,
      p_org_id: organizationId,
    })

    if (error) throw error
    return data
  },
}
