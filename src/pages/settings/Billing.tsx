import { format } from 'date-fns'
import { useMemo } from 'react'
import {
  AlertTriangle, CreditCard, ExternalLink, Clock, Sparkles, ShieldCheck,
  Briefcase, Users, Calendar, Download, ArrowRight,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from 'react-router-dom'
import { SpecCard } from '@/components/settings/shared/SpecCard'
import { SpecChip } from '@/components/settings/shared/SpecChip'
import { MetricStrip, type MetricItem } from '@/components/ui/metric-strip'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useOpenBillingPortal, useCreateCheckout } from '@/hooks/useBillingPortal'
import { useInvoiceHistory } from '@/hooks/useInvoiceHistory'
import { useStripePricing } from '@/hooks/useStripePricing'
import { useCreateCreditPurchase } from '@/hooks/useCreateCreditPurchase'
import { useMembers } from '@/hooks/useMembers'
import { useRecruiterUserIds } from '@/hooks/useRecruiterUserIds'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { formatPrice } from '@/utils/pricing'

function NoirButton({ children, onClick, disabled, icon: Icon, size = 'md' }: any) {
  const h = size === 'sm' ? 27 : 32
  const fs = size === 'sm' ? 11.5 : 12
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1.5 font-inter font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      style={{ background: '#0d0d09', color: '#fffcf9', height: h, padding: '0 12px', fontSize: fs }}
    >
      {Icon && <Icon size={13} strokeWidth={2} />} {children}
    </button>
  )
}
function SecondaryButton({ children, onClick, disabled, icon: Icon, size = 'md' }: any) {
  const h = size === 'sm' ? 27 : 32
  const fs = size === 'sm' ? 11.5 : 12
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1.5 font-inter font-semibold rounded-lg bg-white hover:bg-[#FAFAF7] transition-colors disabled:opacity-50"
      style={{ border: '1px solid #E7E8EE', color: '#5A6072', height: h, padding: '0 12px', fontSize: fs }}
    >
      {Icon && <Icon size={13} strokeWidth={2} />} {children}
    </button>
  )
}

function useSeatCounts() {
  const { members } = useMembers()
  const { recruiterUserIds } = useRecruiterUserIds()
  const { organizationId } = useAuth()
  const { organizations } = useOrganizations()
  const currentOrg = organizations.find((o) => o.id === organizationId)
  const parentOrgId = currentOrg?.parent_organization_id || organizationId
  return useMemo(() => {
    const orgMembers = members.filter(
      (m) => (!parentOrgId || m.organization_id === parentOrgId) && m.user_status === 'active'
    )
    const isBillable = (m: any) =>
      m.system_role === 'admin' || m.system_role === 'sales' ||
      m.user_type === 'workspace_owner' || (m.user_id && recruiterUserIds.has(m.user_id))
    const paid = orgMembers.filter(isBillable).length
    return { paidCount: paid, freeCount: orgMembers.length - paid }
  }, [members, recruiterUserIds, parentOrgId])
}

