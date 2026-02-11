import { useEffect, useState, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'
import useAuthStore from '@/stores/useAuthStore'
import { format } from 'date-fns'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Ban,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface NotificationRow {
  id: string
  channel: string
  event_type: string
  subject: string
  body: string
  status: string
  retry_count: number
  error_message: string | null
  external_id: string | null
  ticket_id: string | null
  recipient_email: string | null
  recipient_phone: string | null
  metadata: Record<string, any> | null
  sent_at: string | null
  failed_at: string | null
  delivered_at: string | null
  read_at: string | null
  next_retry_at: string | null
  created_at: string
}

export function NotificationLogs() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user?.companyId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(
          'id, channel, event_type, subject, body, status, retry_count, error_message, external_id, ticket_id, recipient_email, recipient_phone, metadata, sent_at, failed_at, delivered_at, read_at, next_retry_at, created_at',
        )
        .eq('organization_id', user.companyId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setNotifications((data as NotificationRow[]) || [])
    } catch (err) {
      console.error('Failed to fetch notification logs', err)
      toast.error('Erro ao carregar monitor de mensagens.')
    } finally {
      setLoading(false)
    }
  }, [user?.companyId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleRetry = async (notificationId: string) => {
    if (!user?.companyId) {
      toast.error('Sessão inválida. Faça login novamente.')
      return
    }
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId
          ? { ...n, status: 'PENDING', error_message: null, retry_count: 0, next_retry_at: null }
          : n,
      ),
    )
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'PENDING', error_message: null, retry_count: 0, next_retry_at: null, failed_at: null })
        .eq('id', notificationId)
        .eq('organization_id', user.companyId)

      if (error) throw error
      toast.success('Notificação reenfileirada para reenvio.')
    } catch (err) {
      fetchNotifications()
      toast.error('Falha ao retentar envio.')
      console.error('Retry failed', err)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Enviado
          </Badge>
        )
      case 'DELIVERED':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Entregue
          </Badge>
        )
      case 'READ':
        return (
          <Badge className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
            <CheckCircle2 className="h-3 w-3" /> Lido
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Pendente
          </Badge>
        )
      case 'PROCESSING':
        return (
          <Badge variant="warning" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Enviando
          </Badge>
        )
      case 'CANCELLED':
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Ban className="h-3 w-3" /> Cancelado
          </Badge>
        )
      case 'FAILED':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Falhou
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getRecipient = (item: NotificationRow) =>
    item.recipient_phone || item.recipient_email || '-'

  const getTicketLabel = (item: NotificationRow) => {
    const meta = item.metadata as Record<string, any> | null
    return meta?.public_id || (item.ticket_id ? item.ticket_id.substring(0, 8) : '-')
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-subtle">
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-subtle">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Monitor de Mensagens</CardTitle>
            <CardDescription>
              Visualize as notificações enviadas e seu status de entrega.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={fetchNotifications}
          >
            <RefreshCw className="h-3 w-3" /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Chamado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tentativas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((item) => (
                <Collapsible key={item.id} asChild>
                  <>
                    <TableRow className="group">
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {format(new Date(item.created_at), 'dd/MM HH:mm')}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {item.event_type}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {item.channel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        #{getTicketLabel(item)}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right text-xs">
                        {item.retry_count}/{3}
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-4 pl-12 space-y-3">
                            {/* Detalhes da entrega */}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-muted-foreground">Destinatario:</span>{' '}
                                <span className="font-medium">{getRecipient(item)}</span>
                              </div>
                              {item.external_id && (
                                <div>
                                  <span className="text-muted-foreground">ID Externo:</span>{' '}
                                  <span className="font-mono text-[10px]">{item.external_id}</span>
                                </div>
                              )}
                              {item.sent_at && (
                                <div>
                                  <span className="text-muted-foreground">Enviado em:</span>{' '}
                                  <span>{format(new Date(item.sent_at), 'dd/MM/yyyy HH:mm:ss')}</span>
                                </div>
                              )}
                              {item.delivered_at && (
                                <div>
                                  <span className="text-muted-foreground">Entregue em:</span>{' '}
                                  <span>{format(new Date(item.delivered_at), 'dd/MM/yyyy HH:mm:ss')}</span>
                                </div>
                              )}
                              {item.read_at && (
                                <div>
                                  <span className="text-muted-foreground">Lido em:</span>{' '}
                                  <span className="text-blue-600">{format(new Date(item.read_at), 'dd/MM/yyyy HH:mm:ss')}</span>
                                </div>
                              )}
                              {item.failed_at && (
                                <div>
                                  <span className="text-muted-foreground">Falhou em:</span>{' '}
                                  <span className="text-destructive">
                                    {format(new Date(item.failed_at), 'dd/MM/yyyy HH:mm:ss')}
                                  </span>
                                </div>
                              )}
                              {item.status === 'PENDING' && item.next_retry_at && (
                                <div>
                                  <span className="text-muted-foreground">Proxima tentativa:</span>{' '}
                                  <span className="text-orange-600 font-medium">
                                    {format(new Date(item.next_retry_at), 'dd/MM/yyyy HH:mm:ss')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Erro */}
                            {item.error_message && (
                              <div className="bg-destructive/10 border border-destructive/20 p-2 rounded text-xs text-destructive">
                                {item.error_message}
                              </div>
                            )}

                            {/* Conteudo da mensagem */}
                            <div className="bg-muted/50 p-2 rounded text-[11px] font-mono text-muted-foreground break-all">
                              {item.subject && (
                                <div className="font-bold border-b border-muted-foreground/20 pb-1 mb-1">
                                  {item.subject}
                                </div>
                              )}
                              <div className="whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                                {item.body}
                              </div>
                            </div>

                            {/* Metadata */}
                            {item.metadata && Object.keys(item.metadata).length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                  Metadata
                                </div>
                                <div className="bg-slate-900 text-slate-50 p-2 rounded-md font-mono text-[10px] overflow-x-auto max-h-[100px]">
                                  {JSON.stringify(item.metadata, null, 2)}
                                </div>
                              </div>
                            )}

                            {/* Acao de retry */}
                            {item.status === 'FAILED' && (
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => handleRetry(item.id)}
                                >
                                  <RefreshCw className="h-3 w-3" /> Retentar Envio
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
              {notifications.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="h-8 w-8 opacity-20" />
                      <span>Nenhuma notificacao registrada.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
