import * as React from 'react'
import { PipelineToolbar } from '@/components/jobs/PipelineToolbar'
import type { PipelineFilter } from '@/components/jobs/pipelineFilters'
import { SelectionBar } from '@/components/shared/SelectionBar'
import { PipelineSectionTable } from './PipelineSectionTable'
import { getSectionConfig, type PSHandlers, type PSSection } from './pipelineSectionConfigs'
import { usePipelineSectionRows } from './usePipelineSectionRows'

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
  const rows = usePipelineSectionRows({ jobId, section, candidates, associations, stageMap })
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
