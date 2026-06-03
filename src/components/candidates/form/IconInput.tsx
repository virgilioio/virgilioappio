import React from 'react'
import { Input, type InputProps } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface IconInputProps extends InputProps {
  icon?: LucideIcon
  /** Right-aligned slot (e.g. unit label like "years") */
  trailing?: React.ReactNode
}

/**
 * Input with an optional leading lucide icon and a trailing slot.
 * Used across the candidate sheet for role/company/email/phone/linkedin/location/salary inputs.
 */
export const IconInput = React.forwardRef<HTMLInputElement, IconInputProps>(
  ({ icon: Icon, trailing, className, ...props }, ref) => {
    return (
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-virgilio-muted"
            strokeWidth={1.75}
          />
        )}
        <Input
          ref={ref}
          {...props}
          className={cn(Icon && 'pl-9', trailing && 'pr-16', className)}
        />
        {trailing && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-virgilio-muted">
            {trailing}
          </div>
        )}
      </div>
    )
  },
)
IconInput.displayName = 'IconInput'

export default IconInput
