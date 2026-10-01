import * as React from 'react'
import { PipelineToolbar } from '@/components/jobs/PipelineToolbar'
import type { PipelineFilter } from '@/components/jobs/pipelineFilters'
import { SelectionBar } from '@/components/shared/SelectionBar'
import { PipelineSectionTable } from './PipelineSectionTable'
import { getSectionConfig, type PSHandlers, type PSSection } from './pipelineSectionConfigs'
import { usePipelineSectionRows } from './usePipelineSectionRows'
import { ArrowUpDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { PSRowData } from './pipelineSectionConfigs'

type SortKey = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'score_desc' | 'score_asc' | 'reason' | 'owner'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'date_desc', label: 'Newest rejected' },
  { key: 'date_asc', label: 'Oldest rejected' },
  { key: 'name_asc', label: 'Name A–Z' },
  { key: 'name_desc', label: 'Name Z–A' },
  { key: 'score_desc', label: 'Highest match' },
  { key: 'score_asc', label: 'Lowest match' },
  { key: 'reason', label: 'Reason A–Z' },
  { key: 'owner', label: 'Decided by A–Z' },
]
const t = (v?: string | null) => (v ? new Date(v).getTime() : 0)
const str = (a?: string | null, b?: string | null) => {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}
function sortRows(rows: PSRowData[], k: SortKey) {
  const r = [...rows]
  r.sort((a, b) => {
    switch (k) {
      case 'date_desc': return t(b.rejectedAt) - t(a.rejectedAt)
      case 'date_asc': return t(a.rejectedAt) - t(b.rejectedAt)
      case 'name_asc': return a.name.localeCompare(b.name)
      case 'name_desc': return b.name.localeCompare(a.name)
      case 'score_desc': return (b.score ?? -1) - (a.score ?? -1)
      case 'score_asc': return (a.score ?? 999) - (b.score ?? 999)
      case 'reason': return str(a.status?.label, b.status?.label)
      case 'owner': return str(a.ownerName, b.ownerName)
    }
  })
  return r
}

/**
 * The screen for the four flat sections — toolbar (no Board/List toggle),
 * one generic table, one shared selection bar. Sections differ by config only.
 */
export function PipelineFlatSection({
  jobId,
  section,
  candidates,
  associations,
  stageMap,
  isLoading,
  filters,
  onFiltersChange,
  search,
  onSearchChange,
  selectedIds,
  onSelectedIdsChange,
  handlers,
}: {
  jobId: string
  section: PSSection
  candidates: any[]
  associations: any[]
  stageMap: Record<string, { type: string; name: string }>
  isLoading?: boolean
  filters: PipelineFilter[]
  onFiltersChange: (next: PipelineFilter[]) => void
  search: string
  onSearchChange: (v: string) => void
  selectedIds: string[]
  onSelectedIdsChange: (next: string[]) => void
  handlers: PSHandlers
}) {
  const baseRows = usePipelineSectionRows({ jobId, section, candidates, associations, stageMap })
  const [sortKey, setSortKey] = React.useState<SortKey>('date_desc')
  const sortable = section === 'rejected'
  const rows = React.useMemo(() => (sortable ? sortRows(baseRows, sortKey) : baseRows), [baseRows, sortKey, sortable])
  const cfg = React.useMemo(() => getSectionConfig(section, handlers), [section, handlers])

  // Changing section drops the selection — the set is no longer what you saw.
  React.useEffect(() => {
    onSelectedIdsChange([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  const PrimaryIcon = cfg.primary?.icon

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <PipelineToolbar
          filters={filters}
          onFiltersChange={onFiltersChange}
          search={search}
          onSearchChange={onSearchChange}
          showViewToggle={false}
          sort={
            sortable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" icon={ArrowUpDown} dropdown>
                    Sort: {SORTS.find((x) => x.key === sortKey)?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8} className="w-[200px]">
                  {SORTS.map((o) => (
                    <DropdownMenuItem key={o.key} onSelect={() => setSortKey(o.key)}>
                      <span className="flex-1">{o.label}</span>
                      {o.key === sortKey && <Check className="h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined
          }
          primary={
            cfg.primary ? (
              <button
                type="button"
                onClick={cfg.primary.onClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 28,
                  padding: '0 11px',
                  borderRadius: 8,
                  background: '#0d0d09',
                  color: '#fffcf9',
                  border: '1px solid transparent',
                  fontFamily: "'Poppins', system-ui, sans-serif",
                  fontWeight: 500,
                  fontSize: 12,
                  letterSpacing: '-0.005em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {PrimaryIcon ? <PrimaryIcon size={14} /> : null}
                {cfg.primary.label}
              </button>
            ) : undefined
          }
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '12px 28px 24px' }}>
        <PipelineSectionTable
          grid={cfg.grid}
          columns={cfg.columns}
          rows={rows}
          actions={cfg.actions}
          empty={cfg.empty}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectedIdsChange={onSelectedIdsChange}
          onOpenRow={(row) => handlers.onOpenRow?.(row)}
        />
      </div>

      <SelectionBar
        count={selectedIds.length}
        actions={cfg.bulk.actions}
        onClear={() => onSelectedIdsChange([])}
        totalCount={rows.length}
        onSelectAll={() => onSelectedIdsChange(rows.map((r) => r.id))}
      />
    </div>
  )
}
