import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Activity, CheckCircle2, Clock, Zap, Loader2 } from 'lucide-react'
import { useIntegrationStore } from '@/stores/useIntegrationStore'

const dailyTrendConfig: ChartConfig = {
  success: { label: 'Sucesso', color: 'hsl(142, 71%, 45%)' },
  failed: { label: 'Falhas', color: 'hsl(0, 84%, 60%)' },
}

const providerBreakdownConfig: ChartConfig = {
  success: { label: 'Sucesso', color: 'hsl(142, 71%, 45%)' },
  failed: { label: 'Falhas', color: 'hsl(0, 84%, 60%)' },
}

export function IntegrationDashboard() {
  const { stats, fetchStats } = useIntegrationStore()

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Execuções
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {stats.totalExecutions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Execuções registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Sucesso
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {stats.successRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Execuções bem-sucedidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Médio
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {stats.avgDurationMs}ms
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Duração de execução
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Provedores Ativos
            </CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {stats.activeProviders.length}/5
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Integrações configuradas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Health */}
      <Card>
        <CardHeader>
          <CardTitle>Saúde dos Provedores</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.providerHealth.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum provedor ativo
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats.providerHealth.map((health) => (
                <div
                  key={health.provider}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{health.provider}</p>
                    {health.consecutiveFailures > 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        {health.consecutiveFailures} falha(s) consecutiva(s)
                      </p>
                    )}
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      health.lastStatus === 'SUCCESS'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}
                  >
                    {health.lastStatus}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência Diária (Últimos 14 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.dailyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <ChartContainer config={dailyTrendConfig} className="h-[300px] w-full">
              <BarChart
                data={stats.dailyTrend}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="success"
                  fill="var(--color-success)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="failed"
                  fill="var(--color-failed)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Provider Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Desempenho por Provedor</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.providerBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <ChartContainer config={providerBreakdownConfig} className="h-[300px] w-full">
              <BarChart
                data={stats.providerBreakdown}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 60, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="provider"
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="success"
                  fill="var(--color-success)"
                  radius={[0, 4, 4, 0]}
                  stackId="a"
                />
                <Bar
                  dataKey="failed"
                  fill="var(--color-failed)"
                  radius={[0, 4, 4, 0]}
                  stackId="a"
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
