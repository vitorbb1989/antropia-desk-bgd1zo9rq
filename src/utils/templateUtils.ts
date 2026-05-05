import { NotificationPayload, NotificationEventType } from '@/types'
import { addHours, format } from 'date-fns'

/**
 * Replaces mustache-style variables in a template string with values from a payload object.
 * Supports nested properties via dot notation (e.g., {{ticket.title}}).
 *
 * @param template The template string containing {{variables}}
 * @param payload The data object to extract values from
 * @returns The rendered string
 */
export function renderTemplate(template: string, payload: any): string {
  if (!template) return ''

  return template.replace(/\{\{(.*?)\}\}/g, (match, path) => {
    const key = path.trim()
    const keys = key.split('.')
    let value = payload

    for (const k of keys) {
      if (value === undefined || value === null) return match
      value = value[k]
    }

    return value !== undefined && value !== null ? String(value) : match
  })
}

/**
 * Generates a mock payload for preview purposes based on the event type.
 */
export function getMockPayload(
  eventType: NotificationEventType,
): NotificationPayload {
  const now = new Date()

  return {
    event_version: '1.0',
    event_type: eventType,
    company: {
      id: 'preview-company',
      name: 'Sua Empresa',
    },
    ticket: {
      id: 'preview-ticket',
      public_id: '#0001',
      title: 'Exemplo de chamado para visualização',
      type: 'BUG',
      priority: 'HIGH',
      status: 'RECEIVED',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      portal_url: 'https://desk.antrop-ia.com/t/preview-ticket',
    },
    actors: {
      requester: {
        name: 'Nome do Solicitante',
        email: 'solicitante@empresa.com',
        phone: '+55119XXXXXXXX',
      },
      assigned_agent: {
        name: 'Nome do Agente',
        email: 'agente@empresa.com',
      },
    },
    update: {
      kind: 'system',
      summary: 'O chamado foi recebido e está na fila de atendimento.',
    },
    approval: {
      deadline_at: format(addHours(now, 24), 'dd/MM/yyyy HH:mm'),
    },
  }
}
