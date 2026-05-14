import { useState, useEffect, useMemo } from 'react'
import { differenceInDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  IdentityCell, StatusCell, NumericCell, ComposedCell, AvatarStack, ActionCell,
} from '@/components/ui/table-cells'
import { TableSkeleton, TableEmpty, TableFilteredEmpty } from '@/components/ui/table-states'
import { TableFooterSummary } from '@/components/ui/table-pagination'
import {
  TableToolbar, TableSearch, TableSegmented,
} from '@/components/ui/table-toolbar'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Edit, Archive, MapPin } from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { PipelineBar } from '@/components/jobs/PipelineBar'
import { useJobsCandidateCounts } from '@/hooks/useJobsCandidateCounts'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { useUserAssignedJobIds } from '@/hooks/useUserAssignedJobIds'
import { jobMatchesUsers } from '@/utils/jobInvolvement'
import { Job } from '@/hooks/useJobs'

interface JobsTableProps {
  jobs: Job[]
  isLoading: boolean
  onView: (job: Job) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  onCreateNew: () => void
  /** Status segment value, controlled by parent. */
  statusFilter: 'active' | 'all' | 'paused' | 'closed' | 'archived'
}

type StatusTone = 'green' | 'yellow' | 'neutral' | 'ink'

function statusBadge(status: Job['status']) {
  const map: Record<Job['status'], { tone: StatusTone; label: string }> = {
    open: { tone: 'green', label: 'Open' },
    draft: { tone: 'yellow', label: 'Paused' },
    closed: { tone: 'neutral', label: 'Closed' },
    archived: { tone: 'ink', label: 'Archived' },
  }
  return map[status]
}

const COLS = 8 // job, dept, location, stage, pipeline, days, owner, actions

