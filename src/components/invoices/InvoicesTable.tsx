
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
import { Receipt, ExternalLink, Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoiceUploadModal } from './InvoiceUploadModal'
import { getInvoicePdfUrl } from '@/lib/invoiceStorage'

export function InvoicesTable() {
  const { invoices, isLoading, refreshInvoices } = useInvoices()
  const { isPlatformAdmin } = usePermissions()
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

  const handleUploadComplete = () => {
    refreshInvoices()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
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
            <Receipt className="h-5 w-5" />
            Invoices
          </CardTitle>
          <CardDescription>
            Your organization's billing history and current invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-layout-md">
              <p className="text-muted-foreground">No invoices found.</p>
              <p className="text-sm text-muted-foreground mt-sm">
                Invoices will appear here once billing is set up.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.title}
                        {invoice.file_name && (
                          <div className="text-xs text-muted-foreground mt-1">
                            📄 {invoice.file_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatAmount(invoice.amount, invoice.currency)}
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
                        <div className="flex items-center gap-1">
                          {/* Upload button for Platform Admins */}
                          {isPlatformAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUploadClick(invoice)}
                              title="Upload PDF"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {/* Download button if file exists */}
                          {invoice.invoice_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadClick(invoice)}
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {/* External link button (existing functionality) */}
                          {invoice.invoice_url && !invoice.file_name && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(invoice.invoice_url, '_blank')}
                              title="Open external link"
                            >
                              <ExternalLink className="h-4 w-4" />
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
