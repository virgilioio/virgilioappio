import { useMemo } from 'react'
import { CreditCard, Mail, RotateCcw, Sparkles, Lock } from 'lucide-react'
import { GoGioLogo } from '@/components/GoGioLogo'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useCreateCheckout, useOpenBillingPortal } from '@/hooks/useBillingPortal'
import { useAuth } from '@/contexts/AuthContext'

// Data retention period (90 days) — change here if product defines a different policy.
export const DATA_RETENTION_DAYS = 90

const MONTHLY_PRICE_PER_SEAT = 99
const YEARLY_PRICE_PER_SEAT = 999
const SUPPORT_EMAIL = 'support@virgilio.tech'

type Mode = 'trial_ended' | 'payment_pending' | 'subscription_ended'

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

const addDays = (iso: string | null | undefined, days: number) => {
  if (!iso) return null
  const dt = new Date(iso)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString()
}

interface LockedScreenProps {
  status: 'locked' | 'past_due' | 'canceled' | string
}

export function LockedScreen({ status }: LockedScreenProps) {
  const { data: billing } = useBillingStatus()
  const { logout } = useAuth()
  const createCheckout = useCreateCheckout()
  const openPortal = useOpenBillingPortal()

  const mode: Mode = useMemo(() => {
    if (status === 'past_due') return 'payment_pending'
    if (status === 'canceled') return 'subscription_ended'
    return 'trial_ended'
  }, [status])

  const seats = billing?.seat_quantity || 1
  const interval = billing?.billing_interval || 'month'
  const cycleLabel = interval === 'year' ? 'Annual' : 'Monthly'
  const monthlyTotal = MONTHLY_PRICE_PER_SEAT * seats
  const yearlyTotal = YEARLY_PRICE_PER_SEAT * seats

  const trialEnd = billing?.trial_ends_at
  const subEnd = billing?.subscription_end
  const dataKeptUntil = addDays(subEnd, DATA_RETENTION_DAYS)

  // ---- per-mode content ----
  const content = {
    trial_ended: {
      kicker: 'Workspace paused',
      title: 'Your trial has ended',
      sub: (
        <>
          Your 14-day trial wrapped up on <b className="font-semibold text-[#0d0d09]">{fmtDate(trialEnd)}</b>. Everything is saved exactly as you left it — every job, every candidate, every note — and it unlocks the moment you subscribe.
        </>
      ),
      plan: {
        name: `Gio ATS · ${seats} seat${seats === 1 ? '' : 's'}`,
        note: 'Cancel anytime',
        price: `$${monthlyTotal}`,
        cycle: '/mo',
      },
      ctaIcon: <CreditCard size={14} strokeWidth={2.25} />,
      ctaLabel: 'Subscribe to continue',
      ctaAction: () => createCheckout.mutate({ interval: 'month' }),
      ctaPending: createCheckout.isPending,
      footer: `Trial ended ${fmtDate(trialEnd)} · your data is safe`,
      pausedPill: 'Paused — saved exactly as you left it',
    },
    payment_pending: {
      kicker: 'Payment issue',
      title: 'Let’s fix your payment',
      sub: (
        <>
          The renewal charge on your <b className="font-semibold text-[#0d0d09]">card on file</b> didn’t go through. Update the card and you’re right back in — nothing has been lost or changed.
        </>
      ),
      plan: {
        name: `Gio ATS · ${seats} seat${seats === 1 ? '' : 's'} · ${cycleLabel}`,
        note: `Renewal due ${fmtDate(subEnd)}`,
        price: interval === 'year' ? `$${yearlyTotal}` : `$${monthlyTotal}`,
        cycle: interval === 'year' ? '/yr' : '/mo',
      },
      ctaIcon: <CreditCard size={14} strokeWidth={2.25} />,
      ctaLabel: 'Update payment method',
      ctaAction: () => openPortal.mutate(),
      ctaPending: openPortal.isPending,
      footer: `Charge failed ${fmtDate(subEnd)} · we’ll retry automatically`,
      pausedPill: 'Paused — nothing has been lost',
    },
    subscription_ended: {
      kicker: 'Subscription ended',
      title: 'Pick up where you left off',
      sub: (
        <>
          Your subscription ended on <b className="font-semibold text-[#0d0d09]">{fmtDate(subEnd)}</b>. We keep your whole workspace — jobs, candidates, notes, scorecards — for <b className="font-semibold text-[#0d0d09]">{DATA_RETENTION_DAYS} days</b>, so restarting puts you right back where you stopped.
        </>
      ),
      plan: {
        name: `Gio ATS · ${seats} seat${seats === 1 ? '' : 's'}`,
        note: 'Restart monthly or annual',
        price: `$${MONTHLY_PRICE_PER_SEAT}`,
        cycle: '/seat·mo',
      },
      ctaIcon: <RotateCcw size={14} strokeWidth={2.25} />,
      ctaLabel: 'Restart subscription',
      ctaAction: () => createCheckout.mutate({ interval: 'month' }),
      ctaPending: createCheckout.isPending,
      footer: `Ended ${fmtDate(subEnd)} · data kept until ${fmtDate(dataKeptUntil)}`,
      pausedPill: `Saved for ${DATA_RETENTION_DAYS} days — restart anytime`,
    },
  }[mode]

  return (
    <div
      className="fixed inset-0 z-[100] flex overflow-hidden"
      style={{ background: '#fffcf9', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* LEFT COLUMN */}
      <div
        className="flex flex-col w-full lg:w-[520px] lg:flex-shrink-0"
        style={{ padding: '26px 48px 32px' }}
      >
        <div className="flex items-center">
          <GoGioLogo size="2xl" />
        </div>

        <div className="flex-1 flex flex-col justify-center" style={{ paddingBottom: 30 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.09em',
              color: '#8B8F9E',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            {content.kicker}
          </div>

          <h1
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: '-0.04em',
              color: '#0d0d09',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {content.title}
            <span style={{ color: '#D7C5FB' }}>.</span>
          </h1>

          <p
            style={{
              fontSize: 13.5,
              color: '#5A6072',
              lineHeight: 1.55,
              maxWidth: 380,
              marginTop: 12,
            }}
          >
            {content.sub}
          </p>

          {/* Plan card */}
          <div
            style={{
              marginTop: 22,
              maxWidth: 380,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: '#F6F5F1',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: '#EDE4FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={13} color="#6F3FF5" strokeWidth={2.25} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1F2230' }}>{content.plan.name}</div>
              <div style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 1 }}>{content.plan.note}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 17, fontWeight: 600, color: '#0d0d09' }}>
                {content.plan.price}
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#8B8F9E' }}>{content.plan.cycle}</span>
            </div>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              onClick={content.ctaAction}
              disabled={content.ctaPending}
              style={{
                height: 44,
                padding: '0 18px',
                borderRadius: 10,
                background: '#0d0d09',
                color: '#fffcf9',
                fontSize: 13.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                cursor: content.ctaPending ? 'wait' : 'pointer',
                opacity: content.ctaPending ? 0.7 : 1,
              }}
            >
              {content.ctaIcon}
              {content.ctaPending ? 'Loading…' : content.ctaLabel}
            </button>
            <button
              onClick={() => (window.location.href = `mailto:${SUPPORT_EMAIL}`)}
              style={{
                height: 44,
                padding: '0 16px',
                borderRadius: 10,
                background: '#ffffff',
                border: '1px solid #E7E8EE',
                color: '#5A6072',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
              }}
            >
              <Mail size={13} strokeWidth={2.25} />
              Contact support
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={11} color="#B5B9C4" strokeWidth={2.25} />
          <span style={{ flex: 1, fontSize: 10.5, color: '#8B8F9E' }}>{content.footer}</span>
          <button
            onClick={() => logout()}
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: '#6F3FF5',
              whiteSpace: 'nowrap',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        className="hidden lg:flex flex-1 relative items-center justify-center"
        style={{
          margin: '20px 20px 20px 0',
          borderRadius: 20,
          background: '#F6F5F1',
          border: '1px solid #ECEAE2',
        }}
      >
        {/* Paused pill */}
        <div
          style={{
            position: 'absolute',
            top: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ffffff',
            borderRadius: 999,
            border: '1px solid #E7E8EE',
            padding: '7px 14px',
            boxShadow: '0 12px 28px -16px rgba(13,13,9,0.22)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Lock size={12} color="#6F3FF5" strokeWidth={2.25} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1F2230' }}>{content.pausedPill}</span>
        </div>

        <FrozenWorkspacePreview />
      </div>
    </div>
  )
}

