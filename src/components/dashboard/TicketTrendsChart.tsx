import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { format, parseISO } from 'date-fns'

const config: ChartConfig = {
  created: { label: 'Criados', color: 'hsl(var(--primary))' },
  resolved: { label: 'Resolvidos', color: 'hsl(var(--success))' },
}

export function TicketTrendsChart({
  data,
}: {
  data: { date: string; created: number; resolved: number }[]
}) {
  if (!data || data.length === 0) return <div>Sem dados</div>

  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-created)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-created)"
              stopOpacity={0.1}
            />
          </linearGradient>
          <linearGradient id="fillResolved" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-resolved)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-resolved)"
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => format(parseISO(value), 'dd/MM')}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
        />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="created"
          stroke="var(--color-created)"
          fillOpacity={1}
          fill="url(#fillCreated)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="resolved"
          stroke="var(--color-resolved)"
          fillOpacity={1}
          fill="url(#fillResolved)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
