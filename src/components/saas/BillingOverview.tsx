import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ExternalLink, CreditCard, Calendar, DollarSign, Users, AlertTriangle, Clock } from 'lucide-react'
import { SaaSCustomerDetail } from '@/hooks/useSaaSCustomer'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

interface BillingOverviewProps {
  customer: SaaSCustomerDetail
}

export function BillingOverview({ customer }: BillingOverviewProps) {
  // Fetch full subscription data from tenant_subscriptions
  const { data: subscriptionData, isLoading } = useQuery({
    queryKey: ['tenant-subscription', customer.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', customer.tenant_id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!customer.tenant_id
  })

  const getTierBadgeVariant = (tier: string | null) => {
    switch (tier?.toLowerCase()) {
      case 'business': return 'default'
      case 'growth': return 'secondary'
      case 'launch': return 'outline'
      default: return 'outline'
    }
  }

  const getBillingStatusVariant = (status: string | null) => {
    switch (status) {
      case 'active': return 'default'
      case 'trialing': return 'secondary'
      case 'past_due': return 'destructive'
      case 'locked':
      case 'suspended': return 'destructive'
      case 'canceled': return 'outline'
      case 'grace_period': return 'warning'
      default: return 'outline'
    }
  }

  const openStripePortal = () => {
    if (subscriptionData?.stripe_customer_id) {
      window.open(`https://dashboard.stripe.com/customers/${subscriptionData.stripe_customer_id}`, '_blank')
    }
  }

  const openStripeSubscription = () => {
    if (subscriptionData?.stripe_subscription_id) {
      window.open(`https://dashboard.stripe.com/subscriptions/${subscriptionData.stripe_subscription_id}`, '_blank')
    }
  }

  const formatTierName = (tier: string | null) => {
    if (!tier) return 'No Plan'
    const tierMap: Record<string, string> = {
      'launch': 'GoGio: Launch!',
      'growth': 'GoGio: Growth!',
      'business': 'GoGio: Business!'
    }
    return tierMap[tier.toLowerCase()] || tier
  }

  return (
    <div className="space-y-6">
      {/* Critical Alerts */}
      {subscriptionData?.billing_status === 'past_due' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Past Due</AlertTitle>
          <AlertDescription>
            This account has {subscriptionData.dunning_failed_payment_attempts || 0} failed payment attempt(s). 
            Immediate action required to prevent service disruption.
          </AlertDescription>
        </Alert>
      )}

      {subscriptionData?.cancel_at_period_end && (
        <Alert variant="warning">
          <Clock className="h-4 w-4" />
          <AlertTitle>Subscription Scheduled for Cancellation</AlertTitle>
          <AlertDescription>
            This subscription will be canceled at the end of the current billing period on{' '}
            {subscriptionData.current_period_end_at ? format(new Date(subscriptionData.current_period_end_at), 'MMMM d, yyyy') : 'N/A'}.
          </AlertDescription>
        </Alert>
      )}

      {/* Subscription Overview Card */}
      <Card className="shadow-calendly border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            Subscription Overview<span className="text-virgilio-purple">.</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-virgilio-muted">Loading subscription details...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-virgilio-muted mb-2">Subscription Tier</div>
                  <Badge variant={getTierBadgeVariant(subscriptionData?.subscription_tier)} className="text-base px-4 py-1.5">
                    {formatTierName(subscriptionData?.subscription_tier)}
                  </Badge>
                </div>
                
                <div>
                  <div className="text-sm text-virgilio-muted mb-2">Billing Interval</div>
                  <div className="text-base font-medium text-virgilio-text capitalize">
                    {subscriptionData?.billing_interval || 'Not set'}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-virgilio-muted mb-2">Billing Status</div>
                  <Badge variant={getBillingStatusVariant(subscriptionData?.billing_status)} className="text-base px-4 py-1.5">
                    {subscriptionData?.billing_status || 'Unknown'}
                  </Badge>
                </div>

                <div>
                  <div className="text-sm text-virgilio-muted mb-2">Subscription Status</div>
                  <div className="text-base font-medium text-virgilio-text capitalize">
                    {subscriptionData?.subscription_status || 'Not set'}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm text-virgilio-muted mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Seat Count
                  </div>
                  <div className="text-base font-medium text-virgilio-text">
                    {subscriptionData?.seat_quantity || 0} / {subscriptionData?.max_users || 'Unlimited'} seats
                  </div>
                </div>

                <div>
                  <div className="text-sm text-virgilio-muted mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Current Period
                  </div>
                  <div className="text-sm text-virgilio-text">
                    {subscriptionData?.current_period_start ? (
                      <>
                        {format(new Date(subscriptionData.current_period_start), 'MMM d, yyyy')} -{' '}
                        {subscriptionData.current_period_end_at 
                          ? format(new Date(subscriptionData.current_period_end_at), 'MMM d, yyyy')
                          : 'N/A'
                        }
                      </>
                    ) : (
                      'Not set'
                    )}
                  </div>
                </div>

                {subscriptionData?.billing_status === 'trialing' && (
                  <div>
                    <div className="text-sm text-virgilio-muted mb-2">Trial Period</div>
                    <div className="text-sm text-virgilio-text">
                      {subscriptionData.trial_started_at && (
                        <>Started: {format(new Date(subscriptionData.trial_started_at), 'MMM d, yyyy')}</>
                      )}
                      {subscriptionData.trial_ends_at && (
                        <><br />Ends: {format(new Date(subscriptionData.trial_ends_at), 'MMM d, yyyy')}</>
                      )}
                    </div>
                  </div>
                )}

                {customer?.suspended_at && (
                  <div>
                    <div className="text-sm text-virgilio-muted mb-2">Suspended</div>
                    <div className="text-sm text-virgilio-text">
                      {format(new Date(customer.suspended_at), 'MMM d, yyyy')}
                      {customer.suspended_reason && (
                        <div className="text-xs text-virgilio-muted mt-1">
                          Reason: {customer.suspended_reason}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {subscriptionData && (
            <div className="mt-6 pt-6 border-t border-virgilio-border space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-virgilio-muted mb-1 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Stripe Customer ID
                  </div>
                  <div className="text-xs font-mono text-virgilio-text break-all">
                    {subscriptionData.stripe_customer_id || 'Not set'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-virgilio-muted mb-1">Stripe Subscription ID</div>
                  <div className="text-xs font-mono text-virgilio-text break-all">
                    {subscriptionData.stripe_subscription_id || 'Not set'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {subscriptionData.stripe_customer_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-virgilio-border hover:border-virgilio-purple/30 transition-all"
                    onClick={openStripePortal}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Customer in Stripe
                  </Button>
                )}
                {subscriptionData.stripe_subscription_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-virgilio-border hover:border-virgilio-purple/30 transition-all"
                    onClick={openStripeSubscription}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Subscription in Stripe
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dunning Information */}
      {subscriptionData && subscriptionData.dunning_failed_payment_attempts > 0 && (
        <Card className="shadow-calendly border-destructive">
          <CardHeader>
            <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Payment Issues<span className="text-virgilio-purple">.</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-virgilio-muted mb-1">Failed Payment Attempts</div>
                <div className="text-2xl font-bold text-destructive">
                  {subscriptionData.dunning_failed_payment_attempts}
                </div>
              </div>
              {subscriptionData.last_payment_failed_at && (
                <div>
                  <div className="text-sm text-virgilio-muted mb-1">Last Failed Payment</div>
                  <div className="text-base font-medium text-virgilio-text">
                    {format(new Date(subscriptionData.last_payment_failed_at), 'MMMM d, yyyy h:mm a')}
                  </div>
                </div>
              )}
              <Alert variant="destructive">
                <AlertDescription>
                  Customer should update their payment method immediately to avoid service interruption.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
