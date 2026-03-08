import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface MetricCardProps {
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
  /** Optional sparkline or mini-chart rendered on the right */
  sparkline?: React.ReactNode
  /** Visual variant */
  variant?: 'default' | 'hero' | 'inline'
  /** Accent color class for the icon, e.g. 'text-primary', 'text-destructive' */
  iconColor?: string
  className?: string
}

function isLucideIcon(icon: any): icon is LucideIcon {
  return typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon && 'render' in icon)
}

function formatValue(value: string | number | React.ReactNode | null | undefined, suffix?: string) {
  if (value === null || value === undefined) return 'N/A'
  if (typeof value === 'number') return `${value.toLocaleString()}${suffix || ''}`
  if (typeof value === 'string' && suffix) return `${value}${suffix}`
  return value
}

function TrendBadge({ trend, isLoading }: Pick<MetricCardProps, 'trend' | 'isLoading'>) {
  if (!trend || isLoading) return null

  const trendColor =
    trend.direction === 'neutral'
      ? 'text-muted-foreground'
      : trend.direction === (trend.positiveDirection || 'up')
        ? 'text-virgilio-success'
        : 'text-destructive'

  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-poppins font-medium shrink-0', trendColor)}>
      {trend.direction === 'up' ? (
        <TrendingUp className="h-3 w-3" />
      ) : trend.direction === 'down' ? (
        <TrendingDown className="h-3 w-3" />
      ) : null}
      {trend.value}%
    </span>
  )
}

function IconCircle({
  icon,
  iconColor = 'text-primary',
  size = 'default',
}: {
  icon: MetricCardProps['icon']
  iconColor?: string
  size?: 'default' | 'hero'
}) {
  if (!icon) return null

  const circleSize = size === 'hero' ? 'w-14 h-14' : 'w-12 h-12'
  const iconSize = size === 'hero' ? 'h-6 w-6' : 'h-5 w-5'

  return (
    <div className={cn('rounded-full bg-background shadow-md flex items-center justify-center shrink-0 border border-border/50', circleSize)}>
      {isLucideIcon(icon) ? (
        (() => { const Icon = icon; return <Icon className={cn(iconSize, iconColor)} /> })()
      ) : (
        <div className={cn(iconSize, iconColor, '[&>svg]:h-full [&>svg]:w-full')}>{icon}</div>
      )}
    </div>
  )
}

function wrapTooltip(content: React.ReactElement, tooltip?: string) {
  if (!tooltip) return content
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent><p className="text-xs">{tooltip}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
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
  sparkline,
  variant = 'default',
  iconColor,
  className,
}: MetricCardProps) {
  const formattedValue = formatValue(value, suffix)

  // ─── Inline variant (no card wrapper, used inside MetricCardGroup) ───
  if (variant === 'inline') {
    const content = (
      <div className={cn('flex items-center gap-3 min-w-0 flex-1 px-4 py-3', className)}>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <p className="text-xs font-poppins font-medium text-muted-foreground truncate">{title}</p>
          <div className="flex items-baseline gap-2">
            {isLoading ? (
              <span className="inline-block w-10 h-6 bg-border/50 rounded animate-pulse" />
            ) : (
              <p className="text-xl font-poppins font-bold text-foreground leading-none truncate">
                {formattedValue}
              </p>
            )}
            <TrendBadge trend={trend} isLoading={isLoading} />
          </div>
          {footer && !isLoading && <div className="mt-1">{footer}</div>}
        </div>
        {sparkline && !isLoading && (
          <div className="w-24 h-10 shrink-0">{sparkline}</div>
        )}
      </div>
    )
    return wrapTooltip(content, tooltip)
  }

  // ─── Hero variant (horizontal pill, larger) ───
  if (variant === 'hero') {
    const card = (
      <Card className={cn('rounded-2xl border-border/60 shadow-md hover:shadow-xl transition-all duration-200 ease-out hover:-translate-y-0.5', className)}>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <IconCircle icon={icon} iconColor={iconColor} size="hero" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-poppins font-medium text-muted-foreground uppercase tracking-wider truncate">
                {title}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                {isLoading ? (
                  <span className="inline-block w-16 h-9 bg-border/50 rounded animate-pulse" />
                ) : (
                  <p className="text-3xl font-poppins font-bold text-foreground leading-none truncate">
                    {formattedValue}
                  </p>
                )}
                <TrendBadge trend={trend} isLoading={isLoading} />
              </div>
              {footer && !isLoading && <div className="mt-2">{footer}</div>}
            </div>
            {sparkline && !isLoading && (
              <div className="w-32 h-14 shrink-0">{sparkline}</div>
            )}
          </div>
        </CardContent>
      </Card>
    )
    return wrapTooltip(card, tooltip)
  }

  // ─── Default variant (horizontal pill) ───
  const card = (
    <Card className={cn('rounded-2xl border-border/60 shadow-md hover:shadow-xl transition-all duration-200 ease-out hover:-translate-y-0.5', className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <IconCircle icon={icon} iconColor={iconColor} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-poppins font-medium text-muted-foreground truncate">
              {title}
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              {isLoading ? (
                <span className="inline-block w-12 h-7 bg-border/50 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-poppins font-bold text-foreground leading-none truncate">
                  {formattedValue}
                </p>
              )}
              <TrendBadge trend={trend} isLoading={isLoading} />
            </div>
            {footer && !isLoading && <div className="mt-1.5">{footer}</div>}
          </div>
          {sparkline && !isLoading && (
            <div className="w-28 h-10 shrink-0">{sparkline}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return wrapTooltip(card, tooltip)
}
