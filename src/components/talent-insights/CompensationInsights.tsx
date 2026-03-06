import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { TalentInsightEmptyState } from './TalentInsightEmptyState'
import type { SalaryStats, CountEntry } from '@/hooks/useTalentInsightsData'

interface CompensationInsightsProps {
  salaryStats: SalaryStats | null
  salaryBands: CountEntry[]
}

const PURPLE = 'hsl(267, 100%, 62%)'
const PURPLE_15 = 'hsla(267, 100%, 62%, 0.15)'

function formatSalary(val: number) {
  if (val >= 1000) return `$${Math.round(val / 1000)}k`
  return `$${val}`
}

export function CompensationInsights({ salaryStats, salaryBands }: CompensationInsightsProps) {
  const hasData = salaryBands.some(b => b.count > 0)

  if (!hasData) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Compensation Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalentInsightEmptyState message="No salary data available yet" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
          Compensation Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stats markers */}
        {salaryStats && (
          <div className="flex gap-6 mb-4">
            <div className="text-center">
              <p className="text-xs font-poppins text-virgilio-muted">P25</p>
              <p className="text-lg font-bold text-virgilio-text">{formatSalary(salaryStats.p25)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-poppins text-virgilio-muted">Median</p>
              <p className="text-lg font-bold text-virgilio-purple">{formatSalary(salaryStats.median)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-poppins text-virgilio-muted">P75</p>
              <p className="text-lg font-bold text-virgilio-text">{formatSalary(salaryStats.p75)}</p>
            </div>
            <div className="text-center ml-auto">
              <p className="text-xs font-poppins text-virgilio-muted">Candidates</p>
              <p className="text-lg font-bold text-virgilio-text">{salaryStats.count}</p>
            </div>
          </div>
        )}

        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salaryBands} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-text))' }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                formatter={(value: number) => [`${value} candidates`, 'Count']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {salaryBands.map((_, i) => (
                  <Cell key={i} fill={PURPLE} opacity={0.15 + (i * 0.15)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
