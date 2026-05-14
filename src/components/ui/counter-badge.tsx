import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * CounterBadge — notification indicator overlay for icons (bell, messages, …).
 * Spec: red dot if `count > 0` and `dotOnly`; numbered if `count > 1`; hard cap at `99+`.
 *
 * The parent must be `relative`; this component positions itself top-right.
 */
export interface CounterBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number
  /** Hide the number — render only a dot regardless of count. */
  dotOnly?: boolean
  /** Hard cap. Numbers above this render as `${max}+`. */
  max?: number
  /** Override default red. */
  tone?: "red" | "neutral"
}

export function CounterBadge({
  count,
  dotOnly = false,
  max = 99,
  tone = "red",
  className,
  ...props
}: CounterBadgeProps) {
  if (!count || count <= 0) return null

  const toneClass =
    tone === "red"
      ? "bg-destructive text-destructive-foreground"
      : "bg-muted text-muted-foreground"

  // Dot mode (or single unread, per spec: number when > 1).
  if (dotOnly || count === 1) {
    return (
      <span
        aria-label={`${count} unread`}
        className={cn(
          "absolute top-0 right-0 inline-block h-2 w-2 rounded-full ring-2 ring-background",
          toneClass,
          className
        )}
        {...props}
      />
    )
  }

  const label = count > max ? `${max}+` : String(count)

  return (
    <span
      aria-label={`${count} unread`}
      className={cn(
        "absolute top-0 right-0 inline-flex min-w-[16px] h-4 items-center justify-center rounded-full px-1 font-inter text-[10px] font-semibold leading-none ring-2 ring-background tabular-nums",
        toneClass,
        className
      )}
      {...props}
    >
      {label}
    </span>
  )
}
