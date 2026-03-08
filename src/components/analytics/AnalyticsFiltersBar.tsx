import { useEffect, useState, useCallback } from 'react'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { useAnalyticsFilterOptions } from '@/hooks/useAnalyticsFilterOptions'
import { X } from 'lucide-react'

export interface AnalyticsFilters {
  recruiterIds: string[]
  jobIds: string[]
  organizationIds: string[]
  jobStatus: string
}

const JOB_STATUS_OPTIONS: FilterChipOption[] = [
  { value: 'open', label: 'Open', count: 0 },
  { value: 'closed', label: 'Closed', count: 0 },
  { value: 'draft', label: 'Draft', count: 0 },
  { value: 'archived', label: 'Archived', count: 0 },
]

interface AnalyticsFiltersBarProps {
  onFiltersChange: (filters: AnalyticsFilters) => void
}

export function AnalyticsFiltersBar({ onFiltersChange }: AnalyticsFiltersBarProps) {
  const { recruiters, jobs, organizations, isLoading } = useAnalyticsFilterOptions()

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['open'])
  const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([])
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([])

  // Map FilterOption[] → FilterChipOption[] (no counts in analytics)
  const recruiterChipOptions: FilterChipOption[] = recruiters.map(r => ({ ...r, count: 0 }))
  const jobChipOptions: FilterChipOption[] = jobs.map(j => ({ ...j, count: 0 }))
  const orgChipOptions: FilterChipOption[] = organizations.map(o => ({ ...o, count: 0 }))

  const hasActiveFilters = selectedStatuses.length > 0 || selectedRecruiters.length > 0 || selectedJobs.length > 0 || selectedOrgs.length > 0

  const clearAll = useCallback(() => {
    setSelectedStatuses([])
    setSelectedRecruiters([])
    setSelectedJobs([])
    setSelectedOrgs([])
  }, [])

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange({
      recruiterIds: selectedRecruiters,
      jobIds: selectedJobs,
      organizationIds: selectedOrgs,
      // Keep backward compat: first selected status or 'all'
      jobStatus: selectedStatuses.length === 1 ? selectedStatuses[0] : 'all'
    })
  }, [selectedRecruiters, selectedJobs, selectedOrgs, selectedStatuses, onFiltersChange])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChipPopover
        label="Status"
        options={JOB_STATUS_OPTIONS}
        selectedValues={selectedStatuses}
        onSelectionChange={setSelectedStatuses}
      />

      <FilterChipPopover
        label="Recruiter"
        options={recruiterChipOptions}
        selectedValues={selectedRecruiters}
        onSelectionChange={setSelectedRecruiters}
        searchable
      />

      <FilterChipPopover
        label="Job"
        options={jobChipOptions}
        selectedValues={selectedJobs}
        onSelectionChange={setSelectedJobs}
        searchable
      />

      <FilterChipPopover
        label="Department"
        options={orgChipOptions}
        selectedValues={selectedOrgs}
        onSelectionChange={setSelectedOrgs}
        searchable
      />

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 text-xs font-poppins text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          <X className="h-3 w-3" />
          Clear filters
        </button>
      )}
    </div>
  )
}
