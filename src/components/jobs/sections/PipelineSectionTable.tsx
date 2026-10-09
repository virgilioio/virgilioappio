import * as React from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyAction } from '@/components/ui/empty-state'
import { CandidatesEmpty } from '@/components/empty/CandidatesEmpty'
import { Skeleton } from '@/components/ui/skeleton'
import { RotateCcw, X as XIcon } from 'lucide-react'
import { PSCheck, PS_HAIRLINE, PS_ROWLINE, PS_SAND, PS_LILAC, PS_MUTED, PS_RED, PS_TERTIARY } from './psAtoms'
import type { PSRowData } from './pipelineSectionConfigs'

const inter = "'Inter', system-ui, sans-serif"

export interface PSColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  render: (row: PSRowData) => React.ReactNode
}

export interface PSRowAction {
  id: string
  label: string
  icon?: LucideIcon
  kind?: 'outlined' | 'bare' | 'danger'
  onClick?: (row: PSRowData) => void
  /** Items shown in the "More" menu (only for kind 'bare'). */
  items?: { id: string; label: string; destructive?: boolean; onClick?: (row: PSRowData) => void }[]
}

/** Each section's copy for CandidatesEmpty (the canonical candidate-list empty state). */
export interface PSEmptyConfig {
  title: string
  body: string
  action?: { label: string; icon?: React.ReactNode; onClick?: () => void }
}

const btnBase: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  background: '#fff',
}

