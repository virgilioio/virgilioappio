
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
import { calculatePaymentMetrics } from '@/utils/invoiceUtils'
import { useInvoiceFilter } from '@/utils/invoiceFilters'
import { convertCurrency, formatCurrencyAmount, getCurrencySymbol } from '@/utils/currencyUtils'

export function PaymentsTracker() {
  const { invoices, isLoading } = useInvoices()
  const { userType, organizationId } = useAuth()
  const { defaultCurrency } = useOrganizationCurrency()
  const { filters } = useInvoiceFilter()
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [convertedMetrics, setConvertedMetrics] = useState({
    totalPending: 0,
    overdueAmount: 0,
    urgentAmount: 0,
    pendingCount: 0,
    overdueCount: 0,
    urgentCount: 0
  })
  const [showCurrencyIndicator, setShowCurrencyIndicator] = useState(false)

  // Fetch currency symbol
  useEffect(() => {
    getCurrencySymbol(defaultCurrency).then(setCurrencySymbol)
  }, [defaultCurrency])

  useEffect(() => {
    if (invoices) {
      console.log('=== PAYMENTS TRACKER MULTI-CURRENCY DEBUG ===')
      console.log('PaymentsTracker: Processing invoices for context:', { userType, organizationId, invoiceCount: invoices.length })
      console.log('Display currency:', defaultCurrency)
      
      // Use unified payment metrics calculation with month filter
      const baseMetrics = calculatePaymentMetrics(
        invoices,
        userType !== 'platform_admin' ? organizationId : undefined,
        filters
      )
      
      console.log('PaymentsTracker: Base metrics calculated:', baseMetrics)

      // Convert amounts to display currency if needed
      const convertMetrics = async () => {
        let needsConversion = false
        const conversions = await Promise.all([
          convertCurrency(baseMetrics.totalPending, 'USD', defaultCurrency),
          convertCurrency(baseMetrics.overdueAmount, 'USD', defaultCurrency),
          convertCurrency(baseMetrics.urgentAmount, 'USD', defaultCurrency),
        ])

        // Check if any conversion happened (rate != 1.0)
        needsConversion = conversions.some(c => c.exchangeRate !== 1.0)
        setShowCurrencyIndicator(needsConversion)

        setConvertedMetrics({
          totalPending: conversions[0].convertedAmount,
          overdueAmount: conversions[1].convertedAmount,
          urgentAmount: conversions[2].convertedAmount,
          pendingCount: baseMetrics.pendingCount,
          overdueCount: baseMetrics.overdueCount,
          urgentCount: baseMetrics.urgentCount
        })
      }

      convertMetrics()
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

  // Calculate total receivable/expected income including overdue amounts
  const totalReceivable = convertedMetrics.totalPending + convertedMetrics.overdueAmount

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Payments Tracker
          {showCurrencyIndicator && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              {defaultCurrency}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Priority Section - Overdue & Urgent */}
        {(convertedMetrics.overdueCount > 0 || convertedMetrics.urgentCount > 0) && (
          <div className="space-y-3 pb-4 border-b border-border">
            {convertedMetrics.overdueCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border-destructive border bg-destructive/5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Overdue</p>
                    <p className="text-lg font-bold text-destructive">
                      {formatCurrency(convertedMetrics.overdueAmount)}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">{convertedMetrics.overdueCount} invoice{convertedMetrics.overdueCount > 1 ? 's' : ''}</Badge>
              </div>
            )}
            
            {convertedMetrics.urgentCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border-orange-200 border bg-orange-50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-700">Due Soon (7 days)</p>
                    <p className="text-lg font-bold text-orange-700">
                      {formatCurrency(convertedMetrics.urgentAmount)}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {convertedMetrics.urgentCount} invoice{convertedMetrics.urgentCount > 1 ? 's' : ''}
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
                {formatCurrency(totalReceivable)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-text-secondary text-center">{incomingLabel}</p>
            <div className="bg-success/10 rounded-xl p-4 w-full flex items-center justify-center min-h-[80px]">
              <p className="text-3xl font-bold text-success text-center">
                {formatCurrency(totalReceivable)}
              </p>
            </div>
          </div>
        </div>
        
        {(convertedMetrics.pendingCount > 0 || convertedMetrics.overdueCount > 0) && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{convertedMetrics.pendingCount + convertedMetrics.overdueCount}</Badge>
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
