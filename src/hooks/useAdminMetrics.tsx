
import { useMemo } from 'react'
import { DollarSign, Calendar, AlertTriangle } from 'lucide-react'
import { Invoice } from '@/hooks/useInvoices'
import { InvoiceFilters } from '@/utils/invoiceFilters'
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

interface AdminMetric {
  title: string
  value: string | number
  icon: React.ReactNode
  tooltip: string
  variant: 'default' | 'success' | 'warning' | 'destructive'
}

export function useAdminMetrics(invoices: Invoice[], filters: InvoiceFilters): AdminMetric[] {
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

    const formatDays = (days: number) => {
      return `${days.toFixed(1)} days`
    }

    const getDateFromString = (dateString: string) => new Date(dateString)

    // Total Invoiced - filtered by ISSUE date
    const totalInvoicedThisMonth = displayFilteredInvoices
      .reduce((sum, inv) => sum + inv.amount, 0)

    // Total Paid - filtered by PAYMENT date
    const totalPaidThisMonth = invoices
      .filter(inv => inv.status === 'paid' && inv.paid_at && 
        isWithinInterval(getDateFromString(inv.paid_at), { start: monthStart, end: monthEnd }))
      .reduce((sum, inv) => sum + inv.amount, 0)

    // Outstanding/overdue calculations
    const outstandingBalance = displayFilteredInvoices
      .filter(inv => ['pending', 'overdue'].includes(inv.status))
      .reduce((sum, inv) => sum + inv.amount, 0)

    const overdueAmount = displayFilteredInvoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.amount, 0)

    const overdueCount = displayFilteredInvoices.filter(inv => inv.status === 'overdue').length

    const clientsWithOverdue = new Set(
      displayFilteredInvoices
        .filter(inv => inv.status === 'overdue')
        .map(inv => inv.organization_id)
    ).size

    const invoicesInPeriod = displayFilteredInvoices.length

    // Payment delay calculation
    const paidInvoices = invoices.filter(inv => inv.status === 'paid' && inv.paid_at)
    const avgPaymentDelay = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, inv) => {
          const issueDate = getDateFromString(inv.issued_at)
          const paidDate = getDateFromString(inv.paid_at!)
          const diffInDays = (paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
          return sum + diffInDays
        }, 0) / paidInvoices.length
      : 0

    const periodLabel = filters.selectedMonth 
      ? referenceMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'This Month'

    return [
      {
        title: `Total Invoiced (${periodLabel})`,
        value: formatCurrency(totalInvoicedThisMonth),
        icon: <DollarSign className="h-5 w-5" />,
        tooltip: `Invoices issued in ${periodLabel.toLowerCase()}`,
        variant: 'default'
      },
      {
        title: `Total Paid (${periodLabel})`,
        value: formatCurrency(totalPaidThisMonth),
        icon: <DollarSign className="h-5 w-5" />,
        tooltip: `Payments received in ${periodLabel.toLowerCase()}, regardless of issue date`,
        variant: 'success'
      },
      {
        title: 'Overdue Payments',
        value: formatCurrency(overdueAmount),
        icon: <AlertTriangle className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Total overdue amount from selected period' : 'Total overdue amount from this month',
        variant: overdueAmount > 0 ? 'destructive' : 'default'
      },
      {
        title: 'Outstanding Balance',
        value: formatCurrency(outstandingBalance),
        icon: <AlertTriangle className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Unpaid invoices from selected period' : 'Unpaid invoices from this month',
        variant: outstandingBalance > 0 ? 'warning' : 'default'
      },
      {
        title: 'Overdue Invoice Count',
        value: overdueCount,
        icon: <AlertTriangle className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Number of overdue invoices from selected period' : 'Number of overdue invoices from this month',
        variant: overdueCount > 0 ? 'destructive' : 'default'
      },
      {
        title: 'Clients with Overdue',
        value: clientsWithOverdue,
        icon: <AlertTriangle className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? 'Organizations with overdue invoices from selected period' : 'Organizations with overdue invoices from this month',
        variant: clientsWithOverdue > 0 ? 'destructive' : 'default'
      },
      {
        title: filters.selectedMonth ? `Invoices (${periodLabel})` : 'Invoices (This Month)',
        value: invoicesInPeriod,
        icon: <Calendar className="h-5 w-5" />,
        tooltip: filters.selectedMonth ? `Invoices from ${periodLabel.toLowerCase()}` : 'Invoices issued this month',
        variant: 'default'
      },
      {
        title: 'Avg Payment Delay',
        value: formatDays(avgPaymentDelay),
        icon: <Calendar className="h-5 w-5" />,
        tooltip: 'Average time between invoice issue and payment across all invoices',
        variant: 'default'
      }
    ]
  }, [invoices, filters])
}
