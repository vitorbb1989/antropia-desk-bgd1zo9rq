import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from 'react'
import { Ticket, Message, TicketStatus, User, Attachment } from '@/types'
import { translateStatus, translatePriority } from '@/utils/translations'
import useNotificationStore from './useNotificationStore'
import useAuthStore from './useAuthStore'
import { ticketService } from '@/services/ticketService'
import { toast } from 'sonner'
import useAttachmentStore from './useAttachmentStore'

interface TicketContextType {
  tickets: Ticket[]
  messages: Message[]
  loading: boolean
  totalTickets: number
  page: number
  pageSize: number
  setPage: (page: number) => void
  fetchTickets: () => Promise<void>
  fetchTicketDetails: (ticketId: string) => Promise<void>
  addTicket: (
    ticket: Omit<Ticket, 'id' | 'readableId' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>
  updateTicketStatus: (ticketId: string, status: TicketStatus) => Promise<void>
  updateTicketPriority: (
    ticketId: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
  ) => Promise<void>
  addMessage: (
    message: Omit<Message, 'id' | 'createdAt'> & { attachments?: Attachment[] },
  ) => Promise<void>
  assignTicket: (ticketId: string, assigneeId: string) => Promise<void>
}

const TicketContext = createContext<TicketContextType | null>(null)

export function TicketProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [totalTickets, setTotalTickets] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const { createOutboxItem, cancelPendingReminders } = useNotificationStore()
  const { user } = useAuthStore()
  const { fetchAttachments } = useAttachmentStore()

