import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface AnalyticsTableCardProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: React.ReactNode
  isEmpty?: boolean
  isLoading?: boolean
  emptyMessage?: string
  emptyDescription?: string
  actions?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  /** Max height for scrollable content */
  maxHeight?: string
}

export function AnalyticsTableCard({
  title,
  subtitle,
  icon: Icon,
  children,
  isEmpty,
  isLoading,
  emptyMessage,
  emptyDescription,
  actions,
  footer,
  className,
  maxHeight = 'max-h-[400px]',
}: AnalyticsTableCardProps) {
  return (
    <Card className={cn('border-virgilio-border', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-virgilio-purple" />}
            <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
              {title}
            </CardTitle>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {subtitle && (
          <CardDescription className="text-xs text-virgilio-muted font-poppins">
            {subtitle}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="px-6 pb-6">
            <AnalyticsEmptyState
              title={emptyMessage || 'No data available'}
              description={emptyDescription || 'Try adjusting your filters or date range'}
            />
          </div>
        ) : (
          <>
            <div className={cn('overflow-auto', maxHeight)}>
              {children}
            </div>
            {footer && (
              <div className="border-t border-virgilio-border px-6 py-3">
                {footer}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
