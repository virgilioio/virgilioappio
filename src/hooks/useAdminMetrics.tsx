
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
    const overdueInvoices = filteredInvoices.filter(inv => 
      inv.status === 'overdue' || 
      (inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < now)
    )

    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)

    return {
      totalInvoices,
      totalRevenue,
      totalPending,
      totalOverdue,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length
    }
  }, [invoices, filters])

  // Convert amounts to display currency
  useEffect(() => {
    const convertAmounts = async () => {
      if (baseMetrics.totalRevenue === 0 && baseMetrics.totalPending === 0 && baseMetrics.totalOverdue === 0) {
        setConvertedMetrics({
          totalRevenue: 0,
          totalPending: 0,
          totalOverdue: 0,
          showCurrencyIndicator: false
        })
        return
      }

      try {
        const conversions = await Promise.all([
          convertCurrency(baseMetrics.totalRevenue, 'USD', defaultCurrency, organizationId),
          convertCurrency(baseMetrics.totalPending, 'USD', defaultCurrency, organizationId),
          convertCurrency(baseMetrics.totalOverdue, 'USD', defaultCurrency, organizationId)
        ])

        const showIndicator = conversions.some(c => c.exchangeRate !== 1.0)

        setConvertedMetrics({
          totalRevenue: conversions[0].convertedAmount,
          totalPending: conversions[1].convertedAmount,
          totalOverdue: conversions[2].convertedAmount,
          showCurrencyIndicator: showIndicator
        })
      } catch (error) {
        console.error('Error converting currencies:', error)
        setConvertedMetrics({
          totalRevenue: baseMetrics.totalRevenue,
          totalPending: baseMetrics.totalPending,
          totalOverdue: baseMetrics.totalOverdue,
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
