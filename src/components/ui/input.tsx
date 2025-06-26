
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
          "flex h-input w-full rounded-full border bg-background px-2 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground transition-all duration-150 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:border-accent",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          error && "border-destructive ring-destructive focus-visible:ring-destructive",
          success && "border-success ring-success focus-visible:ring-success",
          !error && !success && "border-input hover:border-accent/50",
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
