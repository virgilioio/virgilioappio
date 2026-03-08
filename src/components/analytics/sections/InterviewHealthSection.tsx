import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsKpiCard } from '@/components/analytics/shared/AnalyticsKpiCard'
import { InterviewTrendChart } from '@/components/analytics/charts/InterviewTrendChart'
import { Stethoscope, CalendarPlus, CalendarCheck, CalendarClock, XCircle, Percent } from 'lucide-react'
import type { InterviewHealthData } from '@/hooks/analytics/useInterviewHealthMetrics'

interface InterviewHealthSectionProps {
  data: InterviewHealthData
}

export function InterviewHealthSection({ data }: InterviewHealthSectionProps) {
  return (
    <AnalyticsSection
      title="Interview Health"
      subtitle="Interview scheduling, completion, and cancellation"
      icon={Stethoscope}
    >
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <AnalyticsKpiCard title="Scheduled" value={data.scheduled} icon={CalendarPlus} tooltip="Interviews scheduled in selected period" isLoading={data.isLoading} />
        <AnalyticsKpiCard title="Completed" value={data.completed} icon={CalendarCheck} tooltip="Interviews where scheduled_start has passed" isLoading={data.isLoading} />
        <AnalyticsKpiCard title="Upcoming" value={data.upcoming} icon={CalendarClock} tooltip="Interviews scheduled in the future" isLoading={data.isLoading} />
        <AnalyticsKpiCard title="Cancelled" value={data.cancelled} icon={XCircle} tooltip="Cancelled interviews in period" isLoading={data.isLoading} />
        <AnalyticsKpiCard title="Completion Rate" value={data.completionRate} icon={Percent} suffix="%" tooltip="Completed / Scheduled in period" isLoading={data.isLoading} />
      </div>
      <InterviewTrendChart data={data.trendData} isLoading={data.isLoading} />
    </AnalyticsSection>
  )
}
