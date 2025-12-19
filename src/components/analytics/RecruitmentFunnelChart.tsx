import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingDown } from 'lucide-react'

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
    {
      label: 'Applications',
      value: data.applications,
      color: 'hsl(var(--virgilio-purple))',
      bgColor: 'hsl(var(--virgilio-purple) / 0.15)'
    },
    {
      label: 'Active Candidates',
      value: data.activeCandidates,
      color: 'hsl(var(--info))',
      bgColor: 'hsl(var(--info) / 0.15)'
    },
    {
      label: 'Offers',
      value: data.offers,
      color: 'hsl(var(--warning))',
      bgColor: 'hsl(var(--warning) / 0.15)'
    },
    {
      label: 'Hired',
      value: data.totalHires,
      color: 'hsl(var(--success))',
      bgColor: 'hsl(var(--success) / 0.15)'
    }
  ]

  // Calculate conversion rates
  const appToActive = data.applications > 0 
    ? ((data.activeCandidates / data.applications) * 100).toFixed(1) 
    : '0'
  const activeToOffer = data.activeCandidates > 0 
    ? ((data.offers / data.activeCandidates) * 100).toFixed(1) 
    : '0'
  const offerToHired = data.offers > 0 
    ? ((data.totalHires / data.offers) * 100).toFixed(1) 
    : '0'
  const overallRate = data.applications > 0 
    ? ((data.totalHires / data.applications) * 100).toFixed(1) 
    : '0'

  // Calculate bar widths (first stage is always 100%)
  const maxValue = Math.max(data.applications, 1)
  const getWidth = (value: number) => Math.max((value / maxValue) * 100, 8)

  // Get conversion rate for each stage transition
  const getConversionRate = (index: number) => {
    if (index === 0) return appToActive
    if (index === 1) return activeToOffer
    if (index === 2) return offerToHired
    return '0'
  }

  if (isLoading) {
    return (
      <Card className="border-virgilio-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-poppins font-semibold text-virgilio-text flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-virgilio-purple" />
            Recruitment Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-virgilio-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-poppins font-semibold text-virgilio-text flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-virgilio-purple" />
          Recruitment Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Funnel Bars */}
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div key={stage.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-poppins font-medium text-virgilio-text">{stage.label}</span>
                  <span className="font-poppins font-semibold" style={{ color: stage.color }}>
                    {stage.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-8 bg-virgilio-border/30 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3"
                    style={{
                      width: `${getWidth(stage.value)}%`,
                      backgroundColor: stage.bgColor,
                      borderLeft: `4px solid ${stage.color}`
                    }}
                  />
                </div>
                {/* Conversion arrow */}
                {index < stages.length - 1 && (
                  <div className="flex items-center justify-center py-1">
                    <div className="flex items-center gap-2 text-xs text-virgilio-muted">
                      <div className="h-4 w-px bg-virgilio-border" />
                      <span className="font-poppins">
                        {getConversionRate(index)}% conversion
                      </span>
                      <div className="h-4 w-px bg-virgilio-border" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Overall conversion rate */}
          <div className="pt-3 border-t border-virgilio-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-poppins text-virgilio-muted">Overall Conversion Rate</span>
              <span className="text-lg font-poppins font-bold text-virgilio-purple">{overallRate}%</span>
            </div>
            <p className="text-xs text-virgilio-muted mt-1 font-poppins">
              Applications → Hired
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
