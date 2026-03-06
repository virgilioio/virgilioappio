import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TalentInsightEmptyState } from './TalentInsightEmptyState'
import type { CountEntry } from '@/hooks/useTalentInsightsData'

interface GeographyInsightsProps {
  countryCounts: CountEntry[]
  cityCounts: CountEntry[]
}

const PURPLE = 'hsl(267, 100%, 62%)'
const PURPLE_LIGHT = 'hsl(267, 100%, 82%)'

export function GeographyInsights({ countryCounts, cityCounts }: GeographyInsightsProps) {
  if (countryCounts.length === 0 && cityCounts.length === 0) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Candidate Geography
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalentInsightEmptyState message="No location data available yet" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
          Candidate Geography
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Countries bar chart */}
          {countryCounts.length > 0 && (
            <div>
              <p className="text-xs font-poppins font-medium text-virgilio-muted mb-3">Top Countries</p>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryCounts} layout="vertical" margin={{ left: 80, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--virgilio-text))' }} width={80} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                      formatter={(value: number) => [`${value} candidates`, 'Count']}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {countryCounts.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? PURPLE : PURPLE_LIGHT} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top cities list */}
          {cityCounts.length > 0 && (
            <div>
              <p className="text-xs font-poppins font-medium text-virgilio-muted mb-3">Top Cities</p>
              <div className="space-y-2">
                {cityCounts.map((city, i) => (
                  <div key={city.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-poppins font-semibold text-virgilio-muted w-5">{i + 1}</span>
                      <span className="text-sm font-poppins text-virgilio-text">{city.name}</span>
                    </div>
                    <span className="text-sm font-poppins font-semibold text-virgilio-purple">{city.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
