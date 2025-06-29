
import { useState, useEffect } from 'react'
import { MoreHorizontal, Download, FileText, Search, Filter, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { Invoice } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'

interface AdminInvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
}

export function AdminInvoicesTable({ invoices, isLoading }: AdminInvoicesTableProps) {
  const { organizations } = useOrganizations()
  const isMobile = useIsMobile()
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Sort invoices by date (newest first)
  const sortedInvoices = [...invoices].sort((a, b) => {
    const dateA = new Date(a.issued_at)
    const dateB = new Date(b.issued_at)
    return dateB.getTime() - dateA.getTime()
  })

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Loading invoices...</CardDescription>
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
          <CardTitle>Invoices</CardTitle>
          <CardDescription>No invoices found</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-accent/10 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-medium">No invoices found</h3>
              <p className="text-muted-foreground mt-1">
                Create your first invoice to get started.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          Manage all organization invoices ({invoices.length} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="h-[52px]">
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-medium">{invoice.title}</div>
                      {invoice.description && (
                        <div className="text-sm text-muted-foreground mt-1">{invoice.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getOrganizationName(invoice.organization_id)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>{formatDate(invoice.issued_at)}</TableCell>
                  <TableCell>
                    {invoice.due_date ? formatDate(invoice.due_date) : 'No due date'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Invoice
                        </DropdownMenuItem>
                        {invoice.invoice_url && (
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Invoice
                        </DropdownMenuItem>
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
          {paginatedInvoices.map((invoice) => (
            <Card key={invoice.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{invoice.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {getOrganizationName(invoice.organization_id)}
                    </p>
                  </div>
                  {getStatusBadge(invoice.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <div className="font-mono">{formatCurrency(invoice.amount, invoice.currency)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Issued:</span>
                    <div>{formatDate(invoice.issued_at)}</div>
                  </div>
                </div>

                {invoice.due_date && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Due:</span>
                    <span className="ml-2">{formatDate(invoice.due_date)}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
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
      </CardContent>
    </Card>
  )
}
