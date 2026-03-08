import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useCandidateFilters } from '@/contexts/CandidateFilterContext'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { FilterSheet } from '@/components/ui/filter-sheet'
import { FilterCheckboxGroup } from '@/components/ui/filter-checkbox-group'
import type { FilterOption } from '@/hooks/useCandidateFilterOptions'

interface CandidateFiltersPanelProps {
  filterOptions: {
    statusOptions: FilterOption[]
    sourceOptions: FilterOption[]
    countryOptions: FilterOption[]
    stateOptions: FilterOption[]
    cityOptions: FilterOption[]
    seniorityOptions: FilterOption[]
    functionalAreaOptions: FilterOption[]
    specializationOptions: FilterOption[]
    skillOptions: FilterOption[]
    enrichmentStatusOptions: FilterOption[]
    experienceRange: { min: number; max: number } | null
    salaryRange: { min: number; max: number } | null
  }
}

export function CandidateFiltersPanel({ filterOptions }: CandidateFiltersPanelProps) {
  const {
    filters, setArrayFilter, toggleArrayFilter, removeArrayFilterValue,
    setNumericFilter, setDateFilter, clearAll, clearFilter,
    hasActiveFilters, activeFilterCount,
  } = useCandidateFilters()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Collect active filter tags for display below
  const activeTags: { key: 'statuses' | 'sources' | 'countries' | 'states' | 'cities' | 'seniorityLevels' | 'functionalAreas' | 'specializations' | 'skills' | 'enrichmentStatuses'; value: string }[] = []
  const arrayKeys = ['statuses', 'sources', 'countries', 'states', 'cities', 'seniorityLevels', 'functionalAreas', 'specializations', 'skills', 'enrichmentStatuses'] as const
  for (const k of arrayKeys) {
    for (const v of filters[k]) {
      activeTags.push({ key: k, value: v })
    }
  }

  const formatSalary = (v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`

  return (
    <>
      {/* Horizontal chip bar — renders as inline fragment for parent flex layout */}
        <FilterChipPopover
          label="Status"
          options={filterOptions.statusOptions}
          selectedValues={filters.statuses}
          onSelectionChange={(v) => setArrayFilter('statuses', v)}
          searchable={false}
        />

        <FilterChipPopover
          label="Source"
          options={filterOptions.sourceOptions}
          selectedValues={filters.sources}
          onSelectionChange={(v) => setArrayFilter('sources', v)}
          searchable
        />

        <FilterChipPopover
          label="Country"
          options={filterOptions.countryOptions}
          selectedValues={filters.countries}
          onSelectionChange={(v) => setArrayFilter('countries', v)}
          searchable
        />

        <FilterChipPopover
          label="Seniority"
          options={filterOptions.seniorityOptions}
          selectedValues={filters.seniorityLevels}
          onSelectionChange={(v) => setArrayFilter('seniorityLevels', v)}
          searchable={false}
        />

        <FilterChipPopover
          label="Skills"
          options={filterOptions.skillOptions.slice(0, 50)}
          selectedValues={filters.skills}
          onSelectionChange={(v) => setArrayFilter('skills', v)}
          searchable
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="gap-1.5 h-8 rounded-full font-poppins text-sm"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          More Filters
          {activeFilterCount > 0 && (
            <Badge variant="purple" className="h-5 min-w-[20px] px-1.5 text-[10px] ml-0.5">{activeFilterCount}</Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="gap-1 h-8 text-xs text-muted-foreground hover:text-foreground font-poppins"
          >
            <X className="h-3 w-3" />
            Clear filters
          </Button>
        )}

      {/* Active filter chips */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeTags.slice(0, 12).map(({ key, value }) => (
            <Badge key={`${key}-${value}`} variant="purple" className="gap-1 pr-1 text-xs h-6 pl-2 font-poppins">
              {value}
              <button
                onClick={() => removeArrayFilterValue(key, value)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {(filters.experienceMin !== null || filters.experienceMax !== null) && (
            <Badge variant="purple" className="gap-1 pr-1 text-xs h-6 pl-2 font-poppins">
              <span className="text-muted-foreground">Exp:</span>
              {filters.experienceMin ?? 0}–{filters.experienceMax ?? '∞'} yrs
              <button
                onClick={() => { clearFilter('experienceMin'); clearFilter('experienceMax') }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {(filters.salaryMin !== null || filters.salaryMax !== null) && (
            <Badge variant="purple" className="gap-1 pr-1 text-xs h-6 pl-2 font-poppins">
              <span className="text-muted-foreground">Salary:</span>
              {formatSalary(filters.salaryMin ?? 0)}–{formatSalary(filters.salaryMax ?? 999999)}
              <button
                onClick={() => { clearFilter('salaryMin'); clearFilter('salaryMax') }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="purple" className="gap-1 pr-1 text-xs h-6 pl-2 font-poppins">
              <span className="text-muted-foreground">Date:</span>
              {filters.dateFrom ? filters.dateFrom.toLocaleDateString() : 'Start'}
              {' – '}
              {filters.dateTo ? filters.dateTo.toLocaleDateString() : 'Now'}
              <button
                onClick={() => { clearFilter('dateFrom'); clearFilter('dateTo') }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {activeTags.length > 12 && (
            <Badge variant="outline" className="text-xs h-6 font-poppins">+{activeTags.length - 12} more</Badge>
          )}
        </div>
      )}

      {/* More Filters Sheet */}
      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="More Filters"
        description="Refine your candidate pool with additional filters"
        onClearAll={() => { clearAll(); setSheetOpen(false) }}
      >
        <FilterCheckboxGroup
          label="State / Region"
          options={filterOptions.stateOptions}
          selectedValues={filters.states}
          onToggle={(v) => toggleArrayFilter('states', v)}
          onClear={() => setArrayFilter('states', [])}
          searchable
        />

        <FilterCheckboxGroup
          label="City"
          options={filterOptions.cityOptions}
          selectedValues={filters.cities}
          onToggle={(v) => toggleArrayFilter('cities', v)}
          onClear={() => setArrayFilter('cities', [])}
          searchable
        />

        <FilterCheckboxGroup
          label="Functional Area"
          options={filterOptions.functionalAreaOptions}
          selectedValues={filters.functionalAreas}
          onToggle={(v) => toggleArrayFilter('functionalAreas', v)}
          onClear={() => setArrayFilter('functionalAreas', [])}
          searchable
        />

        <FilterCheckboxGroup
          label="Specialization"
          options={filterOptions.specializationOptions}
          selectedValues={filters.specializations}
          onToggle={(v) => toggleArrayFilter('specializations', v)}
          onClear={() => setArrayFilter('specializations', [])}
          searchable
        />

        <FilterCheckboxGroup
          label="Enrichment Status"
          options={filterOptions.enrichmentStatusOptions}
          selectedValues={filters.enrichmentStatuses}
          onToggle={(v) => toggleArrayFilter('enrichmentStatuses', v)}
          onClear={() => setArrayFilter('enrichmentStatuses', [])}
        />

        {/* Experience range slider */}
        {filterOptions.experienceRange && filterOptions.experienceRange.max > filterOptions.experienceRange.min && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Experience</span>
              {(filters.experienceMin !== null || filters.experienceMax !== null) && (
                <button
                  onClick={() => { clearFilter('experienceMin'); clearFilter('experienceMax') }}
                  className="text-xs text-primary hover:text-primary/80 font-poppins transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-poppins">
              {filters.experienceMin ?? filterOptions.experienceRange.min}–{filters.experienceMax ?? filterOptions.experienceRange.max} years
            </div>
            <Slider
              min={filterOptions.experienceRange.min}
              max={filterOptions.experienceRange.max}
              step={1}
              value={[
                filters.experienceMin ?? filterOptions.experienceRange.min,
                filters.experienceMax ?? filterOptions.experienceRange.max,
              ]}
              onValueChange={([min, max]) => {
                setNumericFilter('experienceMin', min === filterOptions.experienceRange!.min ? null : min)
                setNumericFilter('experienceMax', max === filterOptions.experienceRange!.max ? null : max)
              }}
            />
          </div>
        )}

        {/* Salary range slider */}
        {filterOptions.salaryRange && filterOptions.salaryRange.max > filterOptions.salaryRange.min && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Salary (Annual)</span>
              {(filters.salaryMin !== null || filters.salaryMax !== null) && (
                <button
                  onClick={() => { clearFilter('salaryMin'); clearFilter('salaryMax') }}
                  className="text-xs text-primary hover:text-primary/80 font-poppins transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-poppins">
              {formatSalary(filters.salaryMin ?? filterOptions.salaryRange.min)}–{formatSalary(filters.salaryMax ?? filterOptions.salaryRange.max)}
            </div>
            <Slider
              min={filterOptions.salaryRange.min}
              max={filterOptions.salaryRange.max}
              step={Math.max(1000, Math.round((filterOptions.salaryRange.max - filterOptions.salaryRange.min) / 100))}
              value={[
                filters.salaryMin ?? filterOptions.salaryRange.min,
                filters.salaryMax ?? filterOptions.salaryRange.max,
              ]}
              onValueChange={([min, max]) => {
                setNumericFilter('salaryMin', min === filterOptions.salaryRange!.min ? null : min)
                setNumericFilter('salaryMax', max === filterOptions.salaryRange!.max ? null : max)
              }}
            />
          </div>
        )}

        {/* Date range */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Created Date</span>
            {(filters.dateFrom !== null || filters.dateTo !== null) && (
              <button
                onClick={() => { clearFilter('dateFrom'); clearFilter('dateTo') }}
                className="text-xs text-primary hover:text-primary/80 font-poppins transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs justify-start font-poppins rounded-md">
                  {filters.dateFrom ? filters.dateFrom.toLocaleDateString() : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom ?? undefined}
                  onSelect={(d) => setDateFilter('dateFrom', d ?? null)}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs justify-start font-poppins rounded-md">
                  {filters.dateTo ? filters.dateTo.toLocaleDateString() : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo ?? undefined}
                  onSelect={(d) => setDateFilter('dateTo', d ?? null)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </FilterSheet>
    </>
  )
}
