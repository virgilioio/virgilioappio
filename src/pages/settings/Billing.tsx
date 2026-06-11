import { format } from 'date-fns'
import {
  AlertTriangle, CreditCard, ExternalLink, RefreshCw, Clock,
  Sparkles, Shield, CheckCircle2,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { MetricStrip } from '@/components/settings/shared/MetricStrip'
import { StatusChip, type StatusTone } from '@/components/settings/shared/StatusChip'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useOpenBillingPortal, useCreateCheckout } from '@/hooks/useBillingPortal'
import { useInvoiceHistory } from '@/hooks/useInvoiceHistory'
import { useSwitchBillingInterval } from '@/hooks/useSwitchBillingInterval'
import { InvoiceHistoryTable } from '@/components/billing/InvoiceHistoryTable'
import { CreditBundleCard } from '@/components/billing/CreditBundleCard'
import { BillingSeatBreakdown } from '@/components/billing/BillingSeatBreakdown'

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  active:        { tone: 'done',     label: 'Active' },
  trialing:      { tone: 'progress', label: 'Free trial' },
  pending_trial: { tone: 'todo',     label: 'Pending trial' },
  grace_period:  { tone: 'blocked',  label: 'Grace period' },
  past_due:      { tone: 'blocked',  label: 'Past due' },
  locked:        { tone: 'blocked',  label: 'Locked' },
  canceled:      { tone: 'neutral',  label: 'Canceled' },
}

