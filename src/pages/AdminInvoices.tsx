import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Calendar, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MultiSelect } from '@/components/ui/multi-select'
import { AdminInvoicesTable } from '@/components/invoices/AdminInvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { BillingMetricsDashboard } from '@/components/invoices/BillingMetricsDashboard'
import { InvoiceAnalyticsChart } from '@/components/invoices/InvoiceAnalyticsChart'
import { TotalPaidCard } from '@/components/invoices/TotalPaidCard'
import { OverduePaymentsCard } from '@/components/invoices/OverduePaymentsCard'
import { OutstandingBalanceCard } from '@/components/invoices/OutstandingBalanceCard'
import { MonthPicker } from '@/components/ui/month-picker'
import { useInvoices } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { filterInvoices, getInvoiceStats, InvoiceFilterProvider, useInvoiceFilter } from '@/utils/invoiceFilters'

function AdminInvoicesContent() {
  const { invoices, isLoading } = useInvoices()
  const { organizations } = useOrganizations()
  const { canManageInvoices } = usePermissions()
  const { filters, setFilters, setFilteredInvoices } = useInvoiceFilter()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>()

  // Update filter context when local filters change
  useEffect(() => {
    const newFilters = {
      searchTerm,
      statuses: selectedStatuses,
      organizationIds: selectedOrganizations,
      selectedMonth
    }
    setFilters(newFilters)
  }, [searchTerm, selectedStatuses, selectedOrganizations, selectedMonth, setFilters])

  // Filter invoices based on all filters
  const filteredInvoices = filterInvoices(invoices, {
    searchTerm,
    statuses: selectedStatuses,
    organizationIds: selectedOrganizations,
    selectedMonth
  })

  // Update filtered invoices in context
  useEffect(() => {
    setFilteredInvoices(filteredInvoices)
  }, [filteredInvoices, setFilteredInvoices])

  const stats = getInvoiceStats(filteredInvoices)

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedStatuses([])
    setSelectedOrganizations([])
    setSelectedMonth(undefined)
  }

  const hasActiveFilters = searchTerm || selectedStatuses.length > 0 || selectedOrganizations.length > 0 || selectedMonth

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'partial', label: 'Partial' }
  ]

  const organizationOptions = organizations.map(org => ({
    value: org.id,
    label: `${org.name} (${org.country})`
  }))

  // Get organization name for display
  const getOrganizationName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    return org ? `${org.name} (${org.country})` : orgId
  }

  if (!canManageInvoices) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                You don't have permission to manage invoices.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="mb-6 sm:mb-8 lg:mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Receipt className="h-6 w-6 sm:h-7 sm:w-7" />
                Invoice Management
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-md">
                Create and manage invoices for all organizations
              </p>
            </div>
            <Button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          </div>

          {/* Charts Grid - 2:1:1:1 ratio */}
          <div className="grid grid-cols-5 gap-6">
            {/* Invoice Analytics Chart - 2 columns */}
            <div className="col-span-2">
              <InvoiceAnalyticsChart invoices={invoices} />
            </div>
            {/* Total Paid Card - 1 column */}
            <div className="col-span-1">
              <TotalPaidCard invoices={invoices} />
            </div>
            {/* Overdue Payments Card - 1 column */}
            <div className="col-span-1">
              <OverduePaymentsCard invoices={invoices} />
            </div>
            {/* Outstanding Balance Card - 1 column */}
            <div className="col-span-1">
              <OutstandingBalanceCard invoices={invoices} />
            </div>
          </div>

          {/* Billing Metrics Dashboard */}
          <BillingMetricsDashboard />

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
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
                
                {/* Filter row */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

                  <MonthPicker
                    selected={selectedMonth}
                    onSelect={setSelectedMonth}
                    placeholder="Filter by month"
                    className="w-full"
                  />

                  <Button variant="outline" onClick={clearFilters}>
                    Clear All
                  </Button>
                </div>
              </div>
              
              {/* Filter summary */}
              {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                    <span>Showing {filteredInvoices.length} of {invoices.length} invoices</span>
                    {selectedMonth && (
                      <Badge variant="secondary">
                        <Calendar className="h-3 w-3 mr-1" />
                        {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </Badge>
                    )}
                    {selectedStatuses.length > 0 && (
                      <Badge variant="secondary">
                        Status: {selectedStatuses.join(', ')}
                      </Badge>
                    )}
                    {selectedOrganizations.length > 0 && (
                      <Badge variant="secondary">
                        Orgs: {selectedOrganizations.length} selected
                      </Badge>
                    )}
                    {searchTerm && (
                      <Badge variant="secondary">
                        Search: "{searchTerm}"
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats for Filtered Results - Updated with proper outstanding balance calculation */}
          {hasActiveFilters && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Filtered Results Summary
                  {selectedMonth && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">Total Invoices</div>
                    <div className="text-lg font-semibold">{stats.totalInvoices}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">Pending</div>
                    <div className="text-lg font-semibold text-orange-600">
                      {stats.pendingCount} (${stats.totalPending.toLocaleString()})
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">Overdue</div>
                    <div className="text-lg font-semibold text-red-600">
                      {stats.overdueCount} (${stats.totalOverdue.toLocaleString()})
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">Partial</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {stats.partialCount} (${stats.totalPartial.toLocaleString()})
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground mb-1">Outstanding</div>
                    <div className="text-lg font-semibold text-purple-600">
                      ${stats.totalOutstanding.toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoices Table */}
          <AdminInvoicesTable 
            invoices={filteredInvoices} 
            isLoading={isLoading} 
          />

          {/* Create Invoice Modal */}
          <CreateInvoiceModal
            open={createModalOpen}
            onOpenChange={setCreateModalOpen}
          />
        </div>
      </div>
    </div>
  )
}

export default function AdminInvoices() {
  return (
    <InvoiceFilterProvider>
      <AdminInvoicesContent />
    </InvoiceFilterProvider>
  )
}
