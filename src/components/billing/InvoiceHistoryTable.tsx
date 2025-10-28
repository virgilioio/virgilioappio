import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { formatPrice } from '@/utils/pricing'
import type { Invoice } from '@/hooks/useInvoiceHistory'

interface InvoiceHistoryTableProps {
  invoices: Invoice[]
}

export function InvoiceHistoryTable({ invoices }: InvoiceHistoryTableProps) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No invoices yet</p>
        <p className="text-xs mt-1">Your invoice history will appear here after your first payment</p>
      </div>
    )
  }

  const getStatusBadge = (status: Invoice['status']) => {
    const variants: Record<Invoice['status'], { variant: any; label: string }> = {
      paid: { variant: 'success', label: 'Paid' },
      open: { variant: 'warning', label: 'Open' },
      void: { variant: 'outline', label: 'Void' },
      uncollectible: { variant: 'destructive', label: 'Uncollectible' },
      draft: { variant: 'secondary', label: 'Draft' },
    }
    const config = variants[status] || variants.draft
    return <Badge variant={config.variant as any}>{config.label}</Badge>
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">
                {invoice.number || invoice.id.substring(0, 8)}
              </TableCell>
              <TableCell>
                {format(new Date(invoice.created), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {invoice.periodStart && invoice.periodEnd ? (
                  <>
                    {format(new Date(invoice.periodStart), 'MMM d')} - {format(new Date(invoice.periodEnd), 'MMM d, yyyy')}
                  </>
                ) : (
                  'N/A'
                )}
              </TableCell>
              <TableCell className="font-medium">
                {formatPrice(invoice.amount, invoice.currency)}
              </TableCell>
              <TableCell>
                {getStatusBadge(invoice.status)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  {invoice.pdfUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(invoice.pdfUrl!, '_blank')}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  )}
                  {invoice.hostedInvoiceUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(invoice.hostedInvoiceUrl!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
