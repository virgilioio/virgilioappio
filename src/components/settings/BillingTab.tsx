
import { useState } from 'react'
import { Plus, Search, Filter } from 'lucide-react'
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

export function BillingTab() {
  const { invoices, isLoading } = useInvoices()
  const { organizations } = useOrganizations()
  const { canManageInvoices, canViewBilling, isPlatformAdmin, isBillingMember } = usePermissions()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([])

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
