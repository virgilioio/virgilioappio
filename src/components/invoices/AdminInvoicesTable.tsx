
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
import { Invoice, useInvoices } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Receipt, Upload, Download, CheckCircle, Trash2, ExternalLink } from 'lucide-react'
import { InvoiceUploadModal } from './InvoiceUploadModal'
import { getInvoicePdfUrl } from '@/lib/invoiceStorage'

interface AdminInvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
}

export function AdminInvoicesTable({ invoices, isLoading }: AdminInvoicesTableProps) {
  const { markInvoiceAsPaid, deleteInvoice } = useInvoices()
  const { organizations } = useOrganizations()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

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
    return org?.name || 'Unknown Organization'
  }

  const handleUploadClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setUploadModalOpen(true)
  }

  const handleDownloadClick = (invoice: Invoice) => {
    if (invoice.invoice_url) {
      const url = getInvoicePdfUrl(invoice.invoice_url)
      window.open(url, '_blank')
    }
  }

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      await markInvoiceAsPaid(invoiceId)
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

  const handleUploadComplete = () => {
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
                    <TableHead>Invoice</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
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
                        <Badge variant={getStatusBadgeVariant(invoice.status)}>
                          {invoice.status}
                        </Badge>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUploadClick(invoice)}
                            title="Upload PDF"
                          >
                            <Upload className="h-3.5 w-3.5" />
                          </Button>
                          
                          {/* Download PDF button if file exists */}
                          {invoice.invoice_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadClick(invoice)}
                              title="Download PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          
                          {/* Mark as paid button if pending */}
                          {invoice.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(invoice.id)}
                              title="Mark as Paid"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          
                          {/* Delete button */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Delete Invoice"
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
          onUploadComplete={handleUploadComplete}
        />
      )}
    </>
  )
}
