import { MetricCard } from '@/components/ui/metric-card'
import { MetricCardGroup } from '@/components/ui/metric-card-group'
import { Users, Clock, DollarSign, Briefcase, Sparkles } from 'lucide-react'
import type { TalentIntelligenceData } from '@/hooks/useTalentIntelligenceData'

interface SummaryMetricsRowProps {
  data: TalentIntelligenceData
}

export function SummaryMetricsRow({ data }: SummaryMetricsRowProps) {
  const formatSalary = (val: number) => {
    if (val >= 1000) return `$${Math.round(val / 1000)}k`
    return `$${val}`
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Hero KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          variant="hero"
          title="Total Candidates"
          value={data.totalCandidates.toLocaleString()}
          icon={Users}
          iconColor="text-primary"
          tooltip="Total candidates in your talent database"
        />
        {data.medianSalary !== null && (
          <MetricCard
            variant="hero"
            title="Median Salary"
            value={formatSalary(data.medianSalary)}
            icon={DollarSign}
            iconColor="text-virgilio-success"
            tooltip="Median annual salary expectation (normalized)"
          />
        )}
        {data.avgExperience !== null && (
          <MetricCard
            variant="hero"
            title="Avg. Experience"
            value={data.avgExperience}
            suffix=" yrs"
            icon={Clock}
            iconColor="text-warning"
            tooltip="Average years of experience across all candidates"
          />
        )}
      </div>

      {/* Row 2: Grouped strips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricCardGroup title="Composition" direction="vertical">
          {data.mostCommonRole && (
            <MetricCard
              variant="inline"
              title="Top Role"
              value={data.mostCommonRole}
              tooltip="Most common role or functional area"
            />
          )}
          {data.enrichedPercentage !== null && (
            <MetricCard
              variant="inline"
              title="Enriched Profiles"
              value={data.enrichedPercentage}
              suffix="%"
              tooltip="Percentage of candidates with AI-enriched profiles"
            />
          )}
        </MetricCardGroup>
      </div>
    </div>
  )
}
