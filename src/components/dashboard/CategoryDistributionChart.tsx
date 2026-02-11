import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function CategoryDistributionChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return <div>Sem dados</div>

  const config: ChartConfig = data.reduce((acc, curr, idx) => {
    acc[curr.categoryName] = {
      label: curr.categoryName,
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
          nameKey="categoryName"
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
