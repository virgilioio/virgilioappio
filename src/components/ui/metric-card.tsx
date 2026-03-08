import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number | React.ReactNode
  /** Pass a LucideIcon component OR a ReactNode */
  icon?: LucideIcon | React.ReactNode
  tooltip?: string
  /** Appended to formatted number values, e.g. "d", "%" */
  suffix?: string
  /** Trend indicator */
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    /** Whether up is good (green) or bad (red). Default: 'up' */
    positiveDirection?: 'up' | 'down'
  }
  isLoading?: boolean
  /** Optional footer content below the value */
  footer?: React.ReactNode
  className?: string
}

function isLucideIcon(icon: any): icon is LucideIcon {
  return typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon && 'render' in icon)
}

export function MetricCard({
  title,
  value,
  icon,
  tooltip,
  suffix,
  trend,
  isLoading,
  footer,
  className,
}: MetricCardProps) {
  const formattedValue = value === null || value === undefined
    ? 'N/A'
    : typeof value === 'number'
      ? `${value.toLocaleString()}${suffix || ''}`
      : typeof value === 'string' && suffix
        ? `${value}${suffix}`
        : value

  const trendColor = trend
    ? trend.direction === 'neutral'
      ? 'text-muted-foreground'
      : (trend.direction === (trend.positiveDirection || 'up'))
        ? 'text-virgilio-success'
        : 'text-destructive'
    : ''

  const card = (
    <Card className={cn('border-border hover:shadow-lg transition-all duration-200 ease-out hover:-translate-y-0.5', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-poppins font-medium text-muted-foreground truncate">
              {title}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              {isLoading ? (
                <span className="inline-block w-12 h-7 bg-border/50 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-poppins font-bold text-foreground leading-none truncate">
                  {formattedValue}
                </p>
              )}
              {trend && !isLoading && (
                <span className={cn('flex items-center gap-0.5 text-xs font-poppins font-medium shrink-0', trendColor)}>
                  {trend.direction === 'up' ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : trend.direction === 'down' ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {trend.value}%
                </span>
              )}
            </div>
            {footer && !isLoading && (
              <div className="mt-2">
                {footer}
              </div>
            )}
          </div>
          {icon && (
            <div className="p-2 rounded-lg bg-primary/10 shrink-0 ml-3">
              {isLucideIcon(icon) ? (
                (() => { const Icon = icon; return <Icon className="h-4 w-4 text-primary" /> })()
              ) : (
                <div className="h-4 w-4 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
              )}
            </div>
          )}
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
