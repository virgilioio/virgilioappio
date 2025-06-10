
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Invoice {
  id: string
  organization_id: string
  title: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'overdue'
  invoice_url?: string
  issued_at: string
  due_date?: string
  created_at: string
  updated_at: string
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getInvoices = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching invoices for user:', user.id)
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching invoices:', fetchError)
        throw fetchError
      }

      console.log('Fetched invoices:', data)
      // Type assertion to ensure the data matches our interface
      setInvoices((data || []) as Invoice[])
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

  useEffect(() => {
    if (user) {
      getInvoices()
    }
  }, [user])

  return {
    invoices,
    isLoading,
    error,
    getInvoices
  }
}
