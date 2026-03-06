import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TalentInsightEmptyState } from './TalentInsightEmptyState'
import type { SkillEntry } from '@/hooks/useTalentInsightsData'

interface SkillsLandscapeProps {
  topSkills: SkillEntry[]
  onSkillClick?: (skill: string) => void
}

const PURPLE = 'hsl(267, 100%, 62%)'
const PURPLE_LIGHT = 'hsl(267, 80%, 75%)'

export function SkillsLandscape({ topSkills, onSkillClick }: SkillsLandscapeProps) {
  if (topSkills.length === 0) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
            Skills Landscape
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalentInsightEmptyState message="No skills data available yet" />
        </CardContent>
      </Card>
    )
  }

  const handleBarClick = (data: any) => {
    if (onSkillClick && data?.name) onSkillClick(data.name)
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
          Skills Landscape
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs font-poppins font-medium text-virgilio-muted mb-3">Top Skills Across Candidates</p>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSkills} layout="vertical" margin={{ left: 120, right: 40, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--virgilio-text))' }} width={120} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                formatter={(value: number, _: string, props: any) => [
                  `${props.payload.count} candidates (${value}%)`,
                  'Frequency'
                ]}
              />
              <Bar
                dataKey="percentage"
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
                onClick={handleBarClick}
                className={onSkillClick ? 'cursor-pointer' : ''}
              >
                {topSkills.map((_, i) => (
                  <Cell key={i} fill={i < 5 ? PURPLE : PURPLE_LIGHT} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
