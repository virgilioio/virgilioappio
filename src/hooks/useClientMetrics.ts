
import { useMemo } from 'react'
import { DollarSign, Calendar, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Invoice } from '@/hooks/useInvoices'
import { InvoiceFilters } from '@/utils/invoiceFilters'
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

interface ClientMetric {
  title: string
  value: string | number | React.ReactNode
  icon: React.ReactNode
  tooltip: string
  variant: 'default' | 'success' | 'warning' | 'destructive'
}

export function useClientMetrics(invoices: Invoice[], filters: InvoiceFilters): ClientMetric[] {
  return useMemo(() => {
    const now = new Date()
    const referenceMonth = filters.selectedMonth || now
    const monthStart = startOfMonth(referenceMonth)
    const monthEnd = endOfMonth(referenceMonth)

    // Filter invoices by issue date for display purposes
    const displayFilteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.issued_at)
      return isWithinInterval(invoiceDate, { start: monthStart, end: monthEnd })
    })

    // Helper functions
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount)
    }

    const getDateFromString = (dateString: string) => new Date(dateString)

    const outstandingBalance = displayFilteredInvoices
      .filter(inv => ['pending', 'overdue'].includes(inv.status))
      .reduce((sum, inv) => sum + inv.amount, 0)

    const overdueAmount = displayFilteredInvoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.amount, 0)

    const upcomingDueAmount = displayFilteredInvoices
      .filter(inv => inv.due_date && getDateFromString(inv.due_date) > now && inv.status === 'pending')
      .reduce((sum, inv) => sum + inv.amount, 0)

    // Paid invoices calculation - filter by payment date
    const paidInPeriod = invoices
      .filter(inv => inv.status === 'paid' && inv.paid_at && 
        isWithinInterval(getDateFromString(inv.paid_at), { start: monthStart, end: monthEnd }))
      .reduce((sum, inv) => sum + inv.amount, 0)

    const overdueCount = displayFilteredInvoices.filter(inv => inv.status === 'overdue').length

    const latestInvoice = displayFilteredInvoices
      .sort((a, b) => getDateFromString(b.issued_at).getTime() - getDateFromString(a.issued_at).getTime())[0]

    const periodLabel = filters.selectedMonth 
      ? filters.selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'This Month'

    const metrics: ClientMetric[] = [
      {
        title: 'Outstanding Balance',
        value: formatCurrency(outstandingBalance),
        icon: <DollarSign className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Unpaid invoices from selected month' : 'Unpaid invoices from this month',
        variant: outstandingBalance > 0 ? 'warning' : 'default'
      },
      {
        title: 'Overdue Payments',
        value: formatCurrency(overdueAmount),
        icon: <AlertTriangle className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Total overdue amount from selected month' : 'Total overdue amount from this month',
        variant: overdueAmount > 0 ? 'destructive' : 'default'
      },
      {
        title: 'Upcoming Due Amount',
        value: formatCurrency(upcomingDueAmount),
        icon: <Calendar className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Pending invoices due from selected month' : 'Pending invoices due from this month',
        variant: 'default'
      },
      {
        title: `Paid Invoices (${periodLabel})`,
        value: formatCurrency(paidInPeriod),
        icon: <DollarSign className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Paid invoices from selected month (by payment date)' : 'Invoices paid this month',
        variant: 'success'
      },
      {
        title: 'Overdue Invoice Count',
        value: overdueCount,
        icon: <AlertTriangle className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Number of overdue invoices from selected month' : 'Number of overdue invoices from this month',
        variant: overdueCount > 0 ? 'destructive' : 'default'
      }
    ]

    // Add latest invoice card if exists
    if (latestInvoice) {
      metrics.push({
        title: 'Latest Invoice',
        value: (
          <div className="space-y-1">
            <div className="text-sm font-medium truncate">{latestInvoice.title}</div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{formatCurrency(latestInvoice.amount)}</span>
              <Badge 
                variant={latestInvoice.status === 'paid' ? 'default' : latestInvoice.status === 'overdue' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {latestInvoice.status}
              </Badge>
            </div>
            {latestInvoice.due_date && (
              <div className="text-xs text-muted-foreground">
                Due: {getDateFromString(latestInvoice.due_date).toLocaleDateString()}
              </div>
            )}
          </div>
        ),
        icon: <DollarSign className="h-5 w-5" />,
        tooltip: 'Most recently issued invoice',
        variant: 'default'
      })
    }

    return metrics
  }, [invoices, filters])
}
