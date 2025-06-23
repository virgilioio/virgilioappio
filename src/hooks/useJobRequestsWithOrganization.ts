
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useUserProfile } from './useUserProfile'

export type JobRequestWithOrganization = {
  id: string
  title: string
  description: string
  department: string
  level: 'L1' | 'L2' | 'L3'
  location: string
  salary_min: number
  salary_max: number
  currency: string
  status: 'pending' | 'approved' | 'rejected'
  organization_id: string
  submitted_by: string
  approved_by: string | null
  created_at: string
  updated_at: string
  organization_name: string
  requester_name: string
  requester_email: string
}

export function useJobRequestsWithOrganization() {
  const { profile } = useUserProfile()

  const query = useQuery({
    queryKey: ['job-requests-with-organization', profile?.organization_id],
    queryFn: async () => {
      console.log('Fetching job requests with organization data')
      
      const { data, error } = await supabase
        .from('job_requests')
        .select(`
          *,
          organizations!inner(name),
          profiles!job_requests_submitted_by_fkey(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching job requests with organization:', error)
        throw error
      }

      const jobRequestsWithOrg = data.map((request: any) => ({
        ...request,
        organization_name: request.organizations?.name || 'Unknown Organization',
        requester_name: request.profiles 
          ? `${request.profiles.first_name || ''} ${request.profiles.last_name || ''}`.trim() || 'Unknown User'
          : 'Unknown User',
        requester_email: request.profiles?.email || ''
      }))

      console.log('Fetched job requests with organization:', jobRequestsWithOrg)
      return jobRequestsWithOrg as JobRequestWithOrganization[]
    },
    enabled: !!profile?.organization_id,
  })

  return {
    jobRequests: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
