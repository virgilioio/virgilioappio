import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSeatsLimit } from '@/hooks/useSeatsLimit'
import { Users, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SeatUsageCardProps {
  tenantId: string
}

export function SeatUsageCard({ tenantId }: SeatUsageCardProps) {
  const { data: seatInfo, isLoading } = useSeatsLimit(tenantId)
  const navigate = useNavigate()

  if (isLoading || !seatInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Seat Usage
          </CardTitle>
          <CardDescription>Loading seat information...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const usagePercent = (seatInfo.current_seats / seatInfo.seat_limit) * 100
  const isNearLimit = usagePercent >= 80 && usagePercent < 100
  const isAtLimit = usagePercent >= 100
  const isOverLimit = seatInfo.over_limit_count > 0

  // Determine status and styling
  const getStatusInfo = () => {
    if (seatInfo.is_trial && isOverLimit) {
      return {
        variant: 'warning' as const,
        icon: AlertTriangle,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        message: `You're using ${seatInfo.over_limit_count} seat${seatInfo.over_limit_count > 1 ? 's' : ''} over your trial limit. Upgrade to continue adding members.`,
        showUpgrade: true,
      }
    }
    if (!seatInfo.is_trial && isAtLimit) {
      return {
        variant: 'destructive' as const,
        icon: XCircle,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        message: 'Seat limit reached. Upgrade your plan to add more members.',
        showUpgrade: true,
      }
    }
    if (isNearLimit) {
      return {
        variant: 'warning' as const,
        icon: AlertTriangle,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        message: 'You\'re approaching your seat limit.',
        showUpgrade: true,
      }
    }
    return {
      variant: 'default' as const,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      message: 'Seat usage is healthy.',
      showUpgrade: false,
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Seat Usage
        </CardTitle>
        <CardDescription>
          {seatInfo.is_trial ? 'Trial Plan' : 'Paid Plan'} • {seatInfo.current_seats} of {seatInfo.seat_limit} seats used
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Billable Seats</span>
            <span className="font-medium">
              {seatInfo.current_seats} / {seatInfo.seat_limit}
            </span>
          </div>
          <Progress 
            value={Math.min(usagePercent, 100)} 
            className="h-2"
          />
        </div>

        {(statusInfo.showUpgrade || isOverLimit) && (
          <Alert variant={statusInfo.variant}>
            <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
            <AlertDescription className="flex items-center justify-between gap-4">
              <span className="flex-1">{statusInfo.message}</span>
              {statusInfo.showUpgrade && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate('/settings/billing')}
                >
                  Upgrade Plan
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {seatInfo.is_trial && !isOverLimit && (
          <p className="text-xs text-muted-foreground">
            Trial accounts can use up to {Math.floor(seatInfo.seat_limit * 1.2)} seats ({Math.floor(20)}% grace period)
          </p>
        )}
      </CardContent>
    </Card>
  )
}
