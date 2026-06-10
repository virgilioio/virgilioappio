import * as React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { EmptyState, EmptyAction } from "@/components/ui/empty-state"
import { SoftPlane, SoftMagnifier } from "@/components/ui/EmptyIllustrations"
import { Plus, RotateCcw } from "lucide-react"

/**
 * Tables — Row state primitives (Gio Foundation v1.0 §4)
 * TableEmpty / TableFilteredEmpty render the canonical EmptyState (card size)
 * inside a single full-width TableRow.
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

// True empty (no data) — generic; pass illustration for surface-specific scene
export function TableEmpty({
  colSpan,
  title,
  description,
  ctaLabel,
  onCta,
  illustration,
}: {
  colSpan: number
  title: React.ReactNode
  description?: React.ReactNode
  ctaLabel?: string
  onCta?: () => void
  className?: string
  illustration?: React.ReactNode
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 border-0">
        <div className="p-4">
          <EmptyState
            size="card"
            illustration={illustration ?? <SoftPlane />}
            title={title}
            body={description}
            primary={
              ctaLabel && onCta ? (
                <EmptyAction icon={<Plus size={16} strokeWidth={2} />} onClick={onCta}>
                  {ctaLabel}
                </EmptyAction>
              ) : undefined
            }
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

// Filtered empty (data exists, no rows match) ───────────────────────────────
export function TableFilteredEmpty({
  colSpan,
  query,
  onClearFilters,
}: {
  colSpan: number
  query?: string
  activeFilters?: React.ReactNode
  onClearFilters: () => void
  className?: string
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 border-0">
        <div className="p-4">
          <EmptyState
            size="card"
            illustration={<SoftMagnifier />}
            title="No matches"
            body={
              query
                ? `Nothing fits "${query}" — adjust or clear your filters to widen the results.`
                : 'No items match the current filters. Clear them to see everything again.'
            }
            primary={
              <EmptyAction
                icon={<RotateCcw size={16} strokeWidth={2} />}
                onClick={onClearFilters}
              >
                Clear filters
              </EmptyAction>
            }
          />
        </div>
      </TableCell>
    </TableRow>
  )
}
