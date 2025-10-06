import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExternalLink, Users, Briefcase, Activity, Calendar, AlertTriangle, Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSaaSCustomer } from '@/hooks/useSaaSCustomer'
import { PageHeader } from '@/components/layout/PageHeader'
import { useOpenBillingPortal, useCreateCheckout } from '@/hooks/useBillingPortal'
import { format } from 'date-fns'

export function SaaSSubscription() {
  const { organizationId } = useAuth()
  const { data: customer, isLoading } = useSaaSCustomer(organizationId!)
  const openPortalMutation = useOpenBillingPortal()
  const createCheckoutMutation = useCreateCheckout()

  if (isLoading) {
    return <div className="text-center py-8">Loading subscription details...</div>
  }

  if (!customer) {
    return <div className="text-center py-8">Subscription information not available</div>
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

  const getPlanVariant = (plan: string | null) => {
    switch (plan) {
      case 'enterprise': return 'default'
      case 'pro': return 'secondary'
      case 'starter': return 'outline'
      case 'trial': return 'destructive'
      default: return 'outline'
    }
  }

  const isTrialing = customer.status === 'trialing'
  const isSuspended = customer.status === 'suspended'

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Subscription" 
        subtitle="Manage your SaaS subscription and billing"
      />

      {/* Status Banners */}
      {isTrialing && customer.renewal_date && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your trial ends on {format(new Date(customer.renewal_date), 'MMMM d, yyyy')}. 
            <Button variant="link" className="h-auto p-0 ml-2">
              Upgrade now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isSuspended && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Your account has been suspended</div>
            {customer.suspended_reason && (
              <div className="text-sm mt-1">Reason: {customer.suspended_reason}</div>
            )}
            <div className="text-sm mt-1">
              Please contact support to reactivate your account.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Plan & Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Plan & Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Current Plan</div>
              <Badge variant={getPlanVariant(customer.plan_type)} className="text-sm">
                {customer.plan_type || 'No Plan'}
              </Badge>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground mb-2">Status</div>
              <Badge variant={getStatusVariant(customer.status)} className="text-sm">
                {customer.status}
              </Badge>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground mb-2">
                {isTrialing ? 'Trial Ends' : 'Next Renewal'}
              </div>
              <div className="font-medium">
                {customer.renewal_date ? (
                  format(new Date(customer.renewal_date), 'MMMM d, yyyy')
                ) : (
                  'Not set'
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline"
              onClick={() => createCheckoutMutation.mutate({ interval: 'month' })}
              disabled={createCheckoutMutation.isPending || isSuspended}
            >
              {createCheckoutMutation.isPending ? 'Loading...' : 'Upgrade Plan'}
            </Button>
            
            {customer.billing_id ? (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => openPortalMutation.mutate()}
                disabled={openPortalMutation.isPending}
              >
                <ExternalLink className="h-4 w-4" />
                {openPortalMutation.isPending ? 'Opening...' : 'Manage Billing'}
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Billing Portal (Not Available)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Snapshot (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{customer.jobs_created_30d}</div>
                <div className="text-sm text-muted-foreground">Jobs Created</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{customer.candidates_added_30d}</div>
                <div className="text-sm text-muted-foreground">Candidates Added</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{customer.members_active_count}</div>
                <div className="text-sm text-muted-foreground">Team Members</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {customer.last_active_at ? (
                    format(new Date(customer.last_active_at), 'MMM d')
                  ) : (
                    'Never'
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Last Active</div>
              </div>
            </div>
          </div>
          
          <Alert className="mt-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Usage data is read-only and updated automatically based on your team's activity.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Billing Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="billing-name">Contact Name</Label>
              <Input 
                id="billing-name"
                placeholder="Enter billing contact name"
                defaultValue={customer.owner_details ? 
                  `${customer.owner_details.first_name || ''} ${customer.owner_details.last_name || ''}`.trim() 
                  : ''
                }
              />
            </div>
            
            <div>
              <Label htmlFor="billing-email">Contact Email</Label>
              <Input 
                id="billing-email"
                type="email"
                placeholder="Enter billing contact email"
                defaultValue={customer.owner_details?.email || ''}
              />
            </div>
          </div>
          
          <Button variant="outline">Update Billing Contact</Button>
        </CardContent>
      </Card>
    </div>
  )
}