import { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface MiniSparklineProps {
  data: number[]
  color: string
  height?: number
  className?: string
}

export function MiniSparkline({ data, color, height = 40, className }: MiniSparklineProps) {
  const gradientId = useMemo(() => `sparkline-${Math.random().toString(36).slice(2, 9)}`, [])

  const chartData = useMemo(() => data.map((value) => ({ value })), [data])

  if (!data.length) return null

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