function ActionButton({
  action,
  row,
}: {
  action: PSRowAction
  row: PSRowData
}) {
  const Icon = action.icon
  const style: React.CSSProperties =
    action.kind === 'bare'
      ? { ...btnBase, border: 'none', background: 'transparent', color: PS_TERTIARY }
      : action.kind === 'danger'
        ? { ...btnBase, border: `1px solid ${PS_HAIRLINE}`, color: PS_RED }
        : { ...btnBase, border: `1px solid ${PS_HAIRLINE}`, color: PS_MUTED }

  if (action.items?.length) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={action.label}
            aria-label={action.label}
            style={style}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={13} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          {action.items.map((it) => (
            <DropdownMenuItem
              key={it.id}
              onClick={(e) => {
                e.stopPropagation()
                it.onClick?.(row)
              }}
              className={it.destructive ? 'text-destructive focus:text-destructive' : undefined}
            >
              {it.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <button
      type="button"
      title={action.label}
      aria-label={action.label}
      style={style}
      onClick={(e) => {
        e.stopPropagation()
        action.onClick?.(row)
      }}
    >
      {Icon ? <Icon size={action.kind === 'bare' ? 13 : 12} /> : null}
    </button>
  )
}

function PSRow({
  row,
  grid,
  columns,
  actions,
  selected,
  anySelected,
  onToggle,
  onOpen,
}: {
  row: PSRowData
  grid: string
  columns: PSColumn[]
  actions: PSRowAction[]
  selected: boolean
  anySelected: boolean
  onToggle: (id: string) => void
  onOpen: (row: PSRowData) => void
}) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(row)}
      style={{
        display: 'grid',
        gridTemplateColumns: grid,
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        padding: '10px 16px',
        cursor: 'pointer',
        borderBottom: `1px solid ${PS_ROWLINE}`,
        background: selected ? PS_LILAC : hovered ? PS_SAND : '#fff',
      }}
    >
      <PSCheck
        checked={selected}
        visible={hovered || selected || anySelected}
        onChange={() => onToggle(row.id)}
      />
      {columns.map((c) => (
        <div key={c.key} style={{ minWidth: 0, textAlign: c.align === 'right' ? 'right' : 'left' }}>
          {c.render(row)}
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 4,
          opacity: hovered || selected ? 1 : 0,
          transition: 'opacity 120ms ease',
        }}
      >
        {actions.map((a) => (
          <ActionButton key={a.id} action={a} row={row} />
        ))}
      </div>
    </div>
  )
}

export function PipelineSectionTable({
  grid,
  columns,
  rows,
  actions,
  empty,
  isLoading,
  filtered = false,
  onClearFilters,
  loadError = null,
  onRetry,
  emptyKey,
  selectedIds,
  onSelectedIdsChange,
  onOpenRow,
}: {
  grid: string
  columns: PSColumn[]
  rows: PSRowData[]
  actions: PSRowAction[]
  empty: PSEmptyConfig
  isLoading?: boolean
  /** Rows exist but filters or a search hide them all (§16 filtered empty). */
  filtered?: boolean
  onClearFilters?: () => void
  /** First load failed or timed out: the inline error with Retry. */
  loadError?: 'failed' | 'timeout' | null
  onRetry?: () => void
  /** Plays the empty-state plane once per key per session. */
  emptyKey?: string
  selectedIds: string[]
  onSelectedIdsChange: (next: string[]) => void
  onOpenRow: (row: PSRowData) => void
}) {
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const tableRef = React.useRef<HTMLDivElement>(null)
  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(r.id))

  const toggle = (id: string) => {
    onSelectedIdsChange(
      selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    )
  }

  return (
    <div
      ref={tableRef}
      tabIndex={-1}
      style={{
        outline: 'none',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: `1px solid ${PS_HAIRLINE}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header row — same grid string as the rows, so the columns align exactly. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: grid,
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: PS_SAND,
          borderBottom: `1px solid ${PS_HAIRLINE}`,
          flexShrink: 0,
        }}
      >
        <PSCheck
          checked={allSelected}
          visible
          onChange={() =>
            onSelectedIdsChange(allSelected ? [] : rows.map((r) => r.id))
          }
        />
        {columns.map((c) => (
          <div
            key={c.key}
            style={{
              fontFamily: inter,
              fontWeight: 600,
              fontSize: 10.5,
              letterSpacing: '0.055em',
              textTransform: 'uppercase',
              color: PS_TERTIARY,
              textAlign: c.align === 'right' ? 'right' : 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {c.label}
          </div>
        ))}
        <div />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {isLoading && !loadError ? (
          // §16: first load only; same row height as the real rows.
          <div role="status" aria-busy="true" aria-label="Loading candidates">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 16px', borderBottom: `1px solid ${PS_ROWLINE}` }}
              >
                <Skeleton className="rounded-[4px]" style={{ width: 14, height: 14 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton className="rounded-[4px]" style={{ width: '34%', height: 10 }} />
                  <Skeleton className="rounded-[4px]" style={{ width: '22%', height: 8 }} />
                </div>
                <Skeleton className="rounded-full" style={{ width: 72, height: 18 }} />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Poppins', system-ui, sans-serif", fontWeight: 600, fontSize: 18, letterSpacing: '-0.025em', color: '#0d0d09' }}>
              {loadError === 'timeout' ? 'These candidates are taking too long to load' : "Couldn't load these candidates"}
            </div>
            <p style={{ margin: '8px auto 0', maxWidth: 340, fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, lineHeight: 1.55, color: '#5A6072' }}>
              {loadError === 'timeout'
                ? "They didn't arrive within 15 seconds. Try again in a moment."
                : 'Check your connection, then try again.'}
            </p>
            {onRetry && (
              <div style={{ marginTop: 20 }}>
                <EmptyAction variant="secondary" icon={<RotateCcw size={16} />} onClick={onRetry}>
                  Retry
                </EmptyAction>
              </div>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '56px 24px' }}>
            <CandidatesEmpty
              filtered={filtered}
              onceKey={emptyKey}
              title={filtered ? 'No candidates match these filters' : empty.title}
              body={filtered ? 'Clear filters to see everyone in this list.' : empty.body}
              primary={
                filtered
                  ? onClearFilters
                    ? {
                        label: 'Clear filters',
                        icon: <XIcon size={16} />,
                        onClick: () => {
                          onClearFilters()
                          // The button goes away with the empty state; keep focus in the table.
                          requestAnimationFrame(() => tableRef.current?.focus({ preventScroll: true }))
                        },
                      }
                    : undefined
                  : empty.action
                    ? { label: empty.action.label, icon: empty.action.icon, onClick: empty.action.onClick }
                    : undefined
              }
            />
          </div>
        ) : (
          rows.map((row) => (
            <PSRow
              key={row.id}
              row={row}
              grid={grid}
              columns={columns}
              actions={actions}
              selected={selectedSet.has(row.id)}
              anySelected={selectedIds.length > 0}
              onToggle={toggle}
              onOpen={onOpenRow}
            />
          ))
        )}
      </div>
    </div>
  )
}
