import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Users, Briefcase, Activity, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSaaSCustomer } from '@/hooks/useSaaSCustomer'
import { PageHeader } from '@/components/layout/PageHeader'
import { format } from 'date-fns'

export function SaaSCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useSaaSCustomer(id!)

  if (isLoading) {
    return <div className="text-center py-8">Loading customer details...</div>
  }

  if (!customer) {
    return <div className="text-center py-8">Customer not found</div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/settings/platform/saas-customers')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader 
          title={customer.name}
          subtitle="SaaS customer details and management"
        />
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Organization</div>
              <div className="font-medium">{customer.name}</div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Plan</div>
              <Badge variant={getPlanVariant(customer.plan_type)}>
                {customer.plan_type || 'No Plan'}
              </Badge>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge variant={getStatusVariant(customer.status)}>
                {customer.status}
              </Badge>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Renewal</div>
              <div className="font-medium">
                {customer.renewal_date ? (
                  format(new Date(customer.renewal_date), 'MMM d, yyyy')
                ) : (
                  'Not set'
                )}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Owner</div>
              <div className="font-medium">
                {customer.owner_details ? (
                  `${customer.owner_details.first_name || ''} ${customer.owner_details.last_name || ''}`.trim() ||
                  customer.owner_details.email
                ) : (
                  'Not assigned'
                )}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-muted-foreground">Billing ID</div>
              <div className="font-medium">
                {customer.billing_id ? (
                  <span className="font-mono text-xs">{customer.billing_id}</span>
                ) : (
                  'Not set'
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Snapshot (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{customer.jobs_created_30d}</div>
                    <div className="text-sm text-muted-foreground">Jobs Created</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{customer.candidates_added_30d}</div>
                    <div className="text-sm text-muted-foreground">Candidates Added</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{customer.members_active_count}</div>
                    <div className="text-sm text-muted-foreground">Active Members</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary" />
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
            </CardContent>
          </Card>

          {/* Recent Activity Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Activity tracking will be implemented in the next phase
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Member management will be implemented in the next phase
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Current Plan</div>
                  <Badge variant={getPlanVariant(customer.plan_type)} className="mt-1">
                    {customer.plan_type || 'No Plan'}
                  </Badge>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={getStatusVariant(customer.status)} className="mt-1">
                    {customer.status}
                  </Badge>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Next Renewal</div>
                  <div className="font-medium">
                    {customer.renewal_date ? (
                      format(new Date(customer.renewal_date), 'MMMM d, yyyy')
                    ) : (
                      'Not set'
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Billing ID</div>
                  <div className="font-mono text-sm">
                    {customer.billing_id || 'Not set'}
                  </div>
                </div>
              </div>
              
              {customer.billing_id && (
                <div className="pt-4">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open Stripe Portal
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline">Change Plan</Button>
                <Button variant="outline">Assign New Owner</Button>
                <Button variant="outline">Edit Trial End</Button>
                {customer.status === 'active' ? (
                  <Button variant="destructive">Suspend Account</Button>
                ) : (
                  <Button variant="default">Restore Account</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}