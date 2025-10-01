import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

interface FeatureFlag {
  flag_name: string
  is_active: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async (): Promise<FeatureFlag[]> => {
      const { data, error } = await supabase.rpc('get_all_feature_flags')
      
      if (error) {
        console.error('Error fetching feature flags:', error)
        throw error
      }
      
      return data || []
    },
    staleTime: 30000, // 30 seconds
  })
}