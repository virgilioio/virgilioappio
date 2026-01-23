import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'
import { BillingTitle } from '@/components/ui/billing-title'
import { MetricCard } from '@/components/ui/metric-card'
import { AlertTriangle, CreditCard, Users, ExternalLink, Check, RefreshCw, TrendingUp, UserPlus, Briefcase, Mail, Clock, Sparkles } from 'lucide-react'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useOpenBillingPortal, useCreateCheckout } from '@/hooks/useBillingPortal'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { useStripePricing } from '@/hooks/useStripePricing'
import { formatPrice } from '@/utils/pricing'
import { useInvoiceHistory } from '@/hooks/useInvoiceHistory'
import { useSwitchBillingInterval } from '@/hooks/useSwitchBillingInterval'
import { useBillingPeriodUsage } from '@/hooks/useBillingPeriodUsage'
import { InvoiceHistoryTable } from '@/components/billing/InvoiceHistoryTable'
import { CreditBundleCard } from '@/components/billing/CreditBundleCard'
import { PerSeatPricingCard } from '@/components/billing/PerSeatPricingCard'

export function Billing() {
  const { organizationId, userType } = useAuth()
  const { data: billing, isLoading } = useBillingStatus()
  const openPortal = useOpenBillingPortal()
  const createCheckout = useCreateCheckout()
  const { data: pricing, isLoading: isPricingLoading } = useStripePricing()
  const { data: invoices = [], isLoading: isInvoicesLoading } = useInvoiceHistory()
  const switchInterval = useSwitchBillingInterval()
  const { data: usage, isLoading: isUsageLoading } = useBillingPeriodUsage()

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <BillingTitle>Billing</BillingTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription and view usage
        </p>
      </div>

      {/* Pending Trial Banner - CC Wall */}
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

      {/* Grace Period Banner */}
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
              <div className="font-semibold">
                {isPendingTrial 
                  ? 'GoGio ATS (Pending)' 
                  : isTrialing
                    ? 'GoGio ATS (Trial)'
                    : 'GoGio ATS'}
              </div>
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

          {/* Seat Count & Credits */}
          <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">
                  {billing.seat_quantity || 1} Recruiter {(billing.seat_quantity || 1) === 1 ? 'Seat' : 'Seats'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {billing.billing_interval === 'year' ? '$999/seat/year' : '$99/seat/month'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">
                  {totalCredits} Enrichment Credits/Month
                </div>
                <div className="text-xs text-muted-foreground">
                  {creditsPerSeat} credits per seat ({billing.billing_interval === 'year' ? 'annual bonus!' : 'monthly'})
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {needsSubscription && (
              <Button
                variant="virgilio"
                onClick={() => createCheckout.mutate({ interval: 'month' })}
                disabled={createCheckout.isPending}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {createCheckout.isPending ? 'Loading...' : isPendingTrial ? 'Start Free Trial' : isTrialing ? 'Subscribe Now' : 'Subscribe'}
              </Button>
            )}

            {canSwitchInterval && (
              <Button
                variant="outline"
                onClick={() => switchInterval.mutate({ 
                  newInterval: billing.billing_interval === 'month' ? 'year' : 'month' 
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
                {openPortal.isPending ? 'Opening...' : 'Manage in Stripe'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-Seat Pricing Card (for trial/locked/pending users) */}
      {needsSubscription && (
        <PerSeatPricingCard 
          showTrialCTA={isPendingTrial || isTrialing}
          currentSeats={billing.seat_quantity || 1}
          billingInterval={billing.billing_interval as 'month' | 'year' || 'month'}
        />
      )}

      {/* Credit Bundle Card - Show for active users */}
      {isActive && (
        <CreditBundleCard 
          bonusCreditsAvailable={(billing.bonus_credits_purchased || 0) - (billing.bonus_credits_used || 0)}
        />
      )}

      {/* Pricing Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Details</CardTitle>
          <CardDescription>Simple, transparent per-seat pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Per-Seat Subscription</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>$99/seat/month</strong> or <strong>$999/seat/year</strong> (~17% savings)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Only recruiters count as seats—hiring managers & interviewers are free</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>100 enrichment credits per seat/month (120 on annual plans)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Automatic scaling—seats added or removed are prorated</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Credit Bundles (Add-ons)</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>500 credits</strong> for $49 ($0.098 each)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>1,500 credits</strong> for $129 ($0.086 each, save 12%)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>5,000 credits</strong> for $349 ($0.070 each, save 29%)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Bonus credits never expire while subscription is active</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Analytics */}
      {isActive && usage && (
        <Card>
          <CardHeader>
            <CardTitle>Current Billing Period Usage</CardTitle>
            <CardDescription>
              {format(new Date(usage.periodStart), 'MMM d')} - {format(new Date(usage.periodEnd), 'MMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard title="Jobs Created" value={usage.jobsCreated} icon={<Briefcase />} />
              <MetricCard title="Candidates Added" value={usage.candidatesAdded} icon={<UserPlus />} />
              <MetricCard title="Active Members" value={usage.activeMembers} icon={<Users />} />
              <MetricCard title="Billable Seats" value={usage.billableSeats} icon={<TrendingUp />} />
              <MetricCard title="Emails Sent" value={usage.emailsSent} icon={<Mail />} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice History */}
      {(isActive || isPastDue || isCanceled) && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
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
      )}
    </div>
  )
}
