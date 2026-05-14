import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Gio Foundation v1.0 — Badges & tags.
 * See docs/style-guide.md for the full spec.
 *
 * Compositional API: tone × size × shape + modifiers (dot, bordered, pulse, icon, count, onRemove).
 * Default text: 11px Inter 500. Default size: sm (22px). Default shape: pill.
 *
 * The 40+ legacy semantic `variant="..."` props are kept as deprecated aliases that resolve
 * internally to a tone + dot + label, so no consumer breaks during the rollout.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tone classes (bg + fg). 8 tones reuse existing pastel/muted/destructive palette;
// `lilac` and `ink` are new tokens added in Phase A1.
// ─────────────────────────────────────────────────────────────────────────────
export const BADGE_TONES = {
  green: "bg-pastel-green text-pastel-green-foreground",
  red: "bg-destructive/10 text-destructive",
  pink: "bg-pastel-pink text-pastel-pink-foreground",
  yellow: "bg-pastel-yellow text-pastel-yellow-foreground",
  orange: "bg-pastel-orange text-pastel-orange-foreground",
  blue: "bg-pastel-blue text-pastel-blue-foreground",
  purple: "bg-pastel-purple text-pastel-purple-foreground",
  lilac: "bg-badge-lilac text-badge-lilac-foreground",
  neutral: "bg-muted text-muted-foreground",
  ink: "bg-badge-ink text-badge-ink-foreground",
} as const

export type BadgeTone = keyof typeof BADGE_TONES

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-inter font-medium leading-none whitespace-nowrap select-none transition-colors duration-150",
  {
    variants: {
      tone: BADGE_TONES,
      size: {
        xs: "h-badge-xs px-[7px] text-[10px]",
        sm: "h-badge-sm px-[9px] text-[11px]", // default
        md: "h-badge-md px-[11px] text-[12px]",
        lg: "h-badge-lg px-[14px] text-[12.5px]",
      },
      shape: {
        pill: "rounded-full",
        square: "rounded-md",
      },
      bordered: {
        true: "border border-current/20",
        false: "",
      },
      // ─── Legacy `variant="..."` aliases (deprecated). Each resolves to a tone+dot
      // combination matching the prior visual. New code should use `tone` + `dot`.
      variant: {
        default: "",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive",
        success: "bg-pastel-green text-pastel-green-foreground",
        warning: "bg-pastel-yellow text-pastel-yellow-foreground",
        info: "bg-pastel-blue text-pastel-blue-foreground",
        outline: "bg-transparent text-foreground border border-virgilio-border",
        "pastel-blue": "bg-pastel-blue text-pastel-blue-foreground",
        "pastel-purple": "bg-pastel-purple text-pastel-purple-foreground",
        "pastel-green": "bg-pastel-green text-pastel-green-foreground",
        "pastel-pink": "bg-pastel-pink text-pastel-pink-foreground",
        "pastel-yellow": "bg-pastel-yellow text-pastel-yellow-foreground",
        "pastel-orange": "bg-pastel-orange text-pastel-orange-foreground",
        purple: "bg-pastel-purple text-pastel-purple-foreground",
        "role-recruiter": "bg-pastel-purple text-pastel-purple-foreground",
        "role-admin": "bg-pastel-blue text-pastel-blue-foreground",
        "role-owner": "bg-badge-ink text-badge-ink-foreground",
        "role-hiring-manager": "bg-pastel-orange text-pastel-orange-foreground",
        "role-interviewer": "bg-muted text-muted-foreground",
        "seat-paid": "bg-pastel-purple text-pastel-purple-foreground",
        "seat-free": "bg-pastel-green text-pastel-green-foreground",
        "status-active": "bg-pastel-green text-pastel-green-foreground",
        "status-invited": "bg-pastel-yellow text-pastel-yellow-foreground",
        "status-inactive": "bg-muted text-muted-foreground",
        "job-open": "bg-pastel-green text-pastel-green-foreground",
        "job-draft": "bg-muted text-muted-foreground",
        "job-closed": "bg-destructive/10 text-destructive",
        "job-archived": "bg-muted text-muted-foreground",
        "pipeline-hired": "bg-pastel-green text-pastel-green-foreground",
        "pipeline-offer": "bg-pastel-orange text-pastel-orange-foreground",
        "pipeline-rejected": "bg-destructive/10 text-destructive",
        "booking-confirmed": "bg-pastel-green text-pastel-green-foreground",
        "booking-rescheduled": "bg-pastel-yellow text-pastel-yellow-foreground",
        "booking-cancelled": "bg-destructive/10 text-destructive",
        "booking-completed": "bg-muted text-muted-foreground",
        "booking-no-show": "bg-pastel-orange text-pastel-orange-foreground",
        "integration-connected": "bg-pastel-green text-pastel-green-foreground",
        "integration-disconnected": "bg-muted text-muted-foreground",
        "integration-error": "bg-destructive/10 text-destructive",
        "integration-expired": "bg-pastel-yellow text-pastel-yellow-foreground",
        "source-inherited": "bg-muted text-muted-foreground",
        "source-custom": "bg-pastel-purple text-pastel-purple-foreground",
        required: "bg-destructive/10 text-destructive",
        optional: "bg-muted text-muted-foreground",
        category: "bg-muted text-muted-foreground",
        "match-excellent": "bg-pastel-green text-pastel-green-foreground",
        "match-good": "bg-pastel-blue text-pastel-blue-foreground",
        "match-fair": "bg-muted text-muted-foreground",
        collected: "bg-pastel-green text-pastel-green-foreground",
        "keyword-match": "bg-badge-lilac text-badge-lilac-foreground",
        "activity-scorecard": "bg-pastel-blue text-pastel-blue-foreground",
        "activity-decision": "bg-pastel-purple text-pastel-purple-foreground",
        "activity-email": "bg-pastel-blue text-pastel-blue-foreground",
        "activity-offer": "bg-pastel-orange text-pastel-orange-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "sm",
      shape: "pill",
      bordered: false,
      variant: "default",
    },
  }
)

