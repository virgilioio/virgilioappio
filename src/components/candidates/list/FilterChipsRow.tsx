import { Plus } from 'lucide-react'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { useCandidateFilters } from '@/contexts/CandidateFilterContext'
import type { useCandidateFilterOptions } from '@/hooks/useCandidateFilterOptions'
import { useState, type ReactNode } from 'react'
import { DateFilterChip } from './DateFilterChip'
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
  const { filters, setArrayFilter, setDateRanges, clearAll, activeFilterCount } = useCandidateFilters()
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
