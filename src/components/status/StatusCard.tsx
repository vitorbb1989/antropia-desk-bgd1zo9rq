import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertCircle, CheckCircle2, MoreHorizontal } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { translateStatus, translatePriority } from '@/utils/translations'
import { cn } from '@/lib/utils'

export function StatusCard({ ticket }: { ticket: any }) {
  const isUrgent = ticket.priority === 'URGENT' || ticket.priority === 'HIGH'

  return (
    <Card
      className={cn(
        'border-l-4 overflow-hidden transition-all hover:shadow-md',
        isUrgent ? 'border-l-red-500 bg-red-50/10' : 'border-l-blue-500',
        ticket.status === 'CLOSED' && 'border-l-slate-400 opacity-75',
      )}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-xs font-bold text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
            #{ticket.readableId}
          </span>
          <Badge
            variant={isUrgent ? 'destructive' : 'secondary'}
            className="text-[10px]"
          >
            {translatePriority(ticket.priority)}
          </Badge>
        </div>

        <h3 className="font-semibold text-base line-clamp-2 mb-3 leading-snug">
          {ticket.title}
        </h3>

        <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(ticket.createdAt), {
                locale: ptBR,
                addSuffix: true,
              })}
            </span>
          </div>
          <div
            className={cn(
              'font-medium px-2 py-0.5 rounded-full text-[10px]',
              ticket.status === 'WAITING_APPROVAL'
                ? 'bg-yellow-100 text-yellow-700'
                : ticket.status === 'CLOSED'
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-blue-50 text-blue-700',
            )}
          >
            {translateStatus(ticket.status)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
