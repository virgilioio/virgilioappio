
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

/**
 * Motion & Feel §7 (CLAUDE.md): a field that can show an error (its caller passes an
 * `error` prop, even while it's undefined) reserves an 18px message line, so a message
 * appearing or clearing never moves the form. The message enters from translateY(-3px)
 * + opacity at --dur-hover; the input's border shifts colour at the same speed.
 */
export function FormField(props: FormFieldProps) {
  const {
    children,
    label,
    error,
    success,
    helpText,
    required,
    className,
    htmlFor,
  } = props
  const validates = 'error' in props
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
          <span className={required ? "font-semibold text-virgilio-text" : "font-medium text-virgilio-muted"}>
            {label}
          </span>
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <div className="relative">
        {clonedChild}
      </div>
      {validates ? (
        <p
          id={error ? errorId : helpId}
          role={error ? 'alert' : undefined}
          aria-live={error ? 'assertive' : success ? 'polite' : undefined}
          className={cn(
            'gio-field-message text-xs',
            error ? 'text-virgilio-error font-medium' : success ? 'text-virgilio-success font-medium' : 'text-virgilio-muted',
          )}
          data-state={error ? 'error' : undefined}
          // A new message re-runs the enter animation.
          key={error ? `e:${error}` : 'idle'}
        >
          {error || success || helpText || null}
        </p>
      ) : (
        <>
          {success && !error && (
            <p aria-live="polite" className="text-xs text-virgilio-success font-medium">
              {success}
            </p>
          )}
          {helpText && !error && !success && (
            <p id={helpId} className="text-xs text-virgilio-muted">
              {helpText}
            </p>
          )}
        </>
      )}
    </div>
  )
}
