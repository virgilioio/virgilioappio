import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { MetricCard } from '@/components/ui/metric-card'
import { MetricCardGroup } from '@/components/ui/metric-card-group'
import { MiniSparkline } from '@/components/ui/mini-sparkline'
import { ApplicationsTrendChart } from '@/components/analytics/ApplicationsTrendChart'
import { FileText, UserCheck, Clock } from 'lucide-react'
import { BarChart3 } from 'lucide-react'
import type { AnalyticsMetrics } from '@/hooks/useAnalyticsMetrics'
import { useMemo } from 'react'

interface OverviewSectionProps {
  metrics: AnalyticsMetrics
}

export function OverviewSection({ metrics }: OverviewSectionProps) {
  const appSparkData = useMemo(() => metrics.trendData.map(d => d.applications), [metrics.trendData])
  const hiresSparkData = useMemo(() => metrics.trendData.map(d => d.hires), [metrics.trendData])
  const offersSparkData = useMemo(() => metrics.trendData.map(d => d.offers), [metrics.trendData])
  const rejectedSparkData = useMemo(() => metrics.trendData.map(d => d.rejected), [metrics.trendData])
  const interviewsCompletedSparkData = useMemo(() => metrics.trendData.map(d => d.interviewsCompleted), [metrics.trendData])

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
          iconColor="text-primary"
          tooltip="New applications in selected period"
          isLoading={metrics.isLoading}
          sparkline={<MiniSparkline data={appSparkData} color="hsl(267 100% 62%)" />}
        />
        <MetricCard
          variant="hero"
          title="Hires"
          value={metrics.totalHires}
          icon={UserCheck}
          iconColor="text-virgilio-success"
          tooltip="Candidates hired in selected period"
          isLoading={metrics.isLoading}
          sparkline={<MiniSparkline data={hiresSparkData} color="hsl(152 69% 41%)" />}
        />
        <MetricCard
          variant="hero"
          title="Avg Time to Hire"
          value={metrics.avgTimeToHire}
          suffix="d"
          icon={Clock}
          iconColor="text-warning"
          tooltip="Average days from candidate creation to hire"
          isLoading={metrics.isLoading}
          sparkline={<MiniSparkline data={hiresSparkData} color="hsl(38 92% 50%)" />}
        />
      </div>

      {/* Row 2: Grouped strips — vertical with sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricCardGroup title="Pipeline" direction="vertical">
          <MetricCard variant="inline" title="Active" value={metrics.activeCandidates} tooltip="Currently active candidates (all time)" isLoading={metrics.isLoading} sparkline={<MiniSparkline data={appSparkData} color="hsl(217 91% 60%)" />} />
          <MetricCard variant="inline" title="Offers" value={metrics.totalOffers} tooltip="Offers extended in selected period" isLoading={metrics.isLoading} />
          <MetricCard variant="inline" title="Rejected" value={metrics.rejectedCandidates} tooltip="Total rejected candidates (all time)" isLoading={metrics.isLoading} />
        </MetricCardGroup>

        <MetricCardGroup title="Interviews" direction="vertical">
          <MetricCard variant="inline" title="Scheduled" value={metrics.interviewsScheduled} tooltip="Interviews scheduled in selected period" isLoading={metrics.isLoading} sparkline={<MiniSparkline data={appSparkData} color="hsl(267 100% 62%)" />} />
          <MetricCard variant="inline" title="Completed" value={metrics.interviewsCompleted} tooltip="Interviews completed in selected period" isLoading={metrics.isLoading} sparkline={<MiniSparkline data={hiresSparkData} color="hsl(152 69% 41%)" />} />
        </MetricCardGroup>
      </div>

      <ApplicationsTrendChart data={metrics.trendData} isLoading={metrics.isLoading} />
    </AnalyticsSection>
  )
}
