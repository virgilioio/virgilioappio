import { ReactNode } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CreditCard, Mail } from 'lucide-react'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useCreateCheckout } from '@/hooks/useBillingPortal'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface BillingGuardProps {
  children?: ReactNode
  requireActive?: boolean // If true, blocks for past_due/canceled too
  fallbackMessage?: string
}

export function BillingGuard({ 
  children, 
  requireActive = false,
  fallbackMessage
}: BillingGuardProps) {
  const { memberRole, userType } = useAuth()
  const { data: billing, isLoading } = useBillingStatus()
  const createCheckout = useCreateCheckout()

  // Platform admins never blocked
  if (userType === 'platform_admin') {
    return <>{children || <Outlet />}</>
  }

  // Hiring managers and interviewers never blocked (read-only roles)
  if (['hiring_manager', 'interviewer'].includes(memberRole || '')) {
    return <>{children || <Outlet />}</>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Checking billing status...</p>
        </div>
      </div>
    )
  }

  // Redirect pending_trial users to trial activation page (CC wall)
  if (billing?.billing_status === 'pending_trial') {
    return <Navigate to="/trial-activation" replace />
  }

  // Determine if user is blocked
  // Allow access during grace_period, only block when locked
  const isBlocked = requireActive 
    ? !['trialing', 'active', 'grace_period'].includes(billing?.billing_status || '')
    : billing?.billing_status === 'locked'

  if (isBlocked) {
    const statusMessages = {
      locked: {
        title: 'Access Locked - Subscription Required',
        description: 'Your trial and grace period have ended. Subscribe to continue using GoGio ATS.',
      },
      past_due: {
        title: 'Payment Past Due',
        description: 'Your last payment failed. Please update your payment method to restore access.',
      },
      canceled: {
        title: 'Subscription Canceled',
        description: 'Your subscription has been canceled. Reactivate to continue using GoGio ATS.',
      },
    }

    const message = statusMessages[billing?.billing_status as keyof typeof statusMessages] || statusMessages.locked

    return (
      <div className="container max-w-2xl mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl">{message.title}</CardTitle>
            <CardDescription className="text-base mt-2">
              {fallbackMessage || message.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                size="lg"
                onClick={() => createCheckout.mutate({ interval: 'month' })}
                disabled={createCheckout.isPending}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {createCheckout.isPending ? 'Loading...' : 'Start Subscription'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.location.href = 'mailto:support@virgilio.tech'}
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </div>

            {billing?.trial_ends_at && (
              <Alert>
                <AlertDescription className="text-sm text-center">
                  Trial ended on {new Date(billing.trial_ends_at).toLocaleDateString()}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Support both direct children and Outlet (for Route element usage)
  return <>{children || <Outlet />}</>
}
