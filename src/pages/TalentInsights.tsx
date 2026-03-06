import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { useTalentInsightsData } from '@/hooks/useTalentInsightsData'
import { SummaryMetricsRow } from '@/components/talent-insights/SummaryMetricsRow'
import { GeographyInsights } from '@/components/talent-insights/GeographyInsights'
import { ExperienceDistribution } from '@/components/talent-insights/ExperienceDistribution'
import { SkillsLandscape } from '@/components/talent-insights/SkillsLandscape'
import { CompensationInsights } from '@/components/talent-insights/CompensationInsights'
import { TalentPoolComposition } from '@/components/talent-insights/TalentPoolComposition'
import { TalentInsightEmptyState } from '@/components/talent-insights/TalentInsightEmptyState'

export default function TalentInsights() {
  const { data, isLoading, error } = useTalentInsightsData()

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <div className="min-h-screen bg-background">
          <Section variant="default" banded container className="animate-fade-in">
            <PageHeader
              title="Talent Insights"
              subtitle="Understand your candidate pool — geography, experience, skills, compensation, and composition."
            />
          </Section>

          <Section container className="animate-fade-in">
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center py-20">
                <p className="text-destructive text-sm">Failed to load talent insights</p>
              </div>
            )}

            {data && data.totalCandidates === 0 && (
              <TalentInsightEmptyState message="No candidates in your talent database yet" />
            )}

            {data && data.totalCandidates > 0 && (
              <div className="space-y-6">
                <SummaryMetricsRow data={data} />
                <GeographyInsights countryCounts={data.countryCounts} cityCounts={data.cityCounts} totalCandidates={data.totalCandidates} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <ExperienceDistribution experienceBands={data.experienceBands} seniorityCounts={data.seniorityCounts} />
                  <SkillsLandscape topSkills={data.topSkills} />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <CompensationInsights salaryStats={data.salaryStats} salaryBands={data.salaryBands} />
                  <TalentPoolComposition
                    functionalAreaCounts={data.functionalAreaCounts}
                    titleCounts={data.titleCounts}
                    specializationCounts={data.specializationCounts}
                  />
                </div>
              </div>
            )}
          </Section>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
