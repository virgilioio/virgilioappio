import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsEmptyState } from '@/components/analytics/shared/AnalyticsEmptyState'
import { TalentDistributionChart } from '@/components/analytics/charts/TalentDistributionChart'
import { Sparkles } from 'lucide-react'
import type { TalentInsightsData } from '@/hooks/analytics/useTalentInsightsMetrics'

interface TalentInsightsSectionProps {
  data: TalentInsightsData
}

export function TalentInsightsSection({ data }: TalentInsightsSectionProps) {
  const hasData = data.seniorityDistribution.length > 0 || data.topSkills.length > 0 || data.geographyDistribution.length > 0 || data.experienceDistribution.length > 0
  const isEmpty = !hasData && !data.isLoading

  return (
    <AnalyticsSection
      title="Talent Insights"
      subtitle="Profile-level distributions across your candidate pipeline"
      icon={Sparkles}
    >
      {isEmpty ? (
        <AnalyticsEmptyState
          icon={Sparkles}
          title="No talent data available"
          description="Candidate profile fields like seniority, skills, and location will appear here"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TalentDistributionChart
            title="Seniority Distribution"
            data={data.seniorityDistribution}
            isLoading={data.isLoading}
            color="hsl(var(--virgilio-purple))"
          />
          <TalentDistributionChart
            title="Years of Experience"
            data={data.experienceDistribution}
            isLoading={data.isLoading}
            color="hsl(var(--info))"
          />
          <TalentDistributionChart
            title="Top Skills"
            data={data.topSkills}
            isLoading={data.isLoading}
            color="hsl(var(--success))"
          />
          <TalentDistributionChart
            title="Geography"
            data={data.geographyDistribution}
            isLoading={data.isLoading}
            color="hsl(var(--warning))"
          />
        </div>
      )}
    </AnalyticsSection>
  )
}
