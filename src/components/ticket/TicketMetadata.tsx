import { Ticket, User, TicketStatus, TicketType } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Clock, AlertCircle, DollarSign, Tag } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { translateStatus, translatePriority } from '@/utils/translations'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { ticketService } from '@/services/ticketService'
import { toast } from 'sonner'

interface TicketMetadataProps {
  ticket: Ticket
  assignee?: User
  requester: User
  agents: User[]
  onAssign: (userId: string) => void
  onStatusChange: (status: TicketStatus) => void
  isAdminOrAgent: boolean
}

export function TicketMetadata({
  ticket,
  assignee,
  requester,
  agents,
  onAssign,
  onStatusChange,
  isAdminOrAgent,
}: TicketMetadataProps) {
  const [estimatedCost, setEstimatedCost] = useState(ticket.estimatedCost || 0)
  const [isEditingCost, setIsEditingCost] = useState(false)

  const handleCostSave = async () => {
    try {
      await ticketService.updateTicket(ticket.id, { estimatedCost })
      setIsEditingCost(false)
      toast.success('Custo estimado atualizado')
    } catch (e) {
      toast.error('Erro ao atualizar custo')
    }
  }

  return (
    <Card className="border-0 shadow-subtle h-full">
      <CardHeader>
        <CardTitle className="text-lg">Detalhes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status & Priority */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Status
            </Label>
            {isAdminOrAgent ? (
              <Select
                value={ticket.status}
                onValueChange={(v) => onStatusChange(v as TicketStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIVED">Recebido</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
                  <SelectItem value="WAITING_CUSTOMER">
                    Aguardando Cliente
                  </SelectItem>
                  <SelectItem value="WAITING_APPROVAL">
                    Aguardando Aprovação
                  </SelectItem>
                  <SelectItem value="CLOSED">Fechado</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div>
                <Badge variant="outline">
                  {translateStatus(ticket.status)}
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Prioridade
            </Label>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  ticket.priority === 'URGENT'
                    ? 'destructive'
                    : ticket.priority === 'HIGH'
                      ? 'warning'
                      : 'secondary'
                }
              >
                {translatePriority(ticket.priority)}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* People */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Solicitante
            </Label>
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={requester.avatar} />
                <AvatarFallback>{requester.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="font-medium">{requester.name}</div>
                {requester.email && (
                  <div className="text-xs text-muted-foreground">
                    {requester.email}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Responsável
            </Label>
            {isAdminOrAgent ? (
              <Select
                value={assignee?.id || 'unassigned'}
                onValueChange={onAssign}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Atribuir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={agent.avatar} />
                          <AvatarFallback>
                            {agent.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {agent.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-3">
                {assignee ? (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={assignee.avatar} />
                      <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <div className="font-medium">{assignee.name}</div>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    Não atribuído
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Financial Info (Agent Only) */}
        {isAdminOrAgent && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Custo Estimado
            </Label>
            {isEditingCost ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(parseFloat(e.target.value))}
                  className="h-8"
                />
                <Button size="sm" onClick={handleCostSave} className="h-8">
                  OK
                </Button>
              </div>
            ) : (
              <div
                className="text-sm font-medium cursor-pointer hover:underline decoration-dashed"
                onClick={() => setIsEditingCost(true)}
                title="Clique para editar"
              >
                R$ {estimatedCost.toFixed(2)}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Dates */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3 w-3" /> Criado
            </span>
            <span>
              {format(new Date(ticket.createdAt), 'dd MMM yyyy', {
                locale: ptBR,
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" /> Atualizado
            </span>
            <span>
              {formatDistanceToNow(new Date(ticket.updatedAt), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
          {ticket.dueDate && (
            <div className="flex items-center justify-between text-orange-600 font-medium">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3" /> Prazo
              </span>
              <span>
                {format(new Date(ticket.dueDate), 'dd MMM HH:mm', {
                  locale: ptBR,
                })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
