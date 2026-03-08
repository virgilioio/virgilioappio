import { useState } from 'react'
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Calendar } from '@/components/ui/calendar'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCandidateFilters } from '@/contexts/CandidateFilterContext'
import type { FilterOption } from '@/hooks/useCandidateFilterOptions'

interface FilterSectionProps {
  label: string
  filterKey: 'statuses' | 'sources' | 'countries' | 'states' | 'cities' | 'seniorityLevels' | 'functionalAreas' | 'specializations' | 'skills' | 'enrichmentStatuses'
  options: FilterOption[]
  searchable?: boolean
}

function MultiSelectFilter({ label, filterKey, options, searchable = false }: FilterSectionProps) {
  const { filters, toggleArrayFilter, clearFilter } = useCandidateFilters()
  const selected = filters[filterKey]
  const [open, setOpen] = useState(false)

  if (options.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {selected.length > 0 && (
          <button onClick={() => clearFilter(filterKey)} className="text-xs text-primary hover:underline">Clear</button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs">
            {selected.length > 0 ? (
              <span className="truncate">{selected.length} selected</span>
            ) : (
              <span className="text-muted-foreground">Select {label.toLowerCase()}...</span>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            {searchable && <CommandInput placeholder={`Search ${label.toLowerCase()}...`} className="h-8 text-xs" />}
            <CommandList className="max-h-[200px]">
              <CommandEmpty className="text-xs py-2 text-center">No results.</CommandEmpty>
              <CommandGroup>
                {options.map(opt => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggleArrayFilter(filterKey, opt.value)}
                    className="text-xs"
                  >
                    <Check className={cn("mr-1.5 h-3 w-3", selected.includes(opt.value) ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{opt.label}</span>
                    <span className="text-muted-foreground ml-1">({opt.count})</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface RangeFilterProps {
  label: string
  range: { min: number; max: number } | null
  minKey: 'experienceMin' | 'salaryMin'
  maxKey: 'experienceMax' | 'salaryMax'
  formatValue?: (v: number) => string
}

function RangeFilter({ label, range, minKey, maxKey, formatValue }: RangeFilterProps) {
  const { filters, setNumericFilter, clearFilter } = useCandidateFilters()
  if (!range || range.min === range.max) return null

  const currentMin = filters[minKey] ?? range.min
  const currentMax = filters[maxKey] ?? range.max
  const hasFilter = filters[minKey] !== null || filters[maxKey] !== null
  const fmt = formatValue || ((v: number) => String(v))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {hasFilter && (
          <button onClick={() => { clearFilter(minKey); clearFilter(maxKey) }} className="text-xs text-primary hover:underline">Clear</button>
        )}
      </div>
      <Slider
        min={range.min}
        max={range.max}
        step={1}
        value={[currentMin, currentMax]}
        onValueChange={([min, max]) => {
          setNumericFilter(minKey, min === range.min ? null : min)
          setNumericFilter(maxKey, max === range.max ? null : max)
        }}
        className="py-1"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{fmt(currentMin)}</span>
        <span>{fmt(currentMax)}</span>
      </div>
    </div>
  )
}

interface DateRangeFilterProps {
  label: string
}

function DateRangeFilter({ label }: DateRangeFilterProps) {
  const { filters, setDateFilter, clearFilter } = useCandidateFilters()
  const hasFilter = filters.dateFrom !== null || filters.dateTo !== null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {hasFilter && (
          <button onClick={() => { clearFilter('dateFrom'); clearFilter('dateTo') }} className="text-xs text-primary hover:underline">Clear</button>
        )}
      </div>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs justify-start">
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
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs justify-start">
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
  )
}

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
  const { activeFilterCount, hasActiveFilters, clearAll, filters, removeArrayFilterValue } = useCandidateFilters()
  const [isOpen, setIsOpen] = useState(false)

  // Collect active filter tags for display
  const activeTags: { key: 'statuses' | 'sources' | 'countries' | 'states' | 'cities' | 'seniorityLevels' | 'functionalAreas' | 'specializations' | 'skills' | 'enrichmentStatuses'; value: string }[] = []
  const arrayKeys = ['statuses', 'sources', 'countries', 'states', 'cities', 'seniorityLevels', 'functionalAreas', 'specializations', 'skills', 'enrichmentStatuses'] as const
  for (const k of arrayKeys) {
    for (const v of filters[k]) {
      activeTags.push({ key: k, value: v })
    }
  }

  return (
    <div className="space-y-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
              )}
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-xs text-muted-foreground gap-1">
              <X className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>

        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <MultiSelectFilter label="Status" filterKey="statuses" options={filterOptions.statusOptions} />
            <MultiSelectFilter label="Source" filterKey="sources" options={filterOptions.sourceOptions} searchable />
            <MultiSelectFilter label="Country" filterKey="countries" options={filterOptions.countryOptions} searchable />
            <MultiSelectFilter label="State" filterKey="states" options={filterOptions.stateOptions} searchable />
            <MultiSelectFilter label="City" filterKey="cities" options={filterOptions.cityOptions} searchable />
            <MultiSelectFilter label="Seniority" filterKey="seniorityLevels" options={filterOptions.seniorityOptions} />
            <MultiSelectFilter label="Function" filterKey="functionalAreas" options={filterOptions.functionalAreaOptions} searchable />
            <MultiSelectFilter label="Specialization" filterKey="specializations" options={filterOptions.specializationOptions} searchable />
            <MultiSelectFilter label="Skills" filterKey="skills" options={filterOptions.skillOptions} searchable />
            <MultiSelectFilter label="Enrichment" filterKey="enrichmentStatuses" options={filterOptions.enrichmentStatusOptions} />
            <RangeFilter
              label="Experience (yrs)"
              range={filterOptions.experienceRange}
              minKey="experienceMin"
              maxKey="experienceMax"
            />
            <RangeFilter
              label="Salary (annual)"
              range={filterOptions.salaryRange}
              minKey="salaryMin"
              maxKey="salaryMax"
              formatValue={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <DateRangeFilter label="Created Date" />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active filter tags */}
      {activeTags.length > 0 && !isOpen && (
        <div className="flex flex-wrap gap-1.5">
          {activeTags.slice(0, 10).map(({ key, value }) => (
            <Badge key={`${key}-${value}`} variant="secondary" className="gap-1 text-xs h-6 pl-2 pr-1">
              {value}
              <button onClick={() => removeArrayFilterValue(key, value)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {activeTags.length > 10 && (
            <Badge variant="outline" className="text-xs h-6">+{activeTags.length - 10} more</Badge>
          )}
        </div>
      )}
    </div>
  )
}
