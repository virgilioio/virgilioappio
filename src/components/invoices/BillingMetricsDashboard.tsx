import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useInvoices, Invoice } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { DollarSign, Calendar, AlertTriangle } from 'lucide-react'
import { useInvoiceFilter } from '@/utils/invoiceFilters'
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

interface MetricCardProps {
  title: string
  value: string | number | React.ReactNode
  icon?: React.ReactNode
  tooltip?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
}

function MetricCard({ title, value, icon, tooltip, variant = 'default' }: MetricCardProps) {
  const getBorderColor = () => {
    switch (variant) {
      case 'success': return 'border-green-200'
      case 'warning': return 'border-orange-200'
      case 'destructive': return 'border-red-200'
      default: return 'border-border'
    }
  }

  const card = (
    <Card className={`${getBorderColor()} hover:shadow-md transition-shadow`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="h-5 w-5 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {card}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return card
}

export function BillingMetricsDashboard() {
  const { invoices } = useInvoices()
  const { canManageInvoices, canViewBilling } = usePermissions()
  const { user, organizationId } = useAuth()
  const { filters } = useInvoiceFilter()

  // Don't render if user can't view billing
  if (!canViewBilling) {
    return null
  }

  const metrics = useMemo(() => {
    // Filter invoices based on role
    let filteredInvoices = canManageInvoices 
      ? invoices // Admin/Billing sees all
      : invoices.filter(invoice => invoice.organization_id === organizationId) // Scoped to org

    // Apply month filter if selected
    if (filters.selectedMonth) {
      const monthStart = startOfMonth(filters.selectedMonth)
      const monthEnd = endOfMonth(filters.selectedMonth)
      
      filteredInvoices = filteredInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.issued_at)
        return isWithinInterval(invoiceDate, { start: monthStart, end: monthEnd })
      })
    }

    const now = new Date()
    const startOfMonthCurrent = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

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

    if (canManageInvoices) {
      // Admin/Billing metrics - use the selected month or current month for calculations
      const referenceMonth = filters.selectedMonth || startOfMonthCurrent
      const monthStart = startOfMonth(referenceMonth)
      const monthEnd = endOfMonth(referenceMonth)

      const totalInvoicedThisMonth = filteredInvoices
        .filter(inv => {
          const issueDate = getDateFromString(inv.issued_at)
          return isWithinInterval(issueDate, { start: monthStart, end: monthEnd })
        })
        .reduce((sum, inv) => sum + inv.amount, 0)

      const totalPaidThisMonth = filteredInvoices
        .filter(inv => inv.status === 'paid' && inv.paid_at && 
          isWithinInterval(getDateFromString(inv.paid_at), { start: monthStart, end: monthEnd }))
        .reduce((sum, inv) => sum + inv.amount, 0)

      const outstandingBalance = filteredInvoices
        .filter(inv => ['pending', 'overdue'].includes(inv.status))
        .reduce((sum, inv) => sum + inv.amount, 0)

      const overdueCount = filteredInvoices.filter(inv => inv.status === 'overdue').length

      const clientsWithOverdue = new Set(
        filteredInvoices
          .filter(inv => inv.status === 'overdue')
          .map(inv => inv.organization_id)
      ).size

      const invoicesInPeriod = filteredInvoices.length

      const paidInvoices = filteredInvoices.filter(inv => inv.status === 'paid' && inv.paid_at)
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
          variant: 'default' as const
        },
        {
          title: `Total Paid (${periodLabel})`,
          value: formatCurrency(totalPaidThisMonth),
          icon: <DollarSign className="h-5 w-5" />,
          tooltip: `Payments received in ${periodLabel.toLowerCase()}`,
          variant: 'success' as const
        },
        {
          title: 'Outstanding Balance',
          value: formatCurrency(outstandingBalance),
          icon: <AlertTriangle className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? 'Unpaid invoices from selected period' : 'Total unpaid invoice amount across all organizations',
          variant: outstandingBalance > 0 ? 'warning' as const : 'default' as const
        },
        {
          title: 'Overdue Invoices',
          value: overdueCount,
          icon: <AlertTriangle className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? 'Overdue invoices from selected period' : 'Number of overdue invoices',
          variant: overdueCount > 0 ? 'destructive' as const : 'default' as const
        },
        {
          title: 'Clients with Overdue',
          value: clientsWithOverdue,
          icon: <AlertTriangle className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? 'Organizations with overdue invoices from selected period' : 'Number of organizations with overdue invoices',
          variant: clientsWithOverdue > 0 ? 'destructive' as const : 'default' as const
        },
        {
          title: filters.selectedMonth ? `Invoices (${periodLabel})` : 'Invoices (Last 30 Days)',
          value: invoicesInPeriod,
          icon: <Calendar className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? `Invoices from ${periodLabel.toLowerCase()}` : 'Invoices issued in the last 30 days',
          variant: 'default' as const
        },
        {
          title: 'Avg Payment Delay',
          value: formatDays(avgPaymentDelay),
          icon: <Calendar className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? 'Average payment delay for selected period' : 'Average time between invoice issue and payment',
          variant: 'default' as const
        }
      ]
    } else {
      // Workspace Owner/Client metrics (org-scoped) - respect month filter
      const outstandingBalance = filteredInvoices
        .filter(inv => ['pending', 'overdue'].includes(inv.status))
        .reduce((sum, inv) => sum + inv.amount, 0)

      const upcomingDueAmount = filteredInvoices
        .filter(inv => inv.due_date && getDateFromString(inv.due_date) > now && inv.status === 'pending')
        .reduce((sum, inv) => sum + inv.amount, 0)

      const paidInPeriod = filteredInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.amount, 0)

      const overdueCount = filteredInvoices.filter(inv => inv.status === 'overdue').length

      const latestInvoice = filteredInvoices
        .sort((a, b) => getDateFromString(b.issued_at).getTime() - getDateFromString(a.issued_at).getTime())[0]

      const periodLabel = filters.selectedMonth 
        ? filters.selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'YTD'

      return [
        {
          title: 'Outstanding Balance',
          value: formatCurrency(outstandingBalance),
          icon: <DollarSign className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? 'Unpaid invoices from selected month' : 'Total unpaid invoice amount for your organization',
          variant: outstandingBalance > 0 ? 'warning' as const : 'default' as const
        },
        {
          title: 'Upcoming Due Amount',
          value: formatCurrency(upcomingDueAmount),
          icon: <Calendar className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? 'Pending invoices due from selected month' : 'Amount due for pending invoices',
          variant: 'default' as const
        },
        {
          title: `Paid Invoices (${periodLabel})`,
          value: formatCurrency(paidInPeriod),
          icon: <DollarSign className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? 'Paid invoices from selected month' : 'Total paid invoices this year',
          variant: 'success' as const
        },
        {
          title: 'Overdue Invoices',
          value: overdueCount,
          icon: <AlertTriangle className="h-5 w-5" />,
          tooltip: filters.selectedMonth ? 'Overdue invoices from selected month' : 'Number of overdue invoices',
          variant: overdueCount > 0 ? 'destructive' as const : 'default' as const
        },
        // Latest Invoice Summary Card
        ...(latestInvoice ? [{
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
          variant: 'default' as const
        }] : [])
      ]
    }
  }, [invoices, canManageInvoices, organizationId, filters])

  if (metrics.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            tooltip={metric.tooltip}
            variant={metric.variant}
          />
        ))}
      </div>
    </div>
  )
}
