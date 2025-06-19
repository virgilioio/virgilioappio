
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, TrendingUp, ExternalLink, AlertTriangle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { useAuth } from '@/contexts/AuthContext'
import { calculatePaymentMetrics } from '@/utils/invoiceUtils'

export function PaymentsTracker() {
  const { invoices, isLoading } = useInvoices()
  const { userType, organizationId } = useAuth()
  const [paymentMetrics, setPaymentMetrics] = useState({
    totalPending: 0,
    overdueAmount: 0,
    urgentAmount: 0,
    pendingCount: 0,
    overdueCount: 0,
    urgentCount: 0
  })

  useEffect(() => {
    if (invoices) {
      console.log('=== PAYMENTS TRACKER DEBUG ===')
      console.log('PaymentsTracker: Processing invoices for context:', { userType, organizationId, invoiceCount: invoices.length })
      console.log('All invoices received:', invoices)
      
      // Use unified payment metrics calculation
      const metrics = calculatePaymentMetrics(
        invoices,
        userType !== 'platform_admin' ? organizationId : undefined
      )
      
      console.log('PaymentsTracker: Using calculated metrics:', metrics)
      
      setPaymentMetrics({
        totalPending: metrics.totalPending,
        overdueAmount: metrics.overdueAmount,
        urgentAmount: metrics.urgentAmount,
        pendingCount: metrics.pendingCount,
        overdueCount: metrics.overdueCount,
        urgentCount: metrics.urgentCount
      })
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
        {(paymentMetrics.overdueCount > 0 || paymentMetrics.urgentCount > 0) && (
          <div className="space-y-3 pb-4 border-b border-border">
            {paymentMetrics.overdueCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border-destructive border bg-destructive/5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Overdue</p>
                    <p className="text-lg font-bold text-destructive">
                      {formatCurrency(paymentMetrics.overdueAmount)}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">{paymentMetrics.overdueCount} invoice{paymentMetrics.overdueCount > 1 ? 's' : ''}</Badge>
              </div>
            )}
            
            {paymentMetrics.urgentCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border-orange-200 border bg-orange-50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-700">Due Soon (7 days)</p>
                    <p className="text-lg font-bold text-orange-700">
                      {formatCurrency(paymentMetrics.urgentAmount)}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {paymentMetrics.urgentCount} invoice{paymentMetrics.urgentCount > 1 ? 's' : ''}
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
              {formatCurrency(paymentMetrics.totalPending)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-text-secondary">{incomingLabel}</p>
            <p className="text-2xl font-semibold text-success">
              {formatCurrency(paymentMetrics.totalPending)}
            </p>
          </div>
        </div>
        
        {paymentMetrics.pendingCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{paymentMetrics.pendingCount}</Badge>
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
