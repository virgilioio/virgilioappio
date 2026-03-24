import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'
import { BillingTitle } from '@/components/ui/billing-title'
import { MetricCard } from '@/components/ui/metric-card'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, CreditCard, Users, ExternalLink, RefreshCw, Clock, Sparkles, CalendarDays, Shield } from 'lucide-react'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useOpenBillingPortal, useCreateCheckout } from '@/hooks/useBillingPortal'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { useInvoiceHistory } from '@/hooks/useInvoiceHistory'
import { useSwitchBillingInterval } from '@/hooks/useSwitchBillingInterval'
import { InvoiceHistoryTable } from '@/components/billing/InvoiceHistoryTable'
import { CreditBundleCard } from '@/components/billing/CreditBundleCard'


export function Billing() {
  const { organizationId, userType } = useAuth()
  const { data: billing, isLoading } = useBillingStatus()
  const openPortal = useOpenBillingPortal()
  const createCheckout = useCreateCheckout()
  const { data: invoices = [], isLoading: isInvoicesLoading } = useInvoiceHistory()
  const switchInterval = useSwitchBillingInterval()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
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
  const isPendingTrial = billing.billing_status === 'pending_trial'
  const isActive = billing.billing_status === 'active'
  const isLocked = billing.billing_status === 'locked'
  const isPastDue = billing.billing_status === 'past_due'
  const isCanceled = billing.billing_status === 'canceled'
  const isGracePeriod = billing.billing_status === 'grace_period'

  const showTrialWarning = isTrialing && billing.days_until_trial_end !== null && billing.days_until_trial_end <= 3
  const needsSubscription = isTrialing || isPendingTrial || isLocked || isGracePeriod || isCanceled

  const getStatusBadge = () => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending_trial: { variant: 'secondary', label: 'Pending Trial' },
      trialing: { variant: 'secondary', label: 'Free Trial' },
      grace_period: { variant: 'warning', label: 'Grace Period' },
      active: { variant: 'success', label: 'Active' },
      past_due: { variant: 'warning', label: 'Past Due' },
      locked: { variant: 'destructive', label: 'Locked' },
      canceled: { variant: 'outline', label: 'Canceled' },
    }
    const config = variants[billing.billing_status] || variants.locked
    return <Badge variant={config.variant as any}>{config.label}</Badge>
  }

  const canSwitchInterval = isActive && billing.stripe_subscription_id

  // Calculate credits per seat based on billing interval
  const creditsPerSeat = billing.billing_interval === 'year' ? 120 : 100
  const totalCredits = (billing.seat_quantity || 1) * creditsPerSeat

  // Next billing date
  const nextBillingDate = isTrialing && billing.trial_ends_at
    ? format(new Date(billing.trial_ends_at), 'MMM d, yyyy')
    : billing.subscription_end
      ? format(new Date(billing.subscription_end), 'MMM d, yyyy')
      : 'N/A'

  // Price display
  const pricePerSeat = billing.billing_interval === 'year' ? '$999' : '$99'
  const intervalLabel = billing.billing_interval === 'year' ? '/year' : '/mo'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <BillingTitle>Billing</BillingTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and billing
        </p>
      </div>

      {/* ── Alert Banners (unchanged) ── */}
      {isPendingTrial && (
        <Alert variant="default">
          <CreditCard className="h-4 w-4" />
          <AlertTitle>Start Your 14-Day Free Trial</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Add a payment method to start your free trial. You won't be charged until the trial ends.
              Get 20 enrichment credits to try out candidate sourcing.
            </span>
            <Button
              size="sm"
              variant="virgilio"
              onClick={() => createCheckout.mutate({ interval: 'month' })}
              disabled={createCheckout.isPending}
              className="ml-4"
            >
              {createCheckout.isPending ? 'Loading...' : 'Start Free Trial'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

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

      {isLocked && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Locked</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Your trial has expired. Subscribe to continue using GoGio ATS.</span>
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

      {isGracePeriod && (
        <Alert variant="destructive">
          <Clock className="h-4 w-4" />
          <AlertTitle>Grace Period Active</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Your trial has ended. You have {billing.days_until_lockout} {billing.days_until_lockout === 1 ? 'day' : 'days'} remaining before access is locked.
            </span>
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

      {/* ── Top Metric Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Current Plan"
          value={isPendingTrial ? 'Pending' : isTrialing ? 'Trial' : 'GoGio ATS'}
          icon={CreditCard}
          iconColor="text-primary"
          footer={
            <span className="text-xs text-muted-foreground">
              {billing.billing_interval === 'year' ? 'Annual billing' : 'Monthly billing'}
            </span>
          }
        />
        <MetricCard
          title="Next Billing"
          value={nextBillingDate}
          icon={CalendarDays}
          iconColor="text-warning"
          footer={
            isTrialing && billing.days_until_trial_end !== null ? (
              <span className="text-xs text-muted-foreground">
                {billing.days_until_trial_end} {billing.days_until_trial_end === 1 ? 'day' : 'days'} remaining
              </span>
            ) : undefined
          }
        />
        <MetricCard
          title="Team Seats"
          value={`${billing.seat_quantity || 1}`}
          suffix=" Seats"
          icon={Users}
          iconColor="text-virgilio-success"
          footer={
            <span className="text-xs text-muted-foreground">Paid seats</span>
          }
        />
        <MetricCard
          title="Enrichment Credits"
          value={totalCredits}
          suffix="/mo"
          icon={Sparkles}
          iconColor="text-violet-500"
          footer={
            <span className="text-xs text-muted-foreground">
              {creditsPerSeat} per seat
            </span>
          }
        />
      </div>

      {/* ── Two-Column: Your Plan + Payment Method ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Your Plan */}
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Your Plan</CardTitle>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Plan name + price */}
            <div>
              <p className="text-2xl font-poppins font-bold text-foreground">
                GoGio ATS
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Per-seat pricing · {pricePerSeat}/seat{intervalLabel}
              </p>
            </div>

            {/* Seat usage breakdown */}
            <BillingSeatBreakdown />

            {/* Credits summary */}
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{totalCredits} credits/month</p>
                <p className="text-xs text-muted-foreground">
                  {creditsPerSeat} per seat{billing.billing_interval === 'year' ? ' · annual bonus' : ''}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              {needsSubscription && (
                <Button
                  variant="virgilio"
                  onClick={() => createCheckout.mutate({ interval: 'month' })}
                  disabled={createCheckout.isPending}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {createCheckout.isPending
                    ? 'Loading...'
                    : isPendingTrial
                      ? 'Start Free Trial'
                      : isTrialing
                        ? 'Subscribe Now'
                        : 'Subscribe'}
                </Button>
              )}

              {canSwitchInterval && (
                <Button
                  variant="outline"
                  onClick={() => switchInterval.mutate({
                    newInterval: billing.billing_interval === 'month' ? 'year' : 'month',
                  })}
                  disabled={switchInterval.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Switch to {billing.billing_interval === 'month' ? 'Annual (Save 17%)' : 'Monthly'}
                </Button>
              )}

              {isActive && billing.stripe_subscription_id && (
                <Button
                  variant="outline"
                  onClick={() => openPortal.mutate()}
                  disabled={openPortal.isPending}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {openPortal.isPending ? 'Opening...' : 'Manage Subscription'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isActive || isPastDue ? (
              <>
                <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
                  <div className="p-2 rounded-full bg-background shadow-sm border border-border/50">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Stripe Connected</p>
                    <p className="text-xs text-muted-foreground">
                      Payment managed securely via Stripe
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openPortal.mutate()}
                    disabled={openPortal.isPending}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {openPortal.isPending ? 'Opening...' : 'Manage Payment Method'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => openPortal.mutate()}
                    disabled={openPortal.isPending}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Stripe Dashboard
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-3">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">No payment method</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {isPendingTrial
                    ? 'Add a payment method to start your free trial'
                    : 'Subscribe to add a payment method'}
                </p>
                <Button
                  variant="virgilio"
                  size="sm"
                  onClick={() => createCheckout.mutate({ interval: 'month' })}
                  disabled={createCheckout.isPending}
                >
                  {createCheckout.isPending ? 'Loading...' : isPendingTrial ? 'Start Free Trial' : 'Subscribe Now'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* ── Credit Bundle Card (for active users) ── */}
      {isActive && (
        <CreditBundleCard
          bonusCreditsAvailable={(billing.bonus_credits_purchased || 0) - (billing.bonus_credits_used || 0)}
        />
      )}

      {/* ── Invoice History (always visible) ── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Billing History</CardTitle>
          <CardDescription>View and download your past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {isInvoicesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <InvoiceHistoryTable invoices={invoices} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
