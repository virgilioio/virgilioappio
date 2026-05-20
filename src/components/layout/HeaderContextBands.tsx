import { Shield, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Stackable context bands rendered directly under the top Header.
 * Priority (top → bottom): Impersonation → Trial / Billing.
 *
 * Bands sit inside the same horizontal inset as the header
 * (left-[5.5rem] right-3) so they visually align with the bar.
 */
export function HeaderContextBands() {
  const { userType } = useAuth()
  const { data: billing } = useBillingStatus()

  const isPlatformAdmin = userType === 'platform_admin'

  const trialing = billing?.billing_status === 'trialing'
  const gracePeriod = billing?.billing_status === 'grace_period'
  const pastDue = billing?.billing_status === 'past_due'

  const showBilling = trialing || gracePeriod || pastDue

  if (!isPlatformAdmin && !showBilling) return null

  return (
    <div className="hidden sm:flex flex-col gap-2 fixed top-[3.75rem] left-[5.5rem] right-3 z-40 pointer-events-none">
      {isPlatformAdmin && (
        <Band tone="lilac" className="pointer-events-auto">
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
        <Band tone="amber" className="pointer-events-auto">
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
            {pastDue && <>Payment past due — update your billing to keep access</>}
          </span>
          <div className="ml-auto">
            <Button variant="purple" size="xs" asChild>
              <Link to="/settings?tab=subscription">Upgrade</Link>
            </Button>
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
}: {
  children: React.ReactNode
  tone: 'lilac' | 'amber'
  className?: string
}) {
  const styles =
    tone === 'lilac'
      ? 'bg-[#F3EEFF] text-virgilio-purple ring-1 ring-virgilio-purple/15'
      : 'bg-[#FFF6D6] text-[#5c3a00] ring-1 ring-[#E0A23A]/30 border-l-4 border-l-[#E0A23A]'

  return (
    <div
      className={cn(
        'h-9 rounded-xl px-3 flex items-center gap-2 shadow-sm',
        styles,
        className,
      )}
    >
      {children}
    </div>
  )
}
