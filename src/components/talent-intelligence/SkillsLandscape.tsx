import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { Sparkles } from 'lucide-react'
import type { SkillEntry } from '@/hooks/useTalentIntelligenceData'

interface SkillsLandscapeProps {
  topSkills: SkillEntry[]
  onSkillClick?: (skill: string) => void
}

const PURPLE = 'hsl(267, 100%, 62%)'
const PURPLE_LIGHT = 'hsl(267, 80%, 75%)'

const pillTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--virgilio-border))',
  borderRadius: '16px',
  fontFamily: 'Poppins, sans-serif',
  fontSize: '12px',
  boxShadow: '0 8px 24px -8px hsl(var(--virgilio-purple) / 0.15)',
  padding: '10px 14px',
}

export function SkillsLandscape({ topSkills, onSkillClick }: SkillsLandscapeProps) {
  const handleBarClick = (data: any) => {
    if (onSkillClick && data?.name) onSkillClick(data.name)
  }

  return (
    <AnalyticsChartCard
      title="Skills Landscape"
      subtitle="Top Skills Across Candidates"
      icon={Sparkles}
      isEmpty={topSkills.length === 0}
      emptyMessage="No skills data available yet"
      height="h-[400px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={topSkills} layout="vertical" margin={{ left: 120, right: 40, top: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="skillBarGradientTop" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={PURPLE} stopOpacity={0.9} />
              <stop offset="100%" stopColor={PURPLE} stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="skillBarGradientRest" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={PURPLE_LIGHT} stopOpacity={0.7} />
              <stop offset="100%" stopColor={PURPLE_LIGHT} stopOpacity={0.25} />
            </linearGradient>
            <filter id="skillGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: 'hsl(var(--virgilio-text))' }}
            width={120}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={pillTooltipStyle}
            formatter={(value: number, _: string, props: any) => [
              `${props.payload.count} candidates (${value}%)`,
              'Frequency'
            ]}
          />
          <Bar
            dataKey="percentage"
            radius={[0, 6, 6, 0]}
            maxBarSize={20}
            onClick={handleBarClick}
            className={onSkillClick ? 'cursor-pointer' : ''}
          >
            {topSkills.map((_, i) => (
              <Cell
                key={i}
                fill={i < 5 ? 'url(#skillBarGradientTop)' : 'url(#skillBarGradientRest)'}
                filter={i < 5 ? 'url(#skillGlow)' : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
