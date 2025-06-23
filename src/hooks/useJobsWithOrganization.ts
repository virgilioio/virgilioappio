
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useUserProfile } from './useUserProfile'

export type JobWithOrganization = {
  id: string
  title: string
  description: string
  level: 'L1' | 'L2' | 'L3'
  location: string
  department: string
  salary_min: number
  salary_max: number
  currency: string
  status: 'draft' | 'open' | 'closed' | 'archived'
  hiring_team: string[]
  organization_id: string
  created_by: string
  created_at: string
  updated_at: string
  organization_name: string
}

export function useJobsWithOrganization() {
  const { profile } = useUserProfile()

  const query = useQuery({
    queryKey: ['jobs-with-organization', profile?.organization_id],
    queryFn: async () => {
      console.log('Fetching jobs with organization data')
      
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          organizations!inner(name)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching jobs with organization:', error)
        throw error
      }

      const mapLevel = (dbLevel: string): 'L1' | 'L2' | 'L3' => {
        if (dbLevel.startsWith('L1')) return 'L1'
        if (dbLevel.startsWith('L2')) return 'L2'
        if (dbLevel.startsWith('L3')) return 'L3'
        return 'L1' // fallback
      }

      const jobsWithOrg = data.map((job: any) => ({
        ...job,
        level: mapLevel(job.level),
        organization_name: job.organizations?.name || 'Unknown Organization',
        hiring_team: Array.isArray(job.hiring_team) ? job.hiring_team : []
      }))

      console.log('Fetched jobs with organization:', jobsWithOrg)
      return jobsWithOrg as JobWithOrganization[]
    },
    enabled: !!profile?.organization_id,
  })

  return {
    jobs: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
