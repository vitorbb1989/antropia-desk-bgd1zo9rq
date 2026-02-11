import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Inbox,
  Activity,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Smile,
  Clock,
} from 'lucide-react'

export function DashboardMetrics({ stats }: { stats: any }) {
  if (!stats) return null

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Aberto
          </CardTitle>
          <Inbox className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-foreground">
            {stats.totalOpen}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Chamados ativos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Custo Médio
          </CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-foreground">
            R$ {stats.avgCost ? stats.avgCost.toFixed(2) : '0.00'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Por ticket</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            CSAT (Satisfação)
          </CardTitle>
          <Smile className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-foreground">
            {stats.avgCsat ? stats.avgCsat.toFixed(1) : '0.0'}/5.0
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Média de avaliações
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tempo de Resolução
          </CardTitle>
          <Clock className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-foreground">
            {stats.avgResolutionTime ? stats.avgResolutionTime.toFixed(1) : '0'}
            h
          </div>
          <p className="text-xs text-muted-foreground mt-1">Média (Horas)</p>
        </CardContent>
      </Card>
    </div>
  )
}