function FrozenWorkspacePreview() {
  const stages = [
    { name: 'Sourced', count: 12, dot: '#ADB2BD' },
    { name: 'Screen', count: 6, dot: '#C9B8FB' },
    { name: 'Interview', count: 3, dot: '#A98BFA' },
    { name: 'Offer', count: 1, dot: '#6F3FF5' },
  ]
  const waiting = [
    { name: 'Sofia Romano', status: 'Interview · Thu 11:00', match: '92%' },
    { name: 'Daniel Park', status: 'Awaiting scorecard', match: '88%' },
    { name: 'Mateo Lopez', status: 'Reply pending · 2d', match: '84%' },
  ]

  return (
    <div
      style={{
        width: 380,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        pointerEvents: 'none',
      }}
    >
      {/* Pipeline card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #E7E8EE',
          padding: '14px 16px',
          boxShadow: '0 24px 48px -28px rgba(13,13,9,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, fontWeight: 600, color: '#0d0d09' }}>
            Senior Product Designer
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: '#0E7A4B',
              background: '#E2F4EA',
              padding: '2px 7px',
              borderRadius: 999,
            }}
          >
            Open
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8B8F9E' }}>22 candidates</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {stages.map((s) => (
            <div key={s.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: s.dot, display: 'inline-block' }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: '#5A6072' }}>{s.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, color: '#8B8F9E' }}>{s.count}</span>
              </div>
              <div
                style={{
                  borderRadius: 7,
                  background: '#FAFAF7',
                  border: '1px dashed #E7E8EE',
                  padding: 5,
                  minHeight: 54,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ background: '#fff', border: '1px solid #EFEEE8', borderRadius: 5, height: 14 }} />
                {s.count > 1 && (
                  <div style={{ background: '#fff', border: '1px solid #EFEEE8', borderRadius: 5, height: 14 }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Waiting for you card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #E7E8EE',
          padding: '13px 16px',
          boxShadow: '0 24px 48px -28px rgba(13,13,9,0.18)',
        }}
      >
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, fontWeight: 600, color: '#0d0d09', marginBottom: 10 }}>
          Waiting for you
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {waiting.map((w) => (
            <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: '#EDE4FF',
                  color: '#6F3FF5',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {w.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1F2230' }}>{w.name}</div>
                <div style={{ fontSize: 9.5, color: '#8B8F9E' }}>{w.status}</div>
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: '#6F3FF5',
                  background: '#EDE4FF',
                  borderRadius: 999,
                  padding: '3px 8px',
                }}
              >
                {w.match}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
