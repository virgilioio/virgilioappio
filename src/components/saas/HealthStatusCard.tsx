import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, AlertTriangle, Lightbulb } from 'lucide-react'
import { CustomerHealthBadge } from './CustomerHealthBadge'
import { CustomerHealthResult } from '@/utils/customerHealth'
import { cn } from '@/lib/utils'

interface HealthStatusCardProps {
  health: CustomerHealthResult
}

export function HealthStatusCard({ health }: HealthStatusCardProps) {
  return (
    <Card className="shadow-calendly border-virgilio-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            Health Analysis<span className="text-virgilio-purple">.</span>
          </CardTitle>
          <CustomerHealthBadge health={health.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Criteria Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-virgilio-muted">Health Criteria</h4>
          <div className="space-y-2">
            {health.reasons.map((reason, index) => (
              <div 
                key={index}
                className={cn(
                  "flex items-start gap-3 p-2 rounded-lg",
                  reason.passed 
                    ? "bg-green-500/10" 
                    : "bg-destructive/10"
                )}
              >
                {reason.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-medium",
                    reason.passed ? "text-green-700 dark:text-green-400" : "text-destructive"
                  )}>
                    {reason.label}
                  </div>
                  <div className="text-xs text-virgilio-muted">
                    {reason.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div className="pt-4 border-t border-virgilio-border">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-virgilio-purple/10">
              <Lightbulb className="h-4 w-4 text-virgilio-purple" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-virgilio-text mb-1">Recommendation</h4>
              <p className="text-sm text-virgilio-muted">
                {health.recommendation}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
