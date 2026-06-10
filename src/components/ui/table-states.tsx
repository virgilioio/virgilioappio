import * as React from "react"
import { cn } from "@/lib/utils"
import { TableCell, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"

/**
 * Tables — Row state primitives (Gio Foundation v1.0 §4)
 *
 * Loading skeleton is unique to tables. Empty / FilteredEmpty are thin
 * wrappers around the canonical <EmptyState variant="table-row"> primitive.
 */

// Loading ───────────────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={`sk-${r}`} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <div
                className="h-3 rounded-[4px] bg-[hsl(var(--tbl-divider-color))] animate-pulse"
                style={{ width: c === 0 ? "60%" : c === columns - 1 ? "30%" : "45%" }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// Empty (no data, user got here on purpose) ─────────────────────────────────
export function TableEmpty({
  colSpan,
  title,
  description,
  ctaLabel,
  onCta,
  className,
}: {
  colSpan: number
  title: React.ReactNode
  description?: React.ReactNode
  ctaLabel?: string
  onCta?: () => void
  className?: string
}) {
  return (
    <EmptyState
      variant="table-row"
      colSpan={colSpan}
      title={title}
      description={description}
      mascot={false}
      action={ctaLabel && onCta ? { label: ctaLabel, onClick: onCta, variant: 'purple' } : undefined}
      className={cn(className)}
    />
  )
}

// Filtered empty (data exists, no rows match) ───────────────────────────────
export function TableFilteredEmpty({
  colSpan,
  query,
  activeFilters: _activeFilters,
  onClearFilters,
  className,
}: {
  colSpan: number
  query?: string
  activeFilters?: React.ReactNode
  onClearFilters: () => void
  className?: string
}) {
  return (
    <EmptyState.Filtered
      colSpan={colSpan}
      query={query}
      onClearFilters={onClearFilters}
      className={className}
    />
  )
}
