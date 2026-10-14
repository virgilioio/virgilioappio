import type { ReactNode } from 'react'
import { ChevronRight, Info } from 'lucide-react'

import { TableSkeleton } from '@/components/ui/table-states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefGlyph } from '@/components/references/RefGlyph'
import { ScopeChip } from '@/components/references/ScopeChip'
import type { ReferenceTemplate } from '@/lib/references/templateModel'
import type { ClientOrg } from './useClientOrganizations'

const COLS = 7

/** e.g. 12 Aug 2026 */
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}


interface Props {
  templates: ReferenceTemplate[]
  clients: ClientOrg[]
  isLoading: boolean
  /** Shown in place of rows when there are none (or the list failed to load). */
  emptyState?: ReactNode
  selectedId?: string | null
  onOpen: (template: ReferenceTemplate) => void
}

export function TemplateListTable({
  templates,
  clients,
  isLoading,
  emptyState,
  selectedId,
  onOpen,
}: Props) {
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-virgilio-border bg-white overflow-clip">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Template</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Referee rules</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead className="text-right">Times used</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[40px]" aria-label="Open" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={4} columns={COLS} />
            ) : templates.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} style={{ padding: '48px 24px' }}>
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => {
                const selected = selectedId === t.id
                const client = t.scope === 'client' ? clientName(t.client_id) : null
                return (
                  <TableRow
                    key={t.id}
                    tabIndex={0}
                    data-state={selected ? 'selected' : undefined}
                    className="cursor-pointer"
                    onClick={() => onOpen(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpen(t)
                      }
                    }}
                  >
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden
                          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-[#0d0d09]"
                        >
                          <RefGlyph size={17} color="#fffcf9" accent={t.is_live ? '#D7C5FB' : 'rgba(255,252,249,0.72)'} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-inter text-[13px] font-medium text-text-primary">
                            {t.name || 'Untitled template'}
                          </span>
                          <span className="block truncate font-inter text-[11.5px] text-text-tertiary">
                            {[client, t.is_live ? null : 'Draft, not live'].filter(Boolean).join(' · ') || '\u00a0'}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ScopeChip scope={t.scope} />
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[260px] truncate font-inter text-[12.5px] text-text-secondary">
                        {t.min_referees}–{t.max_referees} referees
                        {t.relationship_rules.map((r) => `, ${r.count} ${r.relationship.toLowerCase()}`).join('')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-inter text-[12.5px] tabular-nums text-text-primary">
                      {t.questions.length}
                    </TableCell>
                    <TableCell className="text-right font-inter text-[12.5px] tabular-nums">
                      {t.times_used === 0 ? (
                        <span className="text-text-tertiary">Never</span>
                      ) : (
                        <span className="text-text-primary">{t.times_used}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-inter text-[12px] tabular-nums text-text-tertiary">
                      {formatDate(t.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight aria-hidden size={15} className="ml-auto text-[#B5B9C4]" />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="flex items-center gap-2 font-inter text-[11.5px] text-text-tertiary">
        <Info aria-hidden size={13} className="shrink-0" />
        Templates are scoped to this tenant. A client template is offered first when the candidate's job belongs to that client.
      </p>
    </div>
  )
}
