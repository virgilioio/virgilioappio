
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useUserProfile } from './useUserProfile'
import type { Database } from '@/integrations/supabase/types'

type ActivityType = Database['public']['Enums']['activity_type']

export interface Activity {
  id: string
  user_id: string
  organization_id: string | null
  activity_type: ActivityType
  title: string
  description: string | null
  metadata: any
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

export interface CreateActivityData {
  activity_type: ActivityType
  title: string
  description?: string
  metadata?: any
  entity_type?: string
  entity_id?: string
}

export function useActivities(limit = 10) {
  const { profile } = useUserProfile()
  
  return useQuery({
    queryKey: ['activities', profile?.organization_id, limit],
    queryFn: async () => {
      console.log('Fetching activities for organization:', profile?.organization_id)
      
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching activities:', error)
        throw error
      }

      console.log('Fetched activities:', data)
      return data as Activity[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useCreateActivity() {
  const queryClient = useQueryClient()
  const { profile } = useUserProfile()

  return useMutation({
    mutationFn: async (activityData: CreateActivityData) => {
      console.log('Creating activity:', activityData)
      
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...activityData,
          user_id: profile?.user_id,
          organization_id: profile?.organization_id,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating activity:', error)
        throw error
      }

      console.log('Created activity:', data)
      return data as Activity
    },
    onSuccess: () => {
      // Invalidate activities queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
  })
}
