import { Shield, AlertTriangle, X, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useOpenBillingPortal } from '@/hooks/useBillingPortal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Stackable context bands rendered directly under the top Header.
 * Priority (top → bottom): Impersonation → Trial / Billing.
 * Each band is dismissible; dismissal persists for the session.
 */

const DISMISS_KEY = 'header-context-bands-dismissed'

function useDismissed() {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed))
  }, [dismissed])

  return {
    isDismissed: (key: string) => !!dismissed[key],
    dismiss: (key: string) => setDismissed((d) => ({ ...d, [key]: true })),
  }
}

export function HeaderContextBands() {
  const { userType } = useAuth()
  const { data: billing } = useBillingStatus()
  const { isDismissed, dismiss } = useDismissed()
  const openPortal = useOpenBillingPortal()

  const isPlatformAdmin = userType === 'platform_admin'

  const trialing = billing?.billing_status === 'trialing'
  const gracePeriod = billing?.billing_status === 'grace_period'
  const pastDue = billing?.billing_status === 'past_due'
  const fraudReview = billing?.billing_status === 'fraud_review'

  const showAdmin = isPlatformAdmin && !isDismissed('admin')
  // past_due and fraud_review are not dismissible.
  const showBilling = (trialing || gracePeriod) ? !isDismissed('billing') : (pastDue || fraudReview)

  if (!showAdmin && !showBilling) return null

  return (
    <div className="hidden sm:flex flex-col gap-2 fixed top-[3.75rem] left-[5.5rem] right-3 z-40 pointer-events-none">
      {showAdmin && (
        <Band tone="lilac" onDismiss={() => dismiss('admin')} className="pointer-events-auto">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span className="font-poppins font-medium text-[12.5px] tracking-[-0.01em]">
            Platform Admin
          </span>
          <span className="text-[12px] text-virgilio-purple/80 hidden md:inline">
            Viewing data across all organizations
          </span>
        </Band>
      )}

      {showBilling && (
        <Band
          tone="amber"
          onDismiss={(pastDue || fraudReview) ? undefined : () => dismiss('billing')}
          className="pointer-events-auto"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#B86E00]" />
          <span className="font-poppins font-medium text-[12.5px] tracking-[-0.01em] text-[#5c3a00]">
            {trialing && billing?.days_until_trial_end != null && (
              <>
                {billing.days_until_trial_end > 0
                  ? `${billing.days_until_trial_end} day${billing.days_until_trial_end === 1 ? '' : 's'} left in your trial`
                  : 'Your trial ends today'}
              </>
            )}
            {gracePeriod && (
              <>Trial ended — {billing?.days_until_lockout ?? 0} days until lockout</>
            )}
            {pastDue && <>Payment past due — update your payment method to keep access</>}
            {fraudReview && <>Account under fraud review — contact support to restore access</>}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {fraudReview ? (
              <Button variant="purple" size="xs" asChild>
                <a href="mailto:support@gio.app">Contact support</a>
              </Button>
            ) : pastDue ? (
              <Button
                variant="purple"
                size="xs"
                onClick={() => openPortal.mutate()}
                disabled={openPortal.isPending}
              >
                {openPortal.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Update payment method
              </Button>
            ) : (
              <Button variant="purple" size="xs" asChild>
                <Link to="/settings?tab=subscription">Upgrade</Link>
              </Button>
            )}
          </div>
        </Band>
      )}
    </div>
  )
}

function Band({
  children,
  tone,
  className,
  onDismiss,
}: {
  children: React.ReactNode
  tone: 'lilac' | 'amber'
  className?: string
  onDismiss?: () => void
}) {
  const styles =
    tone === 'lilac'
      ? 'bg-[#F3EEFF] text-virgilio-purple ring-1 ring-virgilio-purple/15'
      : 'bg-[#FFF6D6] text-[#5c3a00] ring-1 ring-[#E0A23A]/30 border-l-4 border-l-[#E0A23A]'

  const dismissHover =
    tone === 'lilac'
      ? 'hover:bg-virgilio-purple/10 text-virgilio-purple/70 hover:text-virgilio-purple'
      : 'hover:bg-[#E0A23A]/15 text-[#5c3a00]/70 hover:text-[#5c3a00]'

  return (
    <div
      className={cn(
        'h-9 rounded-xl pl-3 pr-1.5 flex items-center gap-2 shadow-sm',
        styles,
        className,
      )}
    >
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'ml-1 h-6 w-6 rounded-md inline-flex items-center justify-center shrink-0 transition-colors',
            dismissHover,
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
