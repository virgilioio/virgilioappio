import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsKpiCard } from '@/components/analytics/shared/AnalyticsKpiCard'
import { ApplicationsTrendChart } from '@/components/analytics/ApplicationsTrendChart'
import { FileText, Users, UserCheck, CalendarPlus, CalendarCheck, UserX, Clock, Gift } from 'lucide-react'
import { BarChart3 } from 'lucide-react'
import type { AnalyticsMetrics } from '@/hooks/useAnalyticsMetrics'

interface OverviewSectionProps {
  metrics: AnalyticsMetrics
}

export function OverviewSection({ metrics }: OverviewSectionProps) {
  return (
    <AnalyticsSection
      title="Overview"
      subtitle="Key recruiting metrics at a glance"
      icon={BarChart3}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <AnalyticsKpiCard title="Applications" value={metrics.applications} icon={FileText} tooltip="New applications in selected period" isLoading={metrics.isLoading} />
        <AnalyticsKpiCard title="Active" value={metrics.activeCandidates} icon={Users} tooltip="Currently active candidates (all time)" isLoading={metrics.isLoading} />
        <AnalyticsKpiCard title="Hires" value={metrics.totalHires} icon={UserCheck} tooltip="Candidates hired in selected period" isLoading={metrics.isLoading} />
        <AnalyticsKpiCard title="Offers" value={metrics.totalOffers} icon={Gift} tooltip="Offers extended in selected period" isLoading={metrics.isLoading} />
        <AnalyticsKpiCard title="Scheduled" value={metrics.interviewsScheduled} icon={CalendarPlus} tooltip="Interviews scheduled in selected period" isLoading={metrics.isLoading} />
        <AnalyticsKpiCard title="Completed" value={metrics.interviewsCompleted} icon={CalendarCheck} tooltip="Interviews completed in selected period" isLoading={metrics.isLoading} />
        <AnalyticsKpiCard title="Rejected" value={metrics.rejectedCandidates} icon={UserX} tooltip="Total rejected candidates (all time)" isLoading={metrics.isLoading} />
        <AnalyticsKpiCard title="Avg Time to Hire" value={metrics.avgTimeToHire} icon={Clock} suffix="d" tooltip="Average days from candidate creation to hire" isLoading={metrics.isLoading} />
      </div>
      <ApplicationsTrendChart data={metrics.trendData} isLoading={metrics.isLoading} />
    </AnalyticsSection>
  )
}
