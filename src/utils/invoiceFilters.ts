
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { Invoice } from '@/hooks/useInvoices'

export interface InvoiceFilters {
  searchTerm?: string
  status?: string
  selectedMonth?: Date
}

export function filterInvoices(invoices: Invoice[], filters: InvoiceFilters): Invoice[] {
  return invoices.filter(invoice => {
    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      const matchesSearch = 
        invoice.title.toLowerCase().includes(searchLower) ||
        invoice.organization_id.toLowerCase().includes(searchLower) ||
        invoice.description?.toLowerCase().includes(searchLower)
      
      if (!matchesSearch) return false
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (invoice.status !== filters.status) return false
    }

    // Month filter
    if (filters.selectedMonth) {
      const monthStart = startOfMonth(filters.selectedMonth)
      const monthEnd = endOfMonth(filters.selectedMonth)
      const invoiceDate = new Date(invoice.issued_at)
      
      if (!isWithinInterval(invoiceDate, { start: monthStart, end: monthEnd })) {
        return false
      }
    }

    return true
  })
}

export function getInvoiceStats(invoices: Invoice[]) {
  const totalInvoices = invoices.length
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending')
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue')
  const paidInvoices = invoices.filter(inv => inv.status === 'paid')
  
  const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  return {
    totalInvoices,
    pendingCount: pendingInvoices.length,
    overdueCount: overdueInvoices.length,
    paidCount: paidInvoices.length,
    totalPending,
    totalOverdue,
    totalPaid
  }
}
