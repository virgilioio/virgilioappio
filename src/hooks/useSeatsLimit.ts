import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface SeatLimitInfo {
  allowed: boolean
  current_seats: number
  seat_limit: number
  over_limit_count: number
  is_trial: boolean
  billing_status: string
}

export function useSeatsLimit(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['seat-limit', tenantId],
    queryFn: async (): Promise<SeatLimitInfo> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required')
      }

      const { data, error } = await supabase
        .rpc('check_seat_limit' as any, { p_tenant_id: tenantId }) as any

      if (error) {
        console.error('Error checking seat limit:', error)
        throw error
      }

      if (!data) {
        throw new Error('No seat limit data returned')
      }

      return data
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  })
}
