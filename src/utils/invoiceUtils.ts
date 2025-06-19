
import { Invoice } from '@/hooks/useInvoices'
import { InvoiceFilters } from './invoiceFilters'

/**
 * Automatically detects and updates invoice status based on due date
 */
export function detectOverdueInvoices(invoices: Invoice[]): Invoice[] {
  const now = new Date()
  
  return invoices.map(invoice => {
    // If invoice is pending and past due date, mark as overdue
    if (invoice.status === 'pending' && invoice.due_date) {
      const dueDate = new Date(invoice.due_date)
      if (dueDate < now) {
        console.log(`Auto-detecting overdue invoice: ${invoice.id} (due: ${invoice.due_date})`)
        return { ...invoice, status: 'overdue' as const }
      }
    }
    return invoice
  })
}

/**
 * Gets all overdue invoices using unified logic
 * Includes both manually marked overdue and auto-detected overdue
 */
export function getOverdueInvoices(invoices: Invoice[]): Invoice[] {
  const now = new Date()
  
  return invoices.filter(invoice => {
    // Include invoices with overdue status
    if (invoice.status === 'overdue') {
      return true
    }
    
    // Include pending invoices that are past due date
    if (invoice.status === 'pending' && invoice.due_date) {
      const dueDate = new Date(invoice.due_date)
      return dueDate < now
    }
    
    return false
  })
}

/**
 * Gets urgent invoices (due within specified days but not overdue)
 */
export function getUrgentInvoices(invoices: Invoice[], daysAhead: number = 7): Invoice[] {
  const now = new Date()
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
  
  return invoices.filter(invoice => {
    if (invoice.status !== 'pending' || !invoice.due_date) {
      return false
    }
    
    const dueDate = new Date(invoice.due_date)
    return dueDate >= now && dueDate <= futureDate
  })
}

/**
 * Calculates payment metrics with unified overdue logic and optional filtering
 */
export function calculatePaymentMetrics(invoices: Invoice[], organizationId?: string, filters?: InvoiceFilters) {
  console.log('=== PAYMENT METRICS CALCULATION ===')
  console.log('Input invoices:', invoices.length)
  console.log('Organization filter:', organizationId)
  console.log('Date filter:', filters?.selectedMonth)
  
  // Filter by organization if specified
  let relevantInvoices = invoices
  if (organizationId) {
    relevantInvoices = invoices.filter(invoice => invoice.organization_id === organizationId)
    console.log('Filtered to organization invoices:', relevantInvoices.length)
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
    console.log('Filtered to month invoices:', relevantInvoices.length)
  }
  
  // Auto-detect overdue invoices
  const processedInvoices = detectOverdueInvoices(relevantInvoices)
  console.log('Processed invoices with auto-overdue detection:', processedInvoices.length)
  
  // Get different categories
  const pendingInvoices = processedInvoices.filter(inv => inv.status === 'pending')
  const overdueInvoices = getOverdueInvoices(processedInvoices)
  const urgentInvoices = getUrgentInvoices(processedInvoices)
  
  // Calculate amounts
  const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const urgentAmount = urgentInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  
  console.log('Payment metrics calculated:', {
    pendingCount: pendingInvoices.length,
    pendingAmount: totalPending,
    overdueCount: overdueInvoices.length,
    overdueAmount,
    urgentCount: urgentInvoices.length,
    urgentAmount
  })
  
  return {
    processedInvoices,
    pendingInvoices,
    overdueInvoices,
    urgentInvoices,
    totalPending,
    overdueAmount,
    urgentAmount,
    pendingCount: pendingInvoices.length,
    overdueCount: overdueInvoices.length,
    urgentCount: urgentInvoices.length
  }
}
