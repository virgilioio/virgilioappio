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
  
  // Show for both trialing and grace_period status
  const isTrialing = billing.billing_status === 'trialing'
  const isGracePeriod = billing.billing_status === 'grace_period'
  
  if (!isTrialing && !isGracePeriod) return null
  if (!billing.days_until_trial_end && !billing.days_until_lockout) return null

  // Determine urgency and variant
  let variant: 'default' | 'warning' | 'destructive' = 'default'
  let daysRemaining = 0
  let message = ''

  if (isGracePeriod && billing.days_until_lockout !== null) {
    // Grace period - always urgent
    daysRemaining = billing.days_until_lockout
    variant = 'destructive'
    message = daysRemaining === 0 
      ? 'Access locks today!' 
      : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} until access is locked`
  } else if (isTrialing && billing.days_until_trial_end !== null) {
    daysRemaining = billing.days_until_trial_end
    
    // Show earlier warnings with graduated urgency
    if (daysRemaining <= 1) {
      variant = 'destructive'
      message = daysRemaining === 0 
        ? `Trial ends today (${billing.hours_until_trial_end}h remaining)` 
        : 'Trial ends tomorrow'
    } else if (daysRemaining <= 3) {
      variant = 'warning'
      message = `${daysRemaining} days left in your trial`
    } else if (daysRemaining <= 7) {
      variant = 'default'
      message = `${daysRemaining} days left in your trial`
    } else {
      return null // Don't show if more than 7 days
    }
  }

  return (
    <Alert variant={variant} className="mb-6">
      <Clock className="h-4 w-4" />
      <div className="flex items-center justify-between flex-1">
        <div>
          <AlertTitle className="mb-1">
            {isGracePeriod ? 'Grace Period Active' : 'Trial Active'}
          </AlertTitle>
          <AlertDescription>
            {message}
            {isGracePeriod && (
              <span className="block mt-1 font-medium">
                Subscribe now to restore full access.
              </span>
            )}
            {isTrialing && (
              <span className="block mt-1">
                Subscribe now to continue. Just {isPricingLoading ? 'loading...' : formatPrice(pricing?.monthly?.amount || 1000)}/month per recruiter seat.
              </span>
            )}
          </AlertDescription>
        </div>
        <Button
          variant={variant === 'destructive' ? 'default' : variant === 'warning' ? 'virgilio' : 'secondary'}
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
