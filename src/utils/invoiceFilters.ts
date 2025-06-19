
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

// Create a context for sharing filter state across components
import React, { createContext, useContext, useState, ReactNode } from 'react'

interface InvoiceFilterContextType {
  filters: InvoiceFilters
  setFilters: (filters: InvoiceFilters) => void
  filteredInvoices: Invoice[]
  setFilteredInvoices: (invoices: Invoice[]) => void
}

const InvoiceFilterContext = createContext<InvoiceFilterContextType | null>(null)

interface InvoiceFilterProviderProps {
  children: ReactNode
}

export function InvoiceFilterProvider({ children }: InvoiceFilterProviderProps) {
  const [filters, setFilters] = useState<InvoiceFilters>({})
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])

  return (
    <InvoiceFilterContext.Provider value={{
      filters,
      setFilters,
      filteredInvoices,
      setFilteredInvoices
    }}>
      {children}
    </InvoiceFilterContext.Provider>
  )
}

export function useInvoiceFilter() {
  const context = useContext(InvoiceFilterContext)
  if (!context) {
    throw new Error('useInvoiceFilter must be used within an InvoiceFilterProvider')
  }
  return context
}
