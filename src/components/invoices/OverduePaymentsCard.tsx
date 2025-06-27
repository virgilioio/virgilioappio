
import { useMemo, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Invoice } from '@/hooks/useInvoices'
import { AlertTriangle, Globe } from 'lucide-react'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { useAuth } from '@/contexts/AuthContext'
import { convertCurrency, formatCurrencyAmount, getCurrencySymbol } from '@/utils/currencyUtils'

interface OverduePaymentsCardProps {
  invoices: Invoice[]
}

export function OverduePaymentsCard({ invoices }: OverduePaymentsCardProps) {
  const { defaultCurrency } = useOrganizationCurrency()
  const { organizationId } = useAuth()
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [convertedTotal, setConvertedTotal] = useState(0)
  const [showCurrencyIndicator, setShowCurrencyIndicator] = useState(false)

  // Fetch currency symbol
  useEffect(() => {
    getCurrencySymbol(defaultCurrency).then(setCurrencySymbol)
  }, [defaultCurrency])

  const totalOverdue = useMemo(() => {
    const now = new Date()

    // Filter overdue invoices - no time period filtering needed
    const filteredInvoices = invoices.filter(invoice => {
      const isOverdue = invoice.status === 'overdue' || 
        (invoice.status === 'pending' && invoice.due_date && new Date(invoice.due_date) < now)
      return isOverdue
    })

    // Calculate total amount of overdue invoices
    return filteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  }, [invoices])

  // Convert total to organization's default currency
  useEffect(() => {
    const convertTotal = async () => {
      if (totalOverdue === 0) {
        setConvertedTotal(0)
        setShowCurrencyIndicator(false)
        return
      }

      try {
        const conversion = await convertCurrency(totalOverdue, 'USD', defaultCurrency, organizationId)
        setConvertedTotal(conversion.convertedAmount)
        setShowCurrencyIndicator(conversion.exchangeRate !== 1.0)
      } catch (error) {
        console.error('Error converting currency:', error)
        setConvertedTotal(totalOverdue)
        setShowCurrencyIndicator(false)
      }
    }

    convertTotal()
  }, [totalOverdue, defaultCurrency, organizationId])

  const formatCurrency = (amount: number) => {
    return formatCurrencyAmount(amount, defaultCurrency, currencySymbol)
  }

  return (
    <Card className="h-full rounded-2xl" style={{ backgroundColor: '#ffc2c2' }}>
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-black">
              {formatCurrency(convertedTotal)}
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
