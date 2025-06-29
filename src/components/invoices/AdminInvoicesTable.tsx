
import { useState } from 'react'
import { MoreHorizontal, Download, Edit, Trash2, CheckCircle, FileText, Calendar, DollarSign, Search, Filter, Upload, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { MonthPicker } from '@/components/ui/month-picker'
import { useIsMobile } from '@/hooks/use-mobile'
import { EditInvoiceModal } from './EditInvoiceModal'
import { PaymentModal } from './PaymentModal'
import { PartialPaymentModal } from './PartialPaymentModal'
import { InvoiceUploadModal } from './InvoiceUploadModal'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { Invoice } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { filterInvoices, getInvoiceStats } from '@/utils/invoiceFilters'
import { InvoiceDetailsDialog } from './InvoiceDetailsDialog'

interface AdminInvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
}

export function AdminInvoicesTable({ invoices, isLoading }: AdminInvoicesTableProps) {
  const { organizations } = useOrganizations()
  const isMobile = useIsMobile()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [partialPaymentModalOpen, setPartialPaymentModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>()
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  // Filter invoices based on all filters - single declaration
  const filteredInvoices = filterInvoices(invoices || [], {
    searchTerm,
    statuses: statusFilter === 'all' ? [] : [statusFilter],
    organizationIds: organizationFilter === 'all' ? [] : [organizationFilter],
    selectedMonth
  })

  const stats = getInvoiceStats(filteredInvoices)
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || organizationFilter !== 'all' || selectedMonth

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setOrganizationFilter('all')
    setSelectedMonth(undefined)
  }

  const getOrganizationName = (orgId: string) => {
    if (!organizations || !orgId) return 'Unknown Organization'
    const org = organizations.find(o => o?.id === orgId)
    return org ? `${org.name} (${org.country})` : 'Unknown Organization'
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
      month: 'short',
      day: 'numeric'
    })
  }

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setEditModalOpen(true)
  }

  const handlePayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setPaymentModalOpen(true)
  }

  const handlePartialPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setPartialPaymentModalOpen(true)
  }

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete invoice "${invoice.title}"?`)
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)

      if (error) {
        throw error
      }

      toast({
        title: 'Invoice deleted',
        description: `Invoice "${invoice.title}" has been successfully deleted.`,
      })
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Error deleting invoice',
        description: 'Failed to delete the invoice. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleDownloadInvoice = async (invoice: Invoice) => {
    if (!invoice.invoice_url) {
      toast({
        title: 'No file available',
        description: 'This invoice does not have a PDF file attached.',
        variant: 'destructive'
      })
      return
    }

    setDownloadingFiles(prev => new Set(prev).add(invoice.id))

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
      setDownloadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(invoice.id)
        return newSet
      })
    }
  }

  const handleRowClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setDetailsDialogOpen(true)
  }

  const handleUploadPdf = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setUploadModalOpen(true)
  }

  const handleUploadComplete = () => {
    setUploadModalOpen(false)
    setSelectedInvoice(null)
    toast({
      title: 'Upload completed',
      description: 'The invoice PDF has been uploaded successfully.'
    })
  }

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    const dateA = new Date(a.due_date || a.issued_at)
    const dateB = new Date(b.due_date || b.issued_at)
    return dateB.getTime() - dateA.getTime()
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Invoices</CardTitle>
          <CardDescription>Manage invoices for all organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-[52px] w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Invoices</CardTitle>
          <CardDescription>Manage invoices for all organizations</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-accent/10 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-medium text-text-primary">No invoices yet</h3>
              <p className="text-text-secondary mt-1 text-sm">
                Invoices created for organizations will appear here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Invoices</CardTitle>
          <CardDescription>
            Manage invoices for all organizations ({invoices.length} invoice{invoices.length !== 1 ? 's' : ''})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop Table - Hidden on mobile */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInvoices.map((invoice) => (
                  <TableRow 
                    key={invoice.id} 
                    className="h-[52px] cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(invoice)}
                  >
                    <TableCell className="font-medium">{getOrganizationName(invoice.organization_id)}</TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium text-text-primary">{invoice.title}</div>
                        {invoice.description && (
                          <div className="text-sm text-text-secondary mt-1">{invoice.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getStatusBadge(invoice.status)}
                        {invoice.status === 'partial' && invoice.total_paid && (
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(invoice.total_paid, invoice.currency)} paid
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      <div>
                        {formatCurrency(invoice.amount, invoice.currency)}
                        {invoice.status === 'partial' && invoice.remaining_amount && (
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(invoice.remaining_amount, invoice.currency)} remaining
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {invoice.due_date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-text-secondary" />
                          {formatDate(invoice.due_date)}
                        </div>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-text-secondary" />
                        {formatDate(invoice.issued_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditInvoice(invoice) }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {invoice.status !== 'paid' && (
                            <>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePartialPayment(invoice) }}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Record Partial Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePayment(invoice) }}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUploadPdf(invoice) }}>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload PDF
                          </DropdownMenuItem>
                          {invoice.invoice_url ? (
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(invoice); }}
                              disabled={downloadingFiles.has(invoice.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {downloadingFiles.has(invoice.id) ? 'Downloading...' : 'View Invoice'}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled>
                              <FileText className="h-4 w-4 mr-2" />
                              No file available
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(invoice) }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout - Shown on mobile and tablet */}
          <div className="lg:hidden space-y-3 sm:space-y-4">
            {sortedInvoices.map((invoice) => (
              <Card 
                key={invoice.id} 
                className="p-4 cursor-pointer hover:shadow-md transition-all duration-200"
                onClick={() => handleRowClick(invoice)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-text-primary truncate text-sm sm:text-base">
                        {invoice.title}
                      </h3>
                      {invoice.description && (
                        <p className="text-xs sm:text-sm text-text-secondary mt-1 line-clamp-2">
                          {invoice.description}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-text-secondary mt-1 truncate">
                        {getOrganizationName(invoice.organization_id)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(invoice.status)}
                      {invoice.status === 'partial' && invoice.total_paid && (
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(invoice.total_paid, invoice.currency)} paid
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3 text-text-secondary flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-mono text-xs sm:text-sm">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </span>
                        {invoice.status === 'partial' && invoice.remaining_amount && (
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(invoice.remaining_amount, invoice.currency)} remaining
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-text-secondary flex-shrink-0" />
                      <span className="text-xs sm:text-sm truncate">
                        {formatDate(invoice.issued_at)}
                      </span>
                    </div>
                  </div>

                  {invoice.due_date && (
                    <div className="flex items-center gap-2 text-sm pt-1 border-t">
                      <Calendar className="h-3 w-3 text-text-secondary" />
                      <span className="text-xs sm:text-sm">
                        Due: <span className={invoice.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                          {formatDate(invoice.due_date)}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Mobile Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleEditInvoice(invoice); }}
                      className="text-xs flex-1 min-w-0"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    
                    {invoice.status !== 'paid' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handlePayment(invoice); }}
                        className="text-xs flex-1 min-w-0"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Mark Paid
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleUploadPdf(invoice); }}
                      className="text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload
                    </Button>
                    
                    {invoice.invoice_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(invoice); }}
                        disabled={downloadingFiles.has(invoice.id)}
                        className="text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {downloadingFiles.has(invoice.id) ? 'Loading...' : 'View'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <InvoiceDetailsDialog
        invoice={selectedInvoice}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      {/* Edit Invoice Modal */}
      <EditInvoiceModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        invoice={selectedInvoice}
      />

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        invoice={selectedInvoice}
      />

      {/* Partial Payment Modal */}
      <PartialPaymentModal
        open={partialPaymentModalOpen}
        onOpenChange={setPartialPaymentModalOpen}
        invoice={selectedInvoice}
      />

      {/* Upload Invoice Modal */}
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
