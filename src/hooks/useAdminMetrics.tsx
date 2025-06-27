
import { useMemo, useEffect, useState } from 'react'
import { Invoice } from './useInvoices'
import { InvoiceFilters } from '@/utils/invoiceFilters'
import { DollarSign, AlertTriangle, Clock, Receipt, TrendingUp, CheckCircle } from 'lucide-react'
import { useOrganizationCurrency } from './useOrganizationCurrency'
import { useAuth } from '@/contexts/AuthContext'
import { convertCurrency, formatCurrencyAmount, getCurrencySymbol } from '@/utils/currencyUtils'

export interface AdminMetric {
  title: string
  value: string
  icon: React.ReactNode
  tooltip?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  showCurrencyIndicator?: boolean
  currency?: string
}

export function useAdminMetrics(invoices: Invoice[], filters: InvoiceFilters): AdminMetric[] {
  const { defaultCurrency } = useOrganizationCurrency()
  const { organizationId } = useAuth()
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [convertedMetrics, setConvertedMetrics] = useState({
    totalRevenue: 0,
    totalPending: 0,
    totalOverdue: 0,
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

    const totalInvoices = filteredInvoices.length
    const paidInvoices = filteredInvoices.filter(inv => inv.status === 'paid')
    const pendingInvoices = filteredInvoices.filter(inv => inv.status === 'pending')
    const partialInvoices = filteredInvoices.filter(inv => inv.status === 'partial')
    const overdueInvoices = filteredInvoices.filter(inv => 
      inv.status === 'overdue' || 
      (inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < now)
    )

    console.log('=== ADMIN METRICS BASE CALCULATION ===')
    console.log('Filtered invoices:', filteredInvoices.length)
    console.log('Paid invoices:', paidInvoices.length, paidInvoices.map(i => ({ id: i.id, amount: i.amount, currency: i.currency, total_paid: i.total_paid })))
    console.log('Pending invoices:', pendingInvoices.length, pendingInvoices.map(i => ({ id: i.id, amount: i.amount, currency: i.currency })))
    console.log('Partial invoices:', partialInvoices.length, partialInvoices.map(i => ({ id: i.id, amount: i.amount, currency: i.currency, remaining: i.remaining_amount })))
    console.log('Overdue invoices:', overdueInvoices.length, overdueInvoices.map(i => ({ id: i.id, amount: i.amount, currency: i.currency })))

    return {
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      partialInvoices,
      overdueInvoices,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length
    }
  }, [invoices, filters])

  // Convert amounts to display currency with proper per-invoice conversion
  useEffect(() => {
    const convertAmounts = async () => {
      console.log('=== ADMIN METRICS CURRENCY CONVERSION ===')
      console.log('Target currency:', defaultCurrency)
      
      let totalRevenue = 0
      let totalPending = 0
      let totalOverdue = 0
      let showCurrencyIndicator = false

      try {
        // Convert paid invoice amounts (use total_paid if available, otherwise full amount)
        for (const invoice of baseMetrics.paidInvoices) {
          const amountToConvert = invoice.total_paid || invoice.amount
          const conversion = await convertCurrency(
            amountToConvert,
            invoice.currency || 'USD',
            defaultCurrency,
            organizationId
          )
          totalRevenue += conversion.convertedAmount
          if (conversion.exchangeRate !== 1.0) showCurrencyIndicator = true
          
          console.log(`Paid invoice ${invoice.id}: ${amountToConvert} ${invoice.currency} -> ${conversion.convertedAmount} ${defaultCurrency} (rate: ${conversion.exchangeRate})`)
        }

        // Convert pending invoice amounts
        for (const invoice of baseMetrics.pendingInvoices) {
          const conversion = await convertCurrency(
            invoice.amount,
            invoice.currency || 'USD',
            defaultCurrency,
            organizationId
          )
          totalPending += conversion.convertedAmount
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
          totalPending += conversion.convertedAmount
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
          totalOverdue += conversion.convertedAmount
          if (conversion.exchangeRate !== 1.0) showCurrencyIndicator = true
          
          console.log(`Overdue invoice ${invoice.id}: ${invoice.amount} ${invoice.currency} -> ${conversion.convertedAmount} ${defaultCurrency} (rate: ${conversion.exchangeRate})`)
        }

        console.log('Final totals:', { totalRevenue, totalPending, totalOverdue, showCurrencyIndicator })

        setConvertedMetrics({
          totalRevenue,
          totalPending,
          totalOverdue,
          showCurrencyIndicator
        })
      } catch (error) {
        console.error('Error converting currencies in admin metrics:', error)
        // Fallback to original amounts without conversion
        const fallbackRevenue = baseMetrics.paidInvoices.reduce((sum, inv) => sum + (inv.total_paid || inv.amount), 0)
        const fallbackPending = [
          ...baseMetrics.pendingInvoices.map(inv => inv.amount),
          ...baseMetrics.partialInvoices.map(inv => inv.remaining_amount || inv.amount)
        ].reduce((sum, amount) => sum + amount, 0)
        const fallbackOverdue = baseMetrics.overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)

        setConvertedMetrics({
          totalRevenue: fallbackRevenue,
          totalPending: fallbackPending,
          totalOverdue: fallbackOverdue,
          showCurrencyIndicator: false
        })
      }
    }

    if (baseMetrics.paidInvoices.length > 0 || baseMetrics.pendingInvoices.length > 0 || baseMetrics.partialInvoices.length > 0 || baseMetrics.overdueInvoices.length > 0) {
      convertAmounts()
    } else {
      setConvertedMetrics({
        totalRevenue: 0,
        totalPending: 0,
        totalOverdue: 0,
        showCurrencyIndicator: false
      })
    }
  }, [baseMetrics, defaultCurrency, organizationId])

  const formatCurrency = (amount: number) => {
    return formatCurrencyAmount(amount, defaultCurrency, currencySymbol)
  }

  return useMemo(() => {
    const metrics: AdminMetric[] = [
      {
        title: 'Total Invoices',
        value: baseMetrics.totalInvoices.toString(),
        icon: <Receipt className="h-4 w-4" />,
        tooltip: 'Total number of invoices in the system'
      },
      {
        title: 'Total Revenue',
        value: formatCurrency(convertedMetrics.totalRevenue),
        icon: <TrendingUp className="h-4 w-4" />,
        tooltip: 'Total amount from paid invoices',
        variant: 'success' as const,
        showCurrencyIndicator: convertedMetrics.showCurrencyIndicator,
        currency: defaultCurrency
      },
      {
        title: 'Pending Payments',
        value: formatCurrency(convertedMetrics.totalPending),
        icon: <Clock className="h-4 w-4" />,
        tooltip: `${baseMetrics.pendingCount} invoices awaiting payment`,
        variant: 'warning' as const,
        showCurrencyIndicator: convertedMetrics.showCurrencyIndicator,
        currency: defaultCurrency
      },
      {
        title: 'Overdue Payments',
        value: formatCurrency(convertedMetrics.totalOverdue),
        icon: <AlertTriangle className="h-4 w-4" />,
        tooltip: `${baseMetrics.overdueCount} invoices past due date`,
        variant: 'destructive' as const,
        showCurrencyIndicator: convertedMetrics.showCurrencyIndicator,
        currency: defaultCurrency
      }
    ]

    // Add paid invoices metric if there are any
    if (baseMetrics.paidCount > 0) {
      metrics.push({
        title: 'Paid Invoices',
        value: baseMetrics.paidCount.toString(),
        icon: <CheckCircle className="h-4 w-4" />,
        tooltip: 'Number of successfully paid invoices',
        variant: 'success' as const
      })
    }

    return metrics
  }, [baseMetrics, convertedMetrics, defaultCurrency, formatCurrency])
}
