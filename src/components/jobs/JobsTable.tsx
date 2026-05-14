import { useState, useMemo } from 'react'
import { differenceInDays } from 'date-fns'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  IdentityCell, StatusCell, NumericCell, ComposedCell, AvatarStack, ActionCell,
} from '@/components/ui/table-cells'
import { TableSkeleton, TableEmpty, TableFilteredEmpty } from '@/components/ui/table-states'
import { TableFooterSummary } from '@/components/ui/table-pagination'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Edit, Archive, MapPin } from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { PipelineBar } from '@/components/jobs/PipelineBar'
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics'
import { usePermissions } from '@/hooks/usePermissions'
import { useMembers } from '@/hooks/useMembers'
import { useUserAssignedJobIds } from '@/hooks/useUserAssignedJobIds'
import { jobMatchesUsers } from '@/utils/jobInvolvement'
import { Job } from '@/hooks/useJobs'
import { cn } from '@/lib/utils'

type StatusSegment = 'active' | 'all' | 'paused' | 'closed' | 'archived'

interface TabOption {
  value: StatusSegment
  label: string
  count: number
}

interface JobsTableProps {
  jobs: Job[]
  isLoading: boolean
  onView: (job: Job) => void
  onEdit: (job: Job) => void
  onArchive: (id: string) => void
  onCreateNew: () => void
  statusFilter: StatusSegment
  onStatusFilterChange: (v: StatusSegment) => void
  tabs: TabOption[]
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

const COLS = 8 // job, company, location, stage, pipeline, days, owner, actions

export function JobsTable({
  jobs,
  isLoading,
  onView,
  onEdit,
  onArchive,
  statusFilter,
  onStatusFilterChange,
  tabs,
}: JobsTableProps) {
  const permissions = usePermissions()
  const { members, isLoading: membersLoading } = useMembers()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [postedRange, setPostedRange] = useState<string[]>([])

  const { assignedJobIds } = useUserAssignedJobIds(selectedUsers)

  const companyOptions: FilterChipOption[] = useMemo(() => {
    const set = new Set<string>()
    jobs.forEach(j => j.organization_name && set.add(j.organization_name))
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

  const memberById = useMemo(() => {
    const map = new Map<string, { name: string; email?: string }>()
    members.forEach(m => {
      if (!m.user_id) return
      const name = `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() || m.user_email || ''
      map.set(m.user_id, { name, email: m.user_email })
    })
    return map
  }, [members])

  const postedOptions: FilterChipOption[] = useMemo(() => [
    { value: 'today', label: 'Today', count: 0 },
    { value: '7d', label: 'Last 7 days', count: 0 },
    { value: '30d', label: 'Last 30 days', count: 0 },
  ], [])

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (statusFilter === 'active' && !(job.status === 'open' || job.status === 'draft')) return false
      if (statusFilter === 'paused' && job.status !== 'draft') return false
      if (statusFilter === 'closed' && job.status !== 'closed') return false
      if (statusFilter === 'archived' && job.status !== 'archived') return false

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const haystack = `${job.title} ${job.organization_name ?? ''} ${(job.hiring_team_names || []).join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      if (selectedCompanies.length && !selectedCompanies.includes(job.organization_name || '')) return false
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
  }, [jobs, statusFilter, searchTerm, selectedCompanies, selectedLocations, selectedUsers, postedRange, assignedJobIds])

  const visibleIds = useMemo(() => filteredJobs.map(j => j.id), [filteredJobs])
  const { data: metrics = [] } = usePipelineJobMetrics(visibleIds)
  const metricsByJob = useMemo(() => {
    const m = new Map<string, typeof metrics[number]>()
    metrics.forEach(x => m.set(x.job_id, x))
    return m
  }, [metrics])

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedCompanies.length > 0 ||
    selectedLocations.length > 0 ||
    selectedUsers.length > 0 ||
    postedRange.length > 0

  const clearAll = () => {
    setSearchTerm('')
    setSelectedCompanies([])
    setSelectedLocations([])
    setSelectedUsers([])
    setPostedRange([])
  }

  return (
    <div className="space-y-4">
      {/* Tabs + Filters card */}
      <div className="rounded-2xl border border-virgilio-border bg-white overflow-hidden">
        {/* Tabs row */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-virgilio-border">
          {tabs.map(t => {
            const active = t.value === statusFilter
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onStatusFilterChange(t.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg font-poppins text-[13.5px] tracking-[-0.01em] transition-colors',
                  active
                    ? 'bg-[#FAFAF7] text-text-primary font-semibold'
                    : 'text-text-tertiary hover:text-text-primary font-medium'
                )}
              >
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span className={cn(
                    'font-poppins text-[12.5px] tabular-nums',
                    active ? 'text-text-secondary' : 'text-text-tertiary/70'
                  )}>
                    ({t.count})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search + filters row */}
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by title, owner, or company…"
              className="h-10 pl-10 pr-3 bg-[#FAFAF7] border-transparent rounded-xl text-[13.5px] focus-visible:bg-white"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChipPopover
              variant="soft"
              label="Company"
              options={companyOptions}
              selectedValues={selectedCompanies}
              onSelectionChange={setSelectedCompanies}
              searchable
            />
            <FilterChipPopover
              variant="soft"
              label="Location"
              options={locationOptions}
              selectedValues={selectedLocations}
              onSelectionChange={setSelectedLocations}
              searchable
            />
            {(permissions.canViewOrganizations || permissions.isPlatformAdmin) && !membersLoading && userOptions.length > 0 && (
              <FilterChipPopover
                variant="soft"
                label="Owner"
                options={userOptions}
                selectedValues={selectedUsers}
                onSelectionChange={setSelectedUsers}
                searchable
              />
            )}
            <FilterChipPopover
              variant="soft"
              label="Posted"
              options={postedOptions}
              selectedValues={postedRange}
              onSelectionChange={(vals) => setPostedRange(vals.slice(-1))}
              searchable={false}
            />
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block rounded-2xl border border-virgilio-border bg-white overflow-hidden">
        <Table density="default">
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Company</TableHead>
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
                const metric = metricsByJob.get(job.id)
                const totalCount = metric?.active_candidates ?? 0
                const stageData = (metric?.stages ?? []).map(s => ({
                  stage_id: s.stage_id,
                  stage_name: s.stage_name,
                  stage_type: s.stage_type,
                  count: s.count_in_stage,
                  position: s.position,
                }))
                const trending = totalCount >= 20

                // Owner resolution
                const ownerMember = job.created_by ? memberById.get(job.created_by) : undefined
                const ownerName =
                  ownerMember?.name ||
                  job.hiring_team_names?.[0] ||
                  '—'
                const ownerFirst = ownerName === '—' ? '—' : ownerName.split(' ')[0]

                return (
                  <TableRow
                    key={job.id}
                    interactive
                    className="group cursor-pointer"
                    onClick={() => onView(job)}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-poppins font-semibold text-[14px] tracking-[-0.01em] text-text-primary truncate">
                            {job.title}
                          </span>
                          {trending && (
                            <Badge tone="purple" size="xs">Trending</Badge>
                          )}
                        </div>
                        <div className="text-[12px] text-text-tertiary mt-0.5 truncate">
                          Full-time · {totalCount} candidate{totalCount === 1 ? '' : 's'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary">{job.organization_name || '—'}</TableCell>
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
                      <PipelineBar stages={stageData} total={totalCount} />
                    </TableCell>
                    <TableCell className="text-right">
                      <NumericCell className={overdue ? 'text-destructive' : 'text-text-secondary'}>
                        {days}d
                      </NumericCell>
                    </TableCell>
                    <TableCell>
                      <ComposedCell>
                        <AvatarStack people={[{ name: ownerName }]} size={22} />
                        <span className="text-table-cell text-text-primary truncate">{ownerFirst}</span>
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
            const metric = metricsByJob.get(job.id)
            const count = metric?.active_candidates ?? 0
            return (
              <Card key={job.id} className="bg-white" onClick={() => onView(job)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-poppins font-semibold text-[14px] text-text-primary truncate">{job.title}</h4>
                      <div className="text-[12px] text-text-tertiary mt-0.5 truncate">
                        {(job.organization_name || 'Full-time')} · {count} candidate{count === 1 ? '' : 's'}
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
