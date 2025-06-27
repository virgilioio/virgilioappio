
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

    const pendingInvoices = filteredInvoices.filter(inv => inv.status === 'pending')
    const overdueInvoices = filteredInvoices.filter(inv => 
      inv.status === 'overdue' || 
      (inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < now)
    )

    const totalOwed = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)

    return {
      totalInvoices: filteredInvoices.length,
      totalOwed,
      overdueAmount,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length
    }
  }, [invoices, filters])

  // Convert amounts to display currency
  useEffect(() => {
    const convertAmounts = async () => {
      if (baseMetrics.totalOwed === 0 && baseMetrics.overdueAmount === 0) {
        setConvertedMetrics({
          totalOwed: 0,
          overdueAmount: 0,
          showCurrencyIndicator: false
        })
        return
      }

      try {
        const conversions = await Promise.all([
          convertCurrency(baseMetrics.totalOwed, 'USD', defaultCurrency, organizationId),
          convertCurrency(baseMetrics.overdueAmount, 'USD', defaultCurrency, organizationId)
        ])

        const showIndicator = conversions.some(c => c.exchangeRate !== 1.0)

        setConvertedMetrics({
          totalOwed: conversions[0].convertedAmount,
          overdueAmount: conversions[1].convertedAmount,
          showCurrencyIndicator: showIndicator
        })
      } catch (error) {
        console.error('Error converting currencies:', error)
        setConvertedMetrics({
          totalOwed: baseMetrics.totalOwed,
          overdueAmount: baseMetrics.overdueAmount,
          showCurrencyIndicator: false
        })
      }
    }

    convertAmounts()
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
