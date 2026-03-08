import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface AnalyticsKpiCardProps {
  title: string
  value: number | string | null
  icon: LucideIcon
  tooltip?: string
  /** Format suffix, e.g. "d" for days, "%" for percentages */
  suffix?: string
  /** Trend compared to previous period */
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    /** Whether up is good (green) or bad (red) */
    positiveDirection?: 'up' | 'down'
  }
  isLoading?: boolean
  className?: string
}

export function AnalyticsKpiCard({
  title,
  value,
  icon: Icon,
  tooltip,
  suffix,
  trend,
  isLoading,
  className,
}: AnalyticsKpiCardProps) {
  const formattedValue = value === null || value === undefined
    ? 'N/A'
    : typeof value === 'number'
      ? `${value.toLocaleString()}${suffix || ''}`
      : `${value}${suffix || ''}`

  const trendColor = trend
    ? trend.direction === 'neutral'
      ? 'text-virgilio-muted'
      : (trend.direction === (trend.positiveDirection || 'up'))
        ? 'text-success'
        : 'text-destructive'
    : ''

  const card = (
    <Card className={cn('border-virgilio-border hover:shadow-lg transition-shadow', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-poppins font-medium text-virgilio-muted truncate">
              {title}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              {isLoading ? (
                <span className="inline-block w-12 h-7 bg-virgilio-border/50 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-poppins font-bold text-virgilio-text leading-none">
                  {formattedValue}
                </p>
              )}
              {trend && !isLoading && (
                <span className={cn('flex items-center gap-0.5 text-xs font-poppins font-medium', trendColor)}>
                  {trend.direction === 'up' ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : trend.direction === 'down' ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {trend.value}%
                </span>
              )}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-virgilio-purple/10 shrink-0">
            <Icon className="h-4 w-4 text-virgilio-purple" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return card
}
