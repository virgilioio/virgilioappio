import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, Users, Activity, Calendar, AlertTriangle, Mail, TrendingUp } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MetricCard } from '@/components/ui/metric-card'
import { supabase } from '@/lib/supabaseClient'
import { useSaaSCustomer } from '@/hooks/useSaaSCustomer'
import { OnboardingProgressCard } from '@/components/settings/OnboardingProgressCard'
import { useSuspendOrganization, useRestoreOrganization, useExtendTrial, useActivateAccount } from '@/hooks/useSaaSAdminActions'
import { useChangePlan } from '@/hooks/useChangePlan'
import { useAssignTenantCredits } from '@/hooks/useAssignTenantCredits'
import { SuspendOrganizationDialog } from '@/components/settings/SuspendOrganizationDialog'
import { ExtendTrialDialog } from '@/components/settings/ExtendTrialDialog'
import { ChangePlanDialog } from '@/components/settings/ChangePlanDialog'
import { AssignCreditsDialog } from '@/components/settings/AssignCreditsDialog'
import { CustomerHealthBadge } from '@/components/saas/CustomerHealthBadge'
import { HealthStatusCard } from '@/components/saas/HealthStatusCard'
import { QuickActionsPanel } from '@/components/saas/QuickActionsPanel'
import { ActivityTimeline } from '@/components/saas/ActivityTimeline'
import { MembersList } from '@/components/saas/MembersList'
import { BillingOverview } from '@/components/saas/BillingOverview'
import { SubscriptionTimeline } from '@/components/saas/SubscriptionTimeline'
import { SeatManagementCard } from '@/components/saas/SeatManagementCard'
import { PaymentHistory } from '@/components/saas/PaymentHistory'
import { calculateCustomerHealth, CustomerHealthResult } from '@/utils/customerHealth'

