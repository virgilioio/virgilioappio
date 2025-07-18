
import { useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Invoice } from '@/hooks/useInvoices'
import { AlertTriangle, Globe } from 'lucide-react'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrencyAmount } from '@/utils/currencyUtils'
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion'

interface OverduePaymentsCardProps {
  invoices: Invoice[]
}

export function OverduePaymentsCard({ invoices }: OverduePaymentsCardProps) {
  const { defaultCurrency } = useOrganizationCurrency()
  const { organizationId } = useAuth()

  const overdueInvoices = useMemo(() => {
    const now = new Date()

    // Filter overdue invoices - proper status handling
    const filteredInvoices = invoices.filter(invoice => {
      const isOverdue = invoice.status === 'overdue' || 
        (invoice.status === 'pending' && invoice.due_date && new Date(invoice.due_date) < now)
      return isOverdue
    })

    return filteredInvoices
  }, [invoices])

  const { totalConverted, showCurrencyIndicator, currencySymbol, isLoading } = useCurrencyConversion(
    overdueInvoices,
    defaultCurrency,
    organizationId
  )

  const formatCurrency = useCallback((amount: number) => {
    return formatCurrencyAmount(amount, defaultCurrency, currencySymbol)
  }, [defaultCurrency, currencySymbol])

  return (
    <Card className="h-full rounded-2xl" style={{ backgroundColor: '#ffc2c2' }}>
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-black">
              {isLoading ? '...' : formatCurrency(totalConverted)}
            </div>
            <div className="text-xs text-muted-foreground">
              Subset of Outstanding Balance
            </div>
          </div>
          
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Overdue Payments
            {showCurrencyIndicator && (
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
