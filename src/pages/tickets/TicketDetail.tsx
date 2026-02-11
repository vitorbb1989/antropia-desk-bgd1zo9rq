import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useTicketStore from '@/stores/useTicketStore'
import useAuthStore from '@/stores/useAuthStore'
import { TicketTimeline } from '@/components/ticket/TicketTimeline'
import { TicketMetadata } from '@/components/ticket/TicketMetadata'
import { TicketProgress } from '@/components/ticket/TicketProgress'
import { TicketComposer } from '@/components/ticket/TicketComposer'
import { TicketKnowledgeSearch } from '@/components/ticket/TicketKnowledgeSearch'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BookOpen, Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Attachment } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ticketService } from '@/services/ticketService'

export default function TicketDetail() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const {
    tickets,
    messages,
    addMessage,
    assignTicket,
    updateTicketStatus,
    fetchTicketDetails,
    loading,
  } = useTicketStore()
  const { user, users } = useAuthStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [composerText, setComposerText] = useState('')
  const [isKbOpen, setIsKbOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [csatScore, setCsatScore] = useState(0)
  const [csatComment, setCsatComment] = useState('')

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetails(ticketId)
    }
  }, [ticketId, fetchTicketDetails])

  const ticket = tickets.find((t) => t.id === ticketId)

  const ticketMessages = messages
    .filter((m) => m.ticketId === ticketId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

  useEffect(() => {
    if (ticketMessages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [ticketMessages.length])

  // Prompt for feedback when ticket is closed and viewed by requester
  useEffect(() => {
    if (
      ticket &&
      ticket.status === 'CLOSED' &&
      user?.id === ticket.requesterId &&
      !ticket.satisfactionScore
    ) {
      setIsFeedbackOpen(true)
    }
  }, [ticket, user])

  if (!user) return null

  if (loading && !ticket) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <h2 className="text-xl font-semibold">Chamado não encontrado</h2>
        <Button onClick={() => navigate('/tickets')}>
          Voltar para a lista
        </Button>
      </div>
    )
  }

  const assignee = users.find((u) => u.id === ticket.assigneeId)
  const requester = users.find((u) => u.id === ticket.requesterId) || {
    id: ticket.requesterId,
    name: 'Solicitante',
    email: '...',
    role: 'USER' as const,
    companyId: ticket.companyId,
    active: true,
  }
  const agents = users.filter((u) => u.role === 'AGENT' || u.role === 'ADMIN')
  const isAdminOrAgent = user.role === 'ADMIN' || user.role === 'AGENT'

  const handleSendMessage = async (
    content: string,
    attachments: Attachment[],
    isInternal: boolean,
  ) => {
    await addMessage({
      ticketId: ticket.id,
      senderId: user.id,
      content: content,
      isInternal: isInternal,
      type: 'MESSAGE',
      attachments: attachments.length > 0 ? attachments : undefined,
    })
    toast.success('Mensagem enviada')
  }

  const handleInsertKnowledge = (text: string) => {
    setComposerText((prev) => {
      if (prev.length > 0) return prev + '\n\n' + text
      return text
    })
    toast.success('Artigo inserido na resposta')
  }

  const submitFeedback = async () => {
    if (csatScore === 0) return
    try {
      await ticketService.updateTicket(ticket.id, {
        satisfactionScore: csatScore,
        satisfactionComment: csatComment,
      })
      setIsFeedbackOpen(false)
      toast.success('Obrigado pelo seu feedback!')
      // Optionally refresh ticket
    } catch (e) {
      toast.error('Erro ao enviar feedback')
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col min-h-0 bg-background/50 rounded-3xl border-0 shadow-subtle overflow-hidden">
        <div className="p-6 border-b border-border/40 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-secondary"
              onClick={() => navigate('/tickets')}
            >
              <ArrowLeft className="h-5 w-5 opacity-70" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs bg-secondary/50 px-2 py-0.5 rounded-md text-muted-foreground">
                  {ticket.readableId}
                </span>
                <h1 className="font-semibold text-lg leading-none">
                  {ticket.title}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1.5 line-clamp-1 font-normal opacity-80">
                {ticket.description}
              </p>
            </div>
          </div>

          {isAdminOrAgent && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden sm:flex"
              onClick={() => setIsKbOpen(true)}
            >
              <BookOpen className="h-4 w-4" />
              Base de Conhecimento
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-secondary/10">
          <TicketProgress status={ticket.status} />

          <TicketTimeline
            messages={ticketMessages}
            users={users}
            currentUserId={user.id}
          />
          <div ref={bottomRef} />
        </div>

        <TicketComposer
          onSendMessage={handleSendMessage}
          isAdminOrAgent={isAdminOrAgent}
          value={composerText}
          onChange={setComposerText}
          ticketId={ticket.id}
        />
      </div>

      <div className="w-full lg:w-96 space-y-6">
        <TicketMetadata
          ticket={ticket}
          assignee={assignee}
          requester={requester}
          agents={agents}
          onAssign={(id) =>
            assignTicket(ticket.id, id === 'unassigned' ? '' : id)
          }
          onStatusChange={(status) => updateTicketStatus(ticket.id, status)}
          isAdminOrAgent={isAdminOrAgent}
        />
      </div>

      {isAdminOrAgent && (
        <TicketKnowledgeSearch
          open={isKbOpen}
          onOpenChange={setIsKbOpen}
          onInsert={handleInsertKnowledge}
        />
      )}

      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avalie nosso atendimento</DialogTitle>
            <DialogDescription>
              Como foi sua experiência com este chamado?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <Button
                  key={score}
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 hover:text-yellow-400 ${csatScore >= score ? 'text-yellow-400' : 'text-gray-300'}`}
                  onClick={() => setCsatScore(score)}
                >
                  <Star className="h-8 w-8 fill-current" />
                </Button>
              ))}
            </div>
            <Textarea
              placeholder="Deixe um comentário (opcional)"
              value={csatComment}
              onChange={(e) => setCsatComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsFeedbackOpen(false)}>
              Depois
            </Button>
            <Button onClick={submitFeedback} disabled={csatScore === 0}>
              Enviar Avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
