import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { PipelineOverviewTable } from '@/components/analytics/PipelineOverviewTable'
import { RecruitmentFunnelChart } from '@/components/analytics/RecruitmentFunnelChart'
import { CandidateStatusPieChart } from '@/components/analytics/CandidateStatusPieChart'
import { GitBranch } from 'lucide-react'
import type { AnalyticsMetrics } from '@/hooks/useAnalyticsMetrics'

interface PipelineHealthSectionProps {
  metrics: AnalyticsMetrics
}

export function PipelineHealthSection({ metrics }: PipelineHealthSectionProps) {
  return (
    <AnalyticsSection
      title="Pipeline Health"
      subtitle="Current state of your hiring pipeline across all jobs"
      icon={GitBranch}
    >
      <PipelineOverviewTable jobIds={metrics.finalJobIds} isLoading={metrics.isLoading} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecruitmentFunnelChart
          data={{
            applications: metrics.applications,
            activeCandidates: metrics.activeCandidates,
            offers: metrics.totalOffers,
            totalHires: metrics.totalHires,
          }}
          isLoading={metrics.isLoading}
        />
        <CandidateStatusPieChart data={metrics.statusDistribution} isLoading={metrics.isLoading} />
      </div>
    </AnalyticsSection>
  )
}
