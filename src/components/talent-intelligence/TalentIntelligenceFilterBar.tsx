import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { SlidersHorizontal, X } from 'lucide-react'
import { useTalentIntelligenceFilters } from '@/contexts/TalentIntelligenceFilterContext'
import type { FilterOption } from '@/hooks/useTalentIntelligenceFilterOptions'
import { ActiveFilterChips } from './ActiveFilterChips'
import { TalentIntelligenceFilterSheet } from './TalentIntelligenceFilterSheet'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { MobileFilterDrawer } from '@/components/ui/mobile-filter-drawer'

interface TalentIntelligenceFilterBarProps {
  roleOptions: FilterOption[]
  seniorityOptions: FilterOption[]
  countryOptions: FilterOption[]
  skillOptions: FilterOption[]
  functionalAreaOptions: FilterOption[]
  specializationOptions: FilterOption[]
  stateOptions: FilterOption[]
  cityOptions: FilterOption[]
  jobOptions: FilterOption[]
  candidateStatusOptions: FilterOption[]
  pipelineStatusOptions: FilterOption[]
  stageOptions: FilterOption[]
  experienceRange: { min: number; max: number } | null
  salaryRange: { min: number; max: number } | null
  jobLookup: Map<string, string>
}

function formatCurrencyShort(v: number) {
  if (v >= 1000) return `$${Math.round(v / 1000)}k`
  return `$${v}`
}

export function TalentIntelligenceFilterBar(props: TalentIntelligenceFilterBarProps) {
  const { filters, setArrayFilter, setNumericFilter, hasActiveFilters, clearAll } = useTalentIntelligenceFilters()
  const [sheetOpen, setSheetOpen] = useState(false)

  const {
    roleOptions, seniorityOptions, countryOptions, skillOptions,
    functionalAreaOptions, specializationOptions, stateOptions, cityOptions,
    jobOptions, candidateStatusOptions, pipelineStatusOptions, stageOptions,
    experienceRange, salaryRange, jobLookup,
  } = props

  const hasSalaryRange = salaryRange && salaryRange.max > salaryRange.min

  return (
    <div className="space-y-3">
      {/* Horizontal chip bar */}
      <div className="flex flex-wrap items-center gap-2">
        <MobileFilterDrawer
          activeFilterCount={
            filters.jobs.length + filters.roles.length + filters.seniorities.length +
            filters.candidateStatuses.length + filters.pipelineStatuses.length +
            filters.stages.length + filters.countries.length + filters.skills.length +
            (filters.salaryMin !== null || filters.salaryMax !== null ? 1 : 0)
          }
          onClearAll={clearAll}
        >
          <FilterChipPopover
            label="Job"
            options={jobOptions}
            selectedValues={filters.jobs}
            onSelectionChange={(v) => setArrayFilter('jobs', v)}
            searchable
          />

          <FilterChipPopover
            label="Role"
            options={roleOptions}
            selectedValues={filters.roles}
            onSelectionChange={(v) => setArrayFilter('roles', v)}
            searchable
          />

          <FilterChipPopover
            label="Seniority"
            options={seniorityOptions}
            selectedValues={filters.seniorities}
            onSelectionChange={(v) => setArrayFilter('seniorities', v)}
            searchable={false}
          />

          <FilterChipPopover
            label="Status"
            options={candidateStatusOptions}
            selectedValues={filters.candidateStatuses}
            onSelectionChange={(v) => setArrayFilter('candidateStatuses', v)}
            searchable={false}
          />

          <FilterChipPopover
            label="Pipeline"
            options={pipelineStatusOptions}
            selectedValues={filters.pipelineStatuses}
            onSelectionChange={(v) => setArrayFilter('pipelineStatuses', v)}
            searchable={false}
          />

          <FilterChipPopover
            label="Stage"
            options={stageOptions}
            selectedValues={filters.stages}
            onSelectionChange={(v) => setArrayFilter('stages', v)}
            searchable
          />

          <FilterChipPopover
            label="Country"
            options={countryOptions}
            selectedValues={filters.countries}
            onSelectionChange={(v) => setArrayFilter('countries', v)}
            searchable
          />

          <FilterChipPopover
            label="Skills"
            options={skillOptions.slice(0, 50)}
            selectedValues={filters.skills}
            onSelectionChange={(v) => setArrayFilter('skills', v)}
            searchable
          />

          {/* Salary inline slider */}
          {hasSalaryRange && (
            <div className="min-w-[200px] max-w-[260px]">
              <label className="text-xs font-poppins font-medium text-muted-foreground mb-1 block">
                Salary{' '}
                <span className="text-muted-foreground/70">
                  {formatCurrencyShort(filters.salaryMin ?? salaryRange.min)}
                  {' – '}
                  {formatCurrencyShort(filters.salaryMax ?? salaryRange.max)}
                </span>
              </label>
              <Slider
                min={salaryRange.min}
                max={salaryRange.max}
                step={Math.max(1000, Math.round((salaryRange.max - salaryRange.min) / 100))}
                value={[
                  filters.salaryMin ?? salaryRange.min,
                  filters.salaryMax ?? salaryRange.max,
                ]}
                onValueChange={([min, max]) => {
                  setNumericFilter('salaryMin', min === salaryRange.min ? null : min)
                  setNumericFilter('salaryMax', max === salaryRange.max ? null : max)
                }}
                className="mt-2"
              />
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSheetOpen(true)}
            className="gap-1.5 h-8 rounded-full font-poppins text-sm"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            More Filters
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="gap-1 h-8 text-xs text-muted-foreground hover:text-foreground font-poppins sm:inline-flex hidden"
            >
              <X className="h-3 w-3" />
              Clear filters
            </Button>
          )}
        </MobileFilterDrawer>
      </div>

      <ActiveFilterChips jobLookup={jobLookup} />

      <TalentIntelligenceFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        functionalAreaOptions={functionalAreaOptions}
        specializationOptions={specializationOptions}
        stateOptions={stateOptions}
        cityOptions={cityOptions}
        experienceRange={experienceRange}
      />
    </div>
  )
}
