
import { useMemo, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Invoice } from '@/hooks/useInvoices'
import { Clock, Globe } from 'lucide-react'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrencyAmount, getCurrencySymbol } from '@/utils/currencyUtils'
import { calculateOutstandingBalance } from '@/utils/outstandingBalanceUtils'

interface OutstandingBalanceCardProps {
  invoices: Invoice[]
}

export function OutstandingBalanceCard({ invoices }: OutstandingBalanceCardProps) {
  const { defaultCurrency } = useOrganizationCurrency()
  const { organizationId } = useAuth()
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [outstandingData, setOutstandingData] = useState({
    totalOutstanding: 0,
    showCurrencyIndicator: false
  })

  // Fetch currency symbol
  useEffect(() => {
    getCurrencySymbol(defaultCurrency).then(setCurrencySymbol)
  }, [defaultCurrency])

  // Calculate outstanding balance with proper currency conversion
  useEffect(() => {
    const calculateOutstanding = async () => {
      try {
        const result = await calculateOutstandingBalance(
          invoices,
          organizationId,
          undefined, // no date filter for this card
          defaultCurrency
        )
        
        setOutstandingData({
          totalOutstanding: result.totalOutstanding,
          showCurrencyIndicator: result.showCurrencyIndicator
        })
      } catch (error) {
        console.error('Error calculating outstanding balance:', error)
        // Fallback calculation
        const now = new Date()
        const fallbackTotal = invoices
          .filter(invoice => {
            const isOverdue = invoice.status === 'overdue' || 
              (invoice.status === 'pending' && invoice.due_date && new Date(invoice.due_date) < now)
            const isPending = invoice.status === 'pending'
            const isPartial = invoice.status === 'partial'
            return isOverdue || isPending || isPartial
          })
          .reduce((sum, invoice) => {
            if (invoice.status === 'partial') {
              return sum + (invoice.remaining_amount || invoice.amount)
            }
            return sum + invoice.amount
          }, 0)
        
        setOutstandingData({
          totalOutstanding: fallbackTotal,
          showCurrencyIndicator: false
        })
      }
    }

    calculateOutstanding()
  }, [invoices, defaultCurrency, organizationId])

  const formatCurrency = (amount: number) => {
    return formatCurrencyAmount(amount, defaultCurrency, currencySymbol)
  }

  return (
    <Card className="h-full rounded-2xl" style={{ backgroundColor: '#d7c5fb' }}>
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-black">
              {formatCurrency(outstandingData.totalOutstanding)}
            </div>
          </div>
          
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Outstanding Balance
            {outstandingData.showCurrencyIndicator && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                {defaultCurrency}
              </div>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="h-[200px] w-full flex items-center justify-center">
          
        </div>
      </CardContent>
    </Card>
  )
}
