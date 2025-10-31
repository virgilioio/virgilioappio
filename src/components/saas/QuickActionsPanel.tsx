import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, CreditCard, UserPlus, Calendar, Ban, RotateCcw } from 'lucide-react'
import { SaaSCustomerDetail } from '@/hooks/useSaaSCustomer'

interface QuickActionsPanelProps {
  customer: SaaSCustomerDetail
  onExtendTrial: () => void
  onChangePlan: () => void
  onSuspend: () => void
  onRestore: () => void
}

export function QuickActionsPanel({
  customer,
  onExtendTrial,
  onChangePlan,
  onSuspend,
  onRestore,
}: QuickActionsPanelProps) {
  const openStripePortal = () => {
    if (customer.billing_id) {
      window.open(`https://dashboard.stripe.com/customers/${customer.billing_id}`, '_blank')
    }
  }

  return (
    <Card className="shadow-calendly border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
          Quick Actions<span className="text-virgilio-purple">.</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="gap-2 justify-start border-virgilio-border hover:border-virgilio-purple/30 transition-all"
            onClick={onChangePlan}
          >
            <CreditCard className="h-4 w-4" />
            Change Plan
          </Button>
          
          <Button 
            variant="outline" 
            className="gap-2 justify-start border-virgilio-border hover:border-virgilio-purple/30 transition-all"
            onClick={onExtendTrial}
          >
            <Calendar className="h-4 w-4" />
            Extend Trial
          </Button>
          
          {customer.billing_id && (
            <Button 
              variant="outline" 
              className="gap-2 justify-start border-virgilio-border hover:border-virgilio-purple/30 transition-all"
              onClick={openStripePortal}
            >
              <ExternalLink className="h-4 w-4" />
              View in Stripe
            </Button>
          )}
          
          {customer.status === 'suspended' ? (
            <Button 
              variant="outline" 
              className="gap-2 justify-start border-virgilio-border hover:border-virgilio-success/30 transition-all text-virgilio-success"
              onClick={onRestore}
            >
              <RotateCcw className="h-4 w-4" />
              Restore Account
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="gap-2 justify-start border-virgilio-border hover:border-virgilio-error/30 transition-all text-virgilio-error"
              onClick={onSuspend}
            >
              <Ban className="h-4 w-4" />
              Suspend Account
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
