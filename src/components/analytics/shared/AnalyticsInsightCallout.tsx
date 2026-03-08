import { cn } from '@/lib/utils'
import { Lightbulb, AlertTriangle, TrendingUp, Info } from 'lucide-react'

type InsightVariant = 'info' | 'warning' | 'success' | 'insight'

interface AnalyticsInsightCalloutProps {
  title: string
  description?: string
  variant?: InsightVariant
  className?: string
  action?: React.ReactNode
}

const variantStyles: Record<InsightVariant, { border: string; bg: string; icon: typeof Info; iconColor: string }> = {
  info: {
    border: 'border-l-info',
    bg: 'bg-info/5',
    icon: Info,
    iconColor: 'text-info',
  },
  warning: {
    border: 'border-l-warning',
    bg: 'bg-warning/5',
    icon: AlertTriangle,
    iconColor: 'text-warning',
  },
  success: {
    border: 'border-l-success',
    bg: 'bg-success/5',
    icon: TrendingUp,
    iconColor: 'text-success',
  },
  insight: {
    border: 'border-l-virgilio-purple',
    bg: 'bg-virgilio-purple/5',
    icon: Lightbulb,
    iconColor: 'text-virgilio-purple',
  },
}

export function AnalyticsInsightCallout({
  title,
  description,
  variant = 'insight',
  className,
  action,
}: AnalyticsInsightCalloutProps) {
  const styles = variantStyles[variant]
  const Icon = styles.icon

  return (
    <div
      className={cn(
        'rounded-lg border border-virgilio-border border-l-4 p-3',
        styles.border,
        styles.bg,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', styles.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-poppins font-medium text-virgilio-text">{title}</p>
          {description && (
            <p className="text-xs text-virgilio-muted font-poppins mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
