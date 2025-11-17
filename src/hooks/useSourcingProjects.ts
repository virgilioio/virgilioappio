import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import type { SourcingProject } from '@/types/sourcing'

export function useSourcingProjects() {
  const { organizationId } = useAuth()
  
  return useQuery({
    queryKey: ['sourcing-projects', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        console.warn('No organization ID available for sourcing projects query')
        return []
      }

      // Fetch tenant_id for the organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', organizationId)
        .single()

      if (orgError || !orgData?.tenant_id) {
        console.error('Failed to fetch tenant_id:', orgError)
        return []
      }

      const tenantId = orgData.tenant_id

      // Fetch projects that belong to organizations in the same tenant
      const { data, error } = await supabase
        .from('sourcing_projects')
        .select(`
          *, 
          jobs(id, title, status, organization_id),
          organizations!inner(tenant_id)
        `)
        .eq('organizations.tenant_id', tenantId)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data as unknown as SourcingProject[]
    },
    enabled: !!organizationId
  })
}
