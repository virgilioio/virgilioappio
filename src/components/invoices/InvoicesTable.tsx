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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { useInvoices, Invoice } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { Receipt, Download, FileText, Search, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
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

  // Updated pagination logic to match other tables
  const getPageNumbers = (currentPage: number, totalPages: number) => {
    const pages = []
    const showEllipsis = totalPages > 7

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }
    return pages
  }

  // Updated pagination component to match other tables
  const PaginationComponent = () => {
    if (totalPages <= 1) return null

    const pageNumbers = getPageNumbers(currentPage, totalPages)

    if (isMobile) {
      return (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-md">
            Page {currentPage} of {totalPages}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="flex items-center gap-1 hover:scale-105 transition-all duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center gap-1">
          {pageNumbers.map((pageNum, index) => (
            <Button
              key={index}
              variant={currentPage === pageNum ? "default" : "outline"}
              size="sm"
              onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
              disabled={typeof pageNum !== 'number'}
              className={`min-w-[40px] transition-all duration-200 ${
                currentPage === pageNum 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:scale-105 hover:shadow-sm'
              } ${typeof pageNum !== 'number' ? 'cursor-default' : ''}`}
            >
              {pageNum}
            </Button>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 hover:scale-105 transition-all duration-200"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
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

              {/* Enhanced Pagination Controls */}
              {totalPages > 1 && (
                <div className="space-y-4">
                  {/* Results Summary Card */}
                  <Card className="bg-gradient-to-r from-muted/50 to-muted/30 border-muted/50 backdrop-blur-sm">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                          <span>
                            Showing <span className="font-medium text-foreground">{startIndex + 1}-{Math.min(endIndex, sortedInvoices.length)}</span> of{' '}
                            <span className="font-medium text-foreground">{sortedInvoices.length}</span> invoices
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          Page <span className="font-medium text-foreground">{currentPage}</span> of{' '}
                          <span className="font-medium text-foreground">{totalPages}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pagination Controls */}
                  <div className="flex justify-center">
                    <div className="bg-background/80 backdrop-blur-sm border border-muted/50 rounded-lg p-2 shadow-lg">
                      <PaginationComponent />
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