export function SaaSCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useSaaSCustomer(id!)
  
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [extendTrialDialogOpen, setExtendTrialDialogOpen] = useState(false)
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false)
  const [assignCreditsDialogOpen, setAssignCreditsDialogOpen] = useState(false)
  
  const suspendMutation = useSuspendOrganization()
  const restoreMutation = useRestoreOrganization()
  const extendTrialMutation = useExtendTrial()
  const changePlanMutation = useChangePlan()
  const activateMutation = useActivateAccount()
  const assignCreditsMutation = useAssignTenantCredits()

  // Fetch subscription data for current plan info and billing status
  const { data: subscriptionData } = useQuery({
    queryKey: ['tenant-subscription', customer?.tenant_id],
    queryFn: async () => {
      if (!customer?.tenant_id) return null
      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', customer.tenant_id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!customer?.tenant_id
  })

  // Fetch current sourcing credits usage
  const { data: creditUsage } = useQuery({
    queryKey: ['sourcing-credits-usage', customer?.tenant_id],
    queryFn: async () => {
      if (!customer?.tenant_id) return null
      const { data, error } = await supabase
        .from('sourcing_credits_usage')
        .select('*')
        .eq('tenant_id', customer.tenant_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error) throw error
      return data
    },
    enabled: !!customer?.tenant_id
  })

  // Calculate customer health status using shared utility
  const customerHealth: CustomerHealthResult = useMemo(() => {
    if (!customer) {
      return {
        status: 'inactive' as const,
        reasons: [],
        recommendation: 'No customer data available.'
      }
    }
    
    return calculateCustomerHealth({
      status: customer.status,
      last_active_at: customer.last_active_at,
      jobs_created_30d: customer.jobs_created_30d,
      candidates_added_30d: customer.candidates_added_30d,
      members_active_count: customer.members_active_count
    })
  }, [customer])

  // Map real activities from database to ActivityTimeline format
  const formattedActivities = useMemo(() => {
    if (!customer?.recent_activities) return []
    
    return customer.recent_activities.map((activity: any) => ({
      id: activity.id,
      activity_type: activity.activity_type,
      title: activity.title,
      description: activity.description,
      timestamp: activity.created_at,
    }))
  }, [customer?.recent_activities])

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

  const formatPlanDisplay = () => {
    const seats = subscriptionData?.seat_quantity || 1
    const interval = subscriptionData?.billing_interval
    return `${seats} seat${seats !== 1 ? 's' : ''} • ${interval === 'year' ? 'Annual' : 'Monthly'}`
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/settings?tab=platform-saas-customers')}
          className="hover:bg-virgilio-purple/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-h1-mobile md:text-h1-desktop font-poppins font-bold text-virgilio-text">
            {customer.name}<span className="text-virgilio-purple">.</span>
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-virgilio-muted">
            {customer.last_active_at && (
              <span>
                Last active {formatDistanceToNow(new Date(customer.last_active_at), { addSuffix: true })}
              </span>
            )}
            <span>·</span>
            <span>Active since {format(new Date(customer.created_at), 'MMM yyyy')}</span>
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <CustomerHealthBadge health={customerHealth.status} />
        <Badge variant="default" className="px-3 py-1">
          {formatPlanDisplay()}
        </Badge>
        <Badge variant={getStatusVariant(customer.status)} className="px-3 py-1">
          {customer.status}
        </Badge>
      </div>

      {/* Suspension Banner */}
      {customer.status === 'suspended' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Organization Suspended</div>
            {customer.suspended_reason && (
              <div className="text-sm mt-1">Reason: {customer.suspended_reason}</div>
            )}
            {customer.suspended_at && (
              <div className="text-sm text-muted-foreground mt-1">
                Suspended on {format(new Date(customer.suspended_at), 'MMMM d, yyyy')}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats - Now with Total + 30-day trend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Jobs"
          value={customer.jobs_total ?? customer.jobs_created_30d}
          icon={<Briefcase />}
          tooltip="Total active jobs"
          footer={
            customer.jobs_created_30d > 0 ? (
              <div className="flex items-center gap-1 text-xs text-virgilio-success">
                <TrendingUp className="h-3 w-3" />
                <span>+{customer.jobs_created_30d} this month</span>
              </div>
            ) : undefined
          }
        />
        <MetricCard
          title="Total Candidates"
          value={customer.candidates_total ?? customer.candidates_added_30d}
          icon={<Users />}
          tooltip="Total candidates across all jobs"
          footer={
            customer.candidates_added_30d > 0 ? (
              <div className="flex items-center gap-1 text-xs text-virgilio-success">
                <TrendingUp className="h-3 w-3" />
                <span>+{customer.candidates_added_30d} this month</span>
              </div>
            ) : undefined
          }
        />
        <MetricCard
          title="Active Members"
          value={customer.members_active_count}
          icon={<Activity />}
          tooltip="Currently active team members"
        />
        <MetricCard
          title="Last Active"
          value={
            customer.last_active_at
              ? formatDistanceToNow(new Date(customer.last_active_at), { addSuffix: true }).replace('ago', '').trim()
              : 'Never'
          }
          icon={<Calendar />}
          tooltip="Last account activity"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="border-b border-virgilio-border bg-transparent w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Health Status Card */}
            <HealthStatusCard health={customerHealth} />

            {/* Quick Actions */}
            <QuickActionsPanel
              customer={customer}
              onExtendTrial={() => setExtendTrialDialogOpen(true)}
              onChangePlan={() => setChangePlanDialogOpen(true)}
              onSuspend={() => setSuspendDialogOpen(true)}
              onRestore={() => restoreMutation.mutate({ tenantId: customer.tenant_id })}
              onActivate={() => activateMutation.mutate({ tenantId: customer.tenant_id })}
              onAssignCredits={() => setAssignCreditsDialogOpen(true)}
              billingStatus={subscriptionData?.billing_status}
            />

            {/* Onboarding Progress Card */}
            <OnboardingProgressCard tenantId={customer.tenant_id} />

            {/* Owner Contact Card */}
            {customer.owner_details && (
              <Card className="shadow-calendly border-virgilio-border">
                <CardHeader>
                  <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
                    Owner Contact<span className="text-virgilio-purple">.</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm text-virgilio-muted mb-1">Name</div>
                    <div className="font-medium text-virgilio-text">
                      {`${customer.owner_details.first_name || ''} ${customer.owner_details.last_name || ''}`.trim() || 'Not provided'}
                    </div>
                  </div>
                  
                  {customer.owner_details.email && (
                    <div>
                      <div className="text-sm text-virgilio-muted mb-1 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </div>
                      <a 
                        href={`mailto:${customer.owner_details.email}`}
                        className="text-virgilio-purple hover:underline font-medium"
                      >
                        {customer.owner_details.email}
                      </a>
                    </div>
                  )}

                  <div className="pt-4 border-t border-virgilio-border">
                    <div className="text-sm text-virgilio-muted mb-1">Account Details</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-virgilio-muted">Type:</span>
                        <span className="font-medium text-virgilio-text capitalize">{customer.organization_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-virgilio-muted">Signup:</span>
                        <span className="font-medium text-virgilio-text capitalize">{customer.signup_source.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Subscription Timeline */}
          {subscriptionData && (
            <SubscriptionTimeline
              trialStartedAt={subscriptionData.trial_started_at}
              trialEndsAt={subscriptionData.trial_ends_at}
              currentPeriodStart={subscriptionData.current_period_start}
              currentPeriodEndAt={subscriptionData.current_period_end_at}
              lastPaymentFailedAt={subscriptionData.last_payment_failed_at}
              suspendedAt={customer.suspended_at}
              billingStatus={subscriptionData.billing_status}
            />
          )}

          {/* Activity Timeline - Now using real activities */}
          <ActivityTimeline activities={formattedActivities} />
        </TabsContent>

        <TabsContent value="members" className="space-y-6 mt-6">
          <MembersList tenantId={customer.tenant_id} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 mt-6">
          <BillingOverview customer={customer} />
          
          {/* Seat Management */}
          {subscriptionData && (
            <SeatManagementCard
              tenantId={customer.tenant_id}
              currentSeats={subscriptionData.seat_quantity}
              maxSeats={subscriptionData.max_users}
              lastUpdated={subscriptionData.updated_at}
            />
          )}

          {/* Payment History */}
          <PaymentHistory stripeCustomerId={subscriptionData?.stripe_customer_id || null} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 mt-6">
          <ActivityTimeline activities={formattedActivities} />
        </TabsContent>
      </Tabs>

      <SuspendOrganizationDialog
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        onConfirm={(reason) => {
          suspendMutation.mutate({ tenantId: customer.tenant_id, reason })
          setSuspendDialogOpen(false)
        }}
        organizationName={customer.name}
        isPending={suspendMutation.isPending}
      />

      <ExtendTrialDialog
        open={extendTrialDialogOpen}
        onOpenChange={setExtendTrialDialogOpen}
        onConfirm={(newEndDate) => {
          extendTrialMutation.mutate({ tenantId: customer.tenant_id, newEndDate })
          setExtendTrialDialogOpen(false)
        }}
        organizationName={customer.name}
        currentTrialEnd={customer.trial_end_date ? new Date(customer.trial_end_date) : null}
        isPending={extendTrialMutation.isPending}
      />

      <ChangePlanDialog
        open={changePlanDialogOpen}
        onOpenChange={setChangePlanDialogOpen}
        onConfirm={(newInterval, newSeats) => {
          changePlanMutation.mutate({ tenantId: customer.tenant_id, newInterval, newSeats })
          setChangePlanDialogOpen(false)
        }}
        organizationName={customer.name}
        currentSeats={subscriptionData?.seat_quantity || 1}
        currentInterval={subscriptionData?.billing_interval || null}
        isPending={changePlanMutation.isPending}
      />

      <AssignCreditsDialog
        open={assignCreditsDialogOpen}
        onOpenChange={setAssignCreditsDialogOpen}
        onConfirm={(collectLimit, resetUsage) => {
          assignCreditsMutation.mutate({
            tenantId: customer.tenant_id,
            collectCreditsLimit: collectLimit,
            resetUsage,
          })
          setAssignCreditsDialogOpen(false)
        }}
        tenantName={customer.name}
        currentCollectLimit={creditUsage?.collect_credits_limit}
        isPending={assignCreditsMutation.isPending}
      />
    </div>
  )
}
