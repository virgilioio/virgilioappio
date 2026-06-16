import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { useAnalyticsFilterOptions } from '@/hooks/useAnalyticsFilterOptions'
import { AnalyticsTimeFilter, type TimePreset } from '@/components/analytics/AnalyticsTimeFilter'
import type { PageFilters } from '@/components/analytics/model/AnalyticsDataContext'

interface Props {
  filters: PageFilters
  onFiltersChange: (filters: PageFilters) => void
  onDateRangeChange: (start: Date, end: Date) => void
  initialTimePreset?: TimePreset
}

const STATUS: FilterChipOption[] = [
  { value: 'open', label: 'Open', count: 0 },
  { value: 'closed', label: 'Closed', count: 0 },
  { value: 'draft', label: 'Draft', count: 0 },
  { value: 'archived', label: 'Archived', count: 0 },
]

export function AnalyticsFiltersToolbar({ filters, onFiltersChange, onDateRangeChange, initialTimePreset }: Props) {
  const { recruiters, jobs, organizations } = useAnalyticsFilterOptions()

  const [statuses, setStatuses] = useState<string[]>(filters.jobStatus === 'all' ? [] : filters.jobStatus ? [filters.jobStatus] : ['open'])
  const [selRecruiters, setRecruiters] = useState<string[]>(filters.recruiterIds)
  const [selJobs, setJobs] = useState<string[]>(filters.jobIds)
  const [selOrgs, setOrgs] = useState<string[]>(filters.organizationIds)

  const recruiterOpts: FilterChipOption[] = recruiters.map(r => ({ ...r, count: 0 }))
  const jobOpts: FilterChipOption[] = jobs.map(j => ({ ...j, count: 0 }))
  const orgOpts: FilterChipOption[] = organizations.map(o => ({ ...o, count: 0 }))

  const hasActive = statuses.length > 0 || selRecruiters.length > 0 || selJobs.length > 0 || selOrgs.length > 0

  const clearAll = useCallback(() => {
    setStatuses([])
    setRecruiters([])
    setJobs([])
    setOrgs([])
  }, [])

  useEffect(() => {
    onFiltersChange({
      recruiterIds: selRecruiters,
      jobIds: selJobs,
      organizationIds: selOrgs,
      jobStatus: statuses.length === 1 ? statuses[0] : 'all',
    })
  }, [selRecruiters, selJobs, selOrgs, statuses, onFiltersChange])

  return (
    <div className="bg-white border border-[#E7E8EE] rounded-[12px] px-3 py-2.5 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-inter font-medium text-[#5A6072] mr-1">
        <SlidersHorizontal size={12} />
        Filters
      </span>
      <FilterChipPopover label="Status" options={STATUS} selectedValues={statuses} onSelectionChange={setStatuses} />
      <FilterChipPopover label="Recruiter" options={recruiterOpts} selectedValues={selRecruiters} onSelectionChange={setRecruiters} searchable />
      <FilterChipPopover label="Job" options={jobOpts} selectedValues={selJobs} onSelectionChange={setJobs} searchable />
      <FilterChipPopover label="Company" options={orgOpts} selectedValues={selOrgs} onSelectionChange={setOrgs} searchable />
      {hasActive && (
        <button onClick={clearAll} className="inline-flex items-center gap-1 text-[11px] font-inter text-[#5A6072] hover:text-[#0d0d09] transition-colors">
          <X size={11} />
          Clear
        </button>
      )}
      <div className="ml-auto">
        <AnalyticsTimeFilter onDateRangeChange={onDateRangeChange} initialPreset={initialTimePreset} />
      </div>
    </div>
  )
}
