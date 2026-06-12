import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ProfileCardProps {
  title?: ReactNode
  subtitle?: ReactNode
  /** Right-aligned cluster shown in the card header. */
  action?: ReactNode
  /** Optional chip rendered next to title (e.g. lilac "Parsed by Gio"). */
  badge?: ReactNode
  /** Strip header padding from the body (e.g. PDF viewer). */
  bodyPadding?: 'default' | 'none' | 'tight'
  className?: string
  bodyClassName?: string
  children?: ReactNode
}

/**
 * White card, radius 14, hairline 1px #E7E8EE.
 * Header: 14px 20px 12px + bottom hairline #F1F0EC.
 * Title: Poppins 14/600. Subtitle: Inter 11.5 #5A6072.
 * Body: 20px padding (overridable).
 */
export function ProfileCard({
  title,
  subtitle,
  action,
  badge,
  bodyPadding = 'default',
  className,
  bodyClassName,
  children,
}: ProfileCardProps) {
  const hasHeader = !!(title || subtitle || action || badge)
  const bodyPad = bodyPadding === 'none' ? '' : bodyPadding === 'tight' ? 'p-3.5' : 'p-5'

  return (
    <section
      className={cn(
        'bg-white rounded-[14px] border border-[#E7E8EE] shadow-[0_1px_2px_rgba(13,13,9,0.04)] overflow-hidden',
        className,
      )}
    >
      {hasHeader && (
        <header className="flex items-start gap-3 pl-5 pr-3.5 pt-3.5 pb-3 border-b border-[#F1F0EC]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              {title && (
                <h3 className="font-poppins font-semibold text-[14px] tracking-[-0.01em] text-[#1F2230] leading-tight truncate">
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="mt-1 font-inter text-[11.5px] text-[#5A6072] leading-snug">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 flex items-center gap-1.5">{action}</div>}
        </header>
      )}
      <div className={cn(bodyPad, bodyClassName)}>{children}</div>
    </section>
  )
}

export default ProfileCard
