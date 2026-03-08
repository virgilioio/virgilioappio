import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { BarChart3 } from 'lucide-react'

interface StageData {
  name: string
  count: number
}

interface StageDistributionChartProps {
  data: StageData[]
  isLoading?: boolean
}

export function StageDistributionChart({ data, isLoading }: StageDistributionChartProps) {
  return (
    <AnalyticsChartCard
      title="Candidates by Stage"
      icon={BarChart3}
      isLoading={isLoading}
      isEmpty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--virgilio-border))" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-muted))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--virgilio-border))' }}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-muted))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--virgilio-border))' }}
            width={75}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Candidates']}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--virgilio-border))',
              borderRadius: '8px',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '12px',
            }}
          />
          <Bar
            dataKey="count"
            fill="hsl(267 89% 60%)"
            radius={[0, 4, 4, 0]}
            maxBarSize={30}
          />
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
