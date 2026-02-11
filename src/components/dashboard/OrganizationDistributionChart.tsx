import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from '@/components/ui/chart'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--muted))',
]

export function OrganizationDistributionChart({ data }: { data: any[] }) {
  if (!data || data.length === 0)
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
        Sem dados
      </div>
    )

  // Dynamic config based on data
  const config: ChartConfig = data.reduce((acc, curr, idx) => {
    acc[curr.name] = {
      label: curr.name,
      color: COLORS[idx % COLORS.length],
    }
    return acc
  }, {} as ChartConfig)

  const chartData = data.map((d, idx) => ({
    ...d,
    fill: COLORS[idx % COLORS.length],
  }))

  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="name"
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
