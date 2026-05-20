import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronDown, type LucideIcon } from "lucide-react"
import { Spinner } from "@/components/ui/progress-system/Spinner"

import { cn } from "@/lib/utils"

/**
 * Gio Foundation v1.0 button system.
 * See docs/style-guide.md §2 for the full spec.
 *
 * Variants (intent + visual weight, NOT action):
 *  - primary       black fill, white text — single most important action on a screen
 *  - purple        brand-emphasis (AI / Gio / core CRM commits)
 *  - secondary     white + hairline border — most common
 *  - ghost         text-only inline action
 *  - danger        outline red — DEFAULT destructive
 *  - dangerSolid   filled red — confirm step inside destructive dialogs ONLY
 *  - success       filled green — positive confirms only
 *  - link          inline body-text link
 *
 * Sizes (height by row density, NOT importance):
 *  xs 24 · sm 28 · md 34 (default) · lg 40 · xl 48
 *
 * Modifier props:
 *  - icon          LucideIcon rendered before the label
 *  - iconRight     LucideIcon rendered after the label (external/arrow/etc.)
 *  - iconOnly      square button; collapses to w === h. Requires aria-label.
 *  - dropdown      appends ChevronDown @ opacity-65 (menu opener)
 *  - onDark        remaps primary/secondary/ghost for the citron-noir top bar
 *  - loading       swap leading icon for spinner; lock width; keep label
 *
 * Motion (per spec): "barely a posture". Hover = fill shift only. Active =
 * filled variants darken further + inner shadow. NO translate, NO lift, NO scale.
 *
 * Focus: 2px purple ring at 30% opacity, no offset (:focus-visible only).
 *
 * Legacy (kept for backward compat — slated for removal):
 *  - default → purple   (will flip to primary later)
 *  - destructive → dangerSolid
 *  - outline → secondary
 *  - virgilio → purple
 *  - warning, info → unchanged
 *  - primaryOnDark / secondaryOnDark / ghostOnDark → use `onDark` prop instead
 *  - size="icon|icon-sm|icon-lg" → use `iconOnly` + size
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-poppins font-medium tracking-[-0.005em] ring-offset-0 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30 disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // === Gio v1.0 spec variants ===
        primary:
          "bg-[#0d0d09] !text-[#fffcf9] [&_svg]:!text-[#fffcf9] shadow-[var(--shadow-button)] hover:bg-[#1a1a14] active:bg-[#000000] active:shadow-inner",
        purple:
          "bg-virgilio-purple !text-white [&_svg]:!text-white shadow-[var(--shadow-button)] hover:bg-virgilio-purple/90 active:bg-virgilio-purple/85 active:shadow-inner",
        secondary:
          "border border-virgilio-border bg-white text-foreground shadow-[var(--shadow-xs)] hover:bg-[#FAFAF7] active:bg-[#F1F0EC] active:shadow-inner",
        ghost:
          "text-foreground hover:bg-[#F1F0EC] active:bg-[#E7E5E0]",
        danger:
          "border border-virgilio-error/40 bg-background text-virgilio-error shadow-[var(--shadow-xs)] hover:bg-virgilio-error/[0.06] hover:border-virgilio-error/60 active:bg-virgilio-error/[0.10] active:shadow-inner",
        dangerSolid:
          "bg-destructive !text-destructive-foreground [&_svg]:!text-destructive-foreground shadow-[var(--shadow-button)] hover:bg-destructive/90 active:bg-destructive/85 active:shadow-inner",
        success:
          "bg-success !text-success-foreground [&_svg]:!text-success-foreground shadow-[var(--shadow-button)] hover:bg-success/90 active:bg-success/85 active:shadow-inner",
        link:
          "text-virgilio-purple underline-offset-4 hover:underline shadow-none font-medium",

        // === Legacy aliases (kept for backward compat) ===
        // `default` now mirrors `primary` per Gio Foundation v1.0 spec
        // (was purple; flipped to citron-noir/cream so every plain <Button> renders the spec-correct primary).
        default:
          "bg-[#0d0d09] !text-[#fffcf9] [&_svg]:!text-[#fffcf9] shadow-[var(--shadow-button)] hover:bg-[#1a1a14] active:bg-[#000000] active:shadow-inner",
        destructive:
          "bg-destructive !text-destructive-foreground [&_svg]:!text-destructive-foreground shadow-[var(--shadow-button)] hover:bg-destructive/90 active:bg-destructive/85 active:shadow-inner",
        outline:
          "border border-virgilio-border bg-white shadow-[var(--shadow-xs)] hover:bg-[#FAFAF7] active:bg-[#F1F0EC] active:shadow-inner",
        virgilio:
          "bg-virgilio-purple !text-white [&_svg]:!text-white shadow-[var(--shadow-button)] hover:bg-virgilio-purple/90",
        warning:
          "bg-warning text-warning-foreground shadow-[var(--shadow-button)] hover:bg-warning/90",
        info:
          "bg-info text-info-foreground shadow-[var(--shadow-button)] hover:bg-info/90",

        // === Deprecated on-dark variants — use `onDark` prop instead ===
        primaryOnDark:
          "bg-background text-foreground shadow-[var(--shadow-button)] hover:bg-background/90",
        secondaryOnDark:
          "bg-white/10 text-white border border-white/15 hover:bg-white/15",
        ghostOnDark:
          "text-white/85 hover:bg-white/10 hover:text-white",
      },
      size: {
        xs: "h-button-xs-v2 px-2 text-[11.5px] [&_svg]:size-3 rounded-md gap-1",
        sm: "h-button-sm-v2 px-2.5 text-ui-button-sm [&_svg]:size-3.5 gap-1.5",
        md: "h-button-md-v2 px-3 text-ui-button-md [&_svg]:size-3.5 gap-1.5",
        lg: "h-button-lg-v2 px-4 text-ui-button-lg [&_svg]:size-[15px] gap-1.5",
        xl: "h-button-xl-v2 px-5 text-[14px] [&_svg]:size-4 gap-2",
        // Legacy `default` keeps the old 36px height for visual continuity.
        default:
          "h-button px-3 py-2 text-sm font-medium tracking-wide [&_svg]:size-3.5 min-h-[40px] md:min-h-0",
        // Deprecated icon sizes — use `iconOnly` prop instead.
        icon: "h-button-md-v2 w-button-md-v2 [&_svg]:size-4",
        "icon-sm": "h-button-sm-v2 w-button-sm-v2 [&_svg]:size-3.5",
        "icon-lg": "h-button-lg-v2 w-button-lg-v2 [&_svg]:size-4",
      },
      iconOnly: {
        true: "p-0 aspect-square",
        false: "",
      },
    },
    compoundVariants: [
      // iconOnly forces width === height per size.
      { iconOnly: true, size: "xs", className: "w-button-xs-v2" },
      { iconOnly: true, size: "sm", className: "w-button-sm-v2" },
      { iconOnly: true, size: "md", className: "w-button-md-v2" },
      { iconOnly: true, size: "lg", className: "w-button-lg-v2" },
      { iconOnly: true, size: "xl", className: "w-button-xl-v2" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      iconOnly: false,
    },
  }
)

/** On-dark remap: applied when `onDark` is true. */
const onDarkClasses: Record<string, string> = {
  primary:
    "bg-[#fffcf9] text-[#0d0d09] shadow-[var(--shadow-button)] hover:bg-[#fffcf9]/90 active:bg-[#fffcf9]/85",
  purple:
    "bg-virgilio-purple text-white shadow-[var(--shadow-button)] hover:bg-virgilio-purple/90",
  secondary:
    "bg-white/10 text-white border border-white/15 hover:bg-white/15 active:bg-white/20 shadow-none",
  ghost:
    "text-white/85 hover:bg-white/10 hover:text-white",
}

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  /** Leading icon (Lucide). Auto-sized to the button size. */
  icon?: LucideIcon
  /** Trailing icon (Lucide). For arrows, external links, etc. */
  iconRight?: LucideIcon
  /** Appends a ChevronDown at 0.65 opacity to indicate a menu. */
  dropdown?: boolean
  /** Remaps primary/secondary/ghost for the citron-noir top bar. */
  onDark?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      iconOnly,
      asChild = false,
      loading,
      disabled,
      icon: Icon,
      iconRight: IconRight,
      dropdown,
      onDark,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading

    // Dev warning: iconOnly requires aria-label for a11y.
    if (
      process.env.NODE_ENV !== "production" &&
      iconOnly &&
      !props["aria-label"] &&
      !props["aria-labelledby"]
    ) {
      // eslint-disable-next-line no-console
      console.warn("[Button] iconOnly requires `aria-label` (or aria-labelledby).")
    }

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

    const onDarkClass =
      onDark && variant && variant in onDarkClasses
        ? onDarkClasses[variant as keyof typeof onDarkClasses]
        : undefined

    // Icon composition. Loading spinner replaces the leading icon.
    const leading = loading ? (
      <Spinner size={14} tone="current" aria-hidden />
    ) : Icon ? (
      <Icon aria-hidden />
    ) : null

    const trailing = (
      <>
        {IconRight ? <IconRight aria-hidden /> : null}
        {dropdown ? <ChevronDown className="opacity-65" aria-hidden /> : null}
      </>
    )

    const composed = (
      <>
        {leading}
        {children}
        {trailing}
      </>
    )

    if (asChild) {
      return (
        <Comp
          className={cn(
            buttonVariants({ variant, size, iconOnly, className }),
            onDarkClass
          )}
          ref={setRefs as any}
          aria-disabled={isDisabled || undefined}
          style={mergedStyle}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, iconOnly, className }),
          onDarkClass
        )}
        ref={setRefs as any}
        disabled={isDisabled}
        style={mergedStyle}
        {...props}
      >
        {composed}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