export function JobsTable({
  jobs,
  isLoading,
  onView,
  onEdit,
  onArchive,
  statusFilter,
}: JobsTableProps) {
  const permissions = usePermissions()
  const { organizations } = useOrganizations()
  const { members, isLoading: membersLoading } = useMembers()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [postedRange, setPostedRange] = useState<string[]>([]) // 'today' | '7d' | '30d'

  const { assignedJobIds } = useUserAssignedJobIds(selectedUsers)

  const departmentOptions: FilterChipOption[] = useMemo(() => {
    const set = new Set<string>()
    jobs.forEach(j => j.department && set.add(j.department))
    return Array.from(set).sort().map(v => ({ value: v, label: v, count: 0 }))
  }, [jobs])

  const locationOptions: FilterChipOption[] = useMemo(() => {
    const set = new Set<string>()
    jobs.forEach(j => j.location && set.add(j.location))
    return Array.from(set).sort().map(v => ({ value: v, label: v, count: 0 }))
  }, [jobs])

  const userOptions: FilterChipOption[] = useMemo(() => {
    return members
      .filter(m => m.user_status === 'active' && m.user_id && (m.user_type === 'member' || m.user_type === 'workspace_owner'))
      .map(m => ({
        value: m.user_id!,
        label: `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() || m.user_email || 'Unknown',
        count: 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [members])

  const postedOptions: FilterChipOption[] = useMemo(() => [
    { value: 'today', label: 'Today', count: 0 },
    { value: '7d', label: 'Last 7 days', count: 0 },
    { value: '30d', label: 'Last 30 days', count: 0 },
  ], [])

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Status segment
      if (statusFilter === 'active' && !(job.status === 'open' || job.status === 'draft')) return false
      if (statusFilter === 'paused' && job.status !== 'draft') return false
      if (statusFilter === 'closed' && job.status !== 'closed') return false
      if (statusFilter === 'archived' && job.status !== 'archived') return false

      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const haystack = `${job.title} ${job.department ?? ''} ${(job.hiring_team_names || []).join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      if (selectedDepartments.length && !selectedDepartments.includes(job.department || '')) return false
      if (selectedLocations.length && !selectedLocations.includes(job.location || '')) return false

      if (postedRange.length) {
        const days = differenceInDays(new Date(), new Date(job.created_at))
        const range = postedRange[0]
        if (range === 'today' && days > 0) return false
        if (range === '7d' && days > 7) return false
        if (range === '30d' && days > 30) return false
      }

      if (!jobMatchesUsers(job, selectedUsers, assignedJobIds)) return false
      return true
    })
  }, [jobs, statusFilter, searchTerm, selectedDepartments, selectedLocations, selectedUsers, postedRange, assignedJobIds])

  const visibleIds = useMemo(() => filteredJobs.map(j => j.id), [filteredJobs])
  const { data: countsMap = {} } = useJobsCandidateCounts(visibleIds)
  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(countsMap)),
    [countsMap]
  )

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedDepartments.length > 0 ||
    selectedLocations.length > 0 ||
    selectedUsers.length > 0 ||
    postedRange.length > 0

  const clearAll = () => {
    setSearchTerm('')
    setSelectedDepartments([])
    setSelectedLocations([])
    setSelectedUsers([])
    setPostedRange([])
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: search + filter chips */}
      <TableToolbar
        left={
          <>
            <TableSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by title, owner, or department…"
              className="min-w-[260px]"
            />
            <FilterChipPopover
              label="Department"
              options={departmentOptions}
              selectedValues={selectedDepartments}
              onSelectionChange={setSelectedDepartments}
              searchable
            />
            <FilterChipPopover
              label="Location"
              options={locationOptions}
              selectedValues={selectedLocations}
              onSelectionChange={setSelectedLocations}
              searchable
            />
            {(permissions.canViewOrganizations || permissions.isPlatformAdmin) && !membersLoading && userOptions.length > 0 && (
              <FilterChipPopover
                label="Owner"
                options={userOptions}
                selectedValues={selectedUsers}
                onSelectionChange={setSelectedUsers}
                searchable
              />
            )}
            <FilterChipPopover
              label="Posted"
              options={postedOptions}
              selectedValues={postedRange}
              onSelectionChange={(vals) => setPostedRange(vals.slice(-1))}
              searchable={false}
            />
          </>
        }
      />

      {/* Desktop table */}
      <div className="hidden lg:block">
        <Table density="default">
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead className="text-right">Days open</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="w-[44px] text-right" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={5} columns={COLS} />
            ) : filteredJobs.length === 0 ? (
              jobs.length === 0 ? (
                <TableEmpty
                  colSpan={COLS}
                  title="No jobs yet"
                  description="Create your first job to start sourcing and tracking candidates."
                />
              ) : (
                <TableFilteredEmpty
                  colSpan={COLS}
                  query={searchTerm}
                  onClearFilters={clearAll}
                />
              )
            ) : (
              filteredJobs.map(job => {
                const days = differenceInDays(new Date(), new Date(job.created_at))
                const overdue = days >= 21
                const status = statusBadge(job.status)
                const count = countsMap[job.id] ?? 0
                const owner = job.hiring_team_names?.[0] || job.organization_name || '—'
                const trending = count >= 20 // simple, real signal
                const employmentType = job.department ? 'Full-time' : 'Full-time'
                return (
                  <TableRow
                    key={job.id}
                    interactive
                    className="group cursor-pointer"
                    onClick={() => onView(job)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <IdentityCell
                          name={
                            <span className="inline-flex items-center gap-2">
                              <span className="truncate">{job.title}</span>
                              {trending && (
                                <Badge tone="purple" size="xs">Trending</Badge>
                              )}
                            </span>
                          }
                          sub={`${employmentType} · ${count} candidate${count === 1 ? '' : 's'}`}
                          fallback={job.title}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary">{job.department || '—'}</TableCell>
                    <TableCell className="text-text-secondary">
                      {job.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-text-tertiary" />
                          {job.location}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusCell>
                        <Badge tone={status.tone} dot size="sm">{status.label}</Badge>
                      </StatusCell>
                    </TableCell>
                    <TableCell>
                      <PipelineBar count={count} max={maxCount} />
                    </TableCell>
                    <TableCell className="text-right">
                      <NumericCell className={overdue ? 'text-destructive' : 'text-text-secondary'}>
                        {days}d
                      </NumericCell>
                    </TableCell>
                    <TableCell>
                      <ComposedCell>
                        <AvatarStack people={[{ name: owner }]} size={22} />
                        <span className="text-table-cell text-text-primary truncate">{owner}</span>
                      </ComposedCell>
                    </TableCell>
                    <TableCell className="w-[44px] text-right">
                      <ActionCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="xs" iconOnly icon={MoreHorizontal} aria-label="Job actions" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(job) }}>
                              <Eye className="h-4 w-4 mr-2" /> View
                            </DropdownMenuItem>
                            <PermissionGate permission="canEditJobs">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(job) }}>
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate permission="canArchiveJobs">
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onArchive(job.id) }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Archive className="h-4 w-4 mr-2" /> Archive
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ActionCell>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {filteredJobs.length > 0 && !isLoading && (
          <TableFooterSummary
            rangeStart={1}
            rangeEnd={filteredJobs.length}
            total={jobs.length}
            entityLabel="jobs"
          />
        )}
      </div>

      {/* Mobile card view */}
      <div className="lg:hidden space-y-2">
        {isLoading ? (
          <Card><CardContent className="p-4 text-text-tertiary text-sm">Loading…</CardContent></Card>
        ) : filteredJobs.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-text-tertiary text-sm">
            {jobs.length === 0 ? 'No jobs yet.' : 'No jobs match your filters.'}
          </CardContent></Card>
        ) : (
          filteredJobs.map(job => {
            const status = statusBadge(job.status)
            const count = countsMap[job.id] ?? 0
            return (
              <Card key={job.id} className="bg-white" onClick={() => onView(job)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-poppins font-semibold text-[14px] text-text-primary truncate">{job.title}</h4>
                      </div>
                      <div className="text-[12px] text-text-tertiary mt-0.5 truncate">
                        {(job.department || 'Full-time')} · {count} candidate{count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <Badge tone={status.tone} dot size="sm">{status.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
