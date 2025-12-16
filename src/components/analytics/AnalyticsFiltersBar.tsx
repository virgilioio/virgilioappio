import { useEffect, useState } from 'react'
import { MultiSelect } from '@/components/ui/multi-select'
import { useAnalyticsFilterOptions } from '@/hooks/useAnalyticsFilterOptions'
import { Users, Briefcase, Building2 } from 'lucide-react'

export interface AnalyticsFilters {
  recruiterIds: string[]
  jobIds: string[]
  organizationIds: string[]
}

interface AnalyticsFiltersBarProps {
  onFiltersChange: (filters: AnalyticsFilters) => void
}

export function AnalyticsFiltersBar({ onFiltersChange }: AnalyticsFiltersBarProps) {
  const { recruiters, jobs, organizations, isLoading } = useAnalyticsFilterOptions()

  const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([])
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([])

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange({
      recruiterIds: selectedRecruiters,
      jobIds: selectedJobs,
      organizationIds: selectedOrgs
    })
  }, [selectedRecruiters, selectedJobs, selectedOrgs, onFiltersChange])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 min-w-[200px]">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <MultiSelect
          options={recruiters}
          selectedValues={selectedRecruiters}
          onSelectionChange={setSelectedRecruiters}
          placeholder={isLoading ? "Loading..." : "All Recruiters"}
          searchable
          className="flex-1"
          emptyMessage="No recruiters found"
        />
      </div>

      <div className="flex items-center gap-2 min-w-[200px]">
        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
        <MultiSelect
          options={jobs}
          selectedValues={selectedJobs}
          onSelectionChange={setSelectedJobs}
          placeholder={isLoading ? "Loading..." : "All Jobs"}
          searchable
          className="flex-1"
          emptyMessage="No jobs found"
        />
      </div>

      <div className="flex items-center gap-2 min-w-[200px]">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <MultiSelect
          options={organizations}
          selectedValues={selectedOrgs}
          onSelectionChange={setSelectedOrgs}
          placeholder={isLoading ? "Loading..." : "All Departments"}
          searchable
          className="flex-1"
          emptyMessage="No departments found"
        />
      </div>
    </div>
  )
}
