
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, TrendingUp, ExternalLink, AlertTriangle, Clock, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { useInvoiceFilter } from '@/utils/invoiceFilters'
import { formatCurrencyAmount, getCurrencySymbol } from '@/utils/currencyUtils'
import { calculateOutstandingBalance } from '@/utils/outstandingBalanceUtils'

export function PaymentsTracker() {
  const { invoices, isLoading } = useInvoices()
  const { userType, organizationId } = useAuth()
  const { defaultCurrency } = useOrganizationCurrency()
  const { filters } = useInvoiceFilter()
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [outstandingData, setOutstandingData] = useState({
    totalOutstanding: 0,
    overdueAmount: 0,
    urgentAmount: 0,
    pendingCount: 0,
    overdueCount: 0,
    urgentCount: 0,
    showCurrencyIndicator: false
  })

  // Fetch currency symbol
  useEffect(() => {
    getCurrencySymbol(defaultCurrency).then(setCurrencySymbol)
  }, [defaultCurrency])

  useEffect(() => {
    if (invoices) {
      console.log('=== PAYMENTS TRACKER OUTSTANDING BALANCE DEBUG ===')
      console.log('PaymentsTracker: Processing invoices for context:', { userType, organizationId, invoiceCount: invoices.length })
      console.log('Display currency:', defaultCurrency)
      
      const calculateMetrics = async () => {
        try {
          const result = await calculateOutstandingBalance(
            invoices,
            userType !== 'platform_admin' ? organizationId : undefined,
            filters,
            defaultCurrency
          )
          
          console.log('PaymentsTracker: Outstanding balance calculated:', result)

          setOutstandingData({
            totalOutstanding: result.totalOutstanding,
            overdueAmount: result.overdueAmount,
            urgentAmount: 0, // We'll need to calculate urgent separately if needed
            pendingCount: result.pendingCount,
            overdueCount: result.overdueCount,
            urgentCount: 0, // We'll need to calculate urgent separately if needed
            showCurrencyIndicator: result.showCurrencyIndicator
          })
        } catch (error) {
          console.error('Error calculating outstanding balance in PaymentsTracker:', error)
          // Fallback to simpler calculation
          const now = new Date()
          const pending = invoices.filter(inv => inv.status === 'pending')
          const overdue = invoices.filter(inv => 
            inv.status === 'overdue' || 
            (inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < now)
          )
          const partial = invoices.filter(inv => inv.status === 'partial')
          
          const pendingAmount = pending.reduce((sum, inv) => sum + inv.amount, 0)
          const overdueAmount = overdue.reduce((sum, inv) => sum + inv.amount, 0)
          const partialAmount = partial.reduce((sum, inv) => sum + (inv.remaining_amount || inv.amount), 0)
          
          setOutstandingData({
            totalOutstanding: pendingAmount + overdueAmount + partialAmount,
            overdueAmount,
            urgentAmount: 0,
            pendingCount: pending.length + partial.length,
            overdueCount: overdue.length,
            urgentCount: 0,
            showCurrencyIndicator: false
          })
        }
      }

      calculateMetrics()
    }
  }, [invoices, userType, organizationId, filters, defaultCurrency])

  const formatCurrency = (amount: number) => {
    return formatCurrencyAmount(amount, defaultCurrency, currencySymbol)
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
          {outstandingData.showCurrencyIndicator && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              {defaultCurrency}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Priority Section - Overdue & Urgent */}
        {(outstandingData.overdueCount > 0 || outstandingData.urgentCount > 0) && (
          <div className="space-y-3 pb-4 border-b border-border">
            {outstandingData.overdueCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border-destructive border bg-destructive/5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Overdue</p>
                    <p className="text-lg font-bold text-destructive">
                      {formatCurrency(outstandingData.overdueAmount)}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">{outstandingData.overdueCount} invoice{outstandingData.overdueCount > 1 ? 's' : ''}</Badge>
              </div>
            )}
            
            {outstandingData.urgentCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border-orange-200 border bg-orange-50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-700">Due Soon (7 days)</p>
                    <p className="text-lg font-bold text-orange-700">
                      {formatCurrency(outstandingData.urgentAmount)}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {outstandingData.urgentCount} invoice{outstandingData.urgentCount > 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Metrics with Rounded Boxes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-text-secondary text-center">{totalDueLabel}</p>
            <div className="bg-surface-secondary rounded-xl p-4 w-full flex items-center justify-center min-h-[80px]">
              <p className="text-3xl font-bold text-text-primary text-center">
                {formatCurrency(outstandingData.totalOutstanding)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-text-secondary text-center">{incomingLabel}</p>
            <div className="bg-success/10 rounded-xl p-4 w-full flex items-center justify-center min-h-[80px]">
              <p className="text-3xl font-bold text-success text-center">
                {formatCurrency(outstandingData.totalOutstanding)}
              </p>
            </div>
          </div>
        </div>
        
        {(outstandingData.pendingCount > 0 || outstandingData.overdueCount > 0) && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{outstandingData.pendingCount + outstandingData.overdueCount}</Badge>
              <span className="text-sm text-text-secondary">total outstanding invoices</span>
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
