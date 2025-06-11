
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
          "flex min-h-[64px] w-full rounded-md border bg-background px-2 py-1 text-sm ring-offset-background placeholder:text-muted-foreground transition-all duration-default",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          error && "border-destructive ring-destructive",
          success && "border-success ring-success",
          !error && !success && "border-input",
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
