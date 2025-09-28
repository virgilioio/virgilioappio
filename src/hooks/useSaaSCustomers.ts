import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

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
            // Get jobs created in last 30 days
            const { count: jobsCount } = await supabase
              .from('jobs')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id)
              .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

            // Get candidates added in last 30 days
            const { count: candidatesCount } = await supabase
              .from('job_candidates')
              .select('*', { count: 'exact', head: true })
              .eq('job_id', org.id)
              .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

            // Get active members count
            const { count: membersCount } = await supabase
              .from('members')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id)
              .eq('user_status', 'active')

            // Get last activity
            const { data: lastActivity } = await supabase
              .from('members')
              .select('updated_at')
              .eq('organization_id', org.id)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            return {
              ...org,
              jobs_created_30d: jobsCount || 0,
              candidates_added_30d: candidatesCount || 0,
              members_active_count: membersCount || 0,
              last_active_at: lastActivity?.updated_at || null
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