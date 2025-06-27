
import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Invoice } from '@/hooks/useInvoices'
import { DollarSign, Globe } from 'lucide-react'
import { useOrganizationCurrency } from '@/hooks/useOrganizationCurrency'
import { useAuth } from '@/contexts/AuthContext'
import { convertCurrency, formatCurrencyAmount, getCurrencySymbol } from '@/utils/currencyUtils'

interface TotalPaidCardProps {
  invoices: Invoice[]
}

type TimePeriod = '1week' | '1month' | '3months' | '6months' | '1year' | 'all'

export function TotalPaidCard({ invoices }: TotalPaidCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('6months')
  const { defaultCurrency } = useOrganizationCurrency()
  const { organizationId } = useAuth()
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [convertedTotal, setConvertedTotal] = useState(0)
  const [showCurrencyIndicator, setShowCurrencyIndicator] = useState(false)

  // Fetch currency symbol
  useEffect(() => {
    getCurrencySymbol(defaultCurrency).then(setCurrencySymbol)
  }, [defaultCurrency])

  const timePeriodOptions: { value: TimePeriod; label: string }[] = [
    { value: '1week', label: '1W' },
    { value: '1month', label: '1M' },
    { value: '3months', label: '3M' },
    { value: '6months', label: '6M' },
    { value: '1year', label: '1Y' },
    { value: 'all', label: 'All' },
  ]

  const totalPaid = useMemo(() => {
    const now = new Date()
    let startDate = new Date()

    // Calculate start date based on selected period
    switch (selectedPeriod) {
      case '1week':
        startDate.setDate(now.getDate() - 7)
        break
      case '1month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case '3months':
        startDate.setMonth(now.getMonth() - 3)
        break
      case '6months':
        startDate.setMonth(now.getMonth() - 6)
        break
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      case 'all':
        startDate = new Date('2020-01-01') // Far back date for all time
        break
    }

    // Filter invoices by date range
    const filteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.issued_at)
      return invoiceDate >= startDate && invoiceDate <= now
    })

    // Calculate total amount paid (including partial payments)
    return filteredInvoices.reduce((sum, invoice) => {
      if (invoice.status === 'paid') {
        return sum + invoice.amount
      } else if (invoice.status === 'partial' && invoice.total_paid) {
        return sum + invoice.total_paid
      }
      return sum
    }, 0)
  }, [invoices, selectedPeriod])

  // Convert total to organization's default currency
  useEffect(() => {
    const convertTotal = async () => {
      if (totalPaid === 0) {
        setConvertedTotal(0)
        setShowCurrencyIndicator(false)
        return
      }

      try {
        const conversion = await convertCurrency(totalPaid, 'USD', defaultCurrency, organizationId)
        setConvertedTotal(conversion.convertedAmount)
        setShowCurrencyIndicator(conversion.exchangeRate !== 1.0)
      } catch (error) {
        console.error('Error converting currency:', error)
        setConvertedTotal(totalPaid)
        setShowCurrencyIndicator(false)
      }
    }

    convertTotal()
  }, [totalPaid, defaultCurrency, organizationId])

  const formatCurrency = (amount: number) => {
    return formatCurrencyAmount(amount, defaultCurrency, currencySymbol)
  }

  return (
    <Card className="h-full rounded-2xl" style={{ backgroundColor: '#d1fae5' }}>
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-black">
              {formatCurrency(convertedTotal)}
            </div>
          </div>
          
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Total Paid
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
        <div className="h-[160px] w-full mb-3 flex items-center justify-center">
          {/* Removed the large decorative icon */}
        </div>

        {/* Time Period Filter - Moved to bottom */}
        <div className="flex justify-center">
          <div className="flex gap-4">
            {timePeriodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedPeriod(option.value)}
                className={`text-xs px-1 py-0.5 cursor-pointer transition-colors ${
                  selectedPeriod === option.value 
                    ? 'text-green-700 font-medium' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
