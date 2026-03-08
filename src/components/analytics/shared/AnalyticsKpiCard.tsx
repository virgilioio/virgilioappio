/**
 * AnalyticsKpiCard — thin re-export of the standardized MetricCard.
 * Kept for backwards compatibility with analytics sections.
 */
import { MetricCard } from '@/components/ui/metric-card'
import type { LucideIcon } from 'lucide-react'

interface AnalyticsKpiCardProps {
  title: string
  value: number | string | null
  icon: LucideIcon
  tooltip?: string
  suffix?: string
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    positiveDirection?: 'up' | 'down'
  }
  isLoading?: boolean
  className?: string
}

export function AnalyticsKpiCard({
  title,
  value,
  icon,
  tooltip,
  suffix,
  trend,
  isLoading,
  className,
}: AnalyticsKpiCardProps) {
  return (
    <MetricCard
      title={title}
      value={value ?? undefined}
      icon={icon}
      tooltip={tooltip}
      suffix={suffix}
      trend={trend}
      isLoading={isLoading}
      className={className}
    />
  )
}
