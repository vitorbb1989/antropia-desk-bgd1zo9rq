import { useState, useEffect } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Bell, MessageSquare, Check, ExternalLink } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { notificationService } from '@/services/notificationService'
import useAuthStore from '@/stores/useAuthStore'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { ticketService } from '@/services/ticketService'
import { toast } from 'sonner'

export function NotificationCenter() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (user && open) {
      setLoading(true)
      notificationService
        .getNotifications(user.companyId, user.id)
        .then((res) => setNotifications(res.data || []))
        .finally(() => setLoading(false))
    }
  }, [user, open])

  const handleReply = async (ticketId: string, notificationId: string) => {
    const content = replyText[notificationId]
    if (!content?.trim() || !user) return

    setReplying((prev) => ({ ...prev, [notificationId]: true }))
    try {
      await ticketService.addMessage(
        {
          ticketId,
          senderId: user.id,
          content,
          isInternal: false,
          type: 'MESSAGE',
        },
        user.companyId,
      )

      toast.success('Resposta enviada!')
      setReplyText((prev) => ({ ...prev, [notificationId]: '' }))
    } catch (e) {
      toast.error('Erro ao responder')
    } finally {
      setReplying((prev) => ({ ...prev, [notificationId]: false }))
    }
  }

  const unreadCount = notifications.filter((n) => n.status !== 'READ').length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5 opacity-70" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
          <h4 className="font-semibold text-sm">Notificações</h4>
          <span className="text-xs text-muted-foreground">
            {notifications.length} recentes
          </span>
        </div>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação recente.
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => {
                const isComment =
                  n.event_type === 'TICKET_COMMENT' ||
                  n.event_type === 'TICKET_CREATED'
                const ticketId = n.metadata?.ticket_id // Ensure metadata has ticket_id

                return (
                  <div
                    key={n.id}
                    className="p-4 border-b hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h5 className="text-sm font-medium leading-none">
                        {n.subject}
                      </h5>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {n.created_at &&
                          formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {n.body}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      {ticketId && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          asChild
                        >
                          <Link to={`/tickets/${ticketId}`}>
                            Ver Chamado{' '}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      )}

                      {isComment && ticketId && (
                        <div className="flex-1 ml-4">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Resposta rápida..."
                              className="h-8 text-xs"
                              value={replyText[n.id] || ''}
                              onChange={(e) =>
                                setReplyText((prev) => ({
                                  ...prev,
                                  [n.id]: e.target.value,
                                }))
                              }
                            />
                            <Button
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => handleReply(ticketId, n.id)}
                              disabled={replying[n.id]}
                            >
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
