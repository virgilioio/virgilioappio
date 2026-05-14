import * as React from "react"
import { Search, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RemovableChip } from "@/components/ui/removable-chip"

/**
 * Tables — Toolbar (Gio Foundation v1.0 §4)
 *
 * Canonical layout above every table:
 *
 *   ┌─ Search ─┬─ Segmented status ─┬─ Filter pills + "+ Filter" ──── Right: Columns · Density · Export · Primary ┐
 *
 * Use as:
 *
 *   <TableToolbar
 *     left={
 *       <>
 *         <TableSearch placeholder="Search members…" value={q} onChange={setQ} />
 *         <TableSegmented value={status} onChange={setStatus} options={[
 *           { value: "active", label: "Active", count: 5 },
 *           { value: "invited", label: "Invited", count: 1 },
 *         ]} />
 *         <TableFilterPills filters={[{ id: "role", label: "Role: Admin" }]} onRemove={...} />
 *         <TableAddFilterButton onClick={...} />
 *       </>
 *     }
 *     right={<Button variant="primary" size="sm">Invite</Button>}
 *   />
 *
 * When rows are bulk-selected, swap to <TableBulkBar /> instead.
 */

export function TableToolbar({
  left,
  right,
  className,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-1 py-2 flex-wrap",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-wrap min-w-0">{left}</div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  )
}

// Search ───────────────────────────────────────────────────────────────────
export function TableSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[30px] pl-8 pr-2 max-w-[280px] text-[13px]"
      />
    </div>
  )
}

// Segmented status ─────────────────────────────────────────────────────────
export interface TableSegmentedOption<T extends string = string> {
  value: T
  label: string
  count?: number
  icon?: React.ComponentType<{ className?: string }>
}

export function TableSegmented<T extends string = string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: TableSegmentedOption<T>[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "inline-flex h-[30px] items-center gap-0.5 rounded-lg border border-[hsl(var(--tbl-border-color))] bg-[hsl(var(--tbl-row-hover))] p-0.5",
        className
      )}
    >
      {options.map(opt => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-[26px] px-2.5 rounded-md text-[12px] font-medium font-poppins transition-colors flex items-center gap-1.5",
              active
                ? "bg-white text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                : "text-text-tertiary hover:text-text-primary"
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{opt.label}</span>
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "tabular-nums text-[11px]",
                  active ? "text-text-tertiary" : "text-text-tertiary/70"
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// Filter pills + add filter trigger ────────────────────────────────────────
export interface TableActiveFilter {
  id: string
  label: React.ReactNode
}

export function TableFilterPills({
  filters,
  onRemove,
  className,
}: {
  filters: TableActiveFilter[]
  onRemove: (id: string) => void
  className?: string
}) {
  if (!filters.length) return null
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {filters.map(f => (
        <RemovableChip key={f.id} onRemove={() => onRemove(f.id)}>
          {f.label}
        </RemovableChip>
      ))}
    </div>
  )
}

export function TableAddFilterButton({
  onClick,
  label = "Filter",
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <Button variant="ghost" size="sm" icon={Plus} onClick={onClick}>
      {label}
    </Button>
  )
}

// Bulk-select morph ────────────────────────────────────────────────────────
export function TableBulkBar({
  count,
  entityLabel = "items",
  onClear,
  children,
  className,
}: {
  count: number
  entityLabel?: string
  onClear: () => void
  /** Bulk action buttons (size="sm"). Reject = variant="danger". */
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[hsl(var(--virgilio-purple))]/30 bg-[hsl(var(--tbl-row-selected))]",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[13px] font-medium text-text-primary tabular-nums">
          {count} {entityLabel} selected
        </span>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[12px] text-text-tertiary hover:text-text-primary transition-colors"
        >
          <X className="h-3 w-3" />
          Clear selection
        </button>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  )
}
