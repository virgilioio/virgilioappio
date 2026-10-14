import type { ReactNode } from 'react'
import { ArrowUpRight, Ban, ChevronRight, MoreHorizontal, Send, Share2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableSkeleton } from '@/components/ui/table-states'
import { menuItemDanger } from '@/lib/menu-classes'
import { cn } from '@/lib/utils'

import { RefStatus } from '@/components/references/RefStatus'
import { RefereeTrack } from '@/components/references/RefereeTrack'
import type { ReferenceListRow } from '@/hooks/useReferenceList'
import { isActiveRefState } from '@/lib/references/status'

const COLS = 6

function initials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function shortDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function ItemText({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="min-w-0">
      <span className="block truncate">{label}</span>
      {hint && <span className="block text-[11.5px] leading-[1.4] text-text-tertiary">{hint}</span>}
    </span>
  )
}

export interface ReferenceRequestsTableProps {
  rows: ReferenceListRow[]
  /** First load: skeleton rows. */
  loading?: boolean
  /** Shown in place of rows when the list is empty, failed or filtered out. */
  emptyState?: ReactNode
  onOpen: (row: ReferenceListRow) => void
  onResend: (row: ReferenceListRow) => void
  onShare: (row: ReferenceListRow) => void
  onCancel: (row: ReferenceListRow) => void
  onDelete: (row: ReferenceListRow) => void
  canCancel?: boolean
  canDelete?: boolean
}

/**
 * The reference request list, on the shared Table primitives (instant
 * mouse-only row hover, tabular numbers, sticky header shadow) with a real
 * DropdownMenu for row actions (grows from the ⋯, keyboard, Esc).
 */
export function ReferenceRequestsTable({
  rows,
  loading = false,
  emptyState,
  onOpen,
  onResend,
  onShare,
  onCancel,
  onDelete,
  canCancel = true,
  canDelete = true,
}: ReferenceRequestsTableProps) {
  return (
    <div className="rounded-2xl border border-virgilio-border bg-white overflow-clip">
      <Table density="comfortable">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[22%]">Candidate</TableHead>
            <TableHead className="w-[20%]">Collected for</TableHead>
            <TableHead>Template</TableHead>
            <TableHead className="w-[200px]">Progress</TableHead>
            <TableHead>Last activity</TableHead>
            <TableHead className="w-[64px] text-right" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeleton rows={6} columns={COLS} />
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLS} style={{ padding: '48px 24px' }}>
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const active = isActiveRefState(row.state)
              const cancelled = row.state === 'cancelled'
              const submitted = row.referees.filter(
                (r) => r.status === 'submitted' || r.status === 'logged',
              ).length
              return (
                <TableRow
                  key={row.id}
                  data-row-id={row.id}
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => onOpen(row)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpen(row)
                    }
                  }}
                  style={cancelled ? { opacity: 0.62 } : undefined}
                >
                  {/* Candidate */}
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#EDE4FF] font-poppins text-[11px] font-semibold text-[#5B21B6]"
                      >
                        {initials(row.candidateName)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-inter text-[13px] font-medium text-text-primary">
                          {row.candidateName || 'Unnamed candidate'}
                        </span>
                        {row.candidateRole && (
                          <span className="block truncate font-inter text-[11.5px] text-text-tertiary">{row.candidateRole}</span>
                        )}
                      </span>
                    </div>
                  </TableCell>

                  {/* Collected for */}
                  <TableCell>
                    <span className="block max-w-[260px] truncate font-inter text-[12.5px] text-text-primary">
                      {row.clientName ?? row.jobTitle ?? 'No client'}
                    </span>
                    <span className="block max-w-[260px] truncate font-inter text-[11.5px] text-text-tertiary">
                      {[row.stage, shortDate(row.created_at)].filter(Boolean).join(' · ')}
                    </span>
                  </TableCell>

                  {/* Template */}
                  <TableCell>
                    <span className="block max-w-[220px] truncate font-inter text-[12.5px] text-text-secondary">
                      {row.templateName ?? '—'}
                    </span>
                  </TableCell>

                  {/* Progress: counts, never a percentage */}
                  <TableCell>
                    <div className="flex flex-col gap-[5px]">
                      <RefStatus state={row.state} flagged={row.flagged} size="xs" />
                      {row.referees.length > 0 && (
                        <div className="flex items-center gap-[7px]">
                          <RefereeTrack referees={row.referees} requiredCount={row.required} width={54} />
                          <span className="truncate font-inter text-[11.5px] tabular-nums text-text-tertiary">{row.counts}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Last activity */}
                  <TableCell>
                    <span className="block max-w-[240px] truncate font-inter text-[12.5px] text-text-secondary">
                      {row.lastActivity
                        ? `${row.lastActivity.label} · ${ago(row.lastActivity.at)}`
                        : `Requested ${ago(row.created_at)}`}
                    </span>
                  </TableCell>

                  {/* Row actions: the cell stops clicks so the menu never opens the request. */}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <DropdownMenu>
                        <IconTip label="Actions">
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              aria-label={`Actions for ${row.candidateName || 'this request'}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                        </IconTip>
                        <DropdownMenuContent align="end" className="min-w-[220px]">
                          <DropdownMenuItem onClick={() => onOpen(row)}>
                            <ArrowUpRight className="h-3.5 w-3.5" /> Open request
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onResend(row)}>
                            <Send className="h-3.5 w-3.5" /> {active ? 'Resend' : 'Request again'}
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={submitted === 0} onClick={() => onShare(row)} className={submitted === 0 ? 'h-auto items-start py-1.5' : undefined}>
                            <Share2 className={cn('h-3.5 w-3.5 shrink-0', submitted === 0 && 'mt-0.5')} />
                            <ItemText label="Share report" hint={submitted === 0 ? 'Nothing submitted yet' : undefined} />
                          </DropdownMenuItem>
                          {((active && canCancel) || canDelete) && <DropdownMenuSeparator />}
                          {active && canCancel && (
                            <DropdownMenuItem onClick={() => onCancel(row)} className={cn(menuItemDanger, 'h-auto items-start py-1.5')}>
                              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <ItemText label="Cancel request" hint="Revokes links, keeps answers" />
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem onClick={() => onDelete(row)} className={cn(menuItemDanger, 'h-auto items-start py-1.5')}>
                              <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <ItemText
                                label="Delete permanently"
                                hint={
                                  submitted > 0
                                    ? `Destroys ${submitted} reference${submitted === 1 ? '' : 's'}`
                                    : 'Removes the record'
                                }
                              />
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight aria-hidden size={15} className="text-[#B5B9C4]" />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default ReferenceRequestsTable
