import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useStatusPageStore } from '@/stores/useStatusPageStore'
import { format } from 'date-fns'

export function StatusFilters() {
  const { filters, setFilter, refresh, lastUpdated, loading } =
    useStatusPageStore()

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-6 border">
      <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
        <Select
          value={filters.period}
          onValueChange={(v) => setFilter('period', v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAY">Hoje</SelectItem>
            <SelectItem value="7_DAYS">Últimos 7 Dias</SelectItem>
            <SelectItem value="30_DAYS">Últimos 30 Dias</SelectItem>
            <SelectItem value="ALL">Todo o Período</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => setFilter('status', v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os Status</SelectItem>
            <SelectItem value="RECEIVED">Recebido</SelectItem>
            <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
            <SelectItem value="WAITING_CUSTOMER">Aguard. Cliente</SelectItem>
            <SelectItem value="WAITING_APPROVAL">Aguard. Aprovação</SelectItem>
            <SelectItem value="CLOSED">Encerrado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.priority}
          onValueChange={(v) => setFilter('priority', v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas Prioridades</SelectItem>
            <SelectItem value="URGENT">Urgente</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Média</SelectItem>
            <SelectItem value="LOW">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground w-full md:w-auto justify-end">
        <span className="hidden md:inline">
          Atualizado: {format(lastUpdated, 'HH:mm:ss')}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  )
}
