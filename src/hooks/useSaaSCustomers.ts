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
      // Only fetch parent tenants (organizations without a parent)
      const { data: tenants, error } = await supabase
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
        .is('parent_organization_id', null) // Only parent tenants
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching SaaS tenants:', error)
        throw error
      }

      // Get usage data for each tenant (aggregated across all child workspaces)
      const customersWithUsage = await Promise.all(
        (tenants || []).map(async (tenant) => {
          try {
            // Get all child workspace IDs for this tenant
            const { data: childWorkspaces } = await supabase
              .from('organizations')
              .select('id')
              .eq('parent_organization_id', tenant.id)
            
            // Include the tenant itself plus all child workspaces
            const orgIds = [tenant.id, ...(childWorkspaces?.map(w => w.id) || [])]

            // Get all job IDs across all organizations in this tenant
            const { data: allJobs } = await supabase
              .from('jobs')
              .select('id')
              .in('organization_id', orgIds)
            
            const jobIds = allJobs?.map(j => j.id) || []

            // Get aggregated usage metrics in parallel
            const [
              { count: jobsCount },
              recentAssociationsQuery,
              { count: membersCount },
              lastActivity
            ] = await Promise.all([
              // Jobs created in last 30 days across all workspaces
              supabase
                .from('jobs')
                .select('*', { count: 'exact', head: true })
                .in('organization_id', orgIds)
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
              
              // Candidates added via associations in last 30 days across all workspaces
              jobIds.length > 0
                ? supabase
                    .from('job_candidate_associations')
                    .select('candidate_id')
                    .in('job_id', jobIds)
                    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                : Promise.resolve({ data: [] }),
              
              // Active members count across all workspaces
              supabase
                .from('members')
                .select('*', { count: 'exact', head: true })
                .in('organization_id', orgIds)
                .eq('user_status', 'active'),
              
              // Last activity timestamp across all workspaces
              supabase
                .from('members')
                .select('updated_at')
                .in('organization_id', orgIds)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            ])
            
            // Count distinct candidate_ids to avoid duplicates
            const candidatesCount = new Set(
              (recentAssociationsQuery.data || []).map((a: any) => a.candidate_id)
            ).size

            return {
              ...tenant,
              jobs_created_30d: jobsCount || 0,
              candidates_added_30d: candidatesCount,
              members_active_count: membersCount || 0,
              last_active_at: lastActivity?.data?.updated_at || null
            }
          } catch (error) {
            console.error('Error fetching usage data for tenant:', tenant.id, error)
            return {
              ...tenant,
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