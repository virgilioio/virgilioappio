import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsCardProps {
  title?: string
  description?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/**
 * Standard Settings card — flat, hairline border, white surface.
 * Used by all restyled Settings tabs (Phase 2+).
 */
export function SettingsCard({
  title,
  description,
  action,
  footer,
  children,
  className,
  bodyClassName,
}: SettingsCardProps) {
  return (
    <section
      className={cn(
        'bg-white border border-[#E7E8EE] rounded-xl overflow-hidden',
        className
      )}
    >
      {(title || action) && (
        // The action wraps under the title when both don't fit (phones); a switch stays beside it.
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1 basis-[220px]">
            {title && (
              <h3
                className="font-poppins font-semibold text-[#0d0d09]"
                style={{ fontSize: '14px', letterSpacing: '-0.01em' }}
              >
                {title}
              </h3>
            )}
            {description && (
              <p className="font-inter text-[12px] text-[#5A6072] mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn('px-5 pb-5', !title && 'pt-5', bodyClassName)}>
        {children}
      </div>
      {footer && (
        <footer className="border-t border-[#EFEFEA] px-5 py-3 bg-[#FAFAF7]">
          {footer}
        </footer>
      )}
    </section>
  )
}
