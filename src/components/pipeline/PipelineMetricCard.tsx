/**
 * PipelineMetricCard — thin wrapper around standardized MetricCard.
 * Removed custom background/icon colors in favor of consistent branding.
 */
import { MetricCard } from '@/components/ui/metric-card'
import type { LucideIcon } from 'lucide-react'

interface PipelineMetricCardProps {
  title: string
  value: string | number | React.ReactNode
  icon?: LucideIcon
  tooltip?: string
}

export function PipelineMetricCard({ title, value, icon, tooltip }: PipelineMetricCardProps) {
  return (
    <MetricCard
      title={title}
      value={value}
      icon={icon}
      tooltip={tooltip}
    />
  )
}
