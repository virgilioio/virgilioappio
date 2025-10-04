import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface SaaSCustomer {
  id: string
  name: string
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
  jobs_created_30d: number
  candidates_added_30d: number
  members_active_count: number
  last_active_at: string | null
}

export function useSaaSCustomers() {
  return useQuery({
    queryKey: ['saas-customers'],
    queryFn: async (): Promise<SaaSCustomer[]> => {
      const { data: organizations, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          plan_type,
          status,
          renewal_date,
          billing_id,
          owner_id,
          organization_type,
          tenant_type,
          signup_source,
          created_at,
          updated_at
        `)
        .eq('tenant_type', 'saas')
        .eq('organization_type', 'client')
        .eq('signup_source', 'self_serve')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching SaaS customers:', error)
        throw error
      }

      // Get usage data for each organization
      const customersWithUsage = await Promise.all(
        (organizations || []).map(async (org) => {
          try {
            // Get job IDs for this organization
            const { data: orgJobs } = await supabase
              .from('jobs')
              .select('id')
              .eq('organization_id', org.id)
            
            const jobIds = orgJobs?.map(j => j.id) || []

            // Get usage metrics in parallel
            const [
              { count: jobsCount },
              recentAssociationsQuery,
              { count: membersCount },
              lastActivity
            ] = await Promise.all([
              // Jobs created in last 30 days
              supabase
                .from('jobs')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
              
              // Candidates added via associations in last 30 days
              jobIds.length > 0
                ? supabase
                    .from('job_candidate_associations')
                    .select('candidate_id')
                    .in('job_id', jobIds)
                    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                : Promise.resolve({ data: [] }),
              
              // Active members count
              supabase
                .from('members')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .eq('user_status', 'active'),
              
              // Last activity timestamp
              supabase
                .from('members')
                .select('updated_at')
                .eq('organization_id', org.id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            ])
            
            // Count distinct candidate_ids to avoid duplicates
            const candidatesCount = new Set(
              (recentAssociationsQuery.data || []).map((a: any) => a.candidate_id)
            ).size

            return {
              ...org,
              jobs_created_30d: jobsCount || 0,
              candidates_added_30d: candidatesCount,
              members_active_count: membersCount || 0,
              last_active_at: lastActivity?.data?.updated_at || null
            }
          } catch (error) {
            console.error('Error fetching usage data for organization:', org.id, error)
            return {
              ...org,
              jobs_created_30d: 0,
              candidates_added_30d: 0,
              members_active_count: 0,
              last_active_at: null
            }
          }
        })
      )

      return customersWithUsage
    },
  })
}