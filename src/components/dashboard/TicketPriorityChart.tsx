import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'

const config: ChartConfig = {
  LOW: { label: 'Baixa', color: 'hsl(var(--chart-1))' },
  MEDIUM: { label: 'Média', color: 'hsl(var(--chart-2))' },
  HIGH: { label: 'Alta', color: 'hsl(var(--chart-3))' },
  URGENT: { label: 'Urgente', color: 'hsl(var(--destructive))' },
}

export function TicketPriorityChart({
  data,
}: {
  data: Record<string, number>
}) {
  const chartData = [
    { priority: 'LOW', count: data['LOW'] || 0, fill: config.LOW.color },
    {
      priority: 'MEDIUM',
      count: data['MEDIUM'] || 0,
      fill: config.MEDIUM.color,
    },
    { priority: 'HIGH', count: data['HIGH'] || 0, fill: config.HIGH.color },
    {
      priority: 'URGENT',
      count: data['URGENT'] || 0,
      fill: config.URGENT.color,
    },
  ]

  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 0, right: 30 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <YAxis
          dataKey="priority"
          type="category"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => config[value]?.label as string}
          width={80}
        />
        <XAxis type="number" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={4} barSize={30}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