export function Billing() {
  const { data: billing, isLoading } = useBillingStatus()
  const openPortal = useOpenBillingPortal()
  const createCheckout = useCreateCheckout()
  const { data: invoices = [], isLoading: isInvoicesLoading } = useInvoiceHistory()
  const { data: pricing } = useStripePricing()
  const { mutate: purchaseCredits, isPending: isPurchasing } = useCreateCreditPurchase()
  const { paidCount, freeCount } = useSeatCounts()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[60px] w-full rounded-[12px]" />
        <Skeleton className="h-[220px] w-full rounded-[12px]" />
      </div>
    )
  }

  if (!billing) {
    return (
      <SpecCard title="Billing">
        <div className="font-inter text-[12px] text-[#8B8F9E] text-center" style={{ padding: '24px 18px' }}>
          Billing information not available. Contact support if you believe this is an error.
        </div>
      </SpecCard>
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

  const creditsPerSeat = billing.billing_interval === 'year' ? 120 : 100
  const seatQty = billing.seat_quantity || Math.max(paidCount, 1)
  const totalCredits = seatQty * creditsPerSeat
  const nextBillingDate = isTrialing && billing.trial_ends_at
    ? format(new Date(billing.trial_ends_at), 'MMM d, yyyy')
    : billing.subscription_end ? format(new Date(billing.subscription_end), 'MMM d, yyyy') : '—'

  const paidTotal = paidCount + freeCount || 1
  const paidPct = (paidCount / paidTotal) * 100
  const freePct = 100 - paidPct

  const bundles = pricing?.creditBundles || [
    { id: 'b500', credits: 500, amount: 4900, currency: 'usd' },
    { id: 'b1500', credits: 1500, amount: 12900, currency: 'usd', savings: 'Save 12%' },
    { id: 'b5000', credits: 5000, amount: 34900, currency: 'usd', savings: 'Save 29%' },
  ]

  return (
    <div>
      {/* Alert banners */}
      {isPendingTrial && (
        <Alert className="mb-[14px]">
          <CreditCard className="h-4 w-4" />
          <AlertTitle>Start your 14-day free trial</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Add a payment method to start your trial. You won't be charged until it ends.</span>
            <Button size="sm" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>Start free trial</Button>
          </AlertDescription>
        </Alert>
      )}
      {showTrialWarning && (
        <Alert variant="warning" className="mb-[14px]">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Trial ending soon</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Your trial ends in {billing.days_until_trial_end} {billing.days_until_trial_end === 1 ? 'day' : 'days'}.</span>
            <Button size="sm" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>Subscribe now</Button>
          </AlertDescription>
        </Alert>
      )}
      {isLocked && (
        <Alert variant="destructive" className="mb-[14px]">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access locked</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Your trial has expired. Subscribe to continue using Gio.</span>
            <Button size="sm" variant="dangerSolid" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>Subscribe now</Button>
          </AlertDescription>
        </Alert>
      )}
      {isPastDue && (
        <Alert variant="warning" className="mb-[14px]">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment overdue</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Update your payment method to restore access.</span>
            <Button size="sm" variant="secondary" onClick={() => openPortal.mutate()} disabled={openPortal.isPending}>Update payment</Button>
          </AlertDescription>
        </Alert>
      )}
      {isGracePeriod && (
        <Alert variant="destructive" className="mb-[14px]">
          <Clock className="h-4 w-4" />
          <AlertTitle>Grace period active</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{billing.days_until_lockout} {billing.days_until_lockout === 1 ? 'day' : 'days'} remaining before access is locked.</span>
            <Button size="sm" variant="dangerSolid" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>Subscribe now</Button>
          </AlertDescription>
        </Alert>
      )}
      {isCanceled && (
        <Alert className="mb-[14px]">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Subscription canceled</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{billing.subscription_end ? <>Access ends on {format(new Date(billing.subscription_end), 'MMM d, yyyy')}.</> : 'Subscription canceled.'}</span>
            <Button size="sm" onClick={() => createCheckout.mutate({ interval: 'month' })} disabled={createCheckout.isPending}>Reactivate</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Metric strip */}
      <div className="mb-[14px]">
        <MetricStrip
          items={[
            { icon: Briefcase, tone: 'purple', label: 'Plan', value: isPendingTrial ? 'Pending' : isTrialing ? 'Trial' : 'Gio ATS' },
            { icon: Users, tone: 'green', label: 'Paid seats', value: seatQty },
            { icon: Sparkles, tone: 'yellow', label: 'Credits / month', value: totalCredits },
            { icon: Calendar, tone: 'blue', label: 'Next billing', value: nextBillingDate },
          ] satisfies MetricItem[]}
        />
      </div>

      {/* Your plan */}
      <SpecCard
        title="Your plan"
        description="Gio ATS · per-seat pricing · $999/seat/year, billed annually."
        action={<SpecChip tone="green">Active</SpecChip>}
      >
        <div style={{ padding: '14px 18px' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-inter font-semibold text-[#1F2230]" style={{ fontSize: 12 }}>Team seats</span>
            <span className="font-inter text-[#8B8F9E]" style={{ fontSize: 11.5 }}>{paidCount} paid · {freeCount} free collaborators</span>
          </div>
          {/* Split bar */}
          <div className="flex items-stretch w-full" style={{ height: 8, gap: 2 }}>
            <div style={{ width: `${paidPct}%`, background: '#6F3FF5', borderRadius: 999 }} />
            <div style={{ width: `${freePct}%`, background: '#D7C5FB', borderRadius: 999 }} />
          </div>
          {/* Legend */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-3.5 font-inter text-[#5A6072]" style={{ fontSize: 11 }}>
              <span className="inline-flex items-center gap-1.5">
                <span style={{ width: 7, height: 7, borderRadius: 999, background: '#6F3FF5' }} />
                Paid — admins & recruiters
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span style={{ width: 7, height: 7, borderRadius: 999, background: '#D7C5FB' }} />
                Free — hiring managers & interviewers
              </span>
            </div>
            <Link to="/settings?tab=members" className="inline-flex items-center gap-1 font-inter font-medium" style={{ color: '#6F3FF5', fontSize: 11.5 }}>
              View team <ArrowRight size={11} />
            </Link>
          </div>
          {/* Info row */}
          <div
            className="flex items-center gap-2 mt-3"
            style={{ background: '#F6F5F1', borderRadius: 9, padding: '9px 12px' }}
          >
            <Sparkles size={13} style={{ color: '#6F3FF5' }} />
            <span className="font-inter text-[#5A6072]" style={{ fontSize: 11.5 }}>
              {totalCredits} enrichment credits/month — {creditsPerSeat} per seat{billing.billing_interval === 'year' ? ' + annual bonus' : ''}. Unused credits roll over while the subscription is active.
            </span>
          </div>
        </div>
      </SpecCard>

      {/* Payment method */}
      <SpecCard
        title="Payment method"
        description="Managed securely via Stripe — Gio never stores card details."
        action={
          (isActive || isPastDue) && billing.stripe_subscription_id ? (
            <div className="flex gap-2">
              <SecondaryButton size="sm" icon={CreditCard} onClick={() => openPortal.mutate()} disabled={openPortal.isPending}>Manage</SecondaryButton>
              <SecondaryButton size="sm" icon={ExternalLink} onClick={() => openPortal.mutate()} disabled={openPortal.isPending}>Stripe dashboard</SecondaryButton>
            </div>
          ) : undefined
        }
      >
        {isActive || isPastDue ? (
          <div className="flex items-center gap-3" style={{ padding: '12px 18px' }}>
            <div className="shrink-0 inline-flex items-center justify-center" style={{ width: 32, height: 32, background: '#F6F5F1', borderRadius: 8 }}>
              <ShieldCheck size={15} style={{ color: '#12B886' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-inter font-semibold text-[#1F2230]" style={{ fontSize: 12.5, lineHeight: 1.3 }}>Stripe connected</div>
              <div className="font-inter text-[#8B8F9E]" style={{ fontSize: 11, lineHeight: 1.3 }}>Visa ·· 4242 · next charge on renewal</div>
            </div>
            <SpecChip tone="green">Verified</SpecChip>
          </div>
        ) : (
          <div className="font-inter text-[#8B8F9E] text-center" style={{ padding: '20px 18px', fontSize: 12 }}>
            No payment method on file.
          </div>
        )}
      </SpecCard>

      {/* Credit bundles */}
      {isActive && (
        <SpecCard
          title="Credit bundles"
          description="One-time add-ons for enrichment. Never expire while your subscription is active."
        >
          <div className="grid grid-cols-1 md:grid-cols-3">
            {bundles.map((b, i) => {
              const isPopular = b.credits === 1500
              const pricePerCredit = (b.amount / 100 / b.credits).toFixed(2)
              return (
                <div
                  key={b.id}
                  style={{
                    padding: '16px 18px',
                    background: isPopular ? '#FBFAFF' : '#FFFFFF',
                    borderLeft: i > 0 ? '1px solid #F1F0EC' : 'none',
                  }}
                  className="flex flex-col gap-2.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-poppins font-semibold text-[#0d0d09]" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
                      {b.credits.toLocaleString()}
                    </span>
                    <span className="font-inter text-[#8B8F9E]" style={{ fontSize: 11, fontWeight: 500 }}>credits</span>
                    {isPopular && <SpecChip tone="purple">Most popular</SpecChip>}
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-poppins font-semibold text-[#0d0d09]" style={{ fontSize: 15 }}>
                      {formatPrice(b.amount, b.currency)}
                    </span>
                    <span className="font-inter text-[#8B8F9E]" style={{ fontSize: 10.5 }}>${pricePerCredit}/credit</span>
                    {b.savings && (
                      <span className="font-inter" style={{ fontSize: 10, fontWeight: 600, color: '#12B886' }}>{b.savings}</span>
                    )}
                  </div>
                  {isPopular ? (
                    <NoirButton size="sm" onClick={() => purchaseCredits({ bundleSize: String(b.credits) as any })} disabled={isPurchasing}>Buy now</NoirButton>
                  ) : (
                    <SecondaryButton size="sm" onClick={() => purchaseCredits({ bundleSize: String(b.credits) as any })} disabled={isPurchasing}>Buy now</SecondaryButton>
                  )}
                </div>
              )
            })}
          </div>
        </SpecCard>
      )}

      {/* Billing history */}
      <SpecCard title="Billing history" description="Invoices appear here after your first payment.">
        {isInvoicesLoading ? (
          <div className="font-inter text-[12px] text-[#8B8F9E]" style={{ padding: '18px' }}>Loading…</div>
        ) : invoices.length === 0 ? (
          <div className="font-inter text-center text-[#8B8F9E]" style={{ padding: '20px 18px', fontSize: 12 }}>No invoices yet.</div>
        ) : (
          invoices.map((inv, idx) => (
            <div
              key={inv.id}
              className="flex items-center gap-4"
              style={{
                padding: '10px 18px',
                borderBottom: idx === invoices.length - 1 ? 'none' : '1px solid #F1F0EC',
              }}
            >
              <div className="font-inter text-[#1F2230] flex-1 min-w-0" style={{ fontSize: 12 }}>
                {format(new Date(inv.created), 'MMM d, yyyy')}
              </div>
              <div className="font-poppins font-semibold tabular-nums text-[#1F2230]" style={{ fontSize: 12.5 }}>
                {formatPrice(inv.amount, inv.currency)}
              </div>
              <SpecChip tone={inv.status === 'paid' ? 'green' : inv.status === 'open' ? 'amber' : 'gray'}>
                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
              </SpecChip>
              {inv.pdfUrl ? (
                <button
                  type="button"
                  onClick={() => window.open(inv.pdfUrl!, '_blank')}
                  aria-label="Download invoice"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[#8B8F9E] hover:text-[#0d0d09] hover:bg-[#F1F0EC]"
                >
                  <Download size={13} />
                </button>
              ) : <span style={{ width: 24 }} />}
            </div>
          ))
        )}
      </SpecCard>
    </div>
  )
}
