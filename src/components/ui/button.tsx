import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Gio Foundation v1.0 button system.
 * See docs/style-guide.md for the full spec.
 *
 * Variants:
 *  - primary       black fill, white text — the single most important action on a screen
 *  - purple        brand-emphasis (AI / Gio / core CRM commits)
 *  - secondary     white + thin border — most common
 *  - ghost         text-only inline action
 *  - danger        outline red — default destructive
 *  - dangerSolid   filled red — confirm step inside destructive dialogs ONLY
 *  - success       filled green — positive confirms only
 *  - primaryOnDark / secondaryOnDark / ghostOnDark — top-bar surfaces
 *
 * Legacy aliases kept so no consumer breaks during the rollout:
 *  default → purple (today's behavior). Will flip to `primary` (black) in Phase A3.
 *  destructive → dangerSolid
 *  outline → secondary
 *  virgilio → purple (deprecated)
 *  warning, info, link → unchanged
 *
 * Motion (per spec): "barely a posture". Hover = bg-darken only. Active = small
 * translate-y-[0.5px] + inner shadow. No lift, no scale.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-poppins font-medium ring-offset-background transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/35 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 active:translate-y-[0.5px] active:shadow-inner",
  {
    variants: {
      variant: {
        // === Gio v1.0 spec variants ===
        primary:
          "bg-foreground text-background shadow-[var(--shadow-button)] hover:bg-foreground/90",
        purple:
          "bg-virgilio-purple text-white shadow-[var(--shadow-button)] hover:bg-virgilio-purple/90",
        secondary:
          "border border-virgilio-border bg-background text-foreground shadow-[var(--shadow-xs)] hover:bg-foreground/[0.04]",
        ghost:
          "text-foreground hover:bg-foreground/[0.06]",
        danger:
          "border border-virgilio-error/40 bg-background text-virgilio-error shadow-[var(--shadow-xs)] hover:bg-virgilio-error/[0.06] hover:border-virgilio-error/60",
        dangerSolid:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-button)] hover:bg-destructive/90",
        success:
          "bg-success text-success-foreground shadow-[var(--shadow-button)] hover:bg-success/90",
        // === On dark (top bar) ===
        primaryOnDark:
          "bg-background text-foreground shadow-[var(--shadow-button)] hover:bg-background/90",
        secondaryOnDark:
          "bg-white/10 text-white border border-white/15 hover:bg-white/15",
        ghostOnDark:
          "text-white/85 hover:bg-white/10 hover:text-white",
        // === Legacy aliases (kept for backward compat — see Phase A3) ===
        default:
          "bg-virgilio-purple text-white shadow-[var(--shadow-button)] hover:bg-virgilio-purple/90", // = purple, will flip to primary in A3
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-button)] hover:bg-destructive/90", // = dangerSolid
        outline:
          "border border-virgilio-border bg-background shadow-[var(--shadow-xs)] hover:bg-foreground/[0.04]", // = secondary
        virgilio:
          "bg-virgilio-purple text-white shadow-[var(--shadow-button)] hover:bg-virgilio-purple/90", // deprecated, use `purple`
        warning:
          "bg-warning text-warning-foreground shadow-[var(--shadow-button)] hover:bg-warning/90",
        info:
          "bg-info text-info-foreground shadow-[var(--shadow-button)] hover:bg-info/90",
        link:
          "text-primary underline-offset-4 hover:underline shadow-none active:translate-y-0",
      },
      size: {
        // Gio v1.0 sizes
        xs: "h-button-xs-v2 px-2 text-[11.5px] [&_svg]:size-3 rounded-md",
        sm: "h-button-sm-v2 px-2.5 text-ui-button-sm [&_svg]:size-3.5",
        md: "h-button-md-v2 px-3 text-ui-button-md [&_svg]:size-4",
        lg: "h-button-lg-v2 px-4 text-ui-button-lg [&_svg]:size-4",
        xl: "h-button-xl-v2 px-5 text-[15px] [&_svg]:size-[18px]",
        // Legacy `default` keeps the old 36px height for visual continuity until Phase A3.
        default:
          "h-button px-3 py-2 text-sm font-medium tracking-wide [&_svg]:size-3.5 min-h-[40px] md:min-h-0",
        // Icon-only square — uses md height by default
        icon: "h-button-md-v2 w-button-md-v2 [&_svg]:size-4",
        "icon-sm": "h-button-sm-v2 w-button-sm-v2 [&_svg]:size-3.5",
        "icon-lg": "h-button-lg-v2 w-button-lg-v2 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading

    // Lock width during loading to prevent layout shift (Gio spec).
    const innerRef = React.useRef<HTMLElement | null>(null)
    const [lockedWidth, setLockedWidth] = React.useState<number | null>(null)

    const setRefs = React.useCallback(
      (node: HTMLElement | null) => {
        innerRef.current = node
        if (typeof ref === "function") ref(node as HTMLButtonElement)
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node
      },
      [ref]
    )

    React.useLayoutEffect(() => {
      if (loading && innerRef.current && lockedWidth == null) {
        setLockedWidth(innerRef.current.getBoundingClientRect().width)
      }
      if (!loading && lockedWidth != null) {
        setLockedWidth(null)
      }
    }, [loading, lockedWidth])

    const mergedStyle = lockedWidth != null ? { ...style, width: lockedWidth } : style

    if (asChild) {
      return (
        <>
          {loading && <Loader2 className="animate-spin" />}
          <Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={setRefs as any}
            aria-disabled={isDisabled || undefined}
            style={mergedStyle}
            {...props}
          >
            {children}
          </Comp>
        </>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={setRefs as any}
        disabled={isDisabled}
        style={mergedStyle}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
