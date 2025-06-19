
import { useMemo } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'

export function PriorityPaymentAlert() {
  const { invoices } = useInvoices()
  const { canViewBilling } = usePermissions()
  const { userType, organizationId } = useAuth()

  const { overdueData, urgentData } = useMemo(() => {
    if (!canViewBilling || !invoices) return { overdueData: null, urgentData: null }

    console.log('PriorityPaymentAlert: Processing invoices for context:', { userType, organizationId, invoiceCount: invoices.length })

    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // For workspace owners, show invoices they need to pay (pending status)
    // For platform admins, show invoices they've sent that are overdue/urgent
    const relevantInvoices = invoices.filter(invoice => {
      if (userType === 'platform_admin') {
        // Platform admins see all pending invoices (ones they've sent)
        return invoice.status === 'pending'
      } else {
        // Workspace owners see invoices for their organization that they need to pay
        return invoice.status === 'pending' && invoice.organization_id === organizationId
      }
    })

    console.log('PriorityPaymentAlert: Relevant invoices:', relevantInvoices.length)

    // Calculate overdue invoices (past due date)
    const overdueInvoices = relevantInvoices.filter(invoice => {
      if (!invoice.due_date) return false
      return new Date(invoice.due_date) < now
    })

    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

    // Calculate urgent invoices (due within 7 days)
    const urgentInvoices = relevantInvoices.filter(invoice => {
      if (!invoice.due_date) return false
      const dueDate = new Date(invoice.due_date)
      return dueDate >= now && dueDate <= sevenDaysFromNow
    })

    const urgentAmount = urgentInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

    console.log('PriorityPaymentAlert: Calculated amounts:', { 
      overdueCount: overdueInvoices.length, 
      overdueAmount,
      urgentCount: urgentInvoices.length,
      urgentAmount 
    })

    return {
      overdueData: overdueInvoices.length > 0 ? {
        count: overdueInvoices.length,
        amount: overdueAmount,
        invoices: overdueInvoices
      } : null,
      urgentData: urgentInvoices.length > 0 ? {
        count: urgentInvoices.length,
        amount: urgentAmount,
        invoices: urgentInvoices
      } : null
    }
  }, [invoices, canViewBilling, userType, organizationId])

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
