import { useState, useEffect } from 'react'
import useTicketStore from '@/stores/useTicketStore'
import useAuthStore from '@/stores/useAuthStore'
import useCategoryStore from '@/stores/useCategoryStore'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Link } from 'react-router-dom'
import {
  Search,
  Plus,
  AlertCircle,
  Clock,
  MoreHorizontal,
  CheckSquare,
  Square,
} from 'lucide-react'
import { format, isPast, differenceInHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { translateStatus, translatePriority } from '@/utils/translations'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

export default function TicketList() {
  const {
    tickets,
    fetchTickets,
    loading,
    totalTickets,
    page,
    setPage,
    pageSize,
    updateTicketStatus,
    addMessage,
  } = useTicketStore()
  const { user } = useAuthStore()
  const { getCategoryById, fetchCategories } = useCategoryStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedTickets, setSelectedTickets] = useState<string[]>([])

  // Bulk Action State
  const [bulkActionOpen, setBulkActionOpen] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<
    'CLOSE' | 'NOTIFY' | null
  >(null)
  const [bulkMessage, setBulkMessage] = useState('')

  useEffect(() => {
    fetchTickets()
    fetchCategories()
  }, [fetchTickets, fetchCategories])

  if (!user) return null

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.readableId.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(totalTickets / pageSize)

  const toggleSelect = (id: string) => {
    setSelectedTickets((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const toggleSelectAll = () => {
    if (selectedTickets.length === filteredTickets.length) {
      setSelectedTickets([])
    } else {
      setSelectedTickets(filteredTickets.map((t) => t.id))
    }
  }

  const handleBulkAction = async () => {
    if (!bulkActionType) return
    setBulkActionOpen(false)

    const count = selectedTickets.length
    toast.info(`Processando ${count} tickets...`)

    try {
      if (bulkActionType === 'CLOSE') {
        await Promise.all(
          selectedTickets.map((id) => updateTicketStatus(id, 'CLOSED')),
        )
        toast.success(`${count} tickets encerrados.`)
      } else if (bulkActionType === 'NOTIFY') {
        if (!bulkMessage) return
        await Promise.all(
          selectedTickets.map((id) =>
            addMessage({
              ticketId: id,
              senderId: user.id,
              content: bulkMessage,
              isInternal: false,
              type: 'MESSAGE',
            }),
          ),
        )
        toast.success(`Mensagem enviada para ${count} tickets.`)
      }
      setSelectedTickets([])
      setBulkMessage('')
    } catch (e) {
      toast.error('Erro ao processar ação em massa')
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'secondary'
      case 'IN_PROGRESS':
        return 'warning'
      case 'WAITING_CUSTOMER':
        return 'warning'
      case 'WAITING_APPROVAL':
        return 'success'
      case 'CLOSED':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user.role === 'USER' ? 'Meus Chamados' : 'Fila de Chamados'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie suas solicitações de suporte
          </p>
        </div>
        {user.role === 'USER' ? (
          <Button asChild className="rounded-full shadow-md">
            <Link to="/tickets/new">
              <Plus className="mr-2 h-4 w-4" /> Novo Chamado
            </Link>
          </Button>
        ) : (
          selectedTickets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="gap-2">
                  <MoreHorizontal className="h-4 w-4" /> Ações em Massa (
                  {selectedTickets.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    setBulkActionType('CLOSE')
                    setBulkActionOpen(true)
                  }}
                >
                  Encerrar Selecionados
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setBulkActionType('NOTIFY')
                    setBulkActionOpen(true)
                  }}
                >
                  Enviar Notificação em Massa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID ou Título..."
            className="pl-10 rounded-full bg-white shadow-sm border-gray-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px] rounded-full bg-white shadow-sm border-gray-200">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="RECEIVED">Recebido</SelectItem>
            <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
            <SelectItem value="CLOSED">Fechado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {user.role !== 'USER' && (
                <TableHead className="w-[50px] pl-4">
                  <Checkbox
                    checked={
                      selectedTickets.length === filteredTickets.length &&
                      filteredTickets.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-[100px] pl-6">ID</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-6">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && tickets.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-12 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => {
                const category = ticket.categoryId
                  ? getCategoryById(ticket.categoryId)
                  : null
                return (
                  <TableRow key={ticket.id} className="group hover:bg-muted/30">
                    {user.role !== 'USER' && (
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedTickets.includes(ticket.id)}
                          onCheckedChange={() => toggleSelect(ticket.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono font-medium text-xs pl-6 text-muted-foreground">
                      {ticket.readableId}
                    </TableCell>
                    <TableCell>
                      <Link to={`/tickets/${ticket.id}`} className="block">
                        <div className="font-medium text-foreground text-sm hover:underline">
                          {ticket.title}
                        </div>
                        <div className="text-xs text-muted-foreground md:hidden mt-0.5">
                          {format(new Date(ticket.createdAt), 'd MMM', {
                            locale: ptBR,
                          })}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {category ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-xs font-medium">
                            {category.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0.5"
                      >
                        {translatePriority(ticket.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(ticket.status) as any}
                        className="text-[10px] px-2 py-0.5"
                      >
                        {translateStatus(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/tickets/${ticket.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  Nenhum chamado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ação em Massa</DialogTitle>
            <DialogDescription>
              {bulkActionType === 'CLOSE'
                ? 'Você está prestes a encerrar os tickets selecionados. Esta ação não pode ser desfeita.'
                : 'Enviar notificação para os solicitantes dos tickets selecionados.'}
            </DialogDescription>
          </DialogHeader>

          {bulkActionType === 'NOTIFY' && (
            <div className="space-y-4 py-4">
              <Input
                placeholder="Digite a mensagem para todos..."
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleBulkAction}
              variant={bulkActionType === 'CLOSE' ? 'destructive' : 'default'}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage(Math.max(1, page - 1))}
                className={
                  page === 1
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-sm text-muted-foreground px-2">
                Página {page} de {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                className={
                  page === totalPages
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
