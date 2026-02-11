import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const config: ChartConfig = {
  assigned: { label: 'Atribuídos', color: 'hsl(var(--chart-1))' },
  closed: { label: 'Concluídos', color: 'hsl(var(--chart-2))' },
}

export function AgentPerformanceChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <div>Sem dados</div>

  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <YAxis
          dataKey="agentName"
          type="category"
          tickLine={false}
          axisLine={false}
          width={100}
          style={{ fontSize: '12px' }}
        />
        <XAxis type="number" hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="assigned"
          fill="var(--color-assigned)"
          radius={[0, 4, 4, 0]}
          barSize={20}
        />
        <Bar
          dataKey="closed"
          fill="var(--color-closed)"
          radius={[0, 4, 4, 0]}
          barSize={20}
        />
      </BarChart>
    </ChartContainer>
  )
}
