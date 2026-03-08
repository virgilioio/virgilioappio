import { MetricCard } from '@/components/ui/metric-card'
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <MetricCard
        title="Total Candidates"
        value={data.totalCandidates.toLocaleString()}
        icon={Users}
        tooltip="Total candidates in your talent database"
      />
      {data.avgExperience !== null && (
        <MetricCard
          title="Avg. Experience"
          value={data.avgExperience}
          suffix=" yrs"
          icon={Clock}
          tooltip="Average years of experience across all candidates"
        />
      )}
      {data.medianSalary !== null && (
        <MetricCard
          title="Median Salary"
          value={formatSalary(data.medianSalary)}
          icon={DollarSign}
          tooltip="Median annual salary expectation (normalized)"
        />
      )}
      {data.mostCommonRole && (
        <MetricCard
          title="Top Role"
          value={data.mostCommonRole}
          icon={Briefcase}
          tooltip="Most common role or functional area"
        />
      )}
      {data.enrichedPercentage !== null && (
        <MetricCard
          title="Enriched Profiles"
          value={data.enrichedPercentage}
          suffix="%"
          icon={Sparkles}
          tooltip="Percentage of candidates with AI-enriched profiles"
        />
      )}
    </div>
  )
}
