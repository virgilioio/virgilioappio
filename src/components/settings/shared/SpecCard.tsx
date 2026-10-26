import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SpecCardProps {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
}

/**
 * Settings spec card — flat white, padding 0, internal separators #F1F0EC.
 * Header: 14px 18px, bottom hairline #F1F0EC.
 */
export function SpecCard({ title, description, action, children, className, bodyClassName }: SpecCardProps) {
  return (
    <section
      className={cn('bg-white rounded-[12px] overflow-hidden mb-[14px]', className)}
      style={{ border: '1px solid #E7E8EE' }}
    >
      {(title || action) && (
        // The action wraps under the title when both don't fit (phones); a switch stays beside it.
        <header
          className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5"
          style={{ padding: '14px 18px', borderBottom: '1px solid #F1F0EC' }}
        >
          <div className="min-w-0 flex-1 basis-[220px]">
            {title && (
              <h3
                className="font-poppins font-semibold text-[#0d0d09] m-0"
                style={{ fontSize: 13.5, letterSpacing: '-0.01em', lineHeight: 1.2 }}
              >
                {title}
              </h3>
            )}
            {description && (
              <p
                className="font-inter text-[#8B8F9E] m-0"
                style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 3 }}
              >
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/** Row separator. Use on every row except the last. */
export const SPEC_ROW_DIVIDER: React.CSSProperties = { borderBottom: '1px solid #F1F0EC' }