  const fetchTickets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, total } = await ticketService.getTickets(
        user.companyId,
        user.role,
        user.id,
        page,
        pageSize,
      )
      setTickets(data)
      setTotalTickets(total)
    } catch (error) {
      console.error('Fetch tickets error:', error)
      toast.error('Erro ao carregar chamados')
    } finally {
      setLoading(false)
    }
  }, [user, page, pageSize])

  // Trigger fetch on page change or user change
  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  const fetchTicketDetails = useCallback(
    async (ticketId: string) => {
      setLoading(true)
      try {
        const msgs = await ticketService.getMessages(ticketId)
        await fetchAttachments(ticketId)
        setMessages(msgs)
      } catch (error) {
        console.error('Fetch details error:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchAttachments],
  )

  const getCurrentUser = (): User => {
    return (
      user || {
        id: 'system',
        name: 'System',
        role: 'ADMIN',
        email: 'system@antropia.com',
        companyId: 'c1',
        active: true,
      }
    )
  }

  const addTicket = async (
    data: Omit<Ticket, 'id' | 'readableId' | 'createdAt' | 'updatedAt'>,
  ) => {
    try {
      const newTicket = await ticketService.createTicket(data)
      setTickets((prev) => [newTicket, ...prev])

      await addMessage({
        ticketId: newTicket.id,
        senderId: data.requesterId,
        content: data.description,
        isInternal: false,
        type: 'EVENT',
        metadata: { eventType: 'CREATED' },
      })

      createOutboxItem('TICKET_CREATED', newTicket, getCurrentUser(), {
        kind: 'system',
        summary: `Novo chamado criado: ${newTicket.title}`,
      })
    } catch (error) {
      console.error('Add ticket error:', error)
      toast.error('Erro ao criar chamado')
      throw error
    }
  }

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    const targetTicket = tickets.find((t) => t.id === ticketId)
    if (!targetTicket) return

    const oldStatus = targetTicket.status
    if (oldStatus === status) return

    try {
      await ticketService.updateTicket(ticketId, { status })

      const updatedTicket = { ...targetTicket, status }
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? updatedTicket : t)),
      )

      await addMessage({
        ticketId,
        senderId: 'system',
        content: `Status alterado de ${translateStatus(oldStatus)} para ${translateStatus(status)}`,
        isInternal: false,
        type: 'EVENT',
        metadata: {
          eventType: 'STATUS_CHANGE',
          oldValue: oldStatus,
          newValue: status,
        },
      })

      if (oldStatus === 'WAITING_APPROVAL') {
        cancelPendingReminders(ticketId)
      }

      // Notification Logic
      if (status === 'WAITING_APPROVAL') {
        createOutboxItem('WAITING_APPROVAL', updatedTicket, getCurrentUser(), {
          kind: 'status_change',
          summary: 'Aguardando aprovação do cliente',
        })
        createOutboxItem(
          'APPROVAL_REMINDER_24H',
          updatedTicket,
          getCurrentUser(),
          {
            kind: 'system',
            summary: 'Lembrete: Aprovação pendente',
          },
          undefined,
          86400,
        )
      } else if (status === 'WAITING_CUSTOMER') {
        // This typically means a solution or question was sent
        createOutboxItem('SOLUTION_SENT', updatedTicket, getCurrentUser(), {
          kind: 'status_change',
          summary: 'Solução ou resposta enviada. Aguardando retorno.',
        })
      } else if (status === 'CLOSED') {
        createOutboxItem('TICKET_CLOSED', updatedTicket, getCurrentUser(), {
          kind: 'status_change',
          summary: 'Chamado encerrado',
        })
      } else {
        createOutboxItem('TICKET_UPDATED', updatedTicket, getCurrentUser(), {
          kind: 'status_change',
          summary: `Status atualizado para ${translateStatus(status)}`,
        })
      }
    } catch (error) {
      toast.error('Erro ao atualizar status')
    }
  }

  const updateTicketPriority = async (
    ticketId: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
  ) => {
    const targetTicket = tickets.find((t) => t.id === ticketId)
    if (!targetTicket) return

    const oldPriority = targetTicket.priority
    if (oldPriority === priority) return

    try {
      await ticketService.updateTicket(ticketId, { priority })
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, priority } : t)),
      )

      await addMessage({
        ticketId,
        senderId: 'system',
        content: `Prioridade alterada de ${translatePriority(oldPriority)} para ${translatePriority(priority)}`,
        isInternal: false,
        type: 'EVENT',
        metadata: {
          eventType: 'PRIORITY_CHANGE',
          oldValue: oldPriority,
          newValue: priority,
        },
      })
    } catch (error) {
      toast.error('Erro ao atualizar prioridade')
    }
  }

  const assignTicket = async (ticketId: string, assigneeId: string) => {
    try {
      await ticketService.updateTicket(ticketId, {
        assigneeId: assigneeId === 'unassigned' ? undefined : assigneeId,
      })
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                assigneeId:
                  assigneeId === 'unassigned' ? undefined : assigneeId,
              }
            : t,
        ),
      )

      const assigneeName =
        assigneeId === 'unassigned' || !assigneeId ? undefined : 'Agente'

      await addMessage({
        ticketId,
        senderId: 'system',
        content: assigneeName
          ? `Chamado atribuído a ${assigneeName}`
          : 'Chamado não atribuído',
        isInternal: false,
        type: 'EVENT',
        metadata: {
          eventType: 'ASSIGNMENT',
          assigneeName: assigneeName,
          assigneeId: assigneeId,
        },
      })

      if (assigneeId && assigneeId !== 'unassigned') {
        // Notify Agent (Assignment)
        // Logic to re-fetch updated ticket first is better but for MVP we use existing state + ID
        const t = tickets.find((x) => x.id === ticketId)
        if (t) {
          createOutboxItem(
            'TICKET_ASSIGNED',
            { ...t, assigneeId },
            getCurrentUser(),
            {
              kind: 'assignment',
              summary: 'Você foi atribuído a este chamado',
            },
          )
        }
      }
    } catch (error) {
      toast.error('Erro ao atribuir chamado')
    }
  }

  const addMessage = async (
    data: Omit<Message, 'id' | 'createdAt'> & { attachments?: Attachment[] },
  ) => {
    if (!user) return
    try {
      const newMessage = await ticketService.addMessage(data, user.companyId)
      if (data.attachments) {
        newMessage.attachments = data.attachments
      }
      setMessages((prev) => [...prev, newMessage])

      if (
        !newMessage.isInternal &&
        newMessage.type === 'MESSAGE' &&
        newMessage.senderId !== 'system'
      ) {
        const ticket = tickets.find((t) => t.id === newMessage.ticketId)
        if (ticket && newMessage.senderId !== ticket.requesterId) {
          createOutboxItem('TICKET_UPDATED', ticket, getCurrentUser(), {
            kind: 'message',
            summary: 'Nova mensagem do suporte',
          })
        }
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem')
    }
  }

  return (
    <TicketContext.Provider
      value={{
        tickets,
        messages,
        loading,
        totalTickets,
        page,
        pageSize,
        setPage,
        fetchTickets,
        fetchTicketDetails,
        addTicket,
        updateTicketStatus,
        updateTicketPriority,
        addMessage,
        assignTicket,
      }}
    >
      {children}
    </TicketContext.Provider>
  )
}

const useTicketStore = () => {
  const context = useContext(TicketContext)
  if (!context)
    throw new Error('useTicketStore must be used within TicketProvider')
  return context
}

export default useTicketStore
