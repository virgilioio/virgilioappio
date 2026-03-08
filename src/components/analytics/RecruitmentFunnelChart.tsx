import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { TrendingDown, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FunnelData {
  applications: number
  activeCandidates: number
  offers: number
  totalHires: number
}

interface RecruitmentFunnelChartProps {
  data: FunnelData
  isLoading?: boolean
}

export function RecruitmentFunnelChart({ data, isLoading }: RecruitmentFunnelChartProps) {
  const stages = [
    { label: 'Applications', value: data.applications, color: 'hsl(var(--virgilio-purple))', gradient: 'from-virgilio-purple/20 to-virgilio-purple/5' },
    { label: 'Active Candidates', value: data.activeCandidates, color: 'hsl(var(--info))', gradient: 'from-info/20 to-info/5' },
    { label: 'Offers', value: data.offers, color: 'hsl(var(--warning))', gradient: 'from-warning/20 to-warning/5' },
    { label: 'Hired', value: data.totalHires, color: 'hsl(var(--success))', gradient: 'from-success/20 to-success/5', isOutcome: true },
  ]

  const appToActive = data.applications > 0 ? ((data.activeCandidates / data.applications) * 100).toFixed(1) : '0'
  const activeToOffer = data.activeCandidates > 0 ? ((data.offers / data.activeCandidates) * 100).toFixed(1) : '0'
  const offerToHired = data.offers > 0 ? ((data.totalHires / data.offers) * 100).toFixed(1) : '0'
  const overallRate = data.applications > 0 ? ((data.totalHires / data.applications) * 100).toFixed(1) : '0'

  const maxValue = Math.max(data.applications, 1)
  const getWidth = (value: number) => Math.max((value / maxValue) * 100, 8)
  const getConversionRate = (index: number) => {
    if (index === 0) return appToActive
    if (index === 1) return activeToOffer
    if (index === 2) return offerToHired
    return '0'
  }

  const isEmpty = data.applications === 0 && data.activeCandidates === 0 && data.offers === 0 && data.totalHires === 0

  return (
    <AnalyticsChartCard
      title="Recruitment Funnel"
      icon={TrendingDown}
      isLoading={isLoading}
      isEmpty={isEmpty}
      height="h-auto"
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {stages.map((stage, index) => (
            <div key={stage.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-poppins font-medium text-virgilio-text">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.label}
                </span>
                <span className="font-poppins font-semibold" style={{ color: stage.color }}>
                  {stage.value.toLocaleString()}
                </span>
              </div>
              <div className="h-8 bg-virgilio-border/20 rounded-xl overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-xl bg-gradient-to-r transition-all duration-500',
                    stage.gradient,
                    stage.isOutcome && 'shadow-[0_0_12px_-2px] shadow-success/30',
                  )}
                  style={{ width: `${getWidth(stage.value)}%`, borderLeft: `3px solid ${stage.color}` }}
                />
              </div>
              {index < stages.length - 1 && (
                <div className="flex items-center justify-center py-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-virgilio-muted">
                    <ChevronDown className="h-3 w-3" />
                    <span className="font-poppins">{getConversionRate(index)}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-virgilio-border relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-virgilio-purple/40 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-poppins text-virgilio-muted">Overall Conversion Rate</span>
            <span className="text-lg font-poppins font-bold text-virgilio-purple">{overallRate}%</span>
          </div>
          <p className="text-xs text-virgilio-muted mt-1 font-poppins">Applications → Hired</p>
        </div>
      </div>
    </AnalyticsChartCard>
  )
}
