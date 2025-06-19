
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, TrendingUp, ExternalLink, AlertTriangle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { useAuth } from '@/contexts/AuthContext'

export function PaymentsTracker() {
  const { invoices, isLoading } = useInvoices()
  const { userType, organizationId } = useAuth()
  const [paymentsDue, setPaymentsDue] = useState(0)
  const [overdueAmount, setOverdueAmount] = useState(0)
  const [urgentAmount, setUrgentAmount] = useState(0)
  const [incomingPayments, setIncomingPayments] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const [urgentCount, setUrgentCount] = useState(0)

  useEffect(() => {
    if (invoices) {
      console.log('PaymentsTracker: Processing invoices for context:', { userType, organizationId, invoiceCount: invoices.length })
      
      const now = new Date()
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      // Filter invoices based on user context
      let relevantInvoices = invoices

      if (userType !== 'platform_admin' && organizationId) {
        // For workspace owners, only show invoices for their organization
        relevantInvoices = invoices.filter(invoice => invoice.organization_id === organizationId)
        console.log('PaymentsTracker: Filtered to organization invoices:', relevantInvoices.length)
      }

      const pending = relevantInvoices.filter(invoice => invoice.status === 'pending')
      const paymentsDueAmount = pending.reduce((sum, invoice) => sum + (invoice.amount || 0), 0)
      
      // Calculate overdue (past due date)
      const overdue = pending.filter(invoice => {
        if (!invoice.due_date) return false
        return new Date(invoice.due_date) < now
      })
      const overdueTotal = overdue.reduce((sum, invoice) => sum + invoice.amount, 0)
      
      // Calculate urgent (due within 7 days, not overdue)
      const urgent = pending.filter(invoice => {
        if (!invoice.due_date) return false
        const dueDate = new Date(invoice.due_date)
        return dueDate >= now && dueDate <= sevenDaysFromNow
      })
      const urgentTotal = urgent.reduce((sum, invoice) => sum + invoice.amount, 0)
      
      console.log('PaymentsTracker: Calculated amounts:', {
        paymentsDueAmount,
        overdueTotal,
        urgentTotal,
        pendingCount: pending.length,
        overdueCount: overdue.length,
        urgentCount: urgent.length
      })
      
      setPaymentsDue(paymentsDueAmount)
      setOverdueAmount(overdueTotal)
      setUrgentAmount(urgentTotal)
      setIncomingPayments(paymentsDueAmount) // For workspace owners, this represents what they owe
      setPendingCount(pending.length)
      setOverdueCount(overdue.length)
      setUrgentCount(urgent.length)
    }
  }, [invoices, userType, organizationId])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payments Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // Determine labels based on user type
  const getLabels = () => {
    if (userType === 'platform_admin') {
      return {
        totalDueLabel: 'Total Receivable',
        incomingLabel: 'Expected Income'
      }
    } else {
      return {
        totalDueLabel: 'Total Due',
        incomingLabel: 'Amount Owed'
      }
    }
  }

  const { totalDueLabel, incomingLabel } = getLabels()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Payments Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Priority Section - Overdue & Urgent */}
        {(overdueCount > 0 || urgentCount > 0) && (
          <div className="space-y-3 pb-4 border-b border-border">
            {overdueCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border-destructive border bg-destructive/5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Overdue</p>
                    <p className="text-lg font-bold text-destructive">
                      {formatCurrency(overdueAmount)}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">{overdueCount} invoice{overdueCount > 1 ? 's' : ''}</Badge>
              </div>
            )}
            
            {urgentCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border-orange-200 border bg-orange-50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-700">Due Soon (7 days)</p>
                    <p className="text-lg font-bold text-orange-700">
                      {formatCurrency(urgentAmount)}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {urgentCount} invoice{urgentCount > 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Regular Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-text-secondary">{totalDueLabel}</p>
            <p className="text-2xl font-semibold text-text-primary">
              {formatCurrency(paymentsDue)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-text-secondary">{incomingLabel}</p>
            <p className="text-2xl font-semibold text-success">
              {formatCurrency(incomingPayments)}
            </p>
          </div>
        </div>
        
        {pendingCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{pendingCount}</Badge>
              <span className="text-sm text-text-secondary">total pending invoices</span>
            </div>
            <Link to="/settings?tab=billing">
              <Button variant="ghost" size="sm">
                View all
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