export function Billing() {
  const { data: billing, isLoading } = useBillingStatus()
  const openPortal = useOpenBillingPortal()
  const createCheckout = useCreateCheckout()
  const { data: invoices = [], isLoading: isInvoicesLoading } = useInvoiceHistory()
  const switchInterval = useSwitchBillingInterval()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[88px] w-full rounded-xl" />
        <Skeleton className="h-[220px] w-full rounded-xl" />
        <Skeleton className="h-[160px] w-full rounded-xl" />
      </div>
    )
  }

  if (!billing) {
    return (
      <SettingsCard>
        <div className="text-center py-8">
          <AlertTriangle className="h-9 w-9 text-[#8B8F9E] mx-auto mb-3" />
          <h3 className="font-poppins font-semibold text-[14px] text-[#0d0d09] mb-1">
            Billing information not available
          </h3>
          <p className="font-inter text-[12px] text-[#5A6072]">
            Contact support if you believe this is an error.
          </p>
        </div>
      </SettingsCard>
    )
  }

  const status = billing.billing_status
  const isTrialing = status === 'trialing'
  const isPendingTrial = status === 'pending_trial'
  const isActive = status === 'active'
  const isLocked = status === 'locked'
  const isPastDue = status === 'past_due'
  const isCanceled = status === 'canceled'
  const isGracePeriod = status === 'grace_period'

  const showTrialWarning = isTrialing && billing.days_until_trial_end !== null && billing.days_until_trial_end <= 3
  const needsSubscription = isTrialing || isPendingTrial || isLocked || isGracePeriod || isCanceled
  const canSwitchInterval = isActive && billing.stripe_subscription_id

  const creditsPerSeat = billing.billing_interval === 'year' ? 120 : 100
  const totalCredits = (billing.seat_quantity || 1) * creditsPerSeat

  const nextBillingDate = isTrialing && billing.trial_ends_at
    ? format(new Date(billing.trial_ends_at), 'MMM d, yyyy')
    : billing.subscription_end
      ? format(new Date(billing.subscription_end), 'MMM d, yyyy')
      : '—'

  const pricePerSeat = billing.billing_interval === 'year' ? '$999' : '$99'
  const intervalLabel = billing.billing_interval === 'year' ? '/year' : '/mo'
  const statusConfig = STATUS_TONE[status] || STATUS_TONE.locked

  return (
    <div className="space-y-4">
      {/* ── Alert banners (kept) ── */}
      {isPendingTrial && (
        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertTitle>Start your 14-day free trial</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Add a payment method to start your trial. You won't be charged until it ends.</span>
            <Button size="sm" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>
              {createCheckout.isPending ? 'Loading…' : 'Start free trial'}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {showTrialWarning && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Trial ending soon</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              Your trial ends in {billing.days_until_trial_end} {billing.days_until_trial_end === 1 ? 'day' : 'days'}.
            </span>
            <Button size="sm" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>
              Subscribe now
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {isLocked && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access locked</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Your trial has expired. Subscribe to continue using Gio.</span>
            <Button size="sm" variant="dangerSolid" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>
              Subscribe now
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {isPastDue && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment overdue</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Update your payment method to restore access.</span>
            <Button size="sm" variant="secondary" onClick={() => openPortal.mutate()} disabled={openPortal.isPending}>
              Update payment
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {isGracePeriod && (
        <Alert variant="destructive">
          <Clock className="h-4 w-4" />
          <AlertTitle>Grace period active</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              {billing.days_until_lockout} {billing.days_until_lockout === 1 ? 'day' : 'days'} remaining before access is locked.
            </span>
            <Button size="sm" variant="dangerSolid" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>
              Subscribe now
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {isCanceled && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Subscription canceled</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              {billing.subscription_end ? <>Access ends on {format(new Date(billing.subscription_end), 'MMM d, yyyy')}.</> : 'Subscription canceled.'}
            </span>
            <Button size="sm" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>
              Reactivate
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Metric strip ── */}
      <MetricStrip
        metrics={[
          { label: 'Plan', value: isPendingTrial ? 'Pending' : isTrialing ? 'Trial' : 'Gio ATS', hint: billing.billing_interval === 'year' ? 'Annual billing' : 'Monthly billing' },
          { label: 'Paid seats', value: billing.seat_quantity || 1, hint: `${pricePerSeat}${intervalLabel} per seat` },
          { label: 'Credits / mo', value: totalCredits, hint: `${creditsPerSeat} per seat` },
          { label: 'Next billing', value: nextBillingDate, hint: isTrialing && billing.days_until_trial_end !== null ? `${billing.days_until_trial_end} ${billing.days_until_trial_end === 1 ? 'day' : 'days'} left` : undefined },
        ]}
      />

      {/* ── Your plan ── */}
      <SettingsCard
        title="Your plan"
        action={<StatusChip tone={statusConfig.tone} label={statusConfig.label} />}
      >
        <div className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div
                className="font-poppins font-semibold text-[#0d0d09]"
                style={{ fontSize: '20px', letterSpacing: '-0.03em' }}
              >
                Gio ATS
              </div>
              <div className="font-inter text-[12px] text-[#5A6072] mt-0.5">
                Per-seat pricing · {pricePerSeat}{intervalLabel} per seat
              </div>
            </div>
          </div>

          <BillingSeatBreakdown />

          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 border"
            style={{ backgroundColor: '#F7F2FF', borderColor: '#E7DCFF' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#EDE4FF' }}
            >
              <Sparkles className="h-4 w-4" style={{ color: '#5B21B6' }} />
            </div>
            <div className="min-w-0">
              <div className="font-poppins font-medium text-[13px] text-[#0d0d09]">
                {totalCredits} credits per month
              </div>
              <div className="font-inter text-[11.5px] text-[#5A6072]">
                {creditsPerSeat} per seat{billing.billing_interval === 'year' ? ' · annual bonus included' : ''}. Credits refresh on your renewal date.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {needsSubscription && (
              <Button
                icon={CreditCard}
                onClick={() => createCheckout.mutate({ interval: 'month' })}
                disabled={createCheckout.isPending}
              >
                {createCheckout.isPending
                  ? 'Loading…'
                  : isPendingTrial ? 'Start free trial'
                  : isTrialing ? 'Subscribe now'
                  : 'Subscribe'}
              </Button>
            )}
            {canSwitchInterval && (
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => switchInterval.mutate({ newInterval: billing.billing_interval === 'month' ? 'year' : 'month' })}
                disabled={switchInterval.isPending}
              >
                Switch to {billing.billing_interval === 'month' ? 'annual · save 17%' : 'monthly'}
              </Button>
            )}
            {isActive && billing.stripe_subscription_id && (
              <Button
                variant="secondary"
                icon={ExternalLink}
                onClick={() => openPortal.mutate()}
                disabled={openPortal.isPending}
              >
                {openPortal.isPending ? 'Opening…' : 'Manage subscription'}
              </Button>
            )}
          </div>
        </div>
      </SettingsCard>

      {/* ── Payment method ── */}
      <SettingsCard
        title="Payment method"
        action={
          (isActive || isPastDue) && billing.stripe_subscription_id ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => openPortal.mutate()} disabled={openPortal.isPending}>
                Manage
              </Button>
              <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => openPortal.mutate()} disabled={openPortal.isPending}>
                Stripe dashboard
              </Button>
            </div>
          ) : undefined
        }
      >
        {isActive || isPastDue ? (
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#F1F0EC' }}
            >
              <Shield className="h-5 w-5 text-[#0d0d09]" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-poppins font-medium text-[13px] text-[#0d0d09]">
                  Stripe connected
                </span>
                <StatusChip tone="done" label="Verified" />
              </div>
              <div className="font-inter text-[11.5px] text-[#5A6072] mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-[#0E7A4D]" />
                Payment processed securely · next charge on renewal
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: '#F1F0EC' }}
            >
              <CreditCard className="h-5 w-5 text-[#5A6072]" />
            </div>
            <p className="font-poppins font-medium text-[13px] text-[#0d0d09] mb-1">
              No payment method
            </p>
            <p className="font-inter text-[11.5px] text-[#5A6072] mb-3">
              {isPendingTrial ? 'Add a card to start your free trial.' : 'Subscribe to add a payment method.'}
            </p>
            <Button size="sm" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>
              {createCheckout.isPending ? 'Loading…' : isPendingTrial ? 'Start free trial' : 'Subscribe now'}
            </Button>
          </div>
        )}
      </SettingsCard>

      {/* ── Credit bundles ── */}
      {isActive && (
        <CreditBundleCard
          bonusCreditsAvailable={(billing.bonus_credits_purchased || 0) - (billing.bonus_credits_used || 0)}
        />
      )}

      {/* ── Billing history ── */}
      <SettingsCard
        title="Billing history"
        description="Past invoices and receipts."
      >
        {isInvoicesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="font-inter text-[12px] text-[#8B8F9E] py-4 text-center">
            No invoices yet. Your first invoice will appear after your trial converts.
          </p>
        ) : (
          <InvoiceHistoryTable invoices={invoices} />
        )}
      </SettingsCard>
    </div>
  )
}
