
import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

interface FormFieldProps {
  children: React.ReactNode
  label?: string
  error?: string
  success?: string
  helpText?: string
  required?: boolean
  className?: string
  htmlFor?: string
}

export function FormField({ 
  children, 
  label, 
  error, 
  success, 
  helpText, 
  required, 
  className, 
  htmlFor 
}: FormFieldProps) {
  const fieldId = htmlFor || React.useId()
  const errorId = error ? `${fieldId}-error` : undefined
  const helpId = helpText ? `${fieldId}-help` : undefined

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label htmlFor={fieldId} className="flex items-center gap-1 text-sm font-medium mb-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <div className="relative">
        {React.cloneElement(children as React.ReactElement, {
          id: fieldId,
          'aria-invalid': !!error,
          'aria-describedby': cn(errorId, helpId).trim() || undefined,
        })}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-destructive font-medium">
          {error}
        </p>
      )}
      {success && !error && (
        <p className="text-xs text-success font-medium">
          {success}
        </p>
      )}
      {helpText && !error && !success && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {helpText}
        </p>
      )}
    </div>
  )
}
