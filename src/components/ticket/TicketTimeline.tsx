import { Message, User, Attachment } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import {
  GitCommit,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Lock,
  User as UserIcon,
  PlusCircle,
  ArrowRightCircle,
  Clock,
  FileText,
  Mail,
  CheckCheck,
  Download,
  Image as ImageIcon,
} from 'lucide-react'
import { formatEventDescription } from '@/utils/translations'
import { Button } from '@/components/ui/button'
import useAttachmentStore from '@/stores/useAttachmentStore'
import { toast } from 'sonner'

interface TicketTimelineProps {
  messages: Message[]
  users: User[]
  currentUserId: string
}

const AttachmentItem = ({ attachment }: { attachment: Attachment }) => {
  const { getSignedUrl } = useAttachmentStore()

  const handleDownload = async () => {
    const url = await getSignedUrl(attachment.id)
    if (url) {
      window.open(url, '_blank')
    } else {
      toast.error('Link expirado ou arquivo removido.')
    }
  }

  if (attachment.type.startsWith('image/')) {
    return (
      <div
        className="relative group cursor-pointer overflow-hidden rounded-lg border border-border/60 shadow-sm transition-all hover:shadow-md aspect-[4/3] bg-secondary/20"
        onClick={handleDownload}
      >
        {/* We use the temporary URL if available for preview, or placeholder if strict security needed.
                    For this user story, we likely want to use the secure link for preview too, 
                    but that requires async loading. For UX, we use the local blob url if present (new uploads) 
                    or the 'url' prop if available (mock data), otherwise we might need a placeholder 
                 */}
        <img
          src={
            attachment.url ||
            'https://img.usecurling.com/p/300/200?q=locked&color=gray'
          }
          alt={attachment.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Download className="text-white h-6 w-6" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg border bg-background/50 hover:bg-background transition-colors cursor-pointer group"
      onClick={handleDownload}
    >
      <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-xs font-medium truncate" title={attachment.name}>
          {attachment.name}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {(attachment.size / 1024).toFixed(1)} KB
        </span>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-full opacity-70 group-hover:opacity-100"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function TicketTimeline({
  messages,
  users,
  currentUserId,
}: TicketTimelineProps) {
  const getUser = (id: string) => users.find((u) => u.id === id)
  const currentUser = getUser(currentUserId)
  const isClient = currentUser?.role === 'USER'

  const visibleMessages = messages.filter((message) => {
    if (isClient && message.isInternal) return false
    return true
  })

  const sortedMessages = [...visibleMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const getEventIcon = (type: string, metadata?: any) => {
    if (type === 'NOTIFICATION') {
      if (metadata?.channel === 'WHATSAPP')
        return <MessageSquare className="h-4 w-4" />
      return <Mail className="h-4 w-4" />
    }

    if (metadata?.eventType === 'CREATED')
      return <PlusCircle className="h-4 w-4" />
    if (metadata?.eventType === 'STATUS_CHANGE') {
      if (metadata.newValue === 'CLOSED')
        return <CheckCircle2 className="h-4 w-4" />
      return <ArrowRightCircle className="h-4 w-4" />
    }
    if (metadata?.eventType === 'PRIORITY_CHANGE')
      return <AlertCircle className="h-4 w-4" />
    if (metadata?.eventType === 'ASSIGNMENT')
      return <UserIcon className="h-4 w-4" />

    if (type === 'MESSAGE') return <MessageSquare className="h-4 w-4" />
    return <GitCommit className="h-4 w-4" />
  }

  const getHeaderTitle = (message: Message, sender?: User) => {
    const senderName = sender?.name || 'Usuário Desconhecido'
    const isSystem = message.senderId === 'system' || !sender

    if (message.type === 'NOTIFICATION') return `Notificação enviada`

    if (message.type === 'EVENT') {
      if (message.metadata?.eventType === 'CREATED')
        return `Chamado criado por ${senderName}`
      return isSystem ? 'Sistema' : senderName
    }

    if (message.isInternal) return `${senderName} adicionou uma nota interna`

    if (sender?.role === 'USER') return `${senderName} respondeu`
    return `${senderName} respondeu ao cliente`
  }

  return (
    <div className="relative pb-8 pl-2">
      <div className="absolute left-6 top-4 bottom-0 w-px bg-border/60 -z-10" />

      <div className="space-y-8">
        {sortedMessages.map((message, index) => {
          const sender = getUser(message.senderId)
          const isMe = message.senderId === currentUserId
          const isLast = index === sortedMessages.length - 1
          const eventType = message.metadata?.eventType
          const isStatusOrSystem =
            message.type === 'EVENT' ||
            message.type === 'NOTIFICATION' ||
            message.senderId === 'system'

          let iconColorClass = 'bg-muted text-muted-foreground border-border'

          if (message.type === 'NOTIFICATION') {
            iconColorClass =
              message.metadata?.status === 'ERROR'
                ? 'bg-red-50 text-red-500 border-red-100'
                : 'bg-slate-50 text-slate-500 border-slate-200'
          } else if (message.isInternal) {
            iconColorClass = 'bg-yellow-100 text-yellow-700 border-yellow-200'
          } else if (eventType === 'CREATED') {
            iconColorClass = 'bg-blue-100 text-blue-600 border-blue-200'
          } else if (
            eventType === 'CLOSED' ||
            (eventType === 'STATUS_CHANGE' &&
              message.metadata?.newValue === 'CLOSED')
          ) {
            iconColorClass = 'bg-green-100 text-green-600 border-green-200'
          } else if (sender?.role === 'ADMIN' || sender?.role === 'AGENT') {
            iconColorClass = 'bg-primary/10 text-primary border-primary/20'
          } else if (sender?.role === 'USER' && message.type === 'MESSAGE') {
            iconColorClass = 'bg-white border-border text-foreground shadow-sm'
          }

          // Separate attachments
          // Filter out deleted attachments
          const activeAttachments =
            message.attachments?.filter((a) => !a.deletedAt) || []

          const imageAttachments =
            activeAttachments.filter((a) => a.type.startsWith('image/')) || []
          const docAttachments =
            activeAttachments.filter((a) => !a.type.startsWith('image/')) || []
          const hasAttachments = activeAttachments.length > 0

          return (
            <div
              key={message.id}
              className={cn(
                'relative flex gap-6 animate-fade-in-up group',
                isLast ? 'opacity-100' : 'opacity-95',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background shadow-sm z-10 transition-colors duration-300',
                  iconColorClass,
                  isLast && 'ring-2 ring-offset-2 ring-primary/20',
                )}
              >
                {message.isInternal ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  getEventIcon(message.type, message.metadata)
                )}
              </div>

              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'text-sm font-semibold text-foreground',
                      message.type === 'NOTIFICATION' &&
                        'text-muted-foreground',
                    )}
                  >
                    {getHeaderTitle(message, sender)}
                  </span>

                  {message.type === 'NOTIFICATION' &&
                    message.metadata?.status === 'READ' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-green-100 text-green-700 border-green-200">
                        <CheckCheck className="h-3 w-3" /> Lido
                      </span>
                    )}

                  {!isStatusOrSystem && sender?.role && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider',
                        sender.role === 'ADMIN' || sender.role === 'AGENT'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-secondary text-secondary-foreground',
                      )}
                    >
                      {sender.role === 'USER'
                        ? 'Cliente'
                        : sender.role === 'ADMIN'
                          ? 'Admin'
                          : 'Agente'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {format(new Date(message.createdAt), "d 'de' MMM, HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>

                {isStatusOrSystem ? (
                  <div
                    className={cn(
                      'text-sm text-foreground/80 px-4 py-3 rounded-xl border',
                      message.type === 'NOTIFICATION'
                        ? 'bg-slate-50/50 border-slate-100 text-slate-600 italic'
                        : 'bg-secondary/30 border-border/50',
                    )}
                  >
                    {formatEventDescription(
                      message.type,
                      message.metadata,
                      message.content,
                    )}
                  </div>
                ) : (
                  <Card
                    className={cn(
                      'border-0 shadow-subtle transition-all duration-300',
                      message.isInternal
                        ? 'bg-[#FFF9C4]/40 border border-yellow-200/60'
                        : 'bg-white',
                      isMe && !message.isInternal
                        ? 'bg-primary/5 border border-primary/10'
                        : '',
                    )}
                  >
                    <CardContent className="p-4 space-y-3">
                      {message.isInternal && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-700 uppercase tracking-widest">
                          <Lock className="h-3 w-3" /> Nota Interna
                        </div>
                      )}

                      <div
                        className={cn(
                          'text-sm leading-relaxed whitespace-pre-wrap font-normal text-foreground/90',
                          message.isInternal ? 'text-yellow-900/90' : '',
                        )}
                      >
                        {message.content}
                      </div>

                      {hasAttachments && (
                        <div className="mt-3 pt-2 border-t border-border/40 space-y-3">
                          {/* Image Grid */}
                          {imageAttachments.length > 0 && (
                            <div
                              className={cn(
                                'grid gap-2',
                                imageAttachments.length === 1
                                  ? 'grid-cols-1 max-w-sm'
                                  : 'grid-cols-2 md:grid-cols-3',
                              )}
                            >
                              {imageAttachments.map((att) => (
                                <AttachmentItem key={att.id} attachment={att} />
                              ))}
                            </div>
                          )}

                          {/* Document List */}
                          {docAttachments.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {docAttachments.map((att) => (
                                <AttachmentItem key={att.id} attachment={att} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )
        })}
        <div className="absolute left-6 bottom-0 translate-y-full flex flex-col items-center">
          <div className="h-8 w-px bg-gradient-to-b from-border/60 to-transparent" />
        </div>
      </div>
    </div>
  )
}
