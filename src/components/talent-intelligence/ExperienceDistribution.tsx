import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { Clock, Users } from 'lucide-react'
import type { ExperienceBand, CountEntry } from '@/hooks/useTalentIntelligenceData'

interface ExperienceDistributionProps {
  experienceBands: ExperienceBand[]
  seniorityCounts: CountEntry[]
  onBandClick?: (band: string) => void
  onSeniorityClick?: (seniority: string) => void
}

const PIE_COLORS = [
  'hsl(267, 100%, 62%)',
  'hsl(267, 80%, 72%)',
  'hsl(267, 60%, 82%)',
  'hsl(300, 60%, 70%)',
  'hsl(267, 40%, 88%)',
]

const pillTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--virgilio-border))',
  borderRadius: '16px',
  fontFamily: 'Poppins, sans-serif',
  fontSize: '12px',
  boxShadow: '0 8px 24px -8px hsl(var(--virgilio-purple) / 0.15)',
  padding: '10px 14px',
}

export function ExperienceDistribution({ experienceBands, seniorityCounts, onBandClick, onSeniorityClick }: ExperienceDistributionProps) {
  const hasExperience = experienceBands.some(b => b.count > 0)
  const hasSeniority = seniorityCounts.length > 0

  const seniorityTotal = useMemo(
    () => seniorityCounts.reduce((sum, s) => sum + s.count, 0),
    [seniorityCounts]
  )

  if (!hasExperience && !hasSeniority) {
    return (
      <AnalyticsChartCard
        title="Experience Distribution"
        icon={Clock}
        isEmpty
        emptyMessage="No experience data available yet"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Years of Experience — Gradient Bar Chart */}
      {hasExperience && (
        <AnalyticsChartCard title="Years of Experience" icon={Clock} height="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={experienceBands} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="expBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(267, 100%, 62%)" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="hsl(267, 100%, 62%)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="band"
                tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-text))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={pillTooltipStyle}
                formatter={(value: number) => [`${value} candidates`, 'Count']}
              />
              <Bar
                dataKey="count"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
                fill="url(#expBarGradient)"
                onClick={(data) => onBandClick?.(data?.band)}
                className={onBandClick ? 'cursor-pointer' : ''}
              />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      )}

      {/* Seniority Levels — Donut with Center Stat + Legend */}
      {hasSeniority && (
        <AnalyticsChartCard title="Seniority Levels" icon={Users} height="h-[280px]">
          <div className="flex flex-col h-full">
            <div className="flex-1 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={seniorityCounts}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    innerRadius="55%"
                    paddingAngle={2}
                    stroke="none"
                    onClick={(data) => onSeniorityClick?.(data?.name)}
                    className={onSeniorityClick ? 'cursor-pointer' : ''}
                  >
                    {seniorityCounts.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={pillTooltipStyle}
                    formatter={(value: number, name: string) => [`${value} candidates`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center stat */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <span className="text-2xl font-poppins font-bold text-virgilio-text">{seniorityTotal}</span>
                  <p className="text-[10px] font-poppins text-virgilio-muted">Total</p>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2">
              {seniorityCounts.map((entry, i) => (
                <span
                  key={entry.name}
                  className="inline-flex items-center gap-1.5 text-[11px] font-poppins font-medium text-virgilio-muted"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {entry.name}
                </span>
              ))}
            </div>
          </div>
        </AnalyticsChartCard>
      )}
    </div>
  )
}
