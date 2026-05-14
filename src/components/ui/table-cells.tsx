import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTableDensity } from "@/components/ui/table"
import { OverflowMore } from "@/components/ui/overflow-more"

/**
 * Tables — Column type primitives (Gio Foundation v1.0 §4)
 *
 * Six and only six cell shapes. Compose tables from these — don't invent a seventh.
 * Drop these inside <TableCell>, e.g.:
 *
 *   <TableCell><IdentityCell name="Lena Park" sub="Senior Designer · Linear" /></TableCell>
 *   <TableCell align="right"><NumericCell>92</NumericCell></TableCell>
 */

// 1) Identity ───────────────────────────────────────────────────────────────
const AVATAR_SIZE: Record<"compact" | "default" | "comfortable", string> = {
  compact: "h-[22px] w-[22px] text-[10px]",
  default: "h-8 w-8 text-[11px]",
  comfortable: "h-9 w-9 text-[12px]",
}

interface IdentityCellProps {
  name: React.ReactNode
  sub?: React.ReactNode
  src?: string | null
  fallback?: string
  className?: string
  /** Render without the leading avatar (used for object/job tables that don't have a face). */
  hideAvatar?: boolean
}

export function IdentityCell({ name, sub, src, fallback, className, hideAvatar }: IdentityCellProps) {
  const { density } = useTableDensity()
  const initials = (fallback ?? (typeof name === "string" ? name : ""))
    .toString()
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      {!hideAvatar && (
        <Avatar className={cn("shrink-0", AVATAR_SIZE[density])}>
          {src ? <AvatarImage src={src} alt="" /> : null}
          <AvatarFallback className="text-[11px] font-medium">{initials || "—"}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 leading-tight">
        <div className="text-table-name text-text-primary truncate">{name}</div>
        {sub ? (
          <div className="text-table-sub text-text-tertiary truncate">{sub}</div>
        ) : null}
      </div>
    </div>
  )
}

// 2) Status ─────────────────────────────────────────────────────────────────
/**
 * Wraps a single Badge. Spec: "One badge per cell — never stack."
 * Pass a single <Badge size="sm" tone="..." /> as the child.
 */
export function StatusCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center", className)}>{children}</div>
}

// 3) Numeric ────────────────────────────────────────────────────────────────
/** Right-aligned, Poppins, tabular-nums, weight 500. Wrap the parent <TableCell> with `text-right` too. */
export function NumericCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-poppins text-table-num tabular-nums text-right", className)}>
      {children}
    </span>
  )
}

// 4) Mono / ID ──────────────────────────────────────────────────────────────
export function MonoCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-table-mono text-text-primary", className)}>
      {children}
    </span>
  )
}

// 5) Composed (avatar stack / chip cluster) ─────────────────────────────────
interface AvatarStackPerson {
  name?: string
  src?: string | null
  fallback?: string
}

export function AvatarStack({ people, max = 4, size = 24, className }: {
  people: AvatarStackPerson[]
  max?: number
  size?: number
  className?: string
}) {
  const visible = people.slice(0, max)
  const overflow = Math.max(0, people.length - visible.length)
  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((p, i) => {
        const initials = (p.fallback ?? p.name ?? "")
          .toString()
          .split(/\s+/)
          .map(s => s[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase()
        return (
          <Avatar
            key={i}
            className="ring-2 ring-white shrink-0"
            style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -8 }}
          >
            {p.src ? <AvatarImage src={p.src} alt="" /> : null}
            <AvatarFallback className="text-[10px] font-medium">{initials || "—"}</AvatarFallback>
          </Avatar>
        )
      })}
      {overflow > 0 ? (
        <div
          className="ring-2 ring-white shrink-0 rounded-full bg-[hsl(var(--tbl-row-hover))] text-text-tertiary text-[10px] font-medium flex items-center justify-center"
          style={{ width: size, height: size, marginLeft: -8 }}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  )
}

export function ComposedCell({
  children,
  overflowCount,
  className,
}: {
  children: React.ReactNode
  /** When the cluster is badges/chips, render `+N more` chip via OverflowMore. */
  overflowCount?: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {children}
      {overflowCount && overflowCount > 0 ? (
        <OverflowMore count={overflowCount} />
      ) : null}
    </div>
  )
}

// 6) Action / overflow ──────────────────────────────────────────────────────
/**
 * Right-most column. Single overflow ⋯ menu OR icon-only buttons.
 * Visible only on row hover (relies on the parent <TableRow>'s `group` class).
 *
 * Width: 32px column. Always set the surrounding <TableHead className="w-[32px]" />
 * and <TableCell className="w-[32px] text-right" />.
 */
export function ActionCell({ children, alwaysVisible, className }: {
  children: React.ReactNode
  /** Force visible regardless of row hover (e.g. selected rows). */
  alwaysVisible?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1 transition-opacity duration-100",
        alwaysVisible
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        className
      )}
    >
      {children}
    </div>
  )
}
