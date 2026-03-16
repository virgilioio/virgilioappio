import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { Globe } from 'lucide-react'

interface SourceDonutData {
  source: string
  total: number
}

interface SourceDonutChartProps {
  data: SourceDonutData[]
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

export function SourceDonutChart({ data, isLoading }: SourceDonutChartProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.total, 0), [data])

  return (
    <AnalyticsChartCard
      title="Candidates by Source"
      icon={Globe}
      isLoading={isLoading}
      isEmpty={data.length === 0}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="total"
                nameKey="source"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--virgilio-border))',
                  borderRadius: '16px',
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '12px',
                  boxShadow: '0 8px 24px -8px hsl(var(--virgilio-purple) / 0.15)',
                  padding: '10px 14px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center stat */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="text-2xl font-poppins font-bold text-virgilio-text">{total}</span>
              <p className="text-[10px] font-poppins text-virgilio-muted">Total</p>
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2">
          {data.map((entry, index) => (
            <span
              key={entry.source}
              className="inline-flex items-center gap-1.5 text-[11px] font-poppins font-medium text-virgilio-muted"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              {entry.source}
            </span>
          ))}
        </div>
      </div>
    </AnalyticsChartCard>
  )
}
