
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

  const overdueInvoices = useMemo(() => {
    const now = new Date()

    // Filter overdue invoices - proper status handling
    const filteredInvoices = invoices.filter(invoice => {
      const isOverdue = invoice.status === 'overdue' || 
        (invoice.status === 'pending' && invoice.due_date && new Date(invoice.due_date) < now)
      return isOverdue
    })

    console.log('=== OVERDUE PAYMENTS CARD CALCULATION ===')
    console.log('Total invoices:', invoices.length)
    console.log('Overdue invoices:', filteredInvoices.length, filteredInvoices.map(i => ({ 
      id: i.id, 
      amount: i.amount, 
      currency: i.currency, 
      status: i.status,
      due_date: i.due_date,
      remaining_amount: i.remaining_amount
    })))

    return filteredInvoices
  }, [invoices])

  // Convert total to organization's default currency with per-invoice conversion
  useEffect(() => {
    const convertTotal = async () => {
      if (overdueInvoices.length === 0) {
        setConvertedTotal(0)
        setShowCurrencyIndicator(false)
        return
      }

      console.log('=== OVERDUE PAYMENTS CURRENCY CONVERSION ===')
      console.log('Target currency:', defaultCurrency)

      let totalConverted = 0
      let showIndicator = false

      try {
        for (const invoice of overdueInvoices) {
          // For partial payments, use remaining amount, otherwise use full amount
          const amountToConvert = invoice.status === 'partial' && invoice.remaining_amount 
            ? invoice.remaining_amount 
            : invoice.amount
          
          const conversion = await convertCurrency(
            amountToConvert,
            invoice.currency || 'USD',
            defaultCurrency,
            organizationId
          )
          
          totalConverted += conversion.convertedAmount
          if (conversion.exchangeRate !== 1.0) showIndicator = true
          
          console.log(`Overdue invoice ${invoice.id}: ${amountToConvert} ${invoice.currency} -> ${conversion.convertedAmount} ${defaultCurrency} (rate: ${conversion.exchangeRate})`)
        }

        console.log('Final overdue total converted:', totalConverted)

        setConvertedTotal(totalConverted)
        setShowCurrencyIndicator(showIndicator)
      } catch (error) {
        console.error('Error converting currency in OverduePaymentsCard:', error)
        // Fallback to original amounts without conversion
        const fallbackTotal = overdueInvoices.reduce((sum, invoice) => {
          const amount = invoice.status === 'partial' && invoice.remaining_amount 
            ? invoice.remaining_amount 
            : invoice.amount
          return sum + amount
        }, 0)
        setConvertedTotal(fallbackTotal)
        setShowCurrencyIndicator(false)
      }
    }

    convertTotal()
  }, [overdueInvoices, defaultCurrency, organizationId])

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
