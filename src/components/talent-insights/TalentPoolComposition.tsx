import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TalentInsightEmptyState } from './TalentInsightEmptyState'
import type { CountEntry } from '@/hooks/useTalentInsightsData'

interface TalentPoolCompositionProps {
  functionalAreaCounts: CountEntry[]
  titleCounts: CountEntry[]
  specializationCounts: CountEntry[]
}

const PURPLE = 'hsl(267, 100%, 62%)'
const PURPLE_LIGHT = 'hsl(267, 80%, 75%)'

function MiniBarChart({ data, label }: { data: CountEntry[]; label: string }) {
  if (data.length === 0) return null

  return (
    <div>
      <p className="text-xs font-poppins font-medium text-virgilio-muted mb-3">{label}</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: 100, right: 16, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--virgilio-text))' }} width={100} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
              formatter={(value: number) => [`${value} candidates`, 'Count']}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {data.slice(0, 8).map((_, i) => (
                <Cell key={i} fill={i < 3 ? PURPLE : PURPLE_LIGHT} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function TalentPoolComposition({ functionalAreaCounts, titleCounts, specializationCounts }: TalentPoolCompositionProps) {
  const hasAny = functionalAreaCounts.length > 0 || titleCounts.length > 0 || specializationCounts.length > 0

  if (!hasAny) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Talent Pool Composition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalentInsightEmptyState message="No role composition data available yet" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
          Talent Pool Composition
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <MiniBarChart data={titleCounts} label="By Role" />
          <MiniBarChart data={functionalAreaCounts} label="By Functional Area" />
          <MiniBarChart data={specializationCounts} label="By Specialization" />
        </div>
      </CardContent>
    </Card>
  )
}
