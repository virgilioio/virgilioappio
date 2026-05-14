import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Gio v1.0 Split button — primary action + chevron sidecar that opens
 * a menu of alternatives. See docs/style-guide.md §2 "Specialty patterns".
 *
 * Use when the default action has named variants (e.g. "Send" / "Send & schedule").
 */
export interface SplitButtonOption {
  label: string
  onSelect: () => void
  disabled?: boolean
}

export interface SplitButtonProps extends Omit<ButtonProps, "onClick" | "dropdown" | "iconRight"> {
  /** Label of the default action (left side). */
  children: React.ReactNode
  /** Default action handler (left side click). */
  onClick: () => void
  /** Alternative actions revealed via the chevron. */
  options: SplitButtonOption[]
  /** Tooltip / aria-label for the chevron side. Defaults to "More options". */
  menuLabel?: string
}

export const SplitButton = React.forwardRef<HTMLButtonElement, SplitButtonProps>(
  ({ children, onClick, options, menuLabel = "More options", className, variant = "primary", size = "md", ...rest }, ref) => {
    return (
      <div className={cn("inline-flex items-stretch", className)}>
        <Button
          ref={ref}
          variant={variant}
          size={size}
          onClick={onClick}
          className="rounded-r-none border-r-0"
          {...rest}
        >
          {children}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size={size}
              iconOnly
              aria-label={menuLabel}
              className="rounded-l-none border-l border-l-black/10"
            >
              <ChevronDown className="opacity-65" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {options.map((opt) => (
              <DropdownMenuItem
                key={opt.label}
                disabled={opt.disabled}
                onSelect={opt.onSelect}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }
)
SplitButton.displayName = "SplitButton"
