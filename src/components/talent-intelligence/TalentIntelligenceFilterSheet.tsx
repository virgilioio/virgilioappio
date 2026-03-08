import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useTalentIntelligenceFilters } from '@/contexts/TalentIntelligenceFilterContext'
import type { FilterOption } from '@/hooks/useTalentIntelligenceFilterOptions'
import { FilterSheet } from '@/components/ui/filter-sheet'
import { FilterCheckboxGroup } from '@/components/ui/filter-checkbox-group'
import { subDays, subMonths } from 'date-fns'

interface TalentIntelligenceFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  functionalAreaOptions: FilterOption[]
  specializationOptions: FilterOption[]
  stateOptions: FilterOption[]
  cityOptions: FilterOption[]
  experienceRange: { min: number; max: number } | null
}

export function TalentIntelligenceFilterSheet({
  open, onOpenChange,
  functionalAreaOptions, specializationOptions,
  stateOptions, cityOptions, experienceRange,
}: TalentIntelligenceFilterSheetProps) {
  const { filters, toggleArrayFilter, setArrayFilter, setNumericFilter, setDateFilter, clearAll } = useTalentIntelligenceFilters()

  const hasExp = experienceRange && experienceRange.max > experienceRange.min

  const datePresets = [
    { label: 'Last 30 days', value: () => subDays(new Date(), 30) },
    { label: 'Last 90 days', value: () => subDays(new Date(), 90) },
    { label: 'Last 12 months', value: () => subMonths(new Date(), 12) },
    { label: 'All time', value: () => null as Date | null },
  ]

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      title="More Filters"
      description="Refine your talent pool with additional filters"
      onClearAll={() => { clearAll(); onOpenChange(false) }}
    >
      <FilterCheckboxGroup
        label="Functional Area"
        options={functionalAreaOptions}
        selectedValues={filters.functionalAreas}
        onToggle={(v) => toggleArrayFilter('functionalAreas', v)}
        onClear={() => setArrayFilter('functionalAreas', [])}
        searchable
      />

      <FilterCheckboxGroup
        label="Specialization"
        options={specializationOptions}
        selectedValues={filters.specializations}
        onToggle={(v) => toggleArrayFilter('specializations', v)}
        onClear={() => setArrayFilter('specializations', [])}
        searchable
      />

      <FilterCheckboxGroup
        label="State / Region"
        options={stateOptions}
        selectedValues={filters.states}
        onToggle={(v) => toggleArrayFilter('states', v)}
        onClear={() => setArrayFilter('states', [])}
        searchable
      />

      <FilterCheckboxGroup
        label="City"
        options={cityOptions}
        selectedValues={filters.cities}
        onToggle={(v) => toggleArrayFilter('cities', v)}
        onClear={() => setArrayFilter('cities', [])}
        searchable
      />

      {hasExp && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">Experience</span>
            {(filters.experienceMin !== null || filters.experienceMax !== null) && (
              <button
                onClick={() => { setNumericFilter('experienceMin', null); setNumericFilter('experienceMax', null) }}
                className="text-xs text-primary hover:text-primary/80 font-poppins transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-poppins">
            {filters.experienceMin ?? experienceRange.min}–{filters.experienceMax ?? experienceRange.max} years
          </div>
          <Slider
            min={experienceRange.min}
            max={experienceRange.max}
            step={1}
            value={[
              filters.experienceMin ?? experienceRange.min,
              filters.experienceMax ?? experienceRange.max,
            ]}
            onValueChange={([min, max]) => {
              setNumericFilter('experienceMin', min === experienceRange.min ? null : min)
              setNumericFilter('experienceMax', max === experienceRange.max ? null : max)
            }}
          />
        </div>
      )}

      <div className="space-y-2.5">
        <span className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider block">Added Since</span>
        <div className="flex flex-wrap gap-2">
          {datePresets.map(preset => {
            const presetDate = preset.value()
            const isActive = presetDate
              ? filters.dateFrom?.toDateString() === presetDate.toDateString()
              : filters.dateFrom === null
            return (
              <Button
                key={preset.label}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7 rounded-full font-poppins"
                onClick={() => {
                  setDateFilter('dateFrom', presetDate)
                  setDateFilter('dateTo', null)
                }}
              >
                {preset.label}
              </Button>
            )
          })}
        </div>
      </div>
    </FilterSheet>
  )
}
