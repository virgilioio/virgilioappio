import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'
import { BillingTitle } from '@/components/ui/billing-title'
import { AlertTriangle, CreditCard, Users, Calendar, ExternalLink, Check } from 'lucide-react'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useOpenBillingPortal, useCreateCheckout } from '@/hooks/useBillingPortal'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { useStripePricing } from '@/hooks/useStripePricing'
import { formatPrice, calculateYearlySavings } from '@/utils/pricing'

export function Billing() {
  const { organizationId, userType } = useAuth()
  const { data: billing, isLoading } = useBillingStatus()
  const openPortal = useOpenBillingPortal()
  const createCheckout = useCreateCheckout()
  const { data: pricing, isLoading: isPricingLoading } = useStripePricing()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (!billing) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Billing information not available</h3>
          <p className="text-sm text-muted-foreground">
            Please contact support if you believe this is an error.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isTrialing = billing.billing_status === 'trialing'
  const isActive = billing.billing_status === 'active'
  const isLocked = billing.billing_status === 'locked'
  const isPastDue = billing.billing_status === 'past_due'
  const isCanceled = billing.billing_status === 'canceled'

  const showTrialWarning = isTrialing && billing.days_until_trial_end !== null && billing.days_until_trial_end <= 3

  const getStatusBadge = () => {
    const variants: Record<string, { variant: any; label: string }> = {
      trialing: { variant: 'secondary', label: 'Free Trial' },
      active: { variant: 'success', label: 'Active' },
      past_due: { variant: 'warning', label: 'Past Due' },
      locked: { variant: 'destructive', label: 'Locked' },
      canceled: { variant: 'outline', label: 'Canceled' },
    }
    const config = variants[billing.billing_status] || variants.locked
    return <Badge variant={config.variant as any}>{config.label}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <BillingTitle>Billing</BillingTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and view usage
        </p>
      </div>

      {/* Trial Warning Banner - Show when <= 3 days */}
      {showTrialWarning && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Trial ending soon</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Your trial ends in {billing.days_until_trial_end} {billing.days_until_trial_end === 1 ? 'day' : 'days'}. 
              Subscribe now to avoid service interruption.
            </span>
            <Button
              size="sm"
              variant="virgilio"
              onClick={() => createCheckout.mutate({ interval: 'month' })}
              disabled={createCheckout.isPending}
              className="ml-4"
            >
              {createCheckout.isPending ? 'Loading...' : 'Subscribe Now'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Locked Banner */}
      {isLocked && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Locked</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Your trial has expired. Subscribe to continue using Virgilio ATS.</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => createCheckout.mutate({ interval: 'month' })}
              disabled={createCheckout.isPending}
              className="ml-4"
            >
              {createCheckout.isPending ? 'Loading...' : 'Subscribe Now'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Past Due Banner */}
      {isPastDue && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Overdue</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Your payment is overdue. Please update your payment method to restore access.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openPortal.mutate()}
              disabled={openPortal.isPending}
              className="ml-4"
            >
              {openPortal.isPending ? 'Opening...' : 'Update Payment'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Canceled Banner */}
      {isCanceled && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Subscription Canceled</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Your subscription has been canceled. 
              {billing.subscription_end && (
                <> Access will end on {format(new Date(billing.subscription_end), 'MMM d, yyyy')}.</>
              )}
            </span>
            <Button
              size="sm"
              variant="virgilio"
              onClick={() => createCheckout.mutate({ interval: 'month' })}
              disabled={createCheckout.isPending}
              className="ml-4"
            >
              {createCheckout.isPending ? 'Loading...' : 'Reactivate'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your subscription details and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Plan</div>
              <div className="font-semibold">Virgilio ATS</div>
              <div className="text-xs text-muted-foreground">
                {billing.billing_interval === 'year' ? 'Annual billing' : 'Monthly billing'}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Status</div>
              {getStatusBadge()}
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">
                {isTrialing ? 'Trial Ends' : 'Next Renewal'}
              </div>
              {isTrialing && billing.trial_ends_at ? (
                <>
                  <div className="font-medium">
                    {format(new Date(billing.trial_ends_at), 'MMM d, yyyy')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ({billing.days_until_trial_end} {billing.days_until_trial_end === 1 ? 'day' : 'days'} remaining)
                  </div>
                </>
              ) : billing.subscription_end ? (
                <div className="font-medium">
                  {format(new Date(billing.subscription_end), 'MMM d, yyyy')}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">N/A</div>
              )}
            </div>
          </div>

          {/* Seat Count */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">
                    {billing.seat_quantity} Recruiter {billing.seat_quantity === 1 ? 'Seat' : 'Seats'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Hiring Managers and Interviewers are free
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {(isTrialing || isLocked || isCanceled) && (
              <Button
                variant="virgilio"
                onClick={() => createCheckout.mutate({ interval: 'month' })}
                disabled={createCheckout.isPending}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {createCheckout.isPending ? 'Loading...' : isTrialing ? 'Start Subscription' : 'Subscribe'}
              </Button>
            )}

            {isActive && billing.stripe_subscription_id && (
              <Button
                variant="outline"
                onClick={() => openPortal.mutate()}
                disabled={openPortal.isPending}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {openPortal.isPending ? 'Opening...' : 'Manage Billing in Stripe'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Details</CardTitle>
          <CardDescription>Simple, transparent per-seat pricing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Price per Recruiter</div>
              {isPricingLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <>
                  <div className="font-semibold text-lg">
                    {formatPrice(pricing?.monthly?.amount || 1000)}/month or {formatPrice(pricing?.yearly?.amount || 9900)}/year
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Save {pricing?.monthly && pricing?.yearly 
                      ? calculateYearlySavings(pricing.monthly.amount, pricing.yearly.amount)
                      : 17}% with annual billing
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-2">Trial Period</div>
              {isPricingLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <div className="font-semibold text-lg">{pricing?.trialDays || 14} days free</div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                No credit card required
              </div>
            </div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-success mt-0.5" />
              <div>
                <div className="font-medium text-sm">Billable Roles</div>
                <div className="text-xs text-muted-foreground">Admin, Recruiter</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-success mt-0.5" />
              <div>
                <div className="font-medium text-sm">Free Roles</div>
                <div className="text-xs text-muted-foreground">Hiring Manager, Interviewer (unlimited)</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-success mt-0.5" />
              <div>
                <div className="font-medium text-sm">All Features Included</div>
                <div className="text-xs text-muted-foreground">
                  Full ATS, AI-powered matching, unlimited jobs & candidates
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trial Started Info (only during trial) */}
      {isTrialing && billing.trial_started_at && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Trial started</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(billing.trial_started_at), 'MMMM d, yyyy')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">Source</div>
              <div className="text-xs text-muted-foreground">
                Direct signup
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
