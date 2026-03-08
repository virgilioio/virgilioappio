import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { MetricCard } from '@/components/ui/metric-card'
import { MetricCardGroup } from '@/components/ui/metric-card-group'
import { ApplicationsTrendChart } from '@/components/analytics/ApplicationsTrendChart'
import { FileText, UserCheck, Clock, Users, Gift, UserX, CalendarPlus, CalendarCheck } from 'lucide-react'
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
      {/* Row 1: Hero KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          variant="hero"
          title="Applications"
          value={metrics.applications}
          icon={FileText}
          tooltip="New applications in selected period"
          isLoading={metrics.isLoading}
        />
        <MetricCard
          variant="hero"
          title="Hires"
          value={metrics.totalHires}
          icon={UserCheck}
          tooltip="Candidates hired in selected period"
          isLoading={metrics.isLoading}
        />
        <MetricCard
          variant="hero"
          title="Avg Time to Hire"
          value={metrics.avgTimeToHire}
          suffix="d"
          icon={Clock}
          tooltip="Average days from candidate creation to hire"
          isLoading={metrics.isLoading}
        />
      </div>

      {/* Row 2: Grouped strips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricCardGroup title="Pipeline">
          <MetricCard variant="inline" title="Active" value={metrics.activeCandidates} tooltip="Currently active candidates (all time)" isLoading={metrics.isLoading} />
          <MetricCard variant="inline" title="Offers" value={metrics.totalOffers} tooltip="Offers extended in selected period" isLoading={metrics.isLoading} />
          <MetricCard variant="inline" title="Rejected" value={metrics.rejectedCandidates} tooltip="Total rejected candidates (all time)" isLoading={metrics.isLoading} />
        </MetricCardGroup>

        <MetricCardGroup title="Interviews">
          <MetricCard variant="inline" title="Scheduled" value={metrics.interviewsScheduled} tooltip="Interviews scheduled in selected period" isLoading={metrics.isLoading} />
          <MetricCard variant="inline" title="Completed" value={metrics.interviewsCompleted} tooltip="Interviews completed in selected period" isLoading={metrics.isLoading} />
        </MetricCardGroup>
      </div>

      <ApplicationsTrendChart data={metrics.trendData} isLoading={metrics.isLoading} />
    </AnalyticsSection>
  )
}
