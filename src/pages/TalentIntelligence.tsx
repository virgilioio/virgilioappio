import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { useTalentIntelligenceData } from '@/hooks/useTalentIntelligenceData'
import { useTalentIntelligenceFilterOptions } from '@/hooks/useTalentIntelligenceFilterOptions'
import { TalentIntelligenceFilterProvider, useTalentIntelligenceFilters } from '@/contexts/TalentIntelligenceFilterContext'
import { SummaryMetricsRow } from '@/components/talent-intelligence/SummaryMetricsRow'
import { GeographyInsights } from '@/components/talent-intelligence/GeographyInsights'
import { ExperienceDistribution } from '@/components/talent-intelligence/ExperienceDistribution'
import { SkillsLandscape } from '@/components/talent-intelligence/SkillsLandscape'
import { CompensationInsights } from '@/components/talent-intelligence/CompensationInsights'
import { TalentPoolComposition } from '@/components/talent-intelligence/TalentPoolComposition'
import { TalentIntelligenceEmptyState } from '@/components/talent-intelligence/TalentIntelligenceEmptyState'
import { TalentIntelligenceFilterBar } from '@/components/talent-intelligence/TalentIntelligenceFilterBar'
import { Button } from '@/components/ui/button'

function TalentIntelligenceContent() {
  const { filters, clearAll, hasActiveFilters, toggleArrayFilter, setNumericFilter } = useTalentIntelligenceFilters()
  const { data, rawCandidates, isLoading, error } = useTalentIntelligenceData(filters)
  const filterOptions = useTalentIntelligenceFilterOptions(rawCandidates)

  const handleFilterApply = (key: string, value: string) => {
    const keyMap: Record<string, 'roles' | 'functionalAreas' | 'specializations' | 'seniorities' | 'skills' | 'countries' | 'states' | 'cities'> = {
      role: 'roles',
      functionalArea: 'functionalAreas',
      specialization: 'specializations',
      seniority: 'seniorities',
      skill: 'skills',
      country: 'countries',
      state: 'states',
      city: 'cities',
    }
    const filterKey = keyMap[key]
    if (filterKey) toggleArrayFilter(filterKey, value)
  }

  const handleExperienceBandClick = (band: string) => {
    const bandMap: Record<string, [number, number]> = {
      '0–2 years': [0, 2],
      '3–5 years': [3, 5],
      '6–10 years': [6, 10],
      '10+ years': [11, 99],
    }
    const range = bandMap[band]
    if (range) {
      setNumericFilter('experienceMin', range[0])
      setNumericFilter('experienceMax', range[1] === 99 ? null : range[1])
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Section variant="default" banded container className="animate-fade-in">
        <PageHeader
          title="Talent Intelligence"
          subtitle="Understand your candidate pool — geography, experience, skills, compensation, and composition."
        />
      </Section>

      <Section container className="animate-fade-in">
        {/* Filter bar */}
        {rawCandidates.length > 0 && (
          <div className="mb-6">
            <TalentIntelligenceFilterBar
              roleOptions={filterOptions.roleOptions}
              seniorityOptions={filterOptions.seniorityOptions}
              countryOptions={filterOptions.countryOptions}
              skillOptions={filterOptions.skillOptions}
              functionalAreaOptions={filterOptions.functionalAreaOptions}
              specializationOptions={filterOptions.specializationOptions}
              stateOptions={filterOptions.stateOptions}
              cityOptions={filterOptions.cityOptions}
              experienceRange={filterOptions.experienceRange}
              salaryRange={filterOptions.salaryRange}
            />
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-destructive text-sm">Failed to load talent intelligence</p>
          </div>
        )}

        {data && data.totalCandidates === 0 && !hasActiveFilters && (
          <TalentIntelligenceEmptyState message="No candidates in your talent database yet" />
        )}

        {data && data.totalCandidates === 0 && hasActiveFilters && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <TalentIntelligenceEmptyState message="No candidates match the selected filters" />
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        )}

        {data && data.totalCandidates > 0 && (
          <div className="space-y-6">
            <SummaryMetricsRow data={data} />
            <GeographyInsights
              countryCounts={data.countryCounts}
              cityCounts={data.cityCounts}
              totalCandidates={data.totalCandidates}
              onCountryClick={(country) => handleFilterApply('country', country)}
            />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ExperienceDistribution
                experienceBands={data.experienceBands}
                seniorityCounts={data.seniorityCounts}
                onBandClick={handleExperienceBandClick}
                onSeniorityClick={(s) => handleFilterApply('seniority', s)}
              />
              <SkillsLandscape
                topSkills={data.topSkills}
                onSkillClick={(skill) => handleFilterApply('skill', skill)}
              />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <CompensationInsights salaryStats={data.salaryStats} salaryValues={data.salaryValues} />
              <TalentPoolComposition
                functionalAreaCounts={data.functionalAreaCounts}
                titleCounts={data.titleCounts}
                specializationCounts={data.specializationCounts}
                onTitleClick={(t) => handleFilterApply('role', t)}
                onFunctionalAreaClick={(fa) => handleFilterApply('functionalArea', fa)}
                onSpecializationClick={(s) => handleFilterApply('specialization', s)}
              />
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

export default function TalentIntelligence() {
  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <TalentIntelligenceFilterProvider>
          <TalentIntelligenceContent />
        </TalentIntelligenceFilterProvider>
      </PermissionGate>
    </AuthGate>
  )
}
