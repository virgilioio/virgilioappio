import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Tables — Footer / Pagination (Gio Foundation v1.0 §4)
 *
 * Two patterns, mutually exclusive (spec: "Never both").
 *
 * - <TableFooterSummary />  ★ default. Range + Load more. Use for
 *   candidate/people/job tables that filter or virtual-scroll.
 * - <TablePagination />     for invoice tables, audit logs — anywhere the
 *   user benefits from jumping to a page.
 */

export function TableFooterSummary({
  rangeStart,
  rangeEnd,
  total,
  entityLabel = "items",
  onLoadMore,
  loadMoreLabel,
  className,
}: {
  rangeStart: number
  rangeEnd: number
  total: number
  entityLabel?: string
  onLoadMore?: () => void
  loadMoreLabel?: string
  className?: string
}) {
  const hasMore = rangeEnd < total
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2.5 text-[12px] text-text-tertiary",
        className
      )}
    >
      <div>
        Showing{" "}
        <span className="font-medium text-text-primary tabular-nums">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of{" "}
        <span className="font-medium text-text-primary tabular-nums">{total}</span>{" "}
        {entityLabel}
      </div>
      {hasMore && onLoadMore ? (
        <Button variant="ghost" size="sm" onClick={onLoadMore}>
          {loadMoreLabel ?? `Load ${Math.min(25, total - rangeEnd)} more`}
        </Button>
      ) : null}
    </div>
  )
}

// Numbered pagination ───────────────────────────────────────────────────────
function buildPageList(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  if (start > 2) pages.push("…")
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < totalPages - 1) pages.push("…")
  pages.push(totalPages)
  return pages
}

export function TablePagination({
  page,
  totalPages,
  perPage,
  perPageOptions = [10, 25, 50, 100],
  onPageChange,
  onPerPageChange,
  className,
}: {
  page: number
  totalPages: number
  perPage: number
  perPageOptions?: number[]
  onPageChange: (p: number) => void
  onPerPageChange?: (n: number) => void
  className?: string
}) {
  const pages = buildPageList(page, totalPages)
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2.5 text-[12px] text-text-tertiary",
        className
      )}
    >
      {onPerPageChange ? (
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <Select
            value={String(perPage)}
            onValueChange={v => onPerPageChange(Number(v))}
          >
            <SelectTrigger className="h-7 w-[68px] text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {perPageOptions.map(n => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Previous page"
          icon={ChevronLeft}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        />
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="px-2 text-text-tertiary">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "h-7 min-w-[28px] px-2 rounded-md text-[12px] font-medium tabular-nums transition-colors",
                p === page
                  ? "bg-[hsl(var(--tbl-row-selected))] text-[hsl(var(--virgilio-purple))]"
                  : "text-text-secondary hover:bg-[hsl(var(--tbl-row-hover))]"
              )}
            >
              {p}
            </button>
          )
        )}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Next page"
          icon={ChevronRight}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        />
      </div>
    </div>
  )
}
