import { useState, useEffect } from 'react'
import { Plus, Search, Filter, CreditCard, RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MultiSelect } from '@/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Receipt } from 'lucide-react'
import { AdminInvoicesTable } from '@/components/invoices/AdminInvoicesTable'
import { WorkspaceOwnerInvoicesTable } from '@/components/invoices/WorkspaceOwnerInvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { useInvoices } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTenantSubscription } from '@/hooks/useTenantSubscription'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/components/ui/use-toast'

export function BillingTab() {
  const { invoices, isLoading } = useInvoices()
  const { organizations } = useOrganizations()
  const { canManageInvoices, canViewBilling, isPlatformAdmin, isBillingMember } = usePermissions()
  const isMobile = useIsMobile()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([])

  const { toast } = useToast()

  const { data: subData, refetch: refetchSubscription } = useTenantSubscription()
  const subscription = subData?.subscription
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')

  console.log('BillingTab permissions:', {
    canManageInvoices,
    canViewBilling,
    isPlatformAdmin,
    isBillingMember
  })

  // Show admin/billing member view if they have manage permissions
  const showAdminView = canManageInvoices

  // Filter invoices based on search, status, month, and organization (only for admin view)
  const filteredInvoices = showAdminView ? invoices.filter(invoice => {
    const matchesSearch = invoice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.organization_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(invoice.status)
    const matchesOrganization = selectedOrganizations.length === 0 || selectedOrganizations.includes(invoice.organization_id)
    
    // Month filter logic
    let matchesMonth = true
    if (monthFilter !== 'all') {
      const invoiceDate = new Date(invoice.issued_at)
      const filterDate = new Date(monthFilter)
      matchesMonth = invoiceDate.getFullYear() === filterDate.getFullYear() && 
                   invoiceDate.getMonth() === filterDate.getMonth()
    }
    
    return matchesSearch && matchesStatus && matchesOrganization && matchesMonth
  }) : invoices

  const getStatusCounts = () => {
    const invoicesToCount = showAdminView ? filteredInvoices : invoices
    return {
      total: invoicesToCount.length,
      pending: invoicesToCount.filter(i => i.status === 'pending').length,
      paid: invoicesToCount.filter(i => i.status === 'paid').length,
      overdue: invoicesToCount.filter(i => i.status === 'overdue').length,
    }
  }

  const statusCounts = getStatusCounts()

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('billing') === 'success') {
        handleRefreshStatus()
      }
    } catch (e) {
      console.warn('BillingTab: failed to parse URL params', e)
    }
  }, [])

  // Generate month options for the last 12 months
  const getMonthOptions = () => {
    const months = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        value: date.toISOString().substring(0, 7), // YYYY-MM format
        label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      })
    }
    return months
  }

  const monthOptions = getMonthOptions()

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
  ]

  const organizationOptions = organizations.map(org => ({
    value: org.id,
    label: `${org.name} (${org.country})`
  }))

  // If user doesn't have billing view permission, show no access message
  if (!canViewBilling) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            You don't have permission to view billing information.
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleStartCheckout = async () => {
    toast({ title: 'Starting checkout...', description: 'Redirecting to Stripe' })
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { interval: billingInterval },
    })
    if (error) {
      console.error('create-checkout error', error)
      toast({ title: 'Checkout error', description: error.message || 'Could not start checkout', variant: 'destructive' })
      return
    }
    if (data?.url) {
      window.location.href = data.url
    } else {
      toast({ title: 'Checkout error', description: 'No URL returned', variant: 'destructive' })
    }
  }

  const handleManagePortal = async () => {
    const { data, error } = await supabase.functions.invoke('customer-portal')
    if (error) {
      console.error('customer-portal error', error)
      toast({ title: 'Portal error', description: error.message || 'Could not open portal', variant: 'destructive' })
      return
    }
    if (data?.url) {
      window.location.href = data.url
    }
  }

  const handleSyncSeats = async () => {
    toast({ title: 'Syncing seats...', description: 'Updating seat quantity' })
    const { data, error } = await supabase.functions.invoke('update-seat-quantity')
    if (error) {
      console.error('update-seat-quantity error', error)
      toast({ title: 'Sync error', description: error.message || 'Failed to sync seats', variant: 'destructive' })
      return
    }
    console.log('Seat sync result', data)
    toast({ title: 'Seats synced', description: 'Seat quantity updated' })
    refetchSubscription()
  }

  const handleRefreshStatus = async () => {
    const { data, error } = await supabase.functions.invoke('check-subscription')
    if (error) {
      console.error('check-subscription error', error)
      toast({ title: 'Refresh error', description: error.message || 'Failed to refresh status', variant: 'destructive' })
      return
    }
    console.log('Subscription status', data)
    toast({ title: 'Subscription refreshed', description: 'Latest status has been loaded' })
    refetchSubscription()
  }

  const trialDaysLeft = (() => {
    if (!subscription?.trial_end) return null
    const end = new Date(subscription.trial_end).getTime()
    const now = Date.now()
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  })()

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                Billing & Invoices
              </CardTitle>
              <CardDescription className="text-sm">
                {canManageInvoices 
                  ? "Manage billing, your subscription, and invoice history"
                  : "View your organization's billing information and invoice history"
                }
              </CardDescription>
            </div>
            {canManageInvoices && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button 
                  onClick={() => setCreateModalOpen(true)} 
                  className="flex items-center gap-2 w-full sm:w-auto"
                  size={isMobile ? "default" : "default"}
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Create Invoice
                </Button>
                {subscription?.subscribed ? (
                  <Button 
                    onClick={handleManagePortal}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Settings2 className="h-4 w-4" />
                    Manage Subscription
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStartCheckout} 
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <CreditCard className="h-4 w-4" />
                    Start Subscription
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Subscription Controls - Only for admins */}
      {canManageInvoices && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CreditCard className="h-4 w-4" />
              Subscription
            </CardTitle>
            <CardDescription className="text-sm">
              {subscription?.subscribed
                ? `Active ${subscription.billing_interval === 'year' ? 'Yearly' : 'Monthly'} plan${subscription.seat_quantity ? ` • ${subscription.seat_quantity} seat(s)` : ''}`
                : trialDaysLeft !== null
                  ? `Trial active • ${trialDaysLeft} day(s) left`
                  : 'No active subscription'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {!subscription?.subscribed && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Plan:</span>
                  <Select value={billingInterval} onValueChange={(v: 'month' | 'year') => setBillingInterval(v)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly — $29/user</SelectItem>
                      <SelectItem value="year">Yearly — $299/user</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleRefreshStatus} className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh Status
                </Button>
                <Button variant="outline" onClick={handleSyncSeats} className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Sync Seats
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters - Only show for admin view */}
      {showAdminView && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Filter selects - Stack on mobile */}
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <MultiSelect
                  options={statusOptions}
                  selectedValues={selectedStatuses}
                  onSelectionChange={setSelectedStatuses}
                  placeholder="Filter by status"
                />

                <MultiSelect
                  options={organizationOptions}
                  selectedValues={selectedOrganizations}
                  onSelectionChange={setSelectedOrganizations}
                  placeholder="Filter by organization"
                />

                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {monthOptions.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('')
                    setSelectedStatuses([])
                    setSelectedOrganizations([])
                    setMonthFilter('all')
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table - Show different tables based on permissions */}
      {showAdminView ? (
        <AdminInvoicesTable 
          invoices={filteredInvoices} 
          isLoading={isLoading} 
        />
      ) : (
        <WorkspaceOwnerInvoicesTable 
          invoices={invoices} 
          isLoading={isLoading} 
        />
      )}

      {/* Create Invoice Modal */}
      {canManageInvoices && (
        <CreateInvoiceModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
        />
      )}
    </div>
  )
}
