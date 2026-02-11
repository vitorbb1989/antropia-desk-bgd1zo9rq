import { Card, CardContent } from '@/components/ui/card'
import { Activity, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useStatusPageStore } from '@/stores/useStatusPageStore'

export function StatusKPIs() {
  const { kpis } = useStatusPageStore()

  const KPICard = ({ title, value, icon: Icon, colorClass, sub }: any) => (
    <Card className="border-0 shadow-sm bg-white">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-3xl font-bold mt-1">{value}</div>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-full ${colorClass}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <KPICard
        title="Tickets Ativos"
        value={kpis.active}
        icon={Activity}
        colorClass="bg-blue-500"
        sub="Na fila de atendimento"
      />
      <KPICard
        title="Aguard. Aprovação"
        value={kpis.waitingApproval}
        icon={AlertTriangle}
        colorClass="bg-yellow-500"
        sub="Requer ação do cliente"
      />
      <KPICard
        title="Encerrados Hoje"
        value={kpis.closedToday}
        icon={CheckCircle2}
        colorClass="bg-green-500"
        sub="Produtividade diária"
      />
      <KPICard
        title="Tempo Médio Resol."
        value={`${kpis.avgResolutionHours.toFixed(1)}h`}
        icon={Clock}
        colorClass="bg-purple-500"
        sub="Média geral"
      />
    </div>
  )
}
