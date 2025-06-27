
import { useMemo, useEffect, useState } from 'react'
import { Invoice } from './useInvoices'
import { InvoiceFilters } from '@/utils/invoiceFilters'
import { DollarSign, AlertTriangle, Clock, Receipt } from 'lucide-react'
import { useOrganizationCurrency } from './useOrganizationCurrency'
import { useAuth } from '@/contexts/AuthContext'
import { convertCurrency, formatCurrencyAmount, getCurrencySymbol } from '@/utils/currencyUtils'

export interface ClientMetric {
  title: string
  value: string
  icon: React.ReactNode
  tooltip?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  showCurrencyIndicator?: boolean
  currency?: string
}

export function useClientMetrics(invoices: Invoice[], filters: InvoiceFilters): ClientMetric[] {
  const { defaultCurrency } = useOrganizationCurrency()
  const { organizationId } = useAuth()
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [convertedMetrics, setConvertedMetrics] = useState({
    totalOwed: 0,
    overdueAmount: 0,
    showCurrencyIndicator: false
  })

  // Fetch currency symbol
  useEffect(() => {
    getCurrencySymbol(defaultCurrency).then(setCurrencySymbol)
  }, [defaultCurrency])

  const baseMetrics = useMemo(() => {
    const now = new Date()
    let filteredInvoices = invoices

    // Apply month filter if specified
    if (filters.selectedMonth) {
      const { startOfMonth, endOfMonth, isWithinInterval } = require('date-fns')
      const monthStart = startOfMonth(filters.selectedMonth)
      const monthEnd = endOfMonth(filters.selectedMonth)
      
      filteredInvoices = filteredInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.issued_at)
        return isWithinInterval(invoiceDate, { start: monthStart, end: monthEnd })
      })
    }

    // Categorize invoices with proper status handling
    const pendingInvoices = filteredInvoices.filter(inv => inv.status === 'pending')
    const partialInvoices = filteredInvoices.filter(inv => inv.status === 'partial')
    const overdueInvoices = filteredInvoices.filter(inv => 
      inv.status === 'overdue' || 
      (inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < now)
    )

    console.log('=== CLIENT METRICS BASE CALCULATION ===')
    console.log('Filtered invoices:', filteredInvoices.length)
    console.log('Pending invoices:', pendingInvoices.length, pendingInvoices.map(i => ({ id: i.id, amount: i.amount, currency: i.currency })))
    console.log('Partial invoices:', partialInvoices.length, partialInvoices.map(i => ({ id: i.id, amount: i.amount, currency: i.currency, remaining: i.remaining_amount })))
    console.log('Overdue invoices:', overdueInvoices.length, overdueInvoices.map(i => ({ id: i.id, amount: i.amount, currency: i.currency })))

    return {
      totalInvoices: filteredInvoices.length,
      pendingInvoices,
      partialInvoices,
      overdueInvoices,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length
    }
  }, [invoices, filters])

  // Convert amounts to display currency with proper per-invoice conversion
  useEffect(() => {
    const convertAmounts = async () => {
      console.log('=== CLIENT METRICS CURRENCY CONVERSION ===')
      console.log('Target currency:', defaultCurrency)
      
      let totalOwed = 0
      let overdueAmount = 0
      let showCurrencyIndicator = false

      try {
        // Convert pending invoice amounts
        for (const invoice of baseMetrics.pendingInvoices) {
          const conversion = await convertCurrency(
            invoice.amount,
            invoice.currency || 'USD',
            defaultCurrency,
            organizationId
          )
          totalOwed += conversion.convertedAmount
          if (conversion.exchangeRate !== 1.0) showCurrencyIndicator = true
          
          console.log(`Pending invoice ${invoice.id}: ${invoice.amount} ${invoice.currency} -> ${conversion.convertedAmount} ${defaultCurrency} (rate: ${conversion.exchangeRate})`)
        }

        // Convert partial invoice remaining amounts
        for (const invoice of baseMetrics.partialInvoices) {
          const amountToConvert = invoice.remaining_amount || invoice.amount
          const conversion = await convertCurrency(
            amountToConvert,
            invoice.currency || 'USD',
            defaultCurrency,
            organizationId
          )
          totalOwed += conversion.convertedAmount
          if (conversion.exchangeRate !== 1.0) showCurrencyIndicator = true
          
          console.log(`Partial invoice ${invoice.id}: ${amountToConvert} ${invoice.currency} -> ${conversion.convertedAmount} ${defaultCurrency} (rate: ${conversion.exchangeRate})`)
        }

        // Convert overdue invoice amounts
        for (const invoice of baseMetrics.overdueInvoices) {
          const conversion = await convertCurrency(
            invoice.amount,
            invoice.currency || 'USD',
            defaultCurrency,
            organizationId
          )
          overdueAmount += conversion.convertedAmount
          if (conversion.exchangeRate !== 1.0) showCurrencyIndicator = true
          
          console.log(`Overdue invoice ${invoice.id}: ${invoice.amount} ${invoice.currency} -> ${conversion.convertedAmount} ${defaultCurrency} (rate: ${conversion.exchangeRate})`)
        }

        console.log('Final totals:', { totalOwed, overdueAmount, showCurrencyIndicator })

        setConvertedMetrics({
          totalOwed,
          overdueAmount,
          showCurrencyIndicator
        })
      } catch (error) {
        console.error('Error converting currencies in client metrics:', error)
        // Fallback to original amounts without conversion
        const fallbackTotalOwed = [
          ...baseMetrics.pendingInvoices.map(inv => inv.amount),
          ...baseMetrics.partialInvoices.map(inv => inv.remaining_amount || inv.amount)
        ].reduce((sum, amount) => sum + amount, 0)
        
        const fallbackOverdueAmount = baseMetrics.overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)

        setConvertedMetrics({
          totalOwed: fallbackTotalOwed,
          overdueAmount: fallbackOverdueAmount,
          showCurrencyIndicator: false
        })
      }
    }

    if (baseMetrics.pendingInvoices.length > 0 || baseMetrics.partialInvoices.length > 0 || baseMetrics.overdueInvoices.length > 0) {
      convertAmounts()
    } else {
      setConvertedMetrics({
        totalOwed: 0,
        overdueAmount: 0,
        showCurrencyIndicator: false
      })
    }
  }, [baseMetrics, defaultCurrency, organizationId])

  const formatCurrency = (amount: number) => {
    return formatCurrencyAmount(amount, defaultCurrency, currencySymbol)
  }

  return useMemo(() => {
    const metrics: ClientMetric[] = [
      {
        title: 'Total Invoices',
        value: baseMetrics.totalInvoices.toString(),
        icon: <Receipt className="h-4 w-4" />,
        tooltip: 'Total number of invoices for your organization'
      },
      {
        title: 'Amount Owed',
        value: formatCurrency(convertedMetrics.totalOwed),
        icon: <DollarSign className="h-4 w-4" />,
        tooltip: `${baseMetrics.pendingCount} pending invoices`,
        variant: 'warning' as const,
        showCurrencyIndicator: convertedMetrics.showCurrencyIndicator,
        currency: defaultCurrency
      }
    ]

    // Add overdue metric if there are overdue invoices
    if (baseMetrics.overdueCount > 0) {
      metrics.push({
        title: 'Overdue Amount',
        value: formatCurrency(convertedMetrics.overdueAmount),
        icon: <AlertTriangle className="h-4 w-4" />,
        tooltip: `${baseMetrics.overdueCount} overdue invoices`,
        variant: 'destructive' as const,
        showCurrencyIndicator: convertedMetrics.showCurrencyIndicator,
        currency: defaultCurrency
      })
    }

    return metrics
  }, [baseMetrics, convertedMetrics, defaultCurrency, formatCurrency])
}
