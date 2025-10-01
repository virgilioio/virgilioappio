import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface PlatformMetrics {
  users: {
    active: number
    total: number
  }
  organizations: {
    total: number
    clients: number
    platform: number
  }
  jobs: {
    total: number
    active: number
    draft: number
    newThisMonth: number
  }
  candidates: {
    total: number
    independent: number
    jobSpecific: number
    newThisMonth: number
  }
  invoices: {
    recent: number
    paid: number
    pending: number
  }
  activity: {
    recentActivities: number
  }
  // CoreSignal API integration removed
  lastUpdated: string
}

export function usePlatformMetrics() {
  return useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async (): Promise<PlatformMetrics> => {
      console.log('Fetching platform metrics...')
      
      const { data, error } = await supabase.functions.invoke('platform-admin-metrics')
      
      if (error) {
        console.error('Error fetching platform metrics:', error)
        throw new Error(`Failed to fetch platform metrics: ${error.message}`)
      }

      if (!data) {
        throw new Error('No data returned from platform metrics API')
      }

      console.log('Platform metrics data:', data)
      return data
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Data is fresh for 15 seconds
  })
}