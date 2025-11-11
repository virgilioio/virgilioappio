import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface SaaSCustomerDetail {
  id: string
  name: string
  tenant_id: string
  plan_type: string | null
  status: string
  renewal_date: string | null
  billing_id: string | null
  owner_id: string | null
  organization_type: string
  tenant_type: string
  signup_source: string
  created_at: string
  updated_at: string
  trial_end_date: string | null
  suspended_at: string | null
  suspended_reason: string | null
  jobs_created_30d: number
  candidates_added_30d: number
  members_active_count: number
  last_active_at: string | null
  owner_details?: {
    first_name: string | null
    last_name: string | null
    email: string | null
  }
}

export function useSaaSCustomer(customerId: string) {
  return useQuery({
    queryKey: ['saas-customer', customerId],
    queryFn: async (): Promise<SaaSCustomerDetail | null> => {
      if (!customerId) return null

      // Get the SaaS organization
      const { data: organization, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', customerId)
        .eq('tenant_type', 'saas')
        .eq('organization_type', 'client')
        .eq('signup_source', 'self_serve')
        .single()

      if (error || !organization) {
        console.error('Error fetching SaaS customer:', error)
        return null
      }

      // Get job IDs for this organization first
      const { data: orgJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('organization_id', organization.id)
      
      const jobIds = orgJobs?.map(j => j.id) || []

      // Get usage data
      const [
        { count: jobsCount },
        recentAssociationsQuery,
        { count: membersCount },
        lastActivityQuery
      ] = await Promise.all([
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        
        // Get recent candidate associations for this org's jobs
        jobIds.length > 0 
          ? supabase
              .from('job_candidate_associations')
              .select('candidate_id')
              .in('job_id', jobIds)
              .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          : Promise.resolve({ data: [] }),
        
        supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('user_status', 'active'),
        
        supabase
          .from('members')
          .select('updated_at')
          .eq('organization_id', organization.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])
      
      // Count distinct candidate_ids
      const candidatesCount = new Set(
        (recentAssociationsQuery.data || []).map((a: any) => a.candidate_id)
      ).size

      // Get owner details if owner_id exists
      let ownerDetails = null
      if (organization.owner_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('user_id', organization.owner_id)
          .maybeSingle()
        
        ownerDetails = profile
      }

      return {
        ...organization,
        jobs_created_30d: jobsCount || 0,
        candidates_added_30d: candidatesCount || 0,
        members_active_count: membersCount || 0,
        last_active_at: lastActivityQuery.data?.updated_at || null,
        owner_details: ownerDetails
      }
    },
    enabled: !!customerId,
  })
}