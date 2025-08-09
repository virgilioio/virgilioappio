
import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  success?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, success, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-brand border bg-surface-primary px-3 py-2 text-sm ring-offset-background placeholder:text-text-tertiary transition-all duration-200 ease-out shadow-[var(--shadow-xs)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-accent hover:shadow-[var(--shadow-button)] hover:-translate-y-0.5",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
          error && "border-destructive ring-destructive focus-visible:ring-destructive shadow-[0_0_0_1px_hsl(var(--destructive))]",
          success && "border-success ring-success focus-visible:ring-success shadow-[0_0_0_1px_hsl(var(--success))]",
          !error && !success && "border-border hover:border-accent/60",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
