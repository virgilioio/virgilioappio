import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Globe } from 'lucide-react'
import type { SourceRow } from '@/hooks/analytics/useSourcePerformanceMetrics'

interface SourceBarChartProps {
  data: SourceRow[]
  isLoading?: boolean
}

const COLORS = [
  'hsl(var(--virgilio-purple))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
]

export function SourceBarChart({ data, isLoading }: SourceBarChartProps) {
  const chartData = data.slice(0, 10) // Top 10

  return (
    <AnalyticsChartCard
      title="Candidates by Source"
      icon={Globe}
      isLoading={isLoading}
      isEmpty={chartData.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="source"
            width={100}
            tick={{ fontSize: 11 }}
            tickFormatter={v => v.length > 14 ? v.slice(0, 12) + '…' : v}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Candidates']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
