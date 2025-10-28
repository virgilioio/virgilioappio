import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface Invoice {
  id: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible' | 'draft'
  created: string
  pdfUrl: string | null
  hostedInvoiceUrl: string | null
  periodStart: string | null
  periodEnd: string | null
  number: string | null
}

export function useInvoiceHistory() {
  return useQuery({
    queryKey: ['invoice-history'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-invoices')
      
      if (error) {
        console.error('Error fetching invoices:', error)
        throw error
      }
      
      return (data?.invoices || []) as Invoice[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}
