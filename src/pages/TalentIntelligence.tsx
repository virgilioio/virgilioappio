import { useMemo, useState, useCallback, useEffect } from 'react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { useTalentIntelligenceData, applyFilters } from '@/hooks/useTalentIntelligenceData'
import { useTalentIntelligenceFilterOptions } from '@/hooks/useTalentIntelligenceFilterOptions'
import { TalentIntelligenceFilterProvider, useTalentIntelligenceFilters } from '@/contexts/TalentIntelligenceFilterContext'
import { SummaryMetricsRow } from '@/components/talent-intelligence/SummaryMetricsRow'
import { GeographyInsights } from '@/components/talent-intelligence/GeographyInsights'
import { ExperienceDistribution } from '@/components/talent-intelligence/ExperienceDistribution'
import { SkillsLandscape } from '@/components/talent-intelligence/SkillsLandscape'
import { CompensationInsights } from '@/components/talent-intelligence/CompensationInsights'
import { TalentPoolComposition } from '@/components/talent-intelligence/TalentPoolComposition'
import { TalentOrigins } from '@/components/talent-intelligence/TalentOrigins'
import { CandidatesEmpty } from '@/components/empty/CandidatesEmpty'
import { EmptyCard } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { usePermissions } from '@/hooks/usePermissions'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Upload } from 'lucide-react'
import { TalentIntelligenceFilterBar } from '@/components/talent-intelligence/TalentIntelligenceFilterBar'
import { SavedViewSelector } from '@/components/filters/SavedViewSelector'
import { usePersistentFilters } from '@/hooks/usePersistentFilters'
import { useSavedViews } from '@/hooks/useSavedViews'
import type { TalentIntelligenceFilters } from '@/contexts/TalentIntelligenceFilterContext'
import { Loadable } from '@/components/ui/loadable'
import { Skeleton } from '@/components/ui/skeleton'

const EMPTY_TI_FILTERS: TalentIntelligenceFilters = {
  roles: [], functionalAreas: [], specializations: [], seniorities: [],
  skills: [], countries: [], states: [], cities: [], jobs: [],
  candidateStatuses: [], pipelineStatuses: [], stages: [],
  experienceMin: null, experienceMax: null,
  salaryMin: null, salaryMax: null,
  dateFrom: null, dateTo: null,
}

