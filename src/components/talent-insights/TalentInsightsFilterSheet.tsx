import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { MultiSelect } from '@/components/ui/multi-select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useTalentInsightsFilters } from '@/contexts/TalentInsightsFilterContext'
import type { FilterOption } from '@/hooks/useTalentInsightsFilterOptions'
import { subDays, subMonths } from 'date-fns'

interface TalentInsightsFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  functionalAreaOptions: FilterOption[]
  specializationOptions: FilterOption[]
  stateOptions: FilterOption[]
  cityOptions: FilterOption[]
  experienceRange: { min: number; max: number } | null
}

function toOpts(opts: FilterOption[]) {
  return opts.map(o => ({ value: o.value, label: `${o.label} (${o.count})` }))
}

export function TalentInsightsFilterSheet({
  open, onOpenChange,
  functionalAreaOptions, specializationOptions,
  stateOptions, cityOptions, experienceRange,
}: TalentInsightsFilterSheetProps) {
  const { filters, setArrayFilter, setNumericFilter, setDateFilter, clearAll } = useTalentInsightsFilters()

  const hasExp = experienceRange && experienceRange.max > experienceRange.min

  const datePresets = [
    { label: 'Last 30 days', value: () => subDays(new Date(), 30) },
    { label: 'Last 90 days', value: () => subDays(new Date(), 90) },
    { label: 'Last 12 months', value: () => subMonths(new Date(), 12) },
    { label: 'All time', value: () => null as Date | null },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-poppins">More Filters</SheetTitle>
          <SheetDescription className="font-poppins">
            Refine your talent pool with additional filters
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Functional Area */}
          {functionalAreaOptions.length > 0 && (
            <div>
              <label className="text-xs font-poppins font-medium text-muted-foreground mb-1.5 block">Functional Area</label>
              <MultiSelect
                options={toOpts(functionalAreaOptions)}
                selectedValues={filters.functionalAreas}
                onSelectionChange={(v) => setArrayFilter('functionalAreas', v)}
                placeholder="All areas"
                searchable
              />
            </div>
          )}

          {/* Specialization */}
          {specializationOptions.length > 0 && (
            <div>
              <label className="text-xs font-poppins font-medium text-muted-foreground mb-1.5 block">Specialization</label>
              <MultiSelect
                options={toOpts(specializationOptions)}
                selectedValues={filters.specializations}
                onSelectionChange={(v) => setArrayFilter('specializations', v)}
                placeholder="All specializations"
                searchable
              />
            </div>
          )}

          {/* State */}
          {stateOptions.length > 0 && (
            <div>
              <label className="text-xs font-poppins font-medium text-muted-foreground mb-1.5 block">State / Region</label>
              <MultiSelect
                options={toOpts(stateOptions)}
                selectedValues={filters.states}
                onSelectionChange={(v) => setArrayFilter('states', v)}
                placeholder="All states"
                searchable
              />
            </div>
          )}

          {/* City */}
          {cityOptions.length > 0 && (
            <div>
              <label className="text-xs font-poppins font-medium text-muted-foreground mb-1.5 block">City</label>
              <MultiSelect
                options={toOpts(cityOptions)}
                selectedValues={filters.cities}
                onSelectionChange={(v) => setArrayFilter('cities', v)}
                placeholder="All cities"
                searchable
              />
            </div>
          )}

          {/* Experience range */}
          {hasExp && (
            <div>
              <label className="text-xs font-poppins font-medium text-muted-foreground mb-1.5 block">
                Experience{' '}
                <span className="text-muted-foreground/70">
                  {filters.experienceMin ?? experienceRange.min}–{filters.experienceMax ?? experienceRange.max} yrs
                </span>
              </label>
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

          {/* Date range presets */}
          <div>
            <label className="text-xs font-poppins font-medium text-muted-foreground mb-1.5 block">Added Since</label>
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
                    className="text-xs h-7"
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

          {/* Clear all */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { clearAll(); onOpenChange(false) }}
            className="w-full text-muted-foreground"
          >
            Clear all filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
