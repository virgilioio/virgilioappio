import { Section } from '@/components/layout/Section'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Search, Filter, Calendar, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MultiSelect } from '@/components/ui/multi-select'
import { AdminInvoicesTable } from '@/components/invoices/AdminInvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { InvoiceAnalyticsChart } from '@/components/invoices/InvoiceAnalyticsChart'
import { TotalPaidCard } from '@/components/invoices/TotalPaidCard'
import { OverduePaymentsCard } from '@/components/invoices/OverduePaymentsCard'
import { OutstandingBalanceCard } from '@/components/invoices/OutstandingBalanceCard'
import { MonthPicker } from '@/components/ui/month-picker'
import { useInvoices } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { filterInvoices, getInvoiceStats, InvoiceFilterProvider, useInvoiceFilter } from '@/utils/invoiceFilters'

function AdminInvoicesContent() {
  const { invoices, isLoading } = useInvoices()
  const { organizations } = useOrganizations()
  const { canManageInvoices } = usePermissions()
  const isMobile = useIsMobile()
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

  // Filter invoices based on all filters - memoize to prevent unnecessary recalculations
  const filteredInvoices = useMemo(() => {
    return filterInvoices(invoices, {
      searchTerm,
      statuses: selectedStatuses,
      organizationIds: selectedOrganizations,
      selectedMonth
    })
  }, [invoices, searchTerm, selectedStatuses, selectedOrganizations, selectedMonth])

  // Update filtered invoices in context
  useEffect(() => {
    setFilteredInvoices(filteredInvoices)
  }, [filteredInvoices, setFilteredInvoices])

  const stats = useMemo(() => getInvoiceStats(filteredInvoices), [filteredInvoices])

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setSelectedStatuses([])
    setSelectedOrganizations([])
    setSelectedMonth(undefined)
  }, [])

  const hasActiveFilters = useMemo(() => {
    return !!(searchTerm || selectedStatuses.length > 0 || selectedOrganizations.length > 0 || selectedMonth)
  }, [searchTerm, selectedStatuses.length, selectedOrganizations.length, selectedMonth])

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'partial', label: 'Partial' }
  ]

  const organizationOptions = useMemo(() => {
    return organizations.map(org => ({
      value: org.id,
      label: `${org.name} (${org.country})`
    }))
  }, [organizations])

  // Get organization name for display
  const getOrganizationName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    return org ? `${org.name} (${org.country})` : orgId
  }

  if (!canManageInvoices) {
    return (
      <div className="min-h-screen bg-background">
        <Section container className="py-4 sm:py-6 lg:py-8 animate-fade-in">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                You don't have permission to manage invoices.
              </p>
            </CardContent>
          </Card>
        </Section>
      </div>
    )
  }

  return (
  <div className="min-h-screen bg-background">
    <Section container className="py-4 sm:py-6 lg:py-8 animate-fade-in">
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Receipt className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                Invoice Management
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Create and manage invoices for all organizations
              </p>
            </div>
            <Button 
              onClick={() => setCreateModalOpen(true)} 
              className="flex items-center gap-2 w-full sm:w-auto"
              size={isMobile ? "default" : "default"}
            >
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          </div>

          {/* Responsive Charts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
            {/* Invoice Analytics Chart - Takes full width on mobile, 2 columns on large screens */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <InvoiceAnalyticsChart invoices={invoices} />
            </div>
            {/* Metric Cards - Stack vertically on mobile, spread horizontally on larger screens */}
            <div className="col-span-1">
              <TotalPaidCard invoices={invoices} />
            </div>
            <div className="col-span-1">
              <OverduePaymentsCard invoices={invoices} />
            </div>
            <div className="col-span-1">
              <OutstandingBalanceCard invoices={invoices} />
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
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
            <CardContent className="space-y-4">
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
              
              {/* Filter controls - Stack on mobile, grid on larger screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear All
                </Button>
              </div>
              
              {/* Filter summary */}
              {hasActiveFilters && (
                <div className="pt-3 border-t">
                  <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                    <span>Showing {filteredInvoices.length} of {invoices.length} invoices</span>
                    {selectedMonth && (
                      <Badge variant="secondary" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </Badge>
                    )}
                    {selectedStatuses.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Status: {selectedStatuses.join(', ')}
                      </Badge>
                    )}
                    {selectedOrganizations.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Orgs: {selectedOrganizations.length} selected
                      </Badge>
                    )}
                    {searchTerm && (
                      <Badge variant="secondary" className="text-xs">
                        Search: "{searchTerm}"
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats for Filtered Results */}
          {hasActiveFilters && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">
                  Filtered Results Summary
                  {selectedMonth && (
                    <span className="text-sm font-normal text-muted-foreground ml-2 block sm:inline">
                      ({selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                  <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Invoices</div>
                    <div className="text-base sm:text-lg font-semibold">{stats.totalInvoices}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Pending</div>
                    <div className="text-base sm:text-lg font-semibold text-orange-600">
                      {stats.pendingCount} (${stats.totalPending.toLocaleString()})
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Overdue</div>
                    <div className="text-base sm:text-lg font-semibold text-red-600">
                      {stats.overdueCount} (${stats.totalOverdue.toLocaleString()})
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Partial</div>
                    <div className="text-base sm:text-lg font-semibold text-blue-600">
                      {stats.partialCount} (${stats.totalPartial.toLocaleString()})
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 sm:p-4 col-span-2 sm:col-span-1">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Outstanding</div>
                    <div className="text-base sm:text-lg font-semibold text-purple-600">
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
      </Section>
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
