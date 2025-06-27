
import { Invoice } from '@/hooks/useInvoices'
import { InvoiceFilters } from './invoiceFilters'
import { convertCurrency } from './currencyUtils'

export interface OutstandingBalanceResult {
  totalOutstanding: number
  pendingAmount: number
  overdueAmount: number
  partialAmount: number
  pendingCount: number
  overdueCount: number
  partialCount: number
  showCurrencyIndicator: boolean
}

export async function calculateOutstandingBalance(
  invoices: Invoice[], 
  organizationId?: string,
  filters?: InvoiceFilters,
  targetCurrency: string = 'USD'
): Promise<OutstandingBalanceResult> {
  const now = new Date()
  let relevantInvoices = invoices

  // Filter by organization if specified
  if (organizationId) {
    relevantInvoices = invoices.filter(invoice => invoice.organization_id === organizationId)
  }

  // Apply date filter if specified
  if (filters?.selectedMonth) {
    const { startOfMonth, endOfMonth, isWithinInterval } = require('date-fns')
    const monthStart = startOfMonth(filters.selectedMonth)
    const monthEnd = endOfMonth(filters.selectedMonth)
    
    relevantInvoices = relevantInvoices.filter(invoice => {
      const invoiceDate = new Date(invoice.issued_at)
      return isWithinInterval(invoiceDate, { start: monthStart, end: monthEnd })
    })
  }

  // Categorize invoices
  const pendingInvoices = relevantInvoices.filter(inv => inv.status === 'pending')
  const partialInvoices = relevantInvoices.filter(inv => inv.status === 'partial')
  
  // Calculate overdue invoices (both marked as overdue and auto-detected)
  const overdueInvoices = relevantInvoices.filter(inv => 
    inv.status === 'overdue' || 
    (inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < now)
  )

  // Calculate amounts and convert to target currency
  let pendingAmount = 0
  let overdueAmount = 0
  let partialAmount = 0
  let showCurrencyIndicator = false

  try {
    // Convert pending amounts
    for (const invoice of pendingInvoices) {
      const conversion = await convertCurrency(invoice.amount, invoice.currency || 'USD', targetCurrency, organizationId)
      pendingAmount += conversion.convertedAmount
      if (conversion.exchangeRate !== 1.0) showCurrencyIndicator = true
    }

    // Convert overdue amounts
    for (const invoice of overdueInvoices) {
      const conversion = await convertCurrency(invoice.amount, invoice.currency || 'USD', targetCurrency, organizationId)
      overdueAmount += conversion.convertedAmount
      if (conversion.exchangeRate !== 1.0) showCurrencyIndicator = true
    }

    // Convert partial amounts (use remaining_amount if available, otherwise full amount)
    for (const invoice of partialInvoices) {
      const amountToConvert = invoice.remaining_amount || invoice.amount
      const conversion = await convertCurrency(amountToConvert, invoice.currency || 'USD', targetCurrency, organizationId)
      partialAmount += conversion.convertedAmount
      if (conversion.exchangeRate !== 1.0) showCurrencyIndicator = true
    }
  } catch (error) {
    console.error('Error converting currencies for outstanding balance:', error)
    // Fallback to original amounts without conversion
    pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    partialAmount = partialInvoices.reduce((sum, inv) => sum + (inv.remaining_amount || inv.amount), 0)
    showCurrencyIndicator = false
  }

  const totalOutstanding = pendingAmount + overdueAmount + partialAmount

  return {
    totalOutstanding,
    pendingAmount,
    overdueAmount,
    partialAmount,
    pendingCount: pendingInvoices.length,
    overdueCount: overdueInvoices.length,
    partialCount: partialInvoices.length,
    showCurrencyIndicator
  }
}
