import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIntegrationStore } from '@/stores/useIntegrationStore'
import { format } from 'date-fns'
import { RefreshCw, CheckCircle2, XCircle, Clock, Code } from 'lucide-react'

export function IntegrationLogsViewer() {
  const { logs, fetchLogs, fetchLogsFiltered, loading } = useIntegrationStore()
  const [providerFilter, setProviderFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 15000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  const handleFilterChange = (provider: string, status: string) => {
    const filters: any = {}
    if (provider !== 'all') filters.provider = provider
    if (status !== 'all') filters.status = status

    if (Object.keys(filters).length > 0) {
      fetchLogsFiltered(filters)
    } else {
      fetchLogs()
    }
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex gap-3">
            <Select
              value={providerFilter}
              onValueChange={(v) => {
                setProviderFilter(v)
                handleFilterChange(v, statusFilter)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Provedores</SelectItem>
                <SelectItem value="PLANKA">Planka</SelectItem>
                <SelectItem value="BOOKSTACK">Bookstack</SelectItem>
                <SelectItem value="KRAYIN">Krayin CRM</SelectItem>
                <SelectItem value="CHATWOOT">Chatwoot</SelectItem>
                <SelectItem value="TYPEBOT">Typebot</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                handleFilterChange(providerFilter, v)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="SUCCESS">Sucesso</SelectItem>
                <SelectItem value="FAILED">Falha</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFilterChange(providerFilter, statusFilter)}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Atualizar
          </Button>
        </div>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horario</TableHead>
                <TableHead>Integracao</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), 'dd/MM HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.integrationType}</Badge>
                  </TableCell>
                  <TableCell>
                    {log.status === 'SUCCESS' ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Sucesso
                      </Badge>
                    ) : log.status === 'PENDING' ? (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> Falha
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.durationMs != null ? `${log.durationMs}ms` : '-'}
                  </TableCell>
                  <TableCell
                    className="text-sm max-w-[200px] truncate"
                    title={log.errorMessage}
                  >
                    {log.errorMessage || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Code className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Detalhes do Log</DialogTitle>
                          <DialogDescription>{log.id}</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold text-sm mb-2">
                                Request Data
                              </h4>
                              <pre className="text-xs bg-slate-950 text-slate-50 p-3 rounded-md overflow-auto">
                                {JSON.stringify(log.requestData, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm mb-2">
                                Response Data
                              </h4>
                              <pre className="text-xs bg-slate-950 text-slate-50 p-3 rounded-md overflow-auto">
                                {JSON.stringify(log.responseData, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhum log registrado recentemente.
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
