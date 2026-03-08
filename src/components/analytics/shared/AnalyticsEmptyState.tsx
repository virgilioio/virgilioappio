import { cn } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface AnalyticsEmptyStateProps {
  title?: string
  description?: string
  icon?: LucideIcon
  className?: string
}

export function AnalyticsEmptyState({
  title = 'No data available',
  description = 'Try adjusting your filters or date range',
  icon: Icon = BarChart3,
  className,
}: AnalyticsEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center h-full py-8 text-center', className)}>
      <Icon className="h-10 w-10 text-virgilio-muted/30 mb-3" />
      <p className="text-sm font-poppins font-medium text-virgilio-muted">{title}</p>
      {description && (
        <p className="text-xs text-virgilio-muted/70 mt-1 font-poppins max-w-[240px]">{description}</p>
      )}
    </div>
  )
}
