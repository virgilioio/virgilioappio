
import { useState } from 'react'
import { Plus, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Receipt } from 'lucide-react'
import { AdminInvoicesTable } from '@/components/invoices/AdminInvoicesTable'
import { WorkspaceOwnerInvoicesTable } from '@/components/invoices/WorkspaceOwnerInvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { useInvoices } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'

export function BillingTab() {
  const { invoices, isLoading } = useInvoices()
  const { organizations } = useOrganizations()
  const { canManageInvoices, canViewBilling, isPlatformAdmin, isBillingMember } = usePermissions()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')

  // Show admin/billing member view if they have manage permissions
  const showAdminView = canManageInvoices

  // Filter invoices based on search, status, month, and organization (only for admin view)
  const filteredInvoices = showAdminView ? invoices.filter(invoice => {
    const matchesSearch = invoice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.organization_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter
    const matchesOrganization = organizationFilter === 'all' || invoice.organization_id === organizationFilter
    
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

  // If user doesn't have billing view permission, don't render anything
  if (!canViewBilling) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <Receipt className="h-5 w-5" />
                Billing & Invoices
              </CardTitle>
              <CardDescription>
                {showAdminView 
                  ? "Manage billing information and invoice history across organizations"
                  : "View your organization's billing information and invoice history"
                }
              </CardDescription>
            </div>
            {canManageInvoices && (
              <Button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards - Only show for admin view */}
      {showAdminView && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{statusCounts.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statusCounts.paid}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statusCounts.overdue}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters - Only show for admin view */}
      {showAdminView && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
              
              {/* Filter selects */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>

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

                <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.country})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setMonthFilter('all')
                    setOrganizationFilter('all')
                  }}
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
