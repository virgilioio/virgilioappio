import { useState } from 'react'
import { MoreHorizontal, Download, FileText, Calendar, DollarSign, Search, Filter } from 'lucide-react'
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
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { Invoice } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'
import { filterInvoices, getInvoiceStats } from '@/utils/invoiceFilters'
import { InvoiceDetailsDialog } from './InvoiceDetailsDialog'

interface WorkspaceOwnerInvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
}

export function WorkspaceOwnerInvoicesTable({ invoices, isLoading }: WorkspaceOwnerInvoicesTableProps) {
  const { organizations } = useOrganizations()
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>()
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  // Filter invoices based on all filters
  const filteredInvoices = filterInvoices(invoices || [], {
    searchTerm,
    statuses: statusFilter === 'all' ? [] : [statusFilter],
    selectedMonth
  })

  const stats = getInvoiceStats(filteredInvoices)
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || selectedMonth

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
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

  const handleRowClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setDetailsDialogOpen(true)
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

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    const dateA = new Date(a.due_date || a.issued_at)
    const dateB = new Date(b.due_date || b.issued_at)
    return dateB.getTime() - dateA.getTime()
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Your organization's billing history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
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
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Your organization's billing history</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-accent/10 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-text-primary">No invoices yet</h3>
              <p className="text-text-secondary mt-1">
                Your billing history will appear here once invoices are created.
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
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            Your organization's billing history ({invoices.length} invoice{invoices.length !== 1 ? 's' : ''})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
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
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <MonthPicker
                  selected={selectedMonth}
                  onSelect={setSelectedMonth}
                  placeholder="Filter by month"
                  className="w-full sm:w-[160px]"
                />
              </div>

              {/* Filter summary */}
              {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                    <span>Showing {filteredInvoices.length} of {invoices.length} invoices</span>
                    {selectedMonth && (
                      <Badge variant="secondary">
                        <Calendar className="h-3 w-3 mr-1" />
                        {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </Badge>
                    )}
                    {statusFilter !== 'all' && (
                      <Badge variant="secondary">
                        Status: {statusFilter}
                      </Badge>
                    )}
                    {searchTerm && (
                      <Badge variant="secondary">
                        Search: "{searchTerm}"
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {hasActiveFilters && (
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Total Invoices</div>
                <div className="text-lg font-semibold">{stats.totalInvoices}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Pending</div>
                <div className="text-lg font-semibold text-orange-600">
                  {stats.pendingCount} (${stats.totalPending.toLocaleString()})
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Overdue</div>
                <div className="text-lg font-semibold text-red-600">
                  {stats.overdueCount} (${stats.totalOverdue.toLocaleString()})
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Paid</div>
                <div className="text-lg font-semibold text-green-600">
                  {stats.paidCount} (${stats.totalPaid.toLocaleString()})
                </div>
              </div>
            </div>
          )}

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium text-text-primary">{invoice.title}</div>
                        {invoice.description && (
                          <div className="text-sm text-text-secondary mt-1">{invoice.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(invoice.amount, invoice.currency)}
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-4">
            {sortedInvoices.map((invoice) => (
              <Card 
                key={invoice.id} 
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleRowClick(invoice)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-text-primary truncate">{invoice.title}</h3>
                      {invoice.description && (
                        <p className="text-sm text-text-secondary mt-1">{invoice.description}</p>
                      )}
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3 text-text-secondary" />
                      <span className="font-mono">{formatCurrency(invoice.amount, invoice.currency)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-text-secondary" />
                      <span>{formatDate(invoice.issued_at)}</span>
                    </div>
                  </div>

                  {invoice.due_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3 w-3 text-text-secondary" />
                      <span>Due: {formatDate(invoice.due_date)}</span>
                    </div>
                  )}

                  {invoice.invoice_url && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(invoice); }}
                      disabled={downloadingFiles.has(invoice.id)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloadingFiles.has(invoice.id) ? 'Downloading...' : 'View Invoice'}
                    </Button>
                  )}
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
    </>
  )
}
