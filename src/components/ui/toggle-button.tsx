import * as React from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Gio v1.0 Toggle button — visible-state push (Favorite, Pin, Bookmark, Subscribe).
 * Pressed state carries a soft lilac fill and `aria-pressed`.
 *
 * Distinct from `<Switch>` (settings on/off) and `<ToggleGroup>` (segmented control).
 */
export interface ToggleButtonProps extends Omit<ButtonProps, "variant" | "onClick"> {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  /** Label for screen readers (especially when icon-only). */
  "aria-label"?: string
}

export const ToggleButton = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
  ({ pressed, onPressedChange, className, children, ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        variant={pressed ? "secondary" : "ghost"}
        aria-pressed={pressed}
        onClick={() => onPressedChange(!pressed)}
        className={cn(
          pressed &&
            "bg-[hsl(var(--badge-lilac))] text-[hsl(var(--badge-lilac-foreground))] border-[hsl(var(--badge-lilac-foreground))]/15 hover:bg-[hsl(var(--badge-lilac))]/90",
          className
        )}
        {...rest}
      >
        {children}
      </Button>
    )
  }
)
ToggleButton.displayName = "ToggleButton"
