import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { MetricCard } from '@/components/ui/metric-card'
import { MetricCardGroup } from '@/components/ui/metric-card-group'
import { MiniSparkline } from '@/components/ui/mini-sparkline'
import { InterviewTrendChart } from '@/components/analytics/charts/InterviewTrendChart'
import { Stethoscope } from 'lucide-react'
import type { InterviewHealthData } from '@/hooks/analytics/useInterviewHealthMetrics'
import { useMemo } from 'react'

interface InterviewHealthSectionProps {
  data: InterviewHealthData
}

export function InterviewHealthSection({ data }: InterviewHealthSectionProps) {
  const scheduledSpark = useMemo(() => data.trendData.map(d => d.scheduled), [data.trendData])
  const completedSpark = useMemo(() => data.trendData.map(d => d.completed), [data.trendData])

  return (
    <AnalyticsSection
      title="Interview Health"
      subtitle="Interview scheduling, completion, and cancellation"
      icon={Stethoscope}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricCardGroup title="Activity">
          <MetricCard variant="inline" title="Scheduled" value={data.scheduled} tooltip="Interviews scheduled in selected period" isLoading={data.isLoading} sparkline={<MiniSparkline data={scheduledSpark} color="hsl(267 100% 62%)" height={32} />} />
          <MetricCard variant="inline" title="Completed" value={data.completed} tooltip="Interviews where scheduled_start has passed" isLoading={data.isLoading} sparkline={<MiniSparkline data={completedSpark} color="hsl(152 69% 41%)" height={32} />} />
          <MetricCard variant="inline" title="Upcoming" value={data.upcoming} tooltip="Interviews scheduled in the future" isLoading={data.isLoading} />
        </MetricCardGroup>

        <MetricCardGroup title="Outcomes">
          <MetricCard variant="inline" title="Cancelled" value={data.cancelled} tooltip="Cancelled interviews in period" isLoading={data.isLoading} />
          <MetricCard variant="inline" title="Completion Rate" value={data.completionRate} suffix="%" tooltip="Completed / Scheduled in period" isLoading={data.isLoading} />
        </MetricCardGroup>
      </div>
      <InterviewTrendChart data={data.trendData} isLoading={data.isLoading} />
    </AnalyticsSection>
  )
}
