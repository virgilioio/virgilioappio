
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { detectOverdueInvoices } from '@/utils/invoiceUtils'
import type { Invoice } from '@/hooks/useInvoices'

interface InvoiceContextType {
  invoices: Invoice[]
  isLoading: boolean
  error: string | null
  refreshInvoices: () => void
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined)

export function InvoiceProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, organizationId, userType } = useAuth()

  const getInvoices = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('=== INVOICE FETCH DEBUG (Context) ===')
      console.log('Fetching invoices for user:', user.id, 'userType:', userType, 'organizationId:', organizationId)
      
      let query = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      // Filter invoices based on user type and organization context
      if (userType === 'platform_admin') {
        // Platform admins can see all invoices (they manage/send invoices)
        console.log('Platform admin - fetching all invoices')
      } else if (organizationId) {
        // Workspace owners and other members see invoices for their organization
        // These are invoices they need to pay (where their org is the recipient)
        console.log('Filtering invoices for organization:', organizationId)
        query = query.eq('organization_id', organizationId)
      } else {
        // Users without organization context see no invoices
        console.log('No organization context - no invoices')
        setInvoices([])
        setIsLoading(false)
        return
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Error fetching invoices:', fetchError)
        throw fetchError
      }

      console.log('=== RAW INVOICE DATA (Context) ===')
      console.log('Total invoices fetched:', data?.length || 0)
      
      // Auto-detect and update overdue invoices
      const processedInvoices = detectOverdueInvoices((data || []) as Invoice[])
      console.log('=== OVERDUE DETECTION (Context) ===')
      console.log('Invoices after overdue detection:', processedInvoices.length)
      
      // Find invoices that were auto-updated to overdue status
      const autoUpdatedOverdue = processedInvoices.filter((processed, index) => {
        const original = data?.[index]
        return original?.status === 'pending' && processed.status === 'overdue'
      })
      
      if (autoUpdatedOverdue.length > 0) {
        console.log('Auto-updating overdue invoices in database:', autoUpdatedOverdue.length)
        
        // Update overdue invoices in the database
        for (const invoice of autoUpdatedOverdue) {
          try {
            await supabase
              .from('invoices')
              .update({ 
                status: 'overdue',
                updated_at: new Date().toISOString()
              })
              .eq('id', invoice.id)
            
            console.log(`Updated invoice ${invoice.id} to overdue status`)
          } catch (updateError) {
            console.error(`Failed to update invoice ${invoice.id}:`, updateError)
          }
        }
      }

      setInvoices(processedInvoices)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invoices'
      console.error('Invoices fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Set up real-time subscription - only once per context
  useEffect(() => {
    if (!user) return

    console.log('Setting up GLOBAL real-time subscription for invoices')
    
    // Subscribe to real-time changes on the invoices table
    const channel = supabase
      .channel('global-invoices-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'invoices'
        },
        (payload) => {
          console.log('Global real-time invoice change detected:', payload)
          
          // Refresh invoices data when any change occurs
          // This ensures all components stay in sync
          getInvoices()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up GLOBAL invoices real-time subscription')
      supabase.removeChannel(channel)
    }
  }, [user, organizationId, userType])

  // Initial fetch
  useEffect(() => {
    if (user) {
      getInvoices()
    }
  }, [user, organizationId, userType])

  const value: InvoiceContextType = {
    invoices,
    isLoading,
    error,
    refreshInvoices: getInvoices
  }

  return (
    <InvoiceContext.Provider value={value}>
      {children}
    </InvoiceContext.Provider>
  )
}

export function useInvoiceContext() {
  const context = useContext(InvoiceContext)
  if (context === undefined) {
    throw new Error('useInvoiceContext must be used within an InvoiceProvider')
  }
  return context
}
