import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTalentOriginsData, type OriginSegment } from '@/hooks/useTalentOriginsData'

interface TalentOriginsProps {
  filteredCandidateIds: string[]
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

const segments: { value: OriginSegment; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'current', label: 'Current' },
  { value: 'previous', label: 'Previous' },
]

function CompanyInitial({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <div className="w-6 h-6 rounded-md bg-virgilio-purple/10 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-poppins font-semibold text-virgilio-purple">{initial}</span>
    </div>
  )
}

function CompanyAvatar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (!logoUrl) return <CompanyInitial name={name} />
  return (
    <img
      src={logoUrl}
      alt={name}
      className="w-6 h-6 rounded-md object-contain bg-background"
      onError={(e) => {
        // Replace with initials fallback on error
        const target = e.currentTarget
        target.style.display = 'none'
        target.parentElement?.querySelector('.fallback')?.classList.remove('hidden')
      }}
    />
  )
}

// Custom Y-axis tick with company avatar + name
function CustomYTick(props: any) {
  const { x, y, payload, companies } = props
  const entry = companies?.find((c: any) => c.companyName === payload.value)
  const logoUrl = entry?.logoUrl ?? null
  const name = payload.value as string
  const maxLen = 18
  const truncated = name.length > maxLen ? name.slice(0, maxLen) + '…' : name

  return (
    <foreignObject x={x - 150} y={y - 12} width={150} height={24}>
      <div className="flex items-center gap-1.5 justify-end h-full pr-1">
        <CompanyAvatar name={name} logoUrl={logoUrl} />
        <span className="text-[11px] font-poppins text-virgilio-text truncate max-w-[100px]" title={name}>
          {truncated}
        </span>
      </div>
    </foreignObject>
  )
}

export function TalentOrigins({ filteredCandidateIds }: TalentOriginsProps) {
  const { companies, isLoading, segment, setSegment } = useTalentOriginsData(filteredCandidateIds)

  const segmentToggle = (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {segments.map(s => (
        <Button
          key={s.value}
          variant="ghost"
          size="sm"
          onClick={() => setSegment(s.value)}
          className={`h-6 px-2.5 text-[11px] font-poppins rounded-md transition-all ${
            segment === s.value
              ? 'bg-background text-virgilio-text shadow-sm'
              : 'text-virgilio-muted hover:text-virgilio-text'
          }`}
        >
          {s.label}
        </Button>
      ))}
    </div>
  )

  return (
    <AnalyticsChartCard
      title="Talent Origins"
      subtitle="Top Companies Candidates Come From"
      icon={Building2}
      isEmpty={!isLoading && companies.length === 0}
      isLoading={isLoading}
      emptyMessage="No work experience data available"
      emptyDescription="Company origin data will appear once candidates have work experience entries"
      height="h-[400px]"
      actions={segmentToggle}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={companies} layout="vertical" margin={{ left: 160, right: 40, top: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="originBarGradientTop" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={PURPLE} stopOpacity={0.9} />
              <stop offset="100%" stopColor={PURPLE} stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="originBarGradientRest" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={PURPLE_LIGHT} stopOpacity={0.7} />
              <stop offset="100%" stopColor={PURPLE_LIGHT} stopOpacity={0.25} />
            </linearGradient>
            <filter id="originGlow">
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
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="companyName"
            width={160}
            tickLine={false}
            axisLine={false}
            tick={(props: any) => <CustomYTick {...props} companies={companies} />}
          />
          <Tooltip
            contentStyle={pillTooltipStyle}
            formatter={(value: number, _: string, props: any) => {
              const entry = props.payload
              const parts = [`${value} candidate${value !== 1 ? 's' : ''}`]
              if (entry.industry) parts.push(`Industry: ${entry.industry}`)
              return [parts.join(' · '), 'Origin']
            }}
          />
          <Bar
            dataKey="count"
            radius={[0, 6, 6, 0]}
            maxBarSize={20}
          >
            {companies.map((_, i) => (
              <Cell
                key={i}
                fill={i < 5 ? 'url(#originBarGradientTop)' : 'url(#originBarGradientRest)'}
                filter={i < 5 ? 'url(#originGlow)' : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsChartCard>
  )
}
