import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { Loadable } from '@/components/ui/loadable'
import { Skeleton } from '@/components/ui/skeleton'

interface AnalyticsChartCardProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: React.ReactNode
  isEmpty?: boolean
  isLoading?: boolean
  emptyMessage?: string
  emptyDescription?: string
  height?: string
  actions?: React.ReactNode
  className?: string
}

export function AnalyticsChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  isEmpty,
  isLoading,
  emptyMessage,
  emptyDescription,
  height = 'h-[300px]',
  actions,
  className,
}: AnalyticsChartCardProps) {
  return (
    <Card className={cn('border-virgilio-border', className)}>
      <CardHeader className="pb-2">
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
      <CardContent>
        <div className={height}>
          {/* §6: a skeleton the size of the chart, then the chart crossfades in over it. */}
          <Loadable
            loading={!!isLoading}
            className="h-full [&>.gio-loadable-content]:h-full"
            skeleton={<Skeleton className="h-full w-full rounded-[10px]" />}
          >
            {isEmpty ? (
              <AnalyticsEmptyState
                title={emptyMessage || 'No data available'}
                description={emptyDescription || 'Try adjusting your filters or date range'}
              />
            ) : (
              children
            )}
          </Loadable>
        </div>
      </CardContent>
    </Card>
  )
}
