import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Receipt, Download, FileText, DollarSign, Edit } from 'lucide-react'
import { Invoice } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { InvoiceUploadModal } from './InvoiceUploadModal'
import { PaymentModal } from './PaymentModal'
import { EditInvoiceModal } from './EditInvoiceModal'
import { getInvoicePdfUrl } from '@/lib/invoiceStorage'
import { useSortableTable } from '@/hooks/useSortableTable'
import { SortableHeader } from '@/components/ui/sortable-header'

interface AdminInvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
}

export function AdminInvoicesTable({ invoices, isLoading }: AdminInvoicesTableProps) {
  const { organizations } = useOrganizations()
  const { canManageInvoices } = usePermissions()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Add sorting functionality  
  const { sortedData: sortedInvoices, sortConfig, requestSort } = useSortableTable(
    invoices, 
    { key: 'issued_at', direction: 'desc' }
  )

  const getStatusBadgeVariant = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'overdue':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getOrganizationName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    return org ? `${org.name} (${org.country})` : orgId
  }

  const handleUploadClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setUploadModalOpen(true)
  }

  const handlePaymentClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setPaymentModalOpen(true)
  }

  const handleEditClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setEditModalOpen(true)
  }

  const handleDownloadClick = (invoice: Invoice) => {
    if (invoice.invoice_url) {
      const url = getInvoicePdfUrl(invoice.invoice_url)
      window.open(url, '_blank')
    }
  }

  const handleUploadComplete = () => {
    // Refresh will be handled by the parent component or hook
  }

  const handlePaymentComplete = () => {
    // Refresh will be handled by the parent component or hook
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            All Invoices
          </CardTitle>
          <CardDescription>Loading invoices...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            All Invoices
          </CardTitle>
          <CardDescription>
            Manage invoices across all organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No invoices yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Create your first invoice to get started with billing management.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableHeader 
                        sortKey="title" 
                        currentSort={sortConfig} 
                        onSort={requestSort}
                      >
                        Invoice
                      </SortableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableHeader 
                        sortKey="organization_id" 
                        currentSort={sortConfig} 
                        onSort={requestSort}
                      >
                        Organization
                      </SortableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableHeader 
                        sortKey="amount" 
                        currentSort={sortConfig} 
                        onSort={requestSort}
                      >
                        Amount
                      </SortableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableHeader 
                        sortKey="status" 
                        currentSort={sortConfig} 
                        onSort={requestSort}
                      >
                        Status
                      </SortableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableHeader 
                        sortKey="issued_at" 
                        currentSort={sortConfig} 
                        onSort={requestSort}
                      >
                        Issued
                      </SortableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableHeader 
                        sortKey="due_date" 
                        currentSort={sortConfig} 
                        onSort={requestSort}
                      >
                        Due Date
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium">{invoice.title}</div>
                          {invoice.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {invoice.description}
                            </div>
                          )}
                          {invoice.file_name && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {invoice.file_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {getOrganizationName(invoice.organization_id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatAmount(invoice.amount, invoice.currency)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(invoice.issued_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {invoice.due_date ? (
                            <span className={invoice.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                              {formatDate(invoice.due_date)}
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit button */}
                          {canManageInvoices && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(invoice)}
                              title="Edit Invoice"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          
                          {/* Upload PDF button */}
                          {canManageInvoices && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUploadClick(invoice)}
                              title="Upload PDF"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          
                          {/* Log payment button */}
                          {canManageInvoices && invoice.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePaymentClick(invoice)}
                              title="Log Payment"
                              className="text-green-600 hover:text-green-700"
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          
                          {/* Download button if file exists */}
                          {invoice.invoice_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadClick(invoice)}
                              title="Download PDF"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedInvoice && canManageInvoices && (
        <>
          <InvoiceUploadModal
            open={uploadModalOpen}
            onOpenChange={setUploadModalOpen}
            invoice={selectedInvoice}
            onUploadComplete={handleUploadComplete}
          />
          
          <PaymentModal
            open={paymentModalOpen}
            onOpenChange={setPaymentModalOpen}
            invoice={selectedInvoice}
            onPaymentComplete={handlePaymentComplete}
          />
          
          <EditInvoiceModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            invoice={{
              id: selectedInvoice.id,
              title: selectedInvoice.title,
              description: selectedInvoice.description,
              amount: selectedInvoice.amount,
              currency: selectedInvoice.currency,
              issued_at: selectedInvoice.issued_at,
              due_date: selectedInvoice.due_date,
              status: selectedInvoice.status as 'pending' | 'paid' | 'overdue',
            }}
          />
        </>
      )}
    </>
  )
}
