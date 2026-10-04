import { useMemo } from 'react'
import { differenceInDays, format, formatDistanceToNowStrict } from 'date-fns'
import { Handshake, Info, MapPin, MoreHorizontal, Eye, UserPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActionCell, AvatarStack, ComposedCell } from '@/components/ui/table-cells'
import { TableSkeleton } from '@/components/ui/table-states'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftFlag } from '@/components/ui/EmptyIllustrations'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { JobPriorityBadge } from '@/components/jobs/JobPriorityBadge'
import { DraftPill } from './DraftPill'
import { useJobDraftMeta, SETUP_SEGMENTS } from '@/hooks/useJobDraftMeta'
import type { Job } from '@/hooks/useJobs'
import { cn } from '@/lib/utils'

const STEP_NAMES = ['Job information', 'Hiring plan', 'Hiring team', 'Job posting', 'Summary']
const COLS = 9

interface Props {
  jobs: Job[]
  isLoading: boolean
  memberById: Map<string, { name: string; email?: string }>
  onOpen: (job: Job) => void
  onSetup: (job: Job) => void
  onResume: (job: Job) => void
  onAssignOwner: (job: Job) => void
  onDiscard: (job: Job) => void
}

export const isSalesDraft = (j: Job) => !!j.sales_deal_id

