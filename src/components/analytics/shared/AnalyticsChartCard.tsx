import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

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
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
            </div>
          ) : isEmpty ? (
            <AnalyticsEmptyState
              title={emptyMessage || 'No data available'}
              description={emptyDescription || 'Try adjusting your filters or date range'}
            />
          ) : (
            children
          )}
        </div>
      </CardContent>
    </Card>
  )
}
