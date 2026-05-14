import * as React from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Gio v1.0 Floating Action Button.
 * Bottom-right, mobile only, ONE per screen. Reserved for the screen's
 * single best action. Desktop should expose the same action in the page header.
 *
 * See docs/style-guide.md §2 "Specialty patterns".
 */
export interface FABProps extends Omit<ButtonProps, "size" | "variant" | "iconOnly"> {
  variant?: "primary" | "purple"
  /** Required — describes the action for screen readers. */
  "aria-label": string
}

export const FAB = React.forwardRef<HTMLButtonElement, FABProps>(
  ({ className, variant = "primary", children, ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size="lg"
        iconOnly
        className={cn(
          "fixed bottom-6 right-6 z-40 rounded-full shadow-lg md:hidden",
          className
        )}
        {...rest}
      >
        {children}
      </Button>
    )
  }
)
FAB.displayName = "FAB"