export function DraftsTable({ jobs, isLoading, memberById, onOpen, onSetup, onResume, onAssignOwner, onDiscard }: Props) {
  const ordered = useMemo(
    () =>
      [...jobs].sort((a, b) => {
        const s = Number(isSalesDraft(b)) - Number(isSalesDraft(a))
        if (s) return s
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }),
    [jobs],
  )
  const { data: meta } = useJobDraftMeta(ordered.map((j) => j.id))
  const firstName = (id?: string | null) => (id ? memberById.get(id)?.name?.split(' ')[0] : undefined)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="hidden lg:block rounded-2xl border border-virgilio-border bg-white overflow-hidden">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[84px]">Priority</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[200px]">Setup</TableHead>
              <TableHead className="text-right">Last edited</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="w-[180px] text-right" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={4} columns={COLS} />
            ) : ordered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} className="p-4">
                  <EmptyState
                    size="card"
                    illustration={<SoftFlag />}
                    title="No drafts here"
                    body="Jobs you start and don't finish are saved here automatically."
                  />
                </TableCell>
              </TableRow>
            ) : (
              ordered.map((job) => {
                const sales = isSalesDraft(job)
                const stale = differenceInDays(new Date(), new Date(job.updated_at)) >= 30
                const checks = meta?.checks[job.id]
                const nOpenings = meta?.openingCounts[job.id] ?? 0
                const openingsLabel = `${nOpenings} ${nOpenings === 1 ? 'opening' : 'openings'}`
                const done = checks ? SETUP_SEGMENTS.filter((s) => checks[s.key]).length : 0
                const step = Math.min(Math.max(job.draft_step || 1, 1), 5)
                const sub = sales
                  ? [job.sales_deal_title, job.sales_deal_owner && `won by ${job.sales_deal_owner}`, openingsLabel].filter(Boolean).join(' · ')
                  : `Stopped at step ${step} of 5 · ${STEP_NAMES[step - 1]} · ${openingsLabel}`
                const owner = job.created_by ? memberById.get(job.created_by) : undefined
                const editor = firstName(job.last_edited_by)
                return (
                  <TableRow key={job.id} interactive className="group cursor-pointer" onClick={() => onOpen(job)}>
                    <TableCell className="w-[84px]">
                      <JobPriorityBadge priority={(job as any).priority} />
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-inter text-[13px] font-medium text-text-primary">{job.title}</span>
                        {sales && (
                          <span className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full bg-[#F1F0EC] px-1.5 font-inter text-[10.5px] font-semibold text-[#1F2230]">
                            <Handshake className="h-3 w-3" /> From Gio Sales
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate font-inter text-[11px] text-[#8B8F9E]">{sub}</div>
                    </TableCell>
                    <TableCell>{job.department || '—'}</TableCell>
                    <TableCell>
                      {job.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-text-tertiary" />
                          {job.location}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <DraftPill />
                      {stale && <div className="mt-1 font-inter text-[10.5px] font-medium text-[#B45309]">Untouched 30d+</div>}
                    </TableCell>
                    <TableCell className="w-[200px]">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 gap-[3px]">
                          {SETUP_SEGMENTS.map((s) => (
                            <Tooltip key={s.key}>
                              <TooltipTrigger asChild>
                                <span className={cn('h-1.5 flex-1 rounded-full', checks?.[s.key] ? 'bg-[#1F2230]' : 'bg-[#E7E5DE]')} />
                              </TooltipTrigger>
                              <TooltipContent>{s.label}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                        <span className={cn('font-inter text-[11px] font-semibold tabular-nums', done === 5 ? 'text-[#0B7A52]' : 'text-text-primary')}>
                          {checks ? `${done}/5` : '–/5'}
                        </span>
                      </div>
                      {checks && checks.missing.length > 0 && (
                        <div className="mt-1 truncate font-inter text-[10.5px] text-[#8B8F9E]" title={checks.missing.join(', ')}>
                          To do: {checks.missing.join(', ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-block text-right">
                            <div className={cn('font-inter text-[12.5px] font-medium', stale ? 'text-[#B45309]' : 'text-text-primary')}>
                              {formatDistanceToNowStrict(new Date(job.updated_at), { addSuffix: true })}
                            </div>
                            <div className="font-inter text-[10.5px] text-[#8B8F9E]">{format(new Date(job.updated_at), 'MMM d, yyyy')}</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{editor ? `by ${editor}` : 'Last edit'}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {owner?.name ? (
                        <ComposedCell>
                          <AvatarStack people={[{ name: owner.name }]} max={1} size={22} />
                          <span className="text-table-cell text-text-primary truncate">{owner.name.split(' ')[0]}</span>
                        </ComposedCell>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-table-cell text-text-tertiary">
                          <span className="h-[22px] w-[22px] rounded-full border border-dashed border-[#B9B6AC]" />
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="w-[180px] text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {sales ? (
                          <Button size="sm" variant="primary" onClick={() => onSetup(job)}>Set up</Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => onResume(job)}>Resume</Button>
                        )}
                        <ActionCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="xs" iconOnly icon={MoreHorizontal} aria-label="Draft actions" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                              <DropdownMenuItem onClick={() => onOpen(job)}>
                                <Eye className="h-3.5 w-3.5" /> <span>Open</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onAssignOwner(job)}>
                                <UserPlus className="h-3.5 w-3.5" /> <span>Assign owner</span>
                              </DropdownMenuItem>
                              {!sales && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onDiscard(job)}
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> <span>Discard draft</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </ActionCell>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <div className="flex items-center gap-2 border-t border-[#F1F0EC] bg-[#FAFAF7] px-4 py-2.5 font-inter text-[11px] text-[#8B8F9E]">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Drafts save automatically as you go. Wizard drafts untouched for 60 days are archived; drafts from Gio Sales never expire.
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden space-y-2">
        {ordered.map((job) => (
          <div key={job.id} className="rounded-xl border border-virgilio-border bg-white p-4" onClick={() => onOpen(job)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-poppins text-[14px] font-semibold text-text-primary">{job.title}</div>
                {isSalesDraft(job) && <div className="mt-0.5 text-[11px] text-[#8B8F9E]">From Gio Sales</div>}
              </div>
              <DraftPill />
            </div>
          </div>
        ))}
        {!isLoading && ordered.length === 0 && (
          <div className="rounded-xl border border-virgilio-border bg-white p-4">
            <EmptyState size="card" illustration={<SoftFlag />} title="No drafts here" body="Jobs you start and don't finish are saved here automatically." />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
