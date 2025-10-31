import { Badge } from '@/components/ui/badge'
import { TrendingDown, TrendingUp, Activity, AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type HealthStatus = 'healthy' | 'at-risk' | 'churn-risk' | 'inactive'

interface CustomerHealthBadgeProps {
  health: HealthStatus
  tooltip?: string
}

export function CustomerHealthBadge({ health, tooltip }: CustomerHealthBadgeProps) {
  const config = {
    healthy: {
      label: 'Healthy',
      icon: TrendingUp,
      className: 'bg-virgilio-success/10 text-virgilio-success border-virgilio-success/20',
    },
    'at-risk': {
      label: 'At Risk',
      icon: AlertCircle,
      className: 'bg-warning/10 text-warning-foreground border-warning/20',
    },
    'churn-risk': {
      label: 'Churn Risk',
      icon: TrendingDown,
      className: 'bg-virgilio-error/10 text-virgilio-error border-virgilio-error/20',
    },
    inactive: {
      label: 'Inactive',
      icon: Activity,
      className: 'bg-virgilio-muted/10 text-virgilio-muted border-virgilio-muted/20',
    },
  }

  const { label, icon: Icon, className } = config[health]

  const badge = (
    <Badge variant="outline" className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
