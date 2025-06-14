
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
import { useInvoices, Invoice } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { Receipt, Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoiceUploadModal } from './InvoiceUploadModal'
import { getInvoicePdfUrl } from '@/lib/invoiceStorage'

export function InvoicesTable() {
  const { invoices, isLoading, refreshInvoices } = useInvoices()
  const { isPlatformAdmin, canManageInvoices } = usePermissions()
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

  const handleRowClick = (invoice: Invoice) => {
    // If invoice has a URL, download it; otherwise do nothing
    if (invoice.invoice_url) {
      handleDownloadClick(invoice)
    }
  }

  const handleUploadComplete = () => {
    refreshInvoices()
  }

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'text-green-600'
      case 'pending':
        return 'text-orange-600'
      case 'overdue':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoices
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
            Invoices
          </CardTitle>
          <CardDescription>
            Your organization's billing history and current invoices
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
                Invoices will appear here once your organization has billing activity. 
                Contact support if you have questions about billing.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary stats for clients */}
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Outstanding</div>
                  <div className="text-lg font-semibold text-orange-600">
                    {formatAmount(
                      invoices
                        .filter(i => i.status === 'pending' || i.status === 'overdue')
                        .reduce((sum, i) => sum + i.amount, 0),
                      invoices[0]?.currency || 'USD'
                    )}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Paid</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatAmount(
                      invoices
                        .filter(i => i.status === 'paid')
                        .reduce((sum, i) => sum + i.amount, 0),
                      invoices[0]?.currency || 'USD'
                    )}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Invoices</div>
                  <div className="text-lg font-semibold">
                    {invoices.length}
                  </div>
                </div>
              </div>

              {/* Invoices table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow 
                        key={invoice.id} 
                        interactive={!!invoice.invoice_url}
                        onClick={() => handleRowClick(invoice)}
                        className={!invoice.invoice_url ? 'cursor-default' : ''}
                      >
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
                            {/* Admin upload button */}
                            {canManageInvoices && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleUploadClick(invoice); }}
                                title="Upload PDF"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            
                            {/* Download button if file exists */}
                            {invoice.invoice_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleDownloadClick(invoice); }}
                                title="Download PDF"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            
                            {/* No file message for clients */}
                            {!invoice.invoice_url && !canManageInvoices && (
                              <span className="text-xs text-muted-foreground">
                                PDF not available
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal (Admin only) */}
      {selectedInvoice && canManageInvoices && (
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
