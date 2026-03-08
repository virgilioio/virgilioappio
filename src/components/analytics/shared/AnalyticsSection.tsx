import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface AnalyticsSectionProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: React.ReactNode
  defaultCollapsed?: boolean
  className?: string
  /** Phase annotation shown as a subtle badge */
  phase?: 'live' | 'phase1' | 'future'
}

export function AnalyticsSection({
  title,
  subtitle,
  icon: Icon,
  children,
  defaultCollapsed = false,
  className,
  phase,
}: AnalyticsSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <section className={cn('space-y-4', className)}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-3 w-full text-left group"
      >
        {Icon && (
          <div className="p-1.5 rounded-md bg-virgilio-purple/10">
            <Icon className="h-4 w-4 text-virgilio-purple" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-poppins font-semibold text-virgilio-text leading-tight">
              {title}
            </h2>
            {phase && phase !== 'live' && (
              <span className={cn(
                'text-[10px] font-poppins font-medium px-1.5 py-0.5 rounded-full',
                phase === 'phase1' && 'bg-virgilio-purple/10 text-virgilio-purple',
                phase === 'future' && 'bg-muted text-muted-foreground'
              )}>
                {phase === 'phase1' ? 'Phase 1' : 'Coming Soon'}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-virgilio-muted font-poppins mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-virgilio-muted transition-transform duration-200',
            collapsed && '-rotate-90'
          )}
        />
      </button>

      {!collapsed && (
        <div className="animate-fade-in">
          {children}
        </div>
      )}
    </section>
  )
}
