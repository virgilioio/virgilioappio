import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface SaaSTenant {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  organization_type: string
  tenant_type: string
  user_count: number
  last_activity: string | null
}

export function useSaaSTenants() {
  return useQuery({
    queryKey: ['saas-tenants'],
    queryFn: async (): Promise<SaaSTenant[]> => {
      // Get SaaS organizations (external customers)
      const { data: organizations, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          status,
          created_at,
          updated_at,
          organization_type,
          tenant_type
        `)
        .eq('tenant_type', 'saas')
        .eq('organization_type', 'client')
        .is('parent_organization_id', null)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching SaaS tenants:', error)
        throw error
      }

      // Get user counts for each organization
      const tenantsWithCounts = await Promise.all(
        (organizations || []).map(async (org) => {
          const { count: userCount } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('user_status', 'active')

          // Get last activity (most recent member update)
          const { data: lastActivity } = await supabase
            .from('members')
            .select('updated_at')
            .eq('organization_id', org.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single()

          return {
            ...org,
            user_count: userCount || 0,
            last_activity: lastActivity?.updated_at || null
          }
        })
      )

      return tenantsWithCounts
    },
  })
}