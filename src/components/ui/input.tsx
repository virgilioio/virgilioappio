
import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  success?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border bg-surface-primary px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-text-tertiary gio-field shadow-[var(--shadow-xs)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-transparent focus-visible:border-[var(--input-border-focus)] focus-visible:shadow-input hover:shadow-[var(--shadow-button)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
          error && "border-destructive shadow-[0_0_0_1px_hsl(var(--destructive))] focus-visible:border-destructive focus-visible:shadow-[0_0_0_1px_hsl(var(--destructive)),var(--input-ring)]",
          success && "border-success shadow-[0_0_0_1px_hsl(var(--success))] focus-visible:border-success",
          !error && !success && "border-virgilio-border hover:border-virgilio-purple/50",
          // Hide number input spinner arrows
          type === "number" && [
            "[appearance:textfield]", // Firefox
            "[&::-webkit-outer-spin-button]:appearance-none", // Webkit browsers
            "[&::-webkit-inner-spin-button]:appearance-none", // Webkit browsers
            "[&::-webkit-outer-spin-button]:m-0", // Remove margin
            "[&::-webkit-inner-spin-button]:m-0" // Remove margin
          ],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
