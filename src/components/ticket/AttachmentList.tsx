import { useEffect, useState } from 'react'
import { Attachment } from '@/types'
import {
  FileText,
  Download,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  ShieldCheck,
  Loader2,
  Lock,
  Search,
  Eye,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import useAttachmentStore from '@/stores/useAttachmentStore'
import useAuthStore from '@/stores/useAuthStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AttachmentListProps {
  ticketId: string
  className?: string
}

export function AttachmentList({ ticketId, className }: AttachmentListProps) {
  const {
    getAttachmentsByTicket,
    fetchAttachments,
    getSignedUrl,
    deleteAttachment,
    ticketMeta,
    isLoading,
  } = useAttachmentStore()
  const { user } = useAuthStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Fetch filtered attachments from store
  const attachments = getAttachmentsByTicket(ticketId, debouncedSearch)
  const meta = ticketMeta[ticketId]

  // Debounce Search Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch Logic (Initial + Search)
  useEffect(() => {
    // We always fetch if search changed OR if it's initial load (not loaded yet)
    // If it's loaded but search is different from lastSearch in meta, we fetch.
    const shouldFetch = !meta?.isLoaded || meta.lastSearch !== debouncedSearch

    if (shouldFetch) {
      fetchAttachments(ticketId, 1, 10, debouncedSearch)
    }
  }, [ticketId, debouncedSearch, meta?.isLoaded, meta?.lastSearch])

  // Handle Preview URL generation
  useEffect(() => {
    let isMounted = true
    const loadPreview = async () => {
      if (!previewAttachment) {
        setPreviewUrl(null)
        return
      }

      setIsPreviewLoading(true)
      try {
        const url = await getSignedUrl(previewAttachment.id)
        if (isMounted) {
          if (url) {
            setPreviewUrl(url)
          } else {
            toast.error('Não foi possível gerar a visualização')
            setPreviewAttachment(null)
          }
        }
      } catch (error) {
        if (isMounted) {
          toast.error('Erro ao carregar visualização')
          setPreviewAttachment(null)
        }
      } finally {
        if (isMounted) setIsPreviewLoading(false)
      }
    }

    loadPreview()
    return () => {
      isMounted = false
    }
  }, [previewAttachment, getSignedUrl])

  const handleLoadMore = () => {
    if (meta?.hasMore && !isLoading) {
      fetchAttachments(ticketId, meta.nextPage, 10, debouncedSearch)
    }
  }

  const handleDownload = async (att: Attachment) => {
    toast.promise(
      async () => {
        const url = await getSignedUrl(att.id)
        if (url) {
          window.open(url, '_blank')
        } else {
          throw new Error('Link expirado ou inválido')
        }
      },
      {
        loading: 'Gerando link seguro (60s)...',
        success: 'Acesso autorizado',
        error: 'Erro ao gerar link',
      },
    )
  }

  const handleDelete = async (att: Attachment) => {
    await deleteAttachment(att.id)
  }

  const canDelete = (att: Attachment) => {
    if (!user) return false
    if (user.role === 'ADMIN' || user.role === 'AGENT') return true
    return att.uploadedBy === user.id
  }

  const canPreview = (att: Attachment) => {
    const type = att.type.toLowerCase()
    const ext = att.extension.toLowerCase()
    return (
      type.startsWith('image/') ||
      type === 'application/pdf' ||
      ext === 'pdf' ||
      ext === 'png' ||
      ext === 'jpg' ||
      ext === 'jpeg'
    )
  }

  const isEmpty =
    meta?.isLoaded &&
    attachments.length === 0 &&
    !meta?.hasMore &&
    !isLoading &&
    !searchQuery

  const isSearchEmpty = searchQuery && attachments.length === 0 && !isLoading

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Search & Stats Header */}
      {(meta?.isLoaded || searchQuery) && (
        <div className="flex flex-col gap-2">
          {meta?.isLoaded && !isEmpty && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                {attachments.length} de {meta.total} arquivos
              </span>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Pesquisar anexos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-secondary/10 border-transparent focus:bg-white transition-all"
            />
          </div>
        </div>
      )}

      <ScrollArea className="h-[300px] pr-4 rounded-lg border border-transparent bg-secondary/5">
        <div className="space-y-2 p-1">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/50 border border-dashed rounded-xl bg-secondary/10">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhum anexo neste chamado</p>
            </div>
          )}

          {isSearchEmpty && (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground/60">
              <Search className="h-6 w-6 mb-2 opacity-30" />
              <p className="text-xs">
                Nenhum anexo encontrado para esta busca.
              </p>
            </div>
          )}

          {attachments.map((att) => (
            <div
              key={att.id}
              className="group flex items-center gap-3 p-3 bg-white border border-border/50 rounded-xl hover:shadow-md transition-all duration-300 animate-fade-in"
            >
              <div
                className={cn(
                  'h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border shadow-sm overflow-hidden relative',
                  att.type.startsWith('image/')
                    ? 'bg-secondary/20'
                    : 'bg-blue-50 text-blue-500',
                )}
              >
                {att.type.startsWith('image/') ? (
                  att.url ? (
                    <img
                      src={att.url}
                      className="h-full w-full object-cover"
                      alt=""
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )
                ) : (
                  <FileText className="h-5 w-5" />
                )}
                {/* Lock Overlay for Security Indication */}
                <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Lock className="h-3 w-3 text-foreground/50" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium truncate" title={att.name}>
                    {att.name}
                  </h4>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="uppercase">{att.extension}</span>
                  <span>•</span>
                  <span>{(att.size / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <span>
                    {format(new Date(att.createdAt), 'd MMM', {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canPreview(att) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={() => setPreviewAttachment(att)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={() => handleDownload(att)}
                  title="Download Seguro (60s)"
                >
                  <Download className="h-4 w-4" />
                </Button>

                {canDelete(att) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => handleDelete(att)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}

          {/* Skeletons for Loading State */}
          {isLoading && (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="flex items-center gap-3 p-3 bg-white/50 border border-border/20 rounded-xl"
                >
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Load More Trigger */}
          {meta?.hasMore && !isLoading && (
            <div className="pt-2 pb-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                className="rounded-full text-xs gap-2 hover:bg-secondary/80 w-full border-dashed"
              >
                <Loader2 className="h-3 w-3" />
                Carregar mais anexos
              </Button>
            </div>
          )}

          {meta?.isLoaded && !meta?.hasMore && attachments.length > 0 && (
            <div className="py-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">
                Fim da lista
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog
        open={!!previewAttachment}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      >
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0 overflow-hidden bg-zinc-950 border-zinc-800">
          <DialogHeader className="px-4 py-3 border-b border-zinc-800 flex flex-row items-center justify-between bg-zinc-900/50">
            <DialogTitle className="text-zinc-100 text-sm font-medium flex items-center gap-2 truncate pr-8">
              {previewAttachment?.type.startsWith('image/') ? (
                <ImageIcon className="h-4 w-4 text-blue-400" />
              ) : (
                <FileText className="h-4 w-4 text-orange-400" />
              )}
              {previewAttachment?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-zinc-950 relative flex items-center justify-center overflow-hidden">
            {isPreviewLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10">
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                  <span className="text-xs">
                    Carregando visualização segura...
                  </span>
                </div>
              </div>
            )}

            {!isPreviewLoading &&
              previewUrl &&
              (previewAttachment?.type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={previewAttachment.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0 bg-white"
                  title={previewAttachment?.name}
                />
              ))}

            {!isPreviewLoading && !previewUrl && (
              <div className="text-zinc-500 flex flex-col items-center">
                <FileText className="h-12 w-12 mb-2 opacity-20" />
                <span className="text-sm">
                  Não foi possível carregar o arquivo.
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
