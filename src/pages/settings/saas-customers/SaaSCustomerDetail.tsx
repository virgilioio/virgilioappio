import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, Users, Activity, Calendar, AlertTriangle, Mail } from 'lucide-react'
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
import { CustomerHealthBadge, HealthStatus } from '@/components/saas/CustomerHealthBadge'
import { QuickActionsPanel } from '@/components/saas/QuickActionsPanel'
import { ActivityTimeline } from '@/components/saas/ActivityTimeline'
import { MembersList } from '@/components/saas/MembersList'
import { BillingOverview } from '@/components/saas/BillingOverview'
import { SubscriptionTimeline } from '@/components/saas/SubscriptionTimeline'
import { SeatManagementCard } from '@/components/saas/SeatManagementCard'
import { PaymentHistory } from '@/components/saas/PaymentHistory'

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

  // Fetch current CoreSignal usage
  const { data: creditUsage } = useQuery({
    queryKey: ['coresignal-usage', customer?.tenant_id],
    queryFn: async () => {
      if (!customer?.tenant_id) return null
      const { data, error } = await supabase
        .from('coresignal_usage')
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

  // Calculate customer health status (moved before early returns)
  const customerHealth: HealthStatus = useMemo(() => {
    if (!customer || customer.status === 'suspended') return 'inactive'
    
    const daysSinceActive = customer.last_active_at 
      ? (Date.now() - new Date(customer.last_active_at).getTime()) / (1000 * 60 * 60 * 24)
      : 999
    
    const hasUsage = customer.jobs_created_30d > 0 || customer.candidates_added_30d > 0
    
    if (daysSinceActive > 30) return 'churn-risk'
    if (daysSinceActive > 14 || !hasUsage) return 'at-risk'
    return 'healthy'
  }, [customer])

  // Mock activity data (would come from actual activity tracking)
  const recentActivities = useMemo(() => {
    if (!customer) return []
    
    const activities = []
    
    if (customer.jobs_created_30d > 0) {
      activities.push({
        id: '1',
        type: 'job_created' as const,
        description: `Created ${customer.jobs_created_30d} job${customer.jobs_created_30d > 1 ? 's' : ''} in the last 30 days`,
        timestamp: customer.updated_at,
      })
    }
    
    if (customer.candidates_added_30d > 0) {
      activities.push({
        id: '2',
        type: 'candidate_added' as const,
        description: `Added ${customer.candidates_added_30d} candidate${customer.candidates_added_30d > 1 ? 's' : ''} in the last 30 days`,
        timestamp: customer.updated_at,
      })
    }
    
    return activities
  }, [customer])

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
        <CustomerHealthBadge health={customerHealth} />
        <Badge variant={getPlanVariant(customer.plan_type)} className="px-3 py-1">
          {customer.plan_type || 'No Plan'}
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Jobs Created"
          value={customer.jobs_created_30d}
          icon={<Briefcase />}
          tooltip="Jobs created in the last 30 days"
        />
        <MetricCard
          title="Candidates Added"
          value={customer.candidates_added_30d}
          icon={<Users />}
          tooltip="Candidates added in the last 30 days"
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
            <OnboardingProgressCard tenantId={customer.id} />

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

          {/* Activity Timeline */}
          <ActivityTimeline activities={recentActivities} />
        </TabsContent>

        <TabsContent value="members" className="space-y-6 mt-6">
          <MembersList organizationId={customer.id} />
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
          <ActivityTimeline activities={recentActivities} />
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
        onConfirm={(newTier, newInterval) => {
          changePlanMutation.mutate({ tenantId: customer.tenant_id, newTier, newInterval })
          setChangePlanDialogOpen(false)
        }}
        organizationName={customer.name}
        currentTier={subscriptionData?.subscription_tier || null}
        currentInterval={subscriptionData?.billing_interval || null}
        isPending={changePlanMutation.isPending}
      />

      <AssignCreditsDialog
        open={assignCreditsDialogOpen}
        onOpenChange={setAssignCreditsDialogOpen}
        onConfirm={(searchLimit, collectLimit, resetUsage) => {
          assignCreditsMutation.mutate({
            tenantId: customer.tenant_id,
            searchCreditsLimit: searchLimit,
            collectCreditsLimit: collectLimit,
            resetUsage,
          })
          setAssignCreditsDialogOpen(false)
        }}
        tenantName={customer.name}
        currentSearchLimit={creditUsage?.search_credits_limit}
        currentCollectLimit={creditUsage?.collect_credits_limit}
        isPending={assignCreditsMutation.isPending}
      />
    </div>
  )
}