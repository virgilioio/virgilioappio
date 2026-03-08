import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'

interface FilterCardProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  jobStatus: string
  onJobStatusChange: (value: string) => void
  selectedUsers: string[]
  onSelectedUsersChange: (users: string[]) => void
  userOptions: { value: string; label: string }[]
  showUserFilter: boolean
  selectedDepartments: string[]
  onSelectedDepartmentsChange: (departments: string[]) => void
  departmentOptions: { value: string; label: string }[]
}

const STATUS_OPTIONS: FilterChipOption[] = [
  { value: 'all', label: 'All Statuses', count: 0 },
  { value: 'draft', label: 'Draft', count: 0 },
  { value: 'open', label: 'Open', count: 0 },
  { value: 'closed', label: 'Closed', count: 0 },
  { value: 'archived', label: 'Archived', count: 0 },
]

export function FilterCard({
  searchTerm,
  onSearchChange,
  jobStatus,
  onJobStatusChange,
  selectedUsers,
  onSelectedUsersChange,
  userOptions,
  showUserFilter,
  selectedDepartments,
  onSelectedDepartmentsChange,
  departmentOptions,
}: FilterCardProps) {
  const statusSelected = useMemo(() => jobStatus === 'all' ? [] : [jobStatus], [jobStatus])

  const userChipOptions: FilterChipOption[] = useMemo(
    () => userOptions.map(u => ({ value: u.value, label: u.label, count: 0 })),
    [userOptions]
  )

  const deptChipOptions: FilterChipOption[] = useMemo(
    () => departmentOptions.map(d => ({ value: d.value, label: d.label, count: 0 })),
    [departmentOptions]
  )

  const hasActiveFilters = jobStatus !== 'open' || selectedUsers.length > 0 || selectedDepartments.length > 0 || searchTerm.trim() !== ''

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-56">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by job title..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-8 text-sm rounded-full"
        />
      </div>

      <FilterChipPopover
        label="Status"
        options={STATUS_OPTIONS.filter(o => o.value !== 'all')}
        selectedValues={statusSelected}
        onSelectionChange={(vals) => onJobStatusChange(vals.length === 0 ? 'all' : vals[vals.length - 1])}
        searchable={false}
      />

      {showUserFilter && userChipOptions.length > 0 && (
        <FilterChipPopover
          label="User"
          options={userChipOptions}
          selectedValues={selectedUsers}
          onSelectionChange={onSelectedUsersChange}
          searchable
        />
      )}

      {deptChipOptions.length > 0 && (
        <FilterChipPopover
          label="Department"
          options={deptChipOptions}
          selectedValues={selectedDepartments}
          onSelectionChange={onSelectedDepartmentsChange}
          searchable
        />
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange('')
            onJobStatusChange('open')
            onSelectedUsersChange([])
            onSelectedDepartmentsChange([])
          }}
          className="gap-1 h-8 text-xs text-muted-foreground hover:text-foreground font-poppins"
        >
          <X className="h-3 w-3" />
          Clear filters
        </Button>
      )}
    </div>
  )
}
