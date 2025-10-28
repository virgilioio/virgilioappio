import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface BillingPeriodUsage {
  periodStart: string
  periodEnd: string
  jobsCreated: number
  candidatesAdded: number
  activeMembers: number
  billableSeats: number
  emailsSent: number
}

export function useBillingPeriodUsage() {
  return useQuery({
    queryKey: ['billing-period-usage'],
    queryFn: async (): Promise<BillingPeriodUsage> => {
      const { data, error } = await supabase.functions.invoke('get-billing-period-usage')
      
      if (error) {
        console.error('Error fetching billing period usage:', error)
        throw error
      }
      
      return data as BillingPeriodUsage
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  })
}
