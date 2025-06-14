
import { useState } from 'react'
import { MoreHorizontal, Download, FileText, Calendar, DollarSign } from 'lucide-react'
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
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { Invoice } from '@/hooks/useInvoices'
import { useOrganizations } from '@/hooks/useOrganizations'

interface WorkspaceOwnerInvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
}

export function WorkspaceOwnerInvoicesTable({ invoices, isLoading }: WorkspaceOwnerInvoicesTableProps) {
  const { organizations } = useOrganizations()
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())

  const getOrganizationName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    return org ? `${org.name} (${org.country})` : orgId
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
    if (invoice.invoice_url) {
      handleDownloadInvoice(invoice)
    }
  }

  const sortedInvoices = [...invoices].sort((a, b) => {
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

  if (sortedInvoices.length === 0) {
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
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          Your organization's billing history ({sortedInvoices.length} invoice{sortedInvoices.length !== 1 ? 's' : ''})
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                  className="h-[52px]"
                  interactive={!!invoice.invoice_url}
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
              className={`p-4 ${invoice.invoice_url ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
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
  )
}
