import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsChartCard } from '@/components/analytics/shared/AnalyticsChartCard'
import { AnalyticsTableCard } from '@/components/analytics/shared/AnalyticsTableCard'
import { AnalyticsInsightCallout } from '@/components/analytics/shared/AnalyticsInsightCallout'
import { StageDistributionChart } from '@/components/analytics/StageDistributionChart'
import { TimeInStageChart } from '@/components/analytics/charts/TimeInStageChart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Layers, AlertTriangle } from 'lucide-react'
import type { AnalyticsMetrics } from '@/hooks/useAnalyticsMetrics'
import type { StagePerformanceData } from '@/hooks/analytics/useStagePerformanceMetrics'

interface StagePerformanceSectionProps {
  metrics: AnalyticsMetrics
  stageData: StagePerformanceData
}

export function StagePerformanceSection({ metrics, stageData }: StagePerformanceSectionProps) {
  const stuckCount = stageData.stuckCandidates.length

  return (
    <AnalyticsSection
      title="Stage Performance"
      subtitle="How candidates move through your pipeline stages"
      icon={Layers}
    >
      {stuckCount > 0 && (
        <AnalyticsInsightCallout
          variant="warning"
          title={`${stuckCount} candidate${stuckCount > 1 ? 's' : ''} stuck in pipeline`}
          description="These candidates have been in their current stage for more than 14 days"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StageDistributionChart data={metrics.stageDistribution} isLoading={metrics.isLoading} />
        <TimeInStageChart data={stageData.avgTimePerStage} isLoading={stageData.isLoading} />
      </div>

      {stuckCount > 0 && (
        <AnalyticsTableCard
          title="Stuck Candidates"
          subtitle="Active candidates in the same stage for 14+ days"
          icon={AlertTriangle}
          maxHeight="max-h-[300px]"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stageData.stuckCandidates.map(c => (
                <TableRow key={c.associationId}>
                  <TableCell className="font-medium font-poppins text-sm">{c.candidateName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{c.jobTitle}</TableCell>
                  <TableCell className="text-sm">{c.stageName}</TableCell>
                  <TableCell className="text-right font-poppins font-semibold text-warning">{c.daysInStage}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AnalyticsTableCard>
      )}
    </AnalyticsSection>
  )
}
