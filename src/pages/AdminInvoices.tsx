
import { useState } from 'react'
import { Plus, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdminInvoicesTable } from '@/components/invoices/AdminInvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { BillingMetricsDashboard } from '@/components/invoices/BillingMetricsDashboard'
import { useInvoices } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'

export default function AdminInvoices() {
  const { invoices, isLoading } = useInvoices()
  const { canManageInvoices } = usePermissions()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Filter invoices based on search and status
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.organization_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (!canManageInvoices) {
    return (
      <Section>
        <AppContainer>
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
      <AppContainer>
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
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
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
              </div>
            </CardContent>
          </Card>

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
