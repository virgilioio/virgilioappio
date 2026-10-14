import { Plus, X } from 'lucide-react'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { useCandidateFilters } from '@/contexts/CandidateFilterContext'
import type { useCandidateFilterOptions } from '@/hooks/useCandidateFilterOptions'
import { useState, type ReactNode } from 'react'
import { DateFilterChip } from './DateFilterChip'
import { IconTip } from '@/components/ui/tooltip'
import type { DateRangeFilter } from '@/lib/candidateDates'

type FilterOptions = ReturnType<typeof useCandidateFilterOptions>

interface FilterChipsRowProps {
  filterOptions: FilterOptions
  /** Rendered at the far right (the Sort menu). */
  trailing?: ReactNode
}

type ChipKey =
  | 'skills' | 'countries' | 'cities' | 'companies'
  | 'seniorityLevels' | 'functionalAreas'
  | 'pipelineStatuses' | 'stages' | 'jobs'
  | 'sources' | 'statuses' | 'enrichmentStatuses'

const CHIP_LABELS: Record<ChipKey, string> = {
  skills: 'Skills',
  countries: 'Country',
  cities: 'City',
  companies: 'Company',
  seniorityLevels: 'Seniority',
  functionalAreas: 'Function',
  pipelineStatuses: 'Pipeline status',
  stages: 'Stage name',
  jobs: 'Job',
  sources: 'Source',
  statuses: 'Status',
  enrichmentStatuses: 'Enrichment',
}

const OPTION_KEY: Record<ChipKey, keyof FilterOptions> = {
  skills: 'skillOptions',
  countries: 'countryOptions',
  cities: 'cityOptions',
  companies: 'companyOptions',
  seniorityLevels: 'seniorityOptions',
  functionalAreas: 'functionalAreaOptions',
  pipelineStatuses: 'pipelineStatusOptions',
  stages: 'stageOptions',
  jobs: 'jobOptions',
  sources: 'sourceOptions',
  statuses: 'statusOptions',
  enrichmentStatuses: 'enrichmentStatusOptions',
}

const PRIMARY_ORDER: ChipKey[] = ['skills', 'countries', 'pipelineStatuses', 'companies', 'jobs']

export function FilterChipsRow({ filterOptions, trailing }: FilterChipsRowProps) {
  const { filters, setArrayFilter, setDateRanges, setNumericFilter, clearAll, activeFilterCount } = useCandidateFilters()
  // Experience and salary can be set by "Ask in plain English" or a saved
  // search; show them so they can be seen and removed (2026-10-14).
  const span = (min: number | null, max: number | null, unit: (n: number) => string) =>
    min != null && max != null ? `${unit(min)}–${unit(max)}` : min != null ? `${unit(min)}+` : max != null ? `up to ${unit(max)}` : null
  const expLabel = span(filters.experienceMin, filters.experienceMax, (n) => `${n}`)
  const salaryLabel = span(filters.salaryMin, filters.salaryMax, (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`))
  const ranges = filters.dateRanges ?? []
  // One chip per kind of date: setting a kind that's already there replaces it.
  const putRange = (next: DateRangeFilter, at?: number) => {
    const list = ranges.filter((r, i) => i !== at && r.field !== next.field)
    if (at == null) setDateRanges([...list, next])
    else setDateRanges([...list.slice(0, at), next, ...list.slice(at)])
  }
  const [extraVisible, setExtraVisible] = useState<Set<ChipKey>>(new Set())

  const isVisible = (key: ChipKey) =>
    PRIMARY_ORDER.includes(key) ||
    extraVisible.has(key) ||
    (filters[key as keyof typeof filters] as string[])?.length > 0

  const visibleChips = (Object.keys(CHIP_LABELS) as ChipKey[]).filter(isVisible)
  const hiddenChips = (Object.keys(CHIP_LABELS) as ChipKey[]).filter(k => !isVisible(k))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleChips.map(key => {
        const options = (filterOptions as any)[OPTION_KEY[key]] ?? []
        if (options.length === 0 && !((filters[key as keyof typeof filters] as string[])?.length)) return null
        return (
          <FilterChipPopover
            key={key}
            label={CHIP_LABELS[key]}
            options={options}
            selectedValues={(filters[key as keyof typeof filters] as string[]) ?? []}
            onSelectionChange={(vals) => setArrayFilter(key, vals)}
            searchable
          />
        )
      })}

      {expLabel && (
        <RemovableChip label={`Experience · ${expLabel} years`} onRemove={() => { setNumericFilter('experienceMin', null); setNumericFilter('experienceMax', null) }} />
      )}
      {salaryLabel && (
        <RemovableChip label={`Salary · ${salaryLabel} a year`} onRemove={() => { setNumericFilter('salaryMin', null); setNumericFilter('salaryMax', null) }} />
      )}

      {ranges.map((r, i) => (
        <DateFilterChip
          key={`${r.field}-${i}`}
          value={r}
          usedFields={ranges.map((x) => x.field)}
          onChange={(next) => putRange(next, i)}
          onRemove={() => setDateRanges(ranges.filter((_, j) => j !== i))}
        />
      ))}
      {ranges.length < 3 && (
        <DateFilterChip usedFields={ranges.map((x) => x.field)} onChange={(next) => putRange(next)} />
      )}

      {hiddenChips.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-dashed border-virgilio-border text-[13px] font-poppins font-medium text-text-secondary hover:bg-[#F1F0EC] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add filter
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-56">
            <DropdownMenuLabel>Add filter</DropdownMenuLabel>
            {hiddenChips.map(k => (
              <DropdownMenuItem key={k} onSelect={() => setExtraVisible(prev => new Set(prev).add(k))}>
                {CHIP_LABELS[k]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={() => { clearAll(); setExtraVisible(new Set()) }}
          className="ml-1 text-[12px] font-poppins font-medium text-text-tertiary hover:text-text-primary"
        >
          Reset
        </button>
      )}

      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  )
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center h-9 rounded-lg border border-virgilio-border bg-[#FAFAF7] text-[13px] font-poppins font-medium whitespace-nowrap">
      <span className="pl-3.5 pr-1 text-virgilio-purple">{label}</span>
      <IconTip label={`Remove ${label}`}>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="gio-pressable h-full px-2 rounded-r-lg text-text-tertiary hover:text-text-primary hover:bg-[hsl(var(--menu-hover))]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </IconTip>
    </span>
  )
}
