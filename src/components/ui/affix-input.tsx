import * as React from 'react'
import { cn } from '@/lib/utils'

export interface AffixInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  /** Text or an icon in its own segment before the value, e.g. "/jobs/" or "$". */
  prefix?: React.ReactNode
  /** Its own segment after the value, e.g. "/yr" or "%". */
  suffix?: React.ReactNode
  /** Numbers sit right-aligned in tabular figures, next to the suffix. */
  numeric?: boolean
  invalid?: boolean
  wrapperClassName?: string
}

/**
 * Motion & Feel §12 prefix and suffix: each affix sits in its own segment; numeric
 * values are right-aligned in tabular-nums. Focus follows the text-field rule: border
 * --input-border-focus plus --input-ring, instantly, with no change in border width.
 */
export const AffixInput = React.forwardRef<HTMLInputElement, AffixInputProps>(
  ({ prefix, suffix, numeric, invalid, wrapperClassName, className, disabled, ...props }, ref) => (
    <div
      className={cn(
        'gio-field flex h-11 items-stretch overflow-hidden rounded-lg border bg-surface-primary',
        'focus-within:outline focus-within:outline-2 focus-within:outline-transparent',
        invalid
          ? 'border-destructive shadow-[0_0_0_1px_hsl(var(--destructive))] focus-within:border-destructive focus-within:shadow-[0_0_0_1px_hsl(var(--destructive)),var(--input-ring)]'
          : 'border-virgilio-border focus-within:border-[var(--input-border-focus)] focus-within:shadow-input',
        disabled && 'cursor-not-allowed opacity-50 bg-surface-secondary',
        wrapperClassName,
      )}
    >
      {prefix != null && (
        <span className="inline-flex shrink-0 items-center whitespace-nowrap border-r border-virgilio-border bg-[#FAFAF7] px-3 text-[12.5px] text-text-tertiary">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed',
          numeric && 'text-right tabular-nums',
          className,
        )}
        {...props}
      />
      {suffix != null && (
        <span className="inline-flex shrink-0 items-center whitespace-nowrap border-l border-virgilio-border bg-[#FAFAF7] px-3 text-[12px] text-text-tertiary">
          {suffix}
        </span>
      )}
    </div>
  ),
)
AffixInput.displayName = 'AffixInput'
