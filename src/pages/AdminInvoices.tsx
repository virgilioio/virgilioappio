
import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdminInvoicesTable } from '@/components/invoices/AdminInvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { BillingMetricsDashboard } from '@/components/invoices/BillingMetricsDashboard'
import { MonthPicker } from '@/components/ui/month-picker'
import { useInvoices } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { filterInvoices, getInvoiceStats, InvoiceFilterProvider, useInvoiceFilter } from '@/utils/invoiceFilters'

function AdminInvoicesContent() {
  const { invoices, isLoading } = useInvoices()
  const { canManageInvoices } = usePermissions()
  const { filters, setFilters, setFilteredInvoices } = useInvoiceFilter()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>()

  // Update filter context when local filters change
  useEffect(() => {
    const newFilters = {
      searchTerm,
      status: statusFilter,
      selectedMonth
    }
    setFilters(newFilters)
  }, [searchTerm, statusFilter, selectedMonth, setFilters])

  // Filter invoices based on all filters
  const filteredInvoices = filterInvoices(invoices, {
    searchTerm,
    status: statusFilter,
    selectedMonth
  })

  // Update filtered invoices in context
  useEffect(() => {
    setFilteredInvoices(filteredInvoices)
  }, [filteredInvoices, setFilteredInvoices])

  const stats = getInvoiceStats(filteredInvoices)

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setSelectedMonth(undefined)
  }

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || selectedMonth

  if (!canManageInvoices) {
    return (
      <Section>
        <AppContainer variant="sm">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                You don't have permission to manage invoices.
              </p>
            </CardContent>
          </Card>
        </AppContainer>
      </Section>
    )
  }

  return (
    <Section>
      <AppContainer variant="default">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Invoice Management</h1>
              <p className="text-muted-foreground">
                Create and manage invoices for all organizations
              </p>
            </div>
            <Button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
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
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <MonthPicker
                  selected={selectedMonth}
                  onSelect={setSelectedMonth}
                  placeholder="Filter by month"
                  className="w-full sm:w-[180px]"
                />
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
                    {statusFilter !== 'all' && (
                      <Badge variant="secondary">
                        Status: {statusFilter}
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

          {/* Summary Stats for Filtered Results */}
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
                <div className="grid gap-4 md:grid-cols-4">
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
                    <div className="text-sm text-muted-foreground mb-1">Paid</div>
                    <div className="text-lg font-semibold text-green-600">
                      {stats.paidCount} (${stats.totalPaid.toLocaleString()})
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
      </AppContainer>
    </Section>
  )
}

export default function AdminInvoices() {
  return (
    <InvoiceFilterProvider>
      <AdminInvoicesContent />
    </InvoiceFilterProvider>
  )
}
