import { createContext, useContext, ReactNode } from 'react'
import { Ticket, User, NotificationEventType } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { renderTemplate } from '@/utils/templateUtils'

interface NotificationContextType {
  createOutboxItem: (
    eventType: NotificationEventType,
    ticket: Ticket,
    actor: User,
    updateData: { kind: string; summary: string },
    scheduledAt?: string,
    delaySeconds?: number,
  ) => Promise<void>
  cancelPendingReminders: (ticketId: string) => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const createOutboxItem = async (
    eventType: NotificationEventType,
    ticket: Ticket,
    actor: User,
    updateData: { kind: string; summary: string },
    scheduledAt?: string,
    delaySeconds?: number,
  ) => {
    try {
      let recipientId = null
      if (actor.role === 'USER') {
        recipientId = ticket.assigneeId
      } else {
        recipientId = ticket.requesterId
      }

      if (eventType === 'TICKET_ASSIGNED' && ticket.assigneeId) {
        recipientId = ticket.assigneeId
      }

      if (!recipientId) return

      // Priority Logic: URGENT tickets use WhatsApp
      let channel = 'EMAIL'
      const isUrgent = ticket.priority === 'URGENT'
      if (isUrgent) {
        channel = 'WHATSAPP'
      }

      const finalScheduledAt = scheduledAt
        ? scheduledAt
        : delaySeconds
          ? new Date(Date.now() + delaySeconds * 1000).toISOString()
          : new Date().toISOString()

      // Build template payload for rendering
      const templatePayload = {
        ticket: {
          id: ticket.id,
          public_id: ticket.readableId || ticket.id.substring(0, 8),
          title: ticket.title,
          type: ticket.type,
          priority: ticket.priority,
          status: ticket.status,
          created_at: ticket.createdAt,
          updated_at: ticket.updatedAt,
          portal_url: `/tickets/${ticket.id}`,
        },
        actors: {
          requester: { name: actor.role === 'USER' ? actor.name : 'Cliente' },
          assigned_agent: { name: actor.role !== 'USER' ? actor.name : '' },
        },
        update: updateData,
        company: { id: ticket.companyId },
      }

      // Try to resolve a matching template
      let subject = `[${ticket.priority}] Atualização no chamado #${ticket.readableId || ticket.id.substring(0, 8)}`
      let body = updateData.summary
      let templateData: any = null

      const { data: template } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('organization_id', ticket.companyId)
        .eq('event_type', eventType)
        .limit(1)
        .maybeSingle()

      if (template) {
        const renderedBody = [
          template.header ? renderTemplate(template.header, templatePayload) : '',
          renderTemplate(template.body_template || '', templatePayload),
          template.footer ? renderTemplate(template.footer, templatePayload) : '',
        ].filter(Boolean).join('\n\n')

        if (renderedBody) body = renderedBody
        if (template.subject_template) {
          subject = renderTemplate(template.subject_template, templatePayload)
        }

        templateData = {
          template_id: template.id,
          ...templatePayload,
        }
      }

      const { error } = await supabase.from('notifications').insert({
        organization_id: ticket.companyId,
        ticket_id: ticket.id,
        recipient_id: recipientId,
        event_type: eventType,
        channel: channel as any,
        subject,
        body,
        status: 'PENDING',
        created_at: finalScheduledAt,
        template_data: templateData,
        metadata: {
          ticket_id: ticket.id,
          public_id: ticket.readableId,
          title: ticket.title,
          actor_name: actor.name,
          update_summary: updateData.summary,
          delay_seconds: delaySeconds,
          priority: ticket.priority,
          force_immediate: isUrgent,
        },
      })

      if (error) {
        console.error('Failed to create notification', error)
        throw error
      }
    } catch (error) {
      console.error('Error in createOutboxItem', error)
      throw error
    }
  }

  const cancelPendingReminders = async (ticketId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ status: 'CANCELLED' })
        .eq('ticket_id', ticketId)
        .eq('event_type', 'APPROVAL_REMINDER_24H')
        .eq('status', 'PENDING')
    } catch (error) {
      console.error('Failed to cancel reminders', error)
    }
  }

  return (
    <NotificationContext.Provider
      value={{
        createOutboxItem,
        cancelPendingReminders,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

const useNotificationStore = () => {
  const context = useContext(NotificationContext)
  if (!context)
    throw new Error(
      'useNotificationStore must be used within NotificationProvider',
    )
  return context
}

export default useNotificationStore
