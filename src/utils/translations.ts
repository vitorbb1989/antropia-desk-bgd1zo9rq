export const TICKET_STATUS_MAP: Record<string, string> = {
  RECEIVED: 'RECEBIDO',
  IN_PROGRESS: 'EM ANDAMENTO',
  WAITING_CUSTOMER: 'AGUARDANDO CLIENTE',
  WAITING_APPROVAL: 'AGUARDANDO APROVAÇÃO',
  APPROVED: 'APROVADO',
  CLOSED: 'FECHADO',
}

export const TICKET_TYPE_MAP: Record<string, string> = {
  BUG: 'ERRO',
  REQUEST: 'SOLICITAÇÃO',
  FINANCE: 'FINANCEIRO',
  OTHER: 'OUTROS',
}

export const TICKET_PRIORITY_MAP: Record<string, string> = {
  LOW: 'BAIXA',
  MEDIUM: 'MÉDIA',
  HIGH: 'ALTA',
  URGENT: 'URGENTE',
}

export const USER_ROLE_MAP: Record<string, string> = {
  ADMIN: 'ADMIN',
  AGENT: 'AGENTE',
  USER: 'CLIENTE',
}

export const translateStatus = (status: string) =>
  TICKET_STATUS_MAP[status] || status
export const translateType = (type: string) => TICKET_TYPE_MAP[type] || type
export const translatePriority = (priority: string) =>
  TICKET_PRIORITY_MAP[priority] || priority
export const translateRole = (role: string) => USER_ROLE_MAP[role] || role

export const formatEventDescription = (
  type: string,
  metadata?: Record<string, any>,
  content?: string,
): string => {
  if (type === 'NOTIFICATION' && metadata) {
    const channel = metadata.channel === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'
    const status =
      metadata.status === 'SENT'
        ? 'enviado'
        : metadata.status === 'DELIVERED'
          ? 'entregue'
          : metadata.status === 'READ'
            ? 'lido'
            : metadata.status === 'ERROR'
              ? 'com erro'
              : 'enviado'

    return `${channel} ${status} para ${metadata.recipient || 'o cliente'}`
  }

  if (type === 'EVENT' && metadata?.eventType) {
    switch (metadata.eventType) {
      case 'STATUS_CHANGE':
        return `Status atualizado para ${translateStatus(metadata.newValue)}`
      case 'PRIORITY_CHANGE':
        return `Prioridade definida como ${translatePriority(metadata.newValue)}`
      case 'ASSIGNMENT':
        if (metadata.assigneeName) {
          return `${metadata.assigneeName} assumiu este ticket`
        }
        return 'Ticket atribuído'
      case 'CREATED':
        return 'Chamado criado'
      case 'TICKET_CLOSED':
        return 'Chamado encerrado'
      case 'TICKET_REOPENED':
        return 'Chamado reaberto'
    }
  }

  if (content) return content

  return 'Evento do sistema'
}
