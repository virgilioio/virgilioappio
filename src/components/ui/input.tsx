
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
          "flex h-[var(--input-height)] w-full rounded-brand border bg-surface-primary px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-text-tertiary transition-all duration-200 ease-out shadow-[var(--shadow-xs)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-accent hover:shadow-[var(--shadow-button)] hover:-translate-y-0.5",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
          error && "border-destructive ring-destructive focus-visible:ring-destructive shadow-[0_0_0_1px_hsl(var(--destructive))]",
          success && "border-success ring-success focus-visible:ring-success shadow-[0_0_0_1px_hsl(var(--success))]",
          !error && !success && "border-border hover:border-accent/60",
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
