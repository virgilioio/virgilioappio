import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Download, Calendar, DollarSign, FileText, Building2, User, Upload, CreditCard } from 'lucide-react'
import { Invoice } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { useState, useEffect } from 'react'
import { InvoiceUploadModal } from './InvoiceUploadModal'
import { PartialPaymentModal } from './PartialPaymentModal'

interface InvoiceDetailsDialogProps {
  invoice: Invoice | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface InvoicePayment {
  id: string
  amount: number
  currency: string
  payment_date: string
  payment_method: string
  payment_reference?: string
  payment_notes?: string
}

export function InvoiceDetailsDialog({ invoice, open, onOpenChange }: InvoiceDetailsDialogProps) {
  const { organizations } = useOrganizations()
  const [downloadingFile, setDownloadingFile] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [partialPaymentModalOpen, setPartialPaymentModalOpen] = useState(false)
  const [payments, setPayments] = useState<InvoicePayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  if (!invoice) return null

  const organization = organizations?.find(org => org.id === invoice.organization_id) || null

  // Load payment history when invoice changes - ALWAYS call useEffect, move conditions inside
  useEffect(() => {
    if (invoice && invoice.status === 'partial') {
      loadPaymentHistory()
    } else {
      setPayments([])
    }
  }, [invoice])

  const loadPaymentHistory = async () => {
    if (!invoice) return

    setLoadingPayments(true)
    try {
      // Use RPC function with proper type casting
      const { data, error } = await supabase.rpc('load_invoice_payments' as any, { 
        invoice_id_param: invoice.id 
      })

      if (error) {
        console.error('Error loading payment history:', error)
        return
      }

      // Cast the data to the expected type
      setPayments((data as InvoicePayment[]) || [])
    } catch (error) {
      console.error('Error loading payment history:', error)
      // If the function doesn't exist yet, just show empty payments
      setPayments([])
    } finally {
      setLoadingPayments(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'warning',
      paid: 'success',
      overdue: 'destructive',
      partial: 'secondary',
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

  const handleUploadComplete = () => {
    setUploadModalOpen(false)
    toast({
      title: 'Upload completed',
      description: 'The invoice PDF has been uploaded successfully.'
    })
  }

  const handlePartialPaymentAdded = () => {
    setPartialPaymentModalOpen(false)
    loadPaymentHistory() // Reload payment history
    toast({
      title: 'Payment recorded',
      description: 'The partial payment has been recorded successfully.'
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
    <>
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

            {/* Amount and payment status */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(invoice.amount, invoice.currency)}</p>
                </div>
              </div>

              {/* Partial payment status */}
              {invoice.status === 'partial' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <p className="text-sm text-blue-700">Amount Paid</p>
                    <p className="text-lg font-semibold text-blue-700">
                      {formatCurrency(invoice.total_paid || 0, invoice.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">Remaining</p>
                    <p className="text-lg font-semibold text-blue-700">
                      {formatCurrency(invoice.remaining_amount || 0, invoice.currency)}
                    </p>
                  </div>
                </div>
              )}
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

            {/* Payment history for partial payments */}
            {invoice.status === 'partial' && payments.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3">Payment History</h4>
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">
                            {formatCurrency(payment.amount, payment.currency)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(payment.payment_date)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Method: {payment.payment_method}</div>
                          {payment.payment_reference && (
                            <div>Reference: {payment.payment_reference}</div>
                          )}
                          {payment.payment_notes && (
                            <div>Notes: {payment.payment_notes}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Payment info for fully paid invoices */}
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
              <Button 
                onClick={() => setUploadModalOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload PDF
              </Button>

              {invoice.status !== 'paid' && (
                <Button 
                  onClick={() => setPartialPaymentModalOpen(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </Button>
              )}
              
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

      {/* Upload Invoice Modal */}
      <InvoiceUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        invoice={invoice}
        onUploadComplete={handleUploadComplete}
      />

      {/* Partial Payment Modal */}
      <PartialPaymentModal
        open={partialPaymentModalOpen}
        onOpenChange={setPartialPaymentModalOpen}
        invoice={invoice}
        onPaymentAdded={handlePartialPaymentAdded}
      />
    </>
  )
}
