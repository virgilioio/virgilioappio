
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

  // Safely construct aria-describedby
  const ariaDescribedBy = React.useMemo(() => {
    const parts = [errorId, helpId].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : undefined
  }, [errorId, helpId])

  // Validate and clone the children element safely
  const clonedChild = React.useMemo(() => {
    // Ensure children is a valid React element
    if (!React.isValidElement(children)) {
      console.warn('FormField: children is not a valid React element:', children)
      return children
    }

    try {
      return React.cloneElement(children as React.ReactElement, {
        id: fieldId,
        'aria-invalid': !!error,
        'aria-describedby': ariaDescribedBy,
      })
    } catch (err) {
      console.error('FormField: Failed to clone element:', err)
      return children
    }
  }, [children, fieldId, error, ariaDescribedBy])

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={fieldId} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <div className="relative">
        {clonedChild}
      </div>
      {error && (
        <p id={errorId} role="alert" aria-live="assertive" className="text-xs text-destructive font-medium">
          {error}
        </p>
      )}
      {success && !error && (
        <p aria-live="polite" className="text-xs text-success font-medium">
          {success}
        </p>
      )}
      {helpText && !error && !success && (
        <p id={helpId} className="text-xs text-text-tertiary">
          {helpText}
        </p>
      )}
    </div>
  )
}
