import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { TalentInsightEmptyState } from './TalentInsightEmptyState'
import type { ExperienceBand, CountEntry } from '@/hooks/useTalentInsightsData'

interface ExperienceDistributionProps {
  experienceBands: ExperienceBand[]
  seniorityCounts: CountEntry[]
  onBandClick?: (band: string) => void
  onSeniorityClick?: (seniority: string) => void
}

const PURPLE = 'hsl(267, 100%, 62%)'
const PIE_COLORS = [
  'hsl(267, 100%, 62%)',
  'hsl(267, 80%, 72%)',
  'hsl(267, 60%, 82%)',
  'hsl(267, 40%, 88%)',
  'hsl(300, 60%, 70%)',
]

export function ExperienceDistribution({ experienceBands, seniorityCounts, onBandClick, onSeniorityClick }: ExperienceDistributionProps) {
  const hasExperience = experienceBands.some(b => b.count > 0)
  const hasSeniority = seniorityCounts.length > 0

  if (!hasExperience && !hasSeniority) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Experience Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalentInsightEmptyState message="No experience data available yet" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
          Experience Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasExperience && (
            <div>
              <p className="text-xs font-poppins font-medium text-virgilio-muted mb-3">Years of Experience</p>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={experienceBands} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                    <XAxis dataKey="band" tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-text))' }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                      formatter={(value: number) => [`${value} candidates`, 'Count']}
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                      onClick={(data) => onBandClick?.(data?.band)}
                      className={onBandClick ? 'cursor-pointer' : ''}
                    >
                      {experienceBands.map((_, i) => (
                        <Cell key={i} fill={PURPLE} opacity={0.6 + (i * 0.1)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {hasSeniority && (
            <div>
              <p className="text-xs font-poppins font-medium text-virgilio-muted mb-3">Seniority Levels</p>
              <div className="h-[240px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={seniorityCounts}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      onClick={(data) => onSeniorityClick?.(data?.name)}
                      className={onSeniorityClick ? 'cursor-pointer' : ''}
                    >
                      {seniorityCounts.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} candidates`, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
