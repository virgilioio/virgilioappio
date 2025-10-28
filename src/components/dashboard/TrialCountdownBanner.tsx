import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Clock, CreditCard } from 'lucide-react'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useCreateCheckout } from '@/hooks/useBillingPortal'
import { useAuth } from '@/contexts/AuthContext'
import { useStripePricing } from '@/hooks/useStripePricing'
import { formatPrice } from '@/utils/pricing'

export function TrialCountdownBanner() {
  const { data: billing, isLoading } = useBillingStatus()
  const createCheckout = useCreateCheckout()
  const { userType } = useAuth()
  const { data: pricing, isLoading: isPricingLoading } = useStripePricing()

  // Don't show for platform admins
  if (userType === 'platform_admin') return null
  if (isLoading || !billing) return null
  if (billing.billing_status !== 'trialing') return null
  if (!billing.days_until_trial_end) return null

  // Show warning when <= 3 days remaining
  const showWarning = billing.days_until_trial_end <= 3
  const variant = showWarning ? 'destructive' : 'default'

  return (
    <Alert variant={variant} className="mb-6">
      <Clock className="h-4 w-4" />
      <div className="flex items-center justify-between flex-1">
        <div>
          <AlertTitle className="mb-1">
            {billing.days_until_trial_end === 0 
              ? `Trial ends today (${billing.hours_until_trial_end}h remaining)`
              : `${billing.days_until_trial_end} days left in your trial`}
          </AlertTitle>
          <AlertDescription>
            Subscribe now to avoid interruption. Just {isPricingLoading ? 'loading...' : formatPrice(pricing?.monthly?.amount || 1000)}/month per recruiter seat.
          </AlertDescription>
        </div>
        <Button
          variant={showWarning ? 'default' : 'secondary'}
          size="sm"
          onClick={() => createCheckout.mutate({ interval: 'month' })}
          disabled={createCheckout.isPending}
          className="ml-4 shrink-0"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Subscribe Now
        </Button>
      </div>
    </Alert>
  )
}
