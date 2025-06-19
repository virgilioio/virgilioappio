import { useMemo } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { calculatePaymentMetrics } from '@/utils/invoiceUtils'
import { useInvoiceFilter } from '@/utils/invoiceFilters'

export function PriorityPaymentAlert() {
  const { invoices } = useInvoices()
  const { canViewBilling } = usePermissions()
  const { userType, organizationId } = useAuth()
  const { filters } = useInvoiceFilter()

  const { overdueData, urgentData } = useMemo(() => {
    if (!canViewBilling || !invoices) return { overdueData: null, urgentData: null }

    console.log('PriorityPaymentAlert: Processing invoices for context:', { userType, organizationId, invoiceCount: invoices.length })

    // Use unified payment metrics calculation with month filter
    const metrics = calculatePaymentMetrics(
      invoices,
      userType !== 'platform_admin' ? organizationId : undefined,
      filters
    )

    console.log('PriorityPaymentAlert: Calculated amounts:', { 
      overdueCount: metrics.overdueCount, 
      overdueAmount: metrics.overdueAmount,
      urgentCount: metrics.urgentCount,
      urgentAmount: metrics.urgentAmount 
    })

    return {
      overdueData: metrics.overdueCount > 0 ? {
        count: metrics.overdueCount,
        amount: metrics.overdueAmount,
        invoices: metrics.overdueInvoices
      } : null,
      urgentData: metrics.urgentCount > 0 ? {
        count: metrics.urgentCount,
        amount: metrics.urgentAmount,
        invoices: metrics.urgentInvoices
      } : null
    }
  }, [invoices, canViewBilling, userType, organizationId, filters])

  // Don't render if no critical payments or user can't view billing
  if (!canViewBilling || (!overdueData && !urgentData)) {
    return null
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // Show overdue as priority if exists, otherwise show urgent
  const showOverdue = !!overdueData
  const data = showOverdue ? overdueData : urgentData!
  const variant = showOverdue ? 'destructive' : 'default'
  const icon = showOverdue ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />
  const title = showOverdue ? 'Overdue Payments' : 'Urgent Payments Due Soon'
  const description = showOverdue 
    ? `You have ${data.count} overdue invoice${data.count > 1 ? 's' : ''} totaling ${formatCurrency(data.amount)}`
    : `You have ${data.count} invoice${data.count > 1 ? 's' : ''} due within 7 days totaling ${formatCurrency(data.amount)}`

  return (
    <Alert variant={variant} className={`mb-6 ${showOverdue ? 'animate-pulse' : ''}`}>
      {icon}
      <AlertTitle className="flex items-center gap-2">
        {title}
        <Badge variant={showOverdue ? 'destructive' : 'secondary'}>
          {data.count} invoice{data.count > 1 ? 's' : ''}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{description}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/settings?tab=billing">
            <Button size="sm" variant={showOverdue ? 'destructive' : 'default'}>
              View All Invoices
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          {showOverdue && urgentData && (
            <Badge variant="secondary" className="self-start">
              + {urgentData.count} more due soon ({formatCurrency(urgentData.amount)})
            </Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
