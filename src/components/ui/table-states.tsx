import * as React from "react"
import { cn } from "@/lib/utils"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

/**
 * Tables — Row state primitives (Gio Foundation v1.0 §4)
 *
 * Drop these into <TableBody>:
 *
 *   {loading ? <TableSkeleton rows={5} columns={5} /> :
 *    items.length === 0 ? <TableEmpty colSpan={5} title="No members yet"
 *      description="Invite your team to collaborate." ctaLabel="Invite members" onCta={...} /> :
 *    items.map(...)}
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
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className={cn("py-12 text-center", className)}>
        <div className="mx-auto max-w-sm space-y-1.5">
          <div className="text-table-name text-text-primary">{title}</div>
          {description ? (
            <div className="text-body-sm text-text-tertiary">{description}</div>
          ) : null}
          {ctaLabel && onCta ? (
            <div className="pt-3">
              <Button variant="purple" size="sm" onClick={onCta}>
                {ctaLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

// Filtered empty (data exists, no rows match) ───────────────────────────────
export function TableFilteredEmpty({
  colSpan,
  query,
  activeFilters,
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
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className={cn("py-12 text-center", className)}>
        <div className="mx-auto max-w-sm space-y-1.5">
          <div className="text-table-name text-text-primary">No matches</div>
          <div className="text-body-sm text-text-tertiary">
            No items match{" "}
            {query ? <span className="font-medium text-text-primary">"{query}"</span> : "the current filters"}
            {activeFilters ? <> with {activeFilters}</> : null}.
          </div>
          <div className="pt-3">
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              Clear all filters
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}
