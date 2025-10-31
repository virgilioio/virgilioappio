import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, CreditCard, Calendar, DollarSign } from 'lucide-react'
import { SaaSCustomerDetail } from '@/hooks/useSaaSCustomer'
import { format } from 'date-fns'

interface BillingOverviewProps {
  customer: SaaSCustomerDetail
}

export function BillingOverview({ customer }: BillingOverviewProps) {
  const getPlanVariant = (plan: string | null) => {
    switch (plan) {
      case 'enterprise': return 'default'
      case 'pro': return 'secondary'
      case 'starter': return 'outline'
      case 'trial': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'trialing': return 'secondary'
      case 'suspended': return 'destructive'
      case 'cancelled': return 'outline'
      default: return 'default'
    }
  }

  const openStripePortal = () => {
    if (customer.billing_id) {
      window.open(`https://dashboard.stripe.com/customers/${customer.billing_id}`, '_blank')
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card className="shadow-calendly border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            Current Plan<span className="text-virgilio-purple">.</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="text-sm text-virgilio-muted mb-2">Plan Type</div>
                <Badge variant={getPlanVariant(customer.plan_type)} className="text-base px-4 py-1.5">
                  {customer.plan_type || 'No Plan'}
                </Badge>
              </div>
              
              <div>
                <div className="text-sm text-virgilio-muted mb-2">Status</div>
                <Badge variant={getStatusVariant(customer.status)} className="text-base px-4 py-1.5">
                  {customer.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-virgilio-muted mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Next Renewal Date
                </div>
                <div className="text-base font-medium text-virgilio-text">
                  {customer.renewal_date ? (
                    format(new Date(customer.renewal_date), 'MMMM d, yyyy')
                  ) : (
                    'Not set'
                  )}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-virgilio-muted mb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing ID
                </div>
                <div className="text-sm font-mono text-virgilio-text">
                  {customer.billing_id || 'Not set'}
                </div>
              </div>
            </div>
          </div>

          {customer.billing_id && (
            <div className="mt-6 pt-6 border-t border-virgilio-border">
              <Button
                variant="outline"
                className="gap-2 border-virgilio-border hover:border-virgilio-purple/30 transition-all"
                onClick={openStripePortal}
              >
                <ExternalLink className="h-4 w-4" />
                Open Stripe Customer Portal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Information */}
      <Card className="shadow-calendly border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            Payment Information<span className="text-virgilio-purple">.</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-virgilio-muted">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="mb-2">Payment history and invoice details</p>
            <p className="text-sm">View detailed payment information in Stripe</p>
            {customer.billing_id && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2 border-virgilio-border hover:border-virgilio-purple/30"
                onClick={openStripePortal}
              >
                <ExternalLink className="h-4 w-4" />
                View in Stripe
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
