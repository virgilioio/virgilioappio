import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MultiSelect } from '@/components/ui/multi-select'
import { Slider } from '@/components/ui/slider'
import { SlidersHorizontal } from 'lucide-react'
import { useTalentInsightsFilters } from '@/contexts/TalentInsightsFilterContext'
import type { FilterOption } from '@/hooks/useTalentInsightsFilterOptions'
import { ActiveFilterChips } from './ActiveFilterChips'
import { TalentInsightsFilterSheet } from './TalentInsightsFilterSheet'

interface TalentInsightsFilterBarProps {
  roleOptions: FilterOption[]
  seniorityOptions: FilterOption[]
  countryOptions: FilterOption[]
  skillOptions: FilterOption[]
  functionalAreaOptions: FilterOption[]
  specializationOptions: FilterOption[]
  stateOptions: FilterOption[]
  cityOptions: FilterOption[]
  experienceRange: { min: number; max: number } | null
  salaryRange: { min: number; max: number } | null
}

function toMultiSelectOptions(opts: FilterOption[]) {
  return opts.map(o => ({ value: o.value, label: `${o.label} (${o.count})` }))
}

function formatCurrencyShort(v: number) {
  if (v >= 1000) return `$${Math.round(v / 1000)}k`
  return `$${v}`
}

export function TalentInsightsFilterBar(props: TalentInsightsFilterBarProps) {
  const { filters, setArrayFilter, setNumericFilter } = useTalentInsightsFilters()
  const [sheetOpen, setSheetOpen] = useState(false)

  const {
    roleOptions, seniorityOptions, countryOptions, skillOptions,
    functionalAreaOptions, specializationOptions, stateOptions, cityOptions,
    experienceRange, salaryRange,
  } = props

  const hasSalaryRange = salaryRange && salaryRange.max > salaryRange.min

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Role */}
        {roleOptions.length > 0 && (
          <div className="min-w-[180px] max-w-[220px]">
            <label className="text-xs font-poppins font-medium text-muted-foreground mb-1 block">Role</label>
            <MultiSelect
              options={toMultiSelectOptions(roleOptions)}
              selectedValues={filters.roles}
              onSelectionChange={(v) => setArrayFilter('roles', v)}
              placeholder="All roles"
              searchable
            />
          </div>
        )}

        {/* Seniority */}
        {seniorityOptions.length > 0 && (
          <div className="min-w-[160px] max-w-[200px]">
            <label className="text-xs font-poppins font-medium text-muted-foreground mb-1 block">Seniority</label>
            <MultiSelect
              options={toMultiSelectOptions(seniorityOptions)}
              selectedValues={filters.seniorities}
              onSelectionChange={(v) => setArrayFilter('seniorities', v)}
              placeholder="All levels"
              searchable={false}
            />
          </div>
        )}

        {/* Country */}
        {countryOptions.length > 0 && (
          <div className="min-w-[180px] max-w-[220px]">
            <label className="text-xs font-poppins font-medium text-muted-foreground mb-1 block">Country</label>
            <MultiSelect
              options={toMultiSelectOptions(countryOptions)}
              selectedValues={filters.countries}
              onSelectionChange={(v) => setArrayFilter('countries', v)}
              placeholder="All countries"
              searchable
            />
          </div>
        )}

        {/* Skills */}
        {skillOptions.length > 0 && (
          <div className="min-w-[180px] max-w-[220px]">
            <label className="text-xs font-poppins font-medium text-muted-foreground mb-1 block">Skills</label>
            <MultiSelect
              options={toMultiSelectOptions(skillOptions.slice(0, 50))}
              selectedValues={filters.skills}
              onSelectionChange={(v) => setArrayFilter('skills', v)}
              placeholder="All skills"
              searchable
            />
          </div>
        )}

        {/* Salary range */}
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

        {/* More filters button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="gap-1.5 h-9"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          More Filters
        </Button>
      </div>

      <ActiveFilterChips />

      <TalentInsightsFilterSheet
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
