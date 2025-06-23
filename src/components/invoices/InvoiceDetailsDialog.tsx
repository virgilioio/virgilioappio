
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Download, Calendar, DollarSign, FileText, Building2, User } from 'lucide-react'
import { Invoice } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useState } from 'react'

interface InvoiceDetailsDialogProps {
  invoice: Invoice | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvoiceDetailsDialog({ invoice, open, onOpenChange }: InvoiceDetailsDialogProps) {
  const { organizations } = useOrganizations()
  const [downloadingFile, setDownloadingFile] = useState(false)

  if (!invoice) return null

  const organization = organizations.find(org => org.id === invoice.organization_id)

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'warning',
      paid: 'success',
      overdue: 'destructive',
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleDownloadInvoice = async () => {
    if (!invoice.invoice_url) {
      toast({
        title: 'No file available',
        description: 'This invoice does not have a PDF file attached.',
        variant: 'destructive'
      })
      return
    }

    setDownloadingFile(true)

    try {
      const { data, error } = await supabase.storage
        .from('invoices')
        .download(invoice.invoice_url)

      if (error) {
        throw error
      }

      // Create download link
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = invoice.file_name || `invoice-${invoice.title}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Download started',
        description: 'Your invoice file is being downloaded.'
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: 'Download failed',
        description: 'Unable to download the invoice file. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setDownloadingFile(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Details
          </DialogTitle>
          <DialogDescription>
            View detailed information about this invoice
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with title and status */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{invoice.title}</h3>
              {invoice.description && (
                <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>
              )}
            </div>
            {getStatusBadge(invoice.status)}
          </div>

          <Separator />

          {/* Amount and currency */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-2xl font-bold">{formatCurrency(invoice.amount, invoice.currency)}</p>
            </div>
          </div>

          <Separator />

          {/* Organization info */}
          {organization && (
            <>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-medium">{organization.name}</p>
                  <p className="text-sm text-muted-foreground">{organization.country}</p>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Issued Date</p>
                <p className="font-medium">{formatDate(invoice.issued_at)}</p>
              </div>
            </div>

            {invoice.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(invoice.due_date)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment info */}
          {invoice.status === 'paid' && (
            <>
              <Separator />
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">Payment Information</h4>
                <div className="space-y-2 text-sm">
                  {invoice.paid_at && (
                    <div>
                      <span className="text-green-700">Paid on: </span>
                      <span className="font-medium">{formatDate(invoice.paid_at)}</span>
                    </div>
                  )}
                  {invoice.payment_method && (
                    <div>
                      <span className="text-green-700">Payment method: </span>
                      <span className="font-medium">{invoice.payment_method}</span>
                    </div>
                  )}
                  {invoice.payment_reference && (
                    <div>
                      <span className="text-green-700">Reference: </span>
                      <span className="font-medium">{invoice.payment_reference}</span>
                    </div>
                  )}
                  {invoice.payment_notes && (
                    <div>
                      <span className="text-green-700">Notes: </span>
                      <span className="font-medium">{invoice.payment_notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {invoice.invoice_url ? (
              <Button 
                onClick={handleDownloadInvoice}
                disabled={downloadingFile}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {downloadingFile ? 'Downloading...' : 'Download PDF'}
              </Button>
            ) : (
              <Button disabled variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                No file available
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
