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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Hero — Total Candidates */}
      <MetricCard
        variant="hero"
        title="Total Candidates"
        value={data.totalCandidates.toLocaleString()}
        icon={Users}
        tooltip="Total candidates in your talent database"
      />

      {/* Grouped strip — secondary metrics */}
      <MetricCardGroup title="Talent Snapshot" className="md:col-span-3">
        {data.avgExperience !== null && (
          <MetricCard
            variant="inline"
            title="Avg. Experience"
            value={data.avgExperience}
            suffix=" yrs"
            tooltip="Average years of experience across all candidates"
          />
        )}
        {data.medianSalary !== null && (
          <MetricCard
            variant="inline"
            title="Median Salary"
            value={formatSalary(data.medianSalary)}
            tooltip="Median annual salary expectation (normalized)"
          />
        )}
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
  )
}
