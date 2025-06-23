
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { Invoice } from '@/hooks/useInvoices'
import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface InvoiceFilters {
  searchTerm?: string
  statuses?: string[]  // Changed from status to statuses array
  selectedMonth?: Date
  organizationIds?: string[]  // Changed from organizationId to organizationIds array
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

    // Status filter - now supports multiple statuses
    if (filters.statuses && filters.statuses.length > 0) {
      if (!filters.statuses.includes(invoice.status)) return false
    }

    // Organization filter - now supports multiple organizations
    if (filters.organizationIds && filters.organizationIds.length > 0) {
      if (!filters.organizationIds.includes(invoice.organization_id)) return false
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

  return React.createElement(
    InvoiceFilterContext.Provider,
    {
      value: {
        filters,
        setFilters,
        filteredInvoices,
        setFilteredInvoices
      }
    },
    children
  )
}

export function useInvoiceFilter() {
  const context = useContext(InvoiceFilterContext)
  if (!context) {
    throw new Error('useInvoiceFilter must be used within an InvoiceFilterProvider')
  }
  return context
}
