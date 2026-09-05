import * as React from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
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

export interface PSEmptyConfig {
  illustration: React.ReactNode
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
  selectedIds: string[]
  onSelectedIdsChange: (next: string[]) => void
  onOpenRow: (row: PSRowData) => void
}) {
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(r.id))

  const toggle = (id: string) => {
    onSelectedIdsChange(
      selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    )
  }

  return (
    <div
      style={{
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
        {isLoading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{ height: 36, borderRadius: 8, background: PS_ROWLINE, opacity: 0.7 }}
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '40px 28px 44px' }}>
            <EmptyState
              size="card"
              illustration={empty.illustration}
              title={empty.title}
              body={empty.body}
              primary={
                empty.action ? (
                  <EmptyAction icon={empty.action.icon} onClick={empty.action.onClick}>
                    {empty.action.label}
                  </EmptyAction>
                ) : undefined
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
