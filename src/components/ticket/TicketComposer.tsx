import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Send,
  Lock,
  MessageSquare,
  Paperclip,
  X,
  Loader2,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Attachment } from '@/types'
import { AttachmentUpload } from './AttachmentUpload'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import useTicketStore from '@/stores/useTicketStore'
import useAttachmentStore from '@/stores/useAttachmentStore'

interface TicketComposerProps {
  onSendMessage: (
    content: string,
    attachments: Attachment[],
    isInternal: boolean,
  ) => Promise<void>
  isAdminOrAgent: boolean
  value?: string
  onChange?: (value: string) => void
  ticketId: string
}

export function TicketComposer({
  onSendMessage,
  isAdminOrAgent,
  value,
  onChange,
  ticketId,
}: TicketComposerProps) {
  const [internalMessage, setInternalMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Pending attachments that have been uploaded but not yet sent with a message
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [isUploadPopoverOpen, setIsUploadPopoverOpen] = useState(false)
  const { deleteAttachment } = useAttachmentStore()

  // Use props if provided (controlled), otherwise local state (uncontrolled)
  const isControlled = value !== undefined && onChange !== undefined
  const message = isControlled ? value : internalMessage

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    if (isControlled) {
      onChange(newVal)
    } else {
      setInternalMessage(newVal)
    }
  }

  const handleSend = async () => {
    if ((!message.trim() && pendingAttachments.length === 0) || isSending)
      return

    try {
      setIsSending(true)
      await onSendMessage(message, pendingAttachments, isInternal)

      if (isControlled) {
        onChange('')
      } else {
        setInternalMessage('')
      }

      setPendingAttachments([])
      if (isInternal) setIsInternal(false)
    } catch (error) {
      toast.error('Erro ao enviar mensagem')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSend()
    }
  }

  const handleAttachmentRemove = async (attId: string) => {
    // If we remove from here, we should probably soft delete it from the system too,
    // or just remove it from the "pending list".
    // Since it's not linked to a message yet, soft deleting it ensures no orphans if we strictly follow DB rules.
    await deleteAttachment(attId)
    setPendingAttachments((prev) => prev.filter((a) => a.id !== attId))
  }

  return (
    <div className="p-6 border-t border-border/40 bg-white sticky bottom-0 z-10">
      <div className="space-y-4">
        {isAdminOrAgent && (
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => setIsInternal(false)}
              className={cn(
                'text-sm font-medium transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg',
                !isInternal
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary/50',
              )}
            >
              <MessageSquare className="h-4 w-4" /> Resposta Pública
            </button>
            <button
              onClick={() => setIsInternal(true)}
              className={cn(
                'text-sm font-medium transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg',
                isInternal
                  ? 'bg-[#FFF9C4] text-yellow-800'
                  : 'text-muted-foreground hover:bg-secondary/50',
              )}
            >
              <Lock className="h-4 w-4" /> Nota Interna
            </button>
          </div>
        )}

        <div
          className={cn(
            'relative rounded-2xl border transition-all duration-300',
            isInternal
              ? 'bg-[#FFF9C4]/40 border-yellow-200/60 focus-within:bg-[#FFF9C4]/60 focus-within:border-yellow-400/50'
              : 'bg-secondary/30 border-transparent focus-within:bg-white focus-within:border-primary/20 focus-within:shadow-sm',
          )}
        >
          {/* Attached Files Preview Area */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 pb-0">
              {pendingAttachments.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-background border rounded-lg pl-3 pr-1 py-1.5 text-xs font-medium text-foreground shrink-0 animate-fade-in group hover:border-primary/50 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <span className="text-muted-foreground/60 text-[10px]">
                    ({(file.size / 1024).toFixed(0)}kb)
                  </span>
                  <button
                    onClick={() => handleAttachmentRemove(file.id)}
                    className="h-5 w-5 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            placeholder={
              isInternal
                ? 'Escrever uma nota interna (visível apenas para a equipe)...'
                : 'Digite sua resposta para o cliente... (Cmd+Enter para enviar)'
            }
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            className="min-h-[100px] resize-none pr-32 rounded-2xl border-0 bg-transparent focus-visible:ring-0 focus:ring-0 placeholder:text-muted-foreground/60"
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-3">
            {isAdminOrAgent && (
              <div className="flex items-center gap-2 pr-2 border-r border-border/50">
                <Switch
                  id="internal-mode-switch"
                  checked={isInternal}
                  onCheckedChange={setIsInternal}
                  disabled={isSending}
                  className={cn(
                    'data-[state=checked]:bg-yellow-400',
                    !isInternal && 'data-[state=unchecked]:bg-slate-200',
                  )}
                />
                <Label
                  htmlFor="internal-mode-switch"
                  className={cn(
                    'text-xs font-medium cursor-pointer',
                    isInternal ? 'text-yellow-700' : 'text-muted-foreground',
                  )}
                >
                  {isInternal ? 'Interno' : 'Público'}
                </Label>
              </div>
            )}

            <Popover
              open={isUploadPopoverOpen}
              onOpenChange={setIsUploadPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isSending}
                  className="rounded-full h-9 w-9 text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  title="Anexar arquivos"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="end" side="top">
                <h4 className="font-medium mb-3 text-sm">Upload de Arquivos</h4>
                <AttachmentUpload
                  ticketId={ticketId}
                  onUploadComplete={(att) =>
                    setPendingAttachments((prev) => [...prev, att])
                  }
                />
              </PopoverContent>
            </Popover>

            <Button
              onClick={handleSend}
              disabled={
                (!message.trim() && pendingAttachments.length === 0) ||
                isSending
              }
              size="sm"
              className={cn(
                'rounded-full h-9 px-5 transition-all duration-300',
                isInternal
                  ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 hover:shadow-md'
                  : 'bg-primary hover:bg-primary/90 hover:shadow-md',
              )}
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-2" />
              )}
              {isInternal ? 'Postar Nota' : 'Enviar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