function TalentIntelligenceContent() {
  const { filters, setArrayFilter, clearAll, hasActiveFilters, toggleArrayFilter, setNumericFilter } = useTalentIntelligenceFilters()
  const { data, rawCandidates, associations, jobs, stageMappings, isLoading, error, refetch } = useTalentIntelligenceData(filters)
  const navigate = useNavigate()
  const { canManageCandidates } = usePermissions()
  // §16: a failed or 15-second-slow first load is an inline error with Retry.
  const [loadRetry, setLoadRetry] = useState(0)
  const loadTimedOut = useLoadTimeout(isLoading, loadRetry)
  const loadError: 'failed' | 'timeout' | null = error && !data ? 'failed' : loadTimedOut ? 'timeout' : null
  const filterOptions = useTalentIntelligenceFilterOptions(rawCandidates, associations, jobs, stageMappings)

  // Saved views integration
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  // We need a setter that maps to context
  const setFiltersFromRecord = useCallback((record: Record<string, unknown>) => {
    const f = record as unknown as TalentIntelligenceFilters
    // Apply all array filters
    const arrayKeys = ['roles', 'functionalAreas', 'specializations', 'seniorities', 'skills', 'countries', 'states', 'cities', 'jobs', 'candidateStatuses', 'pipelineStatuses', 'stages'] as const
    for (const key of arrayKeys) {
      setArrayFilter(key, (f[key] as string[]) ?? [])
    }
  }, [setArrayFilter])

  const { setActiveViewId: persistViewId, getActiveViewId } = usePersistentFilters(
    'talent-intelligence',
    filters as unknown as Record<string, unknown>,
    setFiltersFromRecord as any,
    EMPTY_TI_FILTERS as unknown as Record<string, unknown>,
  )

  const { defaultView } = useSavedViews('talent-intelligence')

  useEffect(() => {
    const storedViewId = getActiveViewId()
    if (storedViewId) {
      setActiveViewId(storedViewId)
    } else if (defaultView) {
      setActiveViewId(defaultView.id)
      setFiltersFromRecord(defaultView.filters as Record<string, unknown>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultView?.id])

  const handleActiveViewChange = useCallback((viewId: string | null) => {
    setActiveViewId(viewId)
    persistViewId(viewId)
  }, [persistViewId])

  const handleApplyView = useCallback((viewFilters: Record<string, unknown>) => {
    setFiltersFromRecord(viewFilters)
  }, [setFiltersFromRecord])

  // Job ID → title lookup for display in chips
  const jobLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const j of jobs) map.set(j.id, j.title)
    return map
  }, [jobs])

  // Compute filtered candidate IDs for the TalentOrigins hook
  const filteredCandidateIds = useMemo(() => {
    if (!rawCandidates.length) return []
    const filtered = applyFilters(rawCandidates, filters, associations, stageMappings)
    return filtered.map(c => c.id)
  }, [rawCandidates, filters, associations, stageMappings])

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
      <Section variant="default" banded container>
        <PageHeader
          title="Talent Intelligence"
         
        />
      </Section>

      <Section container>
        {/* §6: hold the filter bar's place while loading, so the page doesn't jump down. */}
        {isLoading && (
          <div className="mb-6 space-y-3" aria-hidden="true">
            <Skeleton className="h-8 w-[98px] rounded-full" />
            <div className="flex flex-wrap items-center gap-2">
              {[70, 74, 102, 88, 97, 84, 98, 78].map((w, i) => (
                <Skeleton key={i} className="h-9 rounded-[10px]" style={{ width: w }} />
              ))}
            </div>
          </div>
        )}

        {/* Filter bar + saved views */}
        {rawCandidates.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SavedViewSelector
                pageContext="talent-intelligence"
                currentFilters={filters as unknown as Record<string, unknown>}
                onApplyView={handleApplyView}
                activeViewId={activeViewId}
                onActiveViewChange={handleActiveViewChange}
              />
            </div>
            <TalentIntelligenceFilterBar
              roleOptions={filterOptions.roleOptions}
              seniorityOptions={filterOptions.seniorityOptions}
              countryOptions={filterOptions.countryOptions}
              skillOptions={filterOptions.skillOptions}
              functionalAreaOptions={filterOptions.functionalAreaOptions}
              specializationOptions={filterOptions.specializationOptions}
              stateOptions={filterOptions.stateOptions}
              cityOptions={filterOptions.cityOptions}
              jobOptions={filterOptions.jobOptions}
              candidateStatusOptions={filterOptions.candidateStatusOptions}
              pipelineStatusOptions={filterOptions.pipelineStatusOptions}
              stageOptions={filterOptions.stageOptions}
              experienceRange={filterOptions.experienceRange}
              salaryRange={filterOptions.salaryRange}
              jobLookup={jobLookup}
            />
          </div>
        )}

        {loadError && (
          <EmptyCard minHeight={360}>
            <LoadError
              what="your talent database"
              timedOut={loadError === 'timeout'}
              onRetry={() => { setLoadRetry((n) => n + 1); refetch() }}
            />
          </EmptyCard>
        )}

        {!loadError && data && rawCandidates.length === 0 && (
          <EmptyCard minHeight={360}>
            <CandidatesEmpty
              onceKey="talent-db"
              title="Your talent database is empty"
              body="Candidates you save from Find, or import in bulk, live here."
              primary={
                canManageCandidates
                  ? { label: 'Import candidates', icon: <Upload size={16} strokeWidth={2} />, onClick: () => navigate('/candidates?import=csv') }
                  : undefined
              }
            />
          </EmptyCard>
        )}

        {!loadError && data && rawCandidates.length > 0 && data.totalCandidates === 0 && (
          <EmptyCard minHeight={360}>
            <CandidatesEmpty
              filtered
              onceKey="talent-db"
              title="No matches"
              body={
                <>
                  Nothing fits these filters. The {rawCandidates.length.toLocaleString()}{' '}
                  {rawCandidates.length === 1 ? 'candidate is' : 'candidates are'} still there, just hidden by your filters.
                </>
              }
              primary={{ label: 'Clear filters', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: clearAll }}
            />
          </EmptyCard>
        )}

        {/* §6: a skeleton laid out like the page, then the content crossfades in over it. */}
        {!loadError && (isLoading || (data && data.totalCandidates > 0)) && (
          <Loadable loading={isLoading} skeleton={<TalentIntelligenceSkeleton />}>
            {data && (
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
                <TalentOrigins filteredCandidateIds={filteredCandidateIds} />
              </div>
            )}
          </Loadable>
        )}
      </Section>
    </div>
  )
}

/** Same grid as the loaded page (KPI row, composition, geography, two chart rows). */
function TalentIntelligenceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-[78px] rounded-2xl" />
          <Skeleton className="h-[78px] rounded-2xl" />
          <Skeleton className="h-[78px] rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-[222px] rounded-2xl" />
        </div>
      </div>
      <Skeleton className="h-[467px] rounded-lg" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton className="h-[678px] rounded-lg" />
        <Skeleton className="h-[678px] rounded-lg" />
      </div>
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
