import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'

const config: ChartConfig = {
  RECEIVED: { label: 'Recebido', color: 'hsl(var(--chart-1))' },
  IN_PROGRESS: { label: 'Em Andamento', color: 'hsl(var(--chart-2))' },
  WAITING_CUSTOMER: {
    label: 'Aguardando Cliente',
    color: 'hsl(var(--chart-3))',
  },
  WAITING_APPROVAL: {
    label: 'Aguardando Aprovação',
    color: 'hsl(var(--chart-4))',
  },
  APPROVED: { label: 'Aprovado', color: 'hsl(var(--chart-5))' },
  CLOSED: { label: 'Fechado', color: 'hsl(var(--muted))' },
}

export function TicketStatusChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data)
    .map(([key, value]) => ({
      status: key,
      count: value,
      fill: config[key]?.color || 'hsl(var(--muted))',
    }))
    .filter((d) => d.count > 0)

  if (chartData.length === 0)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Sem dados
      </div>
    )

  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  )
}
