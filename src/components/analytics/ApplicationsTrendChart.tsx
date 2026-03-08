import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { TrendingUp } from 'lucide-react'

interface TrendData {
  date: string
  applications: number
  active: number
  hires: number
  interviewsScheduled: number
}

interface ApplicationsTrendChartProps {
  data: TrendData[]
  isLoading?: boolean
}

const SERIES = [
  { key: 'applications', label: 'Applications', color: 'hsl(var(--virgilio-purple))' },
  { key: 'active', label: 'Active', color: 'hsl(var(--info))' },
  { key: 'hires', label: 'Hires', color: 'hsl(var(--success))' },
  { key: 'interviewsScheduled', label: 'Interviews', color: 'hsl(var(--warning))' },
] as const

function LegendChips() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {SERIES.map((s) => (
        <span
          key={s.key}
          className="inline-flex items-center gap-1.5 text-[11px] font-poppins font-medium text-virgilio-muted"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function ApplicationsTrendChart({ data, isLoading }: ApplicationsTrendChartProps) {
  const gradientIds = useMemo(
    () => SERIES.map((s) => `trend-grad-${s.key}-${Math.random().toString(36).slice(2, 7)}`),
    [],
  )

  return (
    <AnalyticsChartCard
      title="Candidates Over Time"
      icon={TrendingUp}
      isLoading={isLoading}
      isEmpty={data.length === 0}
      actions={<LegendChips />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
          <defs>
            {SERIES.map((s, i) => (
              <linearGradient key={s.key} id={gradientIds[i]} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-muted))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-muted))' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--virgilio-border))',
              borderRadius: '16px',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '12px',
              boxShadow: '0 8px 24px -8px hsl(var(--virgilio-purple) / 0.15)',
              padding: '10px 14px',
            }}
            cursor={{ stroke: 'hsl(var(--virgilio-purple) / 0.2)', strokeWidth: 1 }}
          />
          {SERIES.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.5}
              fill={`url(#${gradientIds[i]})`}
              dot={false}
              activeDot={{ r: 4, fill: s.color, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
