
import { useState, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { MultiSelect } from '@/components/ui/multi-select'
import { Button } from '@/components/ui/button'
import { MonthPicker } from '@/components/ui/month-picker'
import { useInvoices, Invoice } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { Receipt, Download, FileText, Search, Filter, Calendar, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { InvoiceUploadModal } from './InvoiceUploadModal'
import { getInvoicePdfUrl } from '@/lib/invoiceStorage'
import { filterInvoices, getInvoiceStats, useInvoiceFilter } from '@/utils/invoiceFilters'
import { useSortableTable } from '@/hooks/useSortableTable'
import { SortableHeader } from '@/components/ui/sortable-header'

export function InvoicesTable() {
  const { invoices, isLoading, refreshInvoices } = useInvoices()
  const { isPlatformAdmin, canManageInvoices } = usePermissions()
  const { filters, setFilters, setFilteredInvoices } = useInvoiceFilter()
  const isMobile = useIsMobile()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>()
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Update filter context when local filters change
  useEffect(() => {
    const newFilters = {
      searchTerm,
      statuses: selectedStatuses,
      selectedMonth
    }
    setFilters(newFilters)
  }, [searchTerm, selectedStatuses, selectedMonth, setFilters])

  // Filter invoices based on all filters
  const filteredInvoices = filterInvoices(invoices, {
    searchTerm,
    statuses: selectedStatuses,
    selectedMonth
  })

  // Update filtered invoices in context
  useEffect(() => {
    setFilteredInvoices(filteredInvoices)
  }, [filteredInvoices, setFilteredInvoices])

  const stats = getInvoiceStats(filteredInvoices)
  const hasActiveFilters = searchTerm || selectedStatuses.length > 0 || selectedMonth

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedStatuses, selectedMonth])

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedStatuses([])
    setSelectedMonth(undefined)
  }

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
  ]

  // Add sorting functionality  
  const { sortedData: sortedInvoices, sortConfig, requestSort } = useSortableTable(
    filteredInvoices, 
    { key: 'issued_at', direction: 'desc' }
  )

  // Pagination calculations
  const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInvoices = sortedInvoices.slice(startIndex, endIndex)

  // Generate page numbers for pagination - exact same logic as JobsTable
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show first page
      pages.push(1)
      
      if (currentPage > 4) {
        pages.push('ellipsis')
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 3) {
        pages.push('ellipsis')
      }
      
      // Show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }
    
    return pages
  }

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
            {filteredInvoices.length !== invoices.length && (
              <span className="text-muted-foreground ml-1">
                • Showing {filteredInvoices.length} of {invoices.length} filtered
              </span>
            )}
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
              {/* Filters - now truly at the top */}
              <Card>
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
                    <MultiSelect
                      options={statusOptions}
                      selectedValues={selectedStatuses}
                      onSelectionChange={setSelectedStatuses}
                      placeholder="Filter by status"
                      className="w-full sm:w-[160px]"
                    />
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
                        {selectedStatuses.length > 0 && (
                          <Badge variant="secondary">
                            Status: {selectedStatuses.join(', ')}
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

              {/* Summary stats for filtered results */}
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Outstanding</div>
                  <div className="text-lg font-semibold text-orange-600">
                    {formatAmount(stats.totalPending + stats.totalOverdue, filteredInvoices[0]?.currency || 'USD')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.pendingCount + stats.overdueCount} invoice{stats.pendingCount + stats.overdueCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Paid</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatAmount(stats.totalPaid, filteredInvoices[0]?.currency || 'USD')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.paidCount} invoice{stats.paidCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Invoices</div>
                  <div className="text-lg font-semibold">
                    {stats.totalInvoices}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {hasActiveFilters ? `of ${invoices.length} total` : 'all invoices'}
                  </div>
                </div>
              </div>

              {/* Invoices table */}
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
                    {paginatedInvoices.map((invoice) => (
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

              {/* Enhanced Pagination Controls - Matching JobsTable exactly */}
              {totalPages > 1 && (
                <div className="mt-8 space-y-6">
                  {/* Results Summary Card */}
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary/50 border border-border/50 rounded-brand text-sm text-text-secondary backdrop-blur-sm">
                      <FileText className="h-4 w-4 opacity-60" />
                      <span className="font-medium">
                        Showing {startIndex + 1}-{Math.min(endIndex, sortedInvoices.length)} of {sortedInvoices.length} invoices
                      </span>
                    </div>
                  </div>
                  
                  {/* Enhanced Pagination Navigation */}
                  <div className="flex justify-center">
                    <div className="inline-flex items-center bg-surface-primary border border-border/80 rounded-brand shadow-sm p-1 gap-1">
                      {/* Previous Button */}
                      <button
                        onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`
                          inline-flex items-center gap-2 px-3 py-2 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                          ${currentPage === 1 
                            ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                          }
                        `}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Previous</span>
                      </button>

                      {/* Page Numbers */}
                      <div className="flex items-center gap-1 px-2">
                        {getPageNumbers().map((page, index) => (
                          <div key={index}>
                            {page === 'ellipsis' ? (
                              <div className="flex items-center justify-center w-8 h-8 text-text-tertiary">
                                <MoreHorizontal className="h-4 w-4" />
                              </div>
                            ) : (
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`
                                  w-8 h-8 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                                  ${currentPage === page
                                    ? 'bg-accent text-accent-foreground shadow-sm scale-105 font-semibold'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                                  }
                                `}
                              >
                                {page}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`
                          inline-flex items-center gap-2 px-3 py-2 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                          ${currentPage === totalPages 
                            ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                          }
                        `}
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Simplified Pagination */}
                  <div className="sm:hidden flex justify-center">
                    <div className="inline-flex items-center gap-4 px-4 py-2 bg-surface-secondary/30 border border-border/50 rounded-brand backdrop-blur-sm">
                      <button
                        onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`
                          p-2 rounded-brand transition-all duration-200
                          ${currentPage === 1 
                            ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:scale-105 active:scale-95'
                          }
                        `}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-text-secondary">Page</span>
                        <span className="font-medium text-text-primary bg-accent/20 px-2 py-1 rounded-brand">
                          {currentPage}
                        </span>
                        <span className="text-text-secondary">of {totalPages}</span>
                      </div>
                      
                      <button
                        onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`
                          p-2 rounded-brand transition-all duration-200
                          ${currentPage === totalPages 
                            ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:scale-105 active:scale-95'
                          }
                        `}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