type BadgeBaseProps = Omit<
  VariantProps<typeof badgeVariants>,
  "tone" | "variant"
> & {
  tone?: BadgeTone
  /** @deprecated Use `tone` + optional `dot` instead. Kept for backward compat. */
  variant?: VariantProps<typeof badgeVariants>["variant"]
}

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    BadgeBaseProps {
  /** Show a leading 7px tone-colored dot. Use for status badges. */
  dot?: boolean
  /** Animate a soft halo around the dot — for live-signal badges only. */
  pulse?: boolean
  /** Leading icon (Sparkles, Flame, Lock, …). Renders an icon-prefix badge. */
  icon?: LucideIcon
  /** Trailing inline count chip (`12`, `+4 new`). */
  count?: number | string
  /** Adds a × that calls this handler — turns the badge into a removable chip. */
  onRemove?: () => void
  /** @deprecated visual hover affordance. Prefer wrapping in a button if interactive. */
  interactive?: boolean
}

const dotSizeForBadge: Record<NonNullable<BadgeProps["size"]>, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-[7px] w-[7px]",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
}

const iconSizeForBadge: Record<NonNullable<BadgeProps["size"]>, string> = {
  xs: "h-2.5 w-2.5",
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
}

function Badge({
  className,
  tone,
  variant,
  size = "sm",
  shape = "pill",
  bordered,
  dot,
  pulse,
  icon: Icon,
  count,
  onRemove,
  interactive = false,
  children,
  ...props
}: BadgeProps) {
  // If a legacy `variant` is provided, let CVA apply its alias classes and skip `tone`.
  const useLegacy = !!variant && variant !== "default"
  const resolvedTone: BadgeTone | undefined = useLegacy ? undefined : (tone ?? "neutral")

  const dotSize = dotSizeForBadge[size ?? "sm"]
  const iconSize = iconSizeForBadge[size ?? "sm"]

  return (
    <span
      className={cn(
        badgeVariants({
          tone: resolvedTone,
          size,
          shape,
          bordered,
          variant: useLegacy ? variant : "default",
        }),
        interactive && "cursor-pointer hover:opacity-90",
        className
      )}
      {...props}
    >
      {dot && (
        <span className="relative inline-flex shrink-0">
          <span
            className={cn("rounded-full bg-current", dotSize)}
            aria-hidden
          />
          {pulse && (
            <span
              className={cn(
                "absolute inset-0 rounded-full bg-current animate-badge-pulse",
                dotSize
              )}
              aria-hidden
            />
          )}
        </span>
      )}
      {Icon && <Icon className={cn("shrink-0", iconSize)} aria-hidden />}
      {children}
      {count !== undefined && count !== null && (
        <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-current/[0.13] px-1.5 text-[0.92em] tabular-nums leading-none">
          {count}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 -mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-current/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-current"
          aria-label="Remove"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

export { Badge, badgeVariants }
