import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tables — Gio Foundation v1.0 §4
 *
 * Density usage:
 * - "compact" (40h): Pipeline overview, audit logs, integration sub-rows, or
 *   any screen with >50 rows.
 * - "default" (52h, ★): Members, Candidates, Jobs, Invoices, SaaS customers.
 *   Use this unless you have a specific reason not to.
 * - "comfortable" (64h): Marketing-style listings inside embeds (e.g. public
 *   careers page job list). Almost never inside the working app.
 */
export type TableDensity = "compact" | "default" | "comfortable"

type TableContextValue = {
  density: TableDensity
  zebra: boolean
}

const TableContext = React.createContext<TableContextValue>({
  density: "default",
  zebra: false,
})

export const useTableDensity = () => React.useContext(TableContext)

const ROW_H: Record<TableDensity, string> = {
  compact: "h-[var(--tbl-row-h-compact)]",
  default: "h-[var(--tbl-row-h-default)]",
  comfortable: "h-[var(--tbl-row-h-comfy)]",
}

const HEADER_H: Record<TableDensity, string> = {
  compact: "h-[var(--tbl-header-h-compact)]",
  default: "h-[var(--tbl-header-h-default)]",
  comfortable: "h-[var(--tbl-header-h-comfy)]",
}

const CELL_TEXT: Record<TableDensity, string> = {
  compact: "text-table-cell-compact",
  default: "text-table-cell",
  comfortable: "text-table-cell",
}

const HEADER_TEXT: Record<TableDensity, string> = {
  compact: "text-table-header-compact",
  default: "text-table-header",
  comfortable: "text-table-header",
}

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  density?: TableDensity
  /** Off by default. When on, even rows tint to --tbl-row-hover. */
  zebra?: boolean
  /** Wrap the table in a 1px #E7E8EE border + 12px radius shell. Default true. */
  bordered?: boolean
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, density = "default", zebra = false, bordered = true, ...props }, ref) => (
    <TableContext.Provider value={{ density, zebra }}>
      <div
        className={cn(
          "relative w-full overflow-auto",
          bordered &&
            "rounded-[var(--tbl-border-radius)] border border-[hsl(var(--tbl-border-color))] bg-white"
        )}
      >
        <table
          ref={ref}
          className={cn("w-full caption-bottom font-inter", className)}
          {...props}
        />
      </div>
    </TableContext.Provider>
  )
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const { density } = useTableDensity()
  return (
    <thead
      ref={ref}
      className={cn(
        "sticky top-0 z-10 bg-[hsl(var(--tbl-row-hover))] border-b border-[hsl(var(--tbl-divider-color))]",
        `[&_tr]:${HEADER_H[density]}`,
        className
      )}
      {...props}
    />
  )
})
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const { zebra } = useTableDensity()
  return (
    <tbody
      ref={ref}
      className={cn(
        zebra && "[&_tr:nth-child(even)]:bg-[hsl(var(--tbl-row-hover))]",
        className
      )}
      {...props}
    />
  )
})
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-[hsl(var(--tbl-divider-color))] bg-[hsl(var(--tbl-row-hover))] font-medium",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Adds cursor-pointer. Hover/selected styling is always on. */
  interactive?: boolean
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, interactive = false, ...props }, ref) => {
    const { density } = useTableDensity()
    return (
      <tr
        ref={ref}
        className={cn(
          // Base: row height + flat hover/selected per spec.
          "group border-b border-[hsl(var(--tbl-divider-color))] last:border-b-0",
          ROW_H[density],
          // Hover = fill, NOT glow — no translate, no shadow.
          "transition-colors duration-100 hover:bg-[hsl(var(--tbl-row-hover))]",
          // Selected = #FAF8FF + 2px purple LEFT rail.
          "data-[state=selected]:bg-[hsl(var(--tbl-row-selected))]",
          "data-[state=selected]:shadow-[inset_2px_0_0_0_hsl(var(--virgilio-purple))]",
          // Disabled / error hooks.
          "data-[state=disabled]:opacity-40 data-[state=disabled]:pointer-events-none",
          "data-[state=error]:shadow-[inset_2px_0_0_0_hsl(var(--virgilio-error))]",
          interactive && "cursor-pointer",
          className
        )}
        {...props}
      />
    )
  }
)
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const { density } = useTableDensity()
  return (
    <th
      ref={ref}
      className={cn(
        // Eyebrow caps — never bold.
        "px-[var(--tbl-cell-px)] text-left align-middle uppercase font-inter font-medium text-text-tertiary whitespace-nowrap",
        HEADER_TEXT[density],
        "[&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const { density } = useTableDensity()
  return (
    <td
      ref={ref}
      className={cn(
        "px-[var(--tbl-cell-px)] align-middle font-inter text-text-primary",
        CELL_TEXT[density],
        "[&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
})
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-3 text-xs text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
