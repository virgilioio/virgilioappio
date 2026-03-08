import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BarChart3 } from 'lucide-react'
import type { DistributionItem } from '@/hooks/analytics/useTalentInsightsMetrics'

interface TalentDistributionChartProps {
  title: string
  data: DistributionItem[]
  isLoading?: boolean
  color?: string
}

export function TalentDistributionChart({ title, data, isLoading, color = 'hsl(var(--virgilio-purple))' }: TalentDistributionChartProps) {
  return (
    <AnalyticsChartCard
      title={title}
      icon={BarChart3}
      isLoading={isLoading}
      isEmpty={data.length === 0}
      height="h-[250px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 10 }}
            tickFormatter={v => v.length > 18 ? v.slice(0, 16) + '…' : v}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Count']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} fillOpacity={0.7 + (i % 3) * 0.1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
