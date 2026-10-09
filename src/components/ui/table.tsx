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

const HEADER_TR_H: Record<TableDensity, string> = {
  compact: "[&_tr]:h-[var(--tbl-header-h-compact)]",
  default: "[&_tr]:h-[var(--tbl-header-h-default)]",
  comfortable: "[&_tr]:h-[var(--tbl-header-h-comfy)]",
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

/** Nearest ancestor that scrolls vertically, or null when the page itself scrolls. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node && node !== document.body; node = node.parentElement) {
    const y = getComputedStyle(node).overflowY
    if (y === "auto" || y === "scroll" || y === "overlay") return node
  }
  return null
}

/**
 * Sticky headers need the wrapper not to be a scroll container. It clips by default
 * (keeping the rounded corners) and only becomes a horizontal scroller when the table
 * is actually wider than it. `data-sticky` says what the header sticks to: the page
 * (below the fixed top bar, `--tbl-page-top`) or the nearest scrolling box.
 */
function useStickyWrapper(tableRef: React.RefObject<HTMLTableElement>) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const table = tableRef.current
    if (!wrapper || !table) return
    const update = () => {
      const wide = table.scrollWidth > wrapper.clientWidth + 1
      wrapper.style.overflowX = wide ? "auto" : "clip"
      wrapper.style.overflowY = wide ? "hidden" : "visible"
      wrapper.dataset.sticky = !wide && !scrollParent(wrapper) ? "page" : "local"
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(wrapper)
    ro.observe(table)

    // §3 Sticky header: a soft shadow only while rows are scrolled under it.
    const scroller = scrollParent(wrapper)
    const target: HTMLElement | Window = scroller ?? window
    const onScroll = () => {
      const head = table.tHead
      if (!head) return
      const stuck = wrapper.getBoundingClientRect().top + wrapper.clientTop < head.getBoundingClientRect().top - 0.5
      if (stuck) wrapper.setAttribute("data-scrolled", "")
      else wrapper.removeAttribute("data-scrolled")
    }
    onScroll()
    target.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      ro.disconnect()
      target.removeEventListener("scroll", onScroll)
    }
  }, [tableRef])
  return wrapperRef
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, density = "default", zebra = false, bordered = true, ...props }, ref) => {
    const tableRef = React.useRef<HTMLTableElement>(null)
    React.useImperativeHandle(ref, () => tableRef.current as HTMLTableElement)
    const wrapperRef = useStickyWrapper(tableRef)
    return (
      <TableContext.Provider value={{ density, zebra }}>
        <div
          ref={wrapperRef}
          data-sticky="local"
          className={cn(
            "group/table relative w-full [overflow-x:clip]",
            bordered &&
              "rounded-[var(--tbl-border-radius)] border border-[hsl(var(--tbl-border-color))] bg-white"
          )}
        >
          <table
            ref={tableRef}
            className={cn("w-full caption-bottom font-inter", className)}
            {...props}
          />
        </div>
      </TableContext.Provider>
    )
  }
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
        "sticky top-0 group-data-[sticky=page]/table:top-[var(--tbl-page-top,0px)] z-10 bg-[hsl(var(--tbl-row-hover))] border-b border-[hsl(var(--tbl-divider-color))]",
        HEADER_TR_H[density],
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
          // §3 Row hover is instant and mouse-only.
          "hover:bg-[hsl(var(--tbl-row-hover))]",
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
        // §3 Numbers line up in every column (digits only; letters are unaffected).
        "px-[var(--tbl-cell-px)] align-middle font-inter text-text-primary tabular-nums",
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
