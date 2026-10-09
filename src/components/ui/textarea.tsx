
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
          "flex min-h-[96px] w-full rounded-lg border bg-surface-primary px-3 py-2 text-sm ring-offset-background placeholder:text-text-tertiary gio-field shadow-[var(--shadow-xs)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-transparent focus-visible:border-[var(--input-border-focus)] focus-visible:shadow-input hover:shadow-[var(--shadow-button)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
          error && "border-destructive shadow-[0_0_0_1px_hsl(var(--destructive))] focus-visible:border-destructive focus-visible:shadow-[0_0_0_1px_hsl(var(--destructive)),var(--input-ring)]",
          success && "border-success shadow-[0_0_0_1px_hsl(var(--success))] focus-visible:border-success",
          !error && !success && "border-virgilio-border hover:border-virgilio-purple/50",
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
