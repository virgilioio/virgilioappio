import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Invoice, useInvoices } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { Receipt, Upload, Download, CheckCircle, Trash2, DollarSign, Clock, AlertTriangle } from 'lucide-react'
import { InvoiceUploadModal } from './InvoiceUploadModal'
import { PaymentModal } from './PaymentModal'
import { getInvoicePdfUrl } from '@/lib/invoiceStorage'
import { useSortableTable } from '@/hooks/useSortableTable'
import { SortableHeader } from '@/components/ui/sortable-header'

interface AdminInvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
}

export function AdminInvoicesTable({ invoices, isLoading }: AdminInvoicesTableProps) {
  const { updateInvoiceStatus, deleteInvoice } = useInvoices()
  const { organizations } = useOrganizations()
  const { canManageInvoices } = usePermissions()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
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

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-3 w-3" />
      case 'pending':
        return <Clock className="h-3 w-3" />
      case 'overdue':
        return <AlertTriangle className="h-3 w-3" />
      default:
        return null
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getOrganizationName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    return org?.name || 'Unknown Organization'
  }

  const handleUploadClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setUploadModalOpen(true)
  }

  const handlePaymentClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setPaymentModalOpen(true)
  }

  const handleDownloadClick = (invoice: Invoice) => {
    if (invoice.invoice_url) {
      const url = getInvoicePdfUrl(invoice.invoice_url)
      window.open(url, '_blank')
    }
  }

  const handleRowClick = (invoice: Invoice) => {
    // If invoice has a URL, download it; otherwise do nothing
    if (invoice.invoice_url) {
      handleDownloadClick(invoice)
    }
  }

  const handleStatusChange = async (invoiceId: string, newStatus: 'pending' | 'paid' | 'overdue') => {
    try {
      await updateInvoiceStatus(invoiceId, newStatus)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await deleteInvoice(invoiceId)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handlePaymentLogged = () => {
    // The hook will refresh the data automatically
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading invoices...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoices ({invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No invoices found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create your first invoice to get started.
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
                    <TableHead>Payment Details</TableHead>
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
                    <TableRow 
                      key={invoice.id}
                      interactive={!!invoice.invoice_url}
                      onClick={() => handleRowClick(invoice)}
                      className={!invoice.invoice_url ? 'cursor-default' : ''}
                    >
                      <TableCell className="font-medium">
                        <div>
                          {invoice.title}
                          {invoice.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {invoice.description}
                            </div>
                          )}
                          {invoice.file_name && (
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              📄 {invoice.file_name}
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
                        {canManageInvoices ? (
                          <Select
                            value={invoice.status}
                            onValueChange={(value: 'pending' | 'paid' | 'overdue') => 
                              handleStatusChange(invoice.id, value)
                            }
                          >
                            <SelectTrigger className="w-24 h-8" onClick={(e) => e.stopPropagation()}>
                              <SelectValue>
                                <Badge variant={getStatusBadgeVariant(invoice.status)} className="flex items-center gap-1">
                                  {getStatusIcon(invoice.status)}
                                  {invoice.status}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </div>
                              </SelectItem>
                              <SelectItem value="paid">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3" />
                                  Paid
                                </div>
                              </SelectItem>
                              <SelectItem value="overdue">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3" />
                                  Overdue
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getStatusBadgeVariant(invoice.status)} className="flex items-center gap-1">
                            {getStatusIcon(invoice.status)}
                            {invoice.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.status === 'paid' && invoice.paid_at ? (
                          <div className="text-xs space-y-1">
                            <div>
                              <span className="text-muted-foreground">Paid:</span> {formatDateTime(invoice.paid_at)}
                            </div>
                            {invoice.payment_method && (
                              <div>
                                <span className="text-muted-foreground">Method:</span> {invoice.payment_method}
                              </div>
                            )}
                            {invoice.payment_reference && (
                              <div>
                                <span className="text-muted-foreground">Ref:</span> {invoice.payment_reference}
                              </div>
                            )}
                            {invoice.payment_notes && (
                              <div className="text-muted-foreground max-w-40 truncate" title={invoice.payment_notes}>
                                {invoice.payment_notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No payment data</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(invoice.issued_at)}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date ? formatDate(invoice.due_date) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Upload PDF button */}
                          {canManageInvoices && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleUploadClick(invoice); }}
                              title="Upload PDF"
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          
                          {/* Download PDF button if file exists */}
                          {invoice.invoice_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDownloadClick(invoice); }}
                              title="Download PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          
                          {/* Log payment button if pending and user can manage */}
                          {canManageInvoices && invoice.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handlePaymentClick(invoice); }}
                              title="Log Payment"
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          
                          {/* Delete button */}
                          {canManageInvoices && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Delete Invoice"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this invoice? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteInvoice(invoice.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

      {/* Upload Modal */}
      {selectedInvoice && (
        <InvoiceUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          invoice={selectedInvoice}
          onUploadComplete={() => {}}
        />
      )}

      {/* Payment Modal */}
      {selectedInvoice && (
        <PaymentModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          invoice={selectedInvoice}
          onPaymentLogged={handlePaymentLogged}
        />
      )}
    </>
  )
}
