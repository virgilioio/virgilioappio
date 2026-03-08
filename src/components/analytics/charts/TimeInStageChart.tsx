import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Clock } from 'lucide-react'
import type { StageTimeData } from '@/hooks/analytics/useStagePerformanceMetrics'

interface TimeInStageChartProps {
  data: StageTimeData[]
  isLoading?: boolean
}

export function TimeInStageChart({ data, isLoading }: TimeInStageChartProps) {
  return (
    <AnalyticsChartCard
      title="Avg Time in Stage"
      subtitle="Average days candidates spend in each stage (from stage history)"
      icon={Clock}
      isLoading={isLoading}
      isEmpty={data.length === 0}
      emptyMessage="No stage duration data"
      emptyDescription="Stage transitions are needed to calculate time in stage"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}d`} />
          <YAxis
            type="category"
            dataKey="stageName"
            width={120}
            tick={{ fontSize: 11 }}
            tickFormatter={v => v.length > 18 ? v.slice(0, 16) + '…' : v}
          />
          <Tooltip
            formatter={(value: number, _name: string, props: any) => [
              `${value}d avg (${props.payload.candidateCount} candidates)`,
              'Time in Stage'
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="avgDays" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {data.map((_, i) => (
              <Cell key={i} fill="hsl(var(--virgilio-purple))" fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
